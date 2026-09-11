import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getSecret } from '../lib/secretStore.js';

/**
 * OpenAI's Codex CLI as an image engine.
 *
 * Codex runs on a ChatGPT login, not on API credits, and its agent has an
 * image-generation tool. Asked in one `codex exec` to draw a picture and save
 * it into a scratch folder, it does exactly that in about two minutes and
 * answers with the path. The platform pays nothing per image beyond the
 * subscription's usage caps — which is why the admin can put it first in the
 * engine order (IMAGE_ENGINE_ORDER), ahead of the paid gpt-image API.
 *
 * Spawned without a shell, like the Claude CLI: on Windows the npm shim
 * (`codex.cmd`) is not executable by spawn, so the real binary is found under
 * the platform package the shim resolves to. The prompt goes on stdin (`-`),
 * so no quoting is involved.
 */

const IS_WIN = process.platform === 'win32';

const isFile = (p: string): boolean => {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
};

function whichAll(cmd: string): string[] {
  try {
    return execFileSync(IS_WIN ? 'where' : 'which', [cmd], { encoding: 'utf8', timeout: 10_000 })
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** From the npm shim's folder, the native binary of the installed platform package. */
function nativeNear(shimPath: string): string | null {
  const pkg = path.join(path.dirname(shimPath), 'node_modules', '@openai', 'codex', 'node_modules', '@openai');
  let entries: string[] = [];
  try {
    entries = fs.readdirSync(pkg).filter((d) => d.startsWith('codex-'));
  } catch {
    return null;
  }
  for (const entry of entries) {
    const vendor = path.join(pkg, entry, 'vendor');
    let triples: string[] = [];
    try {
      triples = fs.readdirSync(vendor);
    } catch {
      continue;
    }
    for (const triple of triples) {
      const bin = path.join(vendor, triple, 'bin', IS_WIN ? 'codex.exe' : 'codex');
      if (isFile(bin)) return bin;
    }
  }
  return null;
}

let cachedBin: string | null | undefined;
let cachedFor = '';

/** The Codex binary the server can spawn, or null when Codex is not installed. */
export function resolveCodexBin(): string | null {
  const configured = (getSecret('CODEX_CLI_PATH') || '').trim();
  const key = configured || '_default';
  if (cachedBin !== undefined && cachedFor === key) return cachedBin;
  const candidates: string[] = [];
  if (configured) {
    candidates.push(configured);
    const near = nativeNear(configured);
    if (near) candidates.push(near);
  }
  for (const hit of whichAll('codex')) {
    if (IS_WIN) {
      const near = nativeNear(hit);
      if (near) candidates.push(near);
      if (/\.exe$/i.test(hit)) candidates.push(hit);
    } else candidates.push(hit);
  }
  if (IS_WIN) {
    const near = nativeNear(path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'codex.cmd'));
    if (near) candidates.push(near);
  }
  const found = candidates.find((c) => c && isFile(c) && (!IS_WIN || /\.exe$/i.test(c))) || null;
  cachedBin = found;
  cachedFor = key;
  return found;
}

export function codexAvailable(): boolean {
  return Boolean(resolveCodexBin());
}

/**
 * One picture from Codex: the agent draws it with its image tool and saves it
 * at `outFile` inside `workDir` (the only place the sandbox lets it write).
 * Resolves with the file's bytes; rejects with Codex's last words otherwise.
 */
export async function codexGenerateImage(input: { prompt: string; sizeHint: string; workDir: string; outFile: string; timeoutMs?: number }): Promise<Buffer> {
  const bin = resolveCodexBin();
  if (!bin) throw new Error('Codex CLI introuvable sur le serveur.');
  const model = (getSecret('CODEX_IMAGE_MODEL') || '').trim();
  fs.mkdirSync(input.workDir, { recursive: true });
  const args = ['exec', '--ephemeral', '--skip-git-repo-check', '-s', 'workspace-write', '-C', input.workDir, '--color', 'never', ...(model ? ['-m', model] : []), '-'];
  const instruction =
    `Use your image generation tool to create ONE photorealistic image, ${input.sizeHint}: ${input.prompt}\n` +
    `Save the resulting image file as exactly: ${input.outFile}\n` +
    `Do not create, edit or delete anything else. When the file is saved, reply with only its absolute path.`;
  const timeoutMs = input.timeoutMs ?? 300_000;
  await new Promise<void>((resolve, reject) => {
    const child = spawn(bin, args, { shell: false, windowsHide: true, cwd: input.workDir, env: { ...process.env } });
    let out = '';
    let err = '';
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      try {
        child.kill('SIGKILL');
      } catch {
        /* ignore */
      }
      reject(new Error(`Codex CLI : délai dépassé (${Math.round(timeoutMs / 1000)}s).`));
    }, timeoutMs);
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      reject(e);
    });
    child.on('close', (code) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`Codex CLI (code ${code}) : ${(err || out).trim().split(/\r?\n/).slice(-3).join(' ').slice(0, 300)}`));
      resolve();
    });
    child.stdin.on('error', () => {
      /* Codex may close stdin early once it has the prompt; not an error. */
    });
    child.stdin.end(instruction);
  });
  if (!isFile(input.outFile)) {
    // The agent sometimes saves under a slightly different name in the folder; take the newest image there.
    const alt = fs
      .readdirSync(input.workDir)
      .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
      .map((f) => path.join(input.workDir, f))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
    if (!alt) throw new Error('Codex CLI n’a enregistré aucune image.');
    return fs.readFileSync(alt);
  }
  return fs.readFileSync(input.outFile);
}
