/**
 * The Claude CLI brain — ADMIN-ONLY.
 *
 * Ported from the standalone project's src/providers/cli.js. It spawns the real
 * `claude` binary per turn and bills a Claude SUBSCRIPTION rather than the
 * platform's API key, which makes it free to run and is why it is here at all:
 * testing the agent end to end without spending anything, and running numbers
 * the platform itself owns.
 *
 * WHY EVERY MODEL USING IT CARRIES `adminOnly`, and why that is not negotiable:
 *
 *   ONE TOKEN IS ONE PERSON'S SUBSCRIPTION. Pointing paying tenants at it means
 *   every vendor's customer conversations bill against a single human account,
 *   share its rate limit, and stop together the moment that account is limited.
 *
 *   CONCURRENCY IS PLATFORM-WIDE. The semaphore below is per PROCESS, not per
 *   account — the default of 2 is two replies in flight across every tenant on
 *   this worker, not two each.
 *
 *   THERE ARE NO COSTS TO ATTRIBUTE. A subscription turn reports no billable
 *   tokens, so `WhatsappAgentUsage.costCents` stays zero and the admin's
 *   cost-versus-billed view has nothing behind it. Accounts are still charged
 *   the flat per-reply tariff; the platform just cannot see what it really cost.
 *
 * The API provider in brain.ts remains the path for real tenants.
 */

import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getSecret, getSecretNumber } from '../lib/secretStore.js';
import type { BrainMessage, BrainResult, BrainIntents } from './brain.js';

export const CLI_PROVIDER = 'claude-cli';

const IS_WIN = process.platform === 'win32';
const EXE = IS_WIN ? 'claude.exe' : 'claude';
const PKG_BIN = ['node_modules', '@anthropic-ai', 'claude-code', 'bin', EXE];

const isFile = (p: string): boolean => {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
};

/** `where` / `which` without a shell — both are real executables. */
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

/**
 * Can this path be handed straight to spawn(shell:false)?
 *
 * On Windows the answer is "only a .exe". `where claude` returns THREE things
 * from an npm global install — `claude` (an extensionless bash script),
 * `claude.cmd` and `claude.ps1` — and none of them is executable without a
 * shell. Rejecting only the dotted shims lets the extensionless one through,
 * and it fails at spawn time with a bare ENOENT that looks like the CLI is not
 * installed at all.
 *
 * A shell is not an option regardless of the file: it would split the JSON we
 * pass in --json-schema and --system-prompt on whitespace.
 */
const isSpawnable = (p: string): boolean =>
  IS_WIN ? /\.exe$/i.test(p) : !/\.(cmd|ps1|bat)$/i.test(p);

/** From any shim, walk to the real binary the npm package installed. */
function realBinaryNear(shimPath: string): string | null {
  const dir = path.dirname(shimPath);
  return [path.join(dir, ...PKG_BIN), path.join(dir, EXE)].find(isFile) || null;
}

let cachedBin: string | null = null;
let cachedFor: string | null = null;

export function resolveBin(): string | null {
  const configured = getSecret('CLAUDE_CLI_PATH') || '';
  const key = configured || '_default';
  if (cachedBin && cachedFor === key) return cachedBin;

  const candidates: string[] = [];
  if (configured) {
    candidates.push(configured);
    // The admin may have pointed at a shim; recover the real binary beside it.
    const near = realBinaryNear(configured);
    if (near) candidates.push(near);
  }

  for (const hit of whichAll('claude')) {
    // Anything not directly spawnable is treated as a shim and we look for the
    // real binary beside it. On Windows that covers the extensionless script
    // too, which is the one `where` lists first.
    if (!isSpawnable(hit)) {
      const near = realBinaryNear(hit);
      if (near) candidates.push(near);
      continue;
    }
    candidates.push(hit);
  }

  const home = os.homedir();
  candidates.push(
    path.join(home, '.claude', 'local', EXE),
    path.join(home, 'AppData', 'Roaming', 'npm', ...PKG_BIN),
    path.join('/usr', 'local', 'lib', ...PKG_BIN),
    path.join('/usr', 'lib', ...PKG_BIN)
  );

  const found = candidates.find((c) => c && isSpawnable(c) && isFile(c)) || null;
  cachedBin = found;
  cachedFor = key;
  return found;
}

export const CLI_NOT_FOUND =
  'Binaire `claude` introuvable. Installez-le avec `npm install -g @anthropic-ai/claude-code`, ' +
  'ou renseignez CLAUDE_CLI_PATH dans Variables & Secrets (sous Windows ce doit être claude.exe, pas claude.cmd).';

/**
 * The structured contract. The CLI has no native tool calling here, so the
 * whole decision comes back as one JSON object.
 */
const REPLY_SCHEMA = {
  type: 'object',
  properties: {
    reply: {
      type: 'string',
      description: 'The exact WhatsApp message to send the customer. Never contains JSON or field names.',
    },
    action: {
      type: 'string',
      enum: ['none', 'confirm', 'reject', 'human'],
      description:
        'confirm = customer explicitly agreed to the order you read back. reject = clear no / wrong number. human = needs a teammate. Otherwise none.',
    },
    reason: { type: 'string', description: 'Short internal note for confirm/reject/human. Not shown to the customer.' },
    send_media: {
      type: 'string',
      description:
        'Exact product name whose photos/video to send, when the customer asks to see the item. Empty string to send nothing.',
    },
    lead: {
      type: 'object',
      description: 'Every customer detail known so far. Include a field only when you actually know it.',
      properties: {
        full_name: { type: 'string' },
        phone: { type: 'string' },
        city: { type: 'string' },
        address: { type: 'string' },
        product: { type: 'string' },
        variant: { type: 'string' },
        quantity: { type: 'integer' },
        price: { type: 'number' },
        notes: { type: 'string' },
      },
    },
  },
  required: ['reply'],
};

/* ------------------------------------------------------------------ */
/* concurrency                                                         */
/* ------------------------------------------------------------------ */

let active = 0;
const waiting: (() => void)[] = [];

/**
 * PER PROCESS, not per account. Each turn is a real OS process, and Windows in
 * particular starts refusing new ones under load (0xC0000142), so this is a
 * hard gate rather than a nicety.
 */
function acquire(max: number): Promise<void> {
  if (active < max) {
    active++;
    return Promise.resolve();
  }
  return new Promise((resolve) => waiting.push(resolve));
}

function release(): void {
  const next = waiting.shift();
  if (next) return next();
  active = Math.max(0, active - 1);
}

/* ------------------------------------------------------------------ */

/** Renders the conversation as the plain transcript the CLI reads on stdin. */
function buildTranscript(history: BrainMessage[], context: string): string {
  const lines: string[] = [context, ''];

  for (const m of history) {
    const who = m.role === 'user' ? 'Customer' : 'You';
    if (typeof m.content === 'string') {
      lines.push(`${who}: ${m.content}`);
      continue;
    }
    // Image blocks are inlined base64 for the API provider; the CLI cannot take
    // those on stdin, so they are named instead. Attachments are handed over as
    // readable paths by the caller when it has them.
    const text = m.content
      .map((b) => (b.type === 'text' ? b.text : b.type === 'image' ? '[image attached]' : ''))
      .filter(Boolean)
      .join(' ');
    lines.push(`${who}: ${text}`);
  }

  lines.push('', 'Reply now as the agent, following your instructions and the required JSON schema.');
  return lines.join('\n');
}

/** Tolerates a fenced block, surrounding prose, or a plain message. */
function parsePayload(raw: unknown): Record<string, any> | null {
  if (raw && typeof raw === 'object') return raw as Record<string, any>;
  const text = String(raw ?? '').trim();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    /* fall through */
  }

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      /* fall through */
    }
  }

  const braced = text.match(/\{[\s\S]*\}/);
  if (braced) {
    try {
      return JSON.parse(braced[0]);
    } catch {
      /* fall through */
    }
  }

  // Last resort: the model wrote a plain message. Still usable as a reply.
  return { reply: text, action: 'none' };
}

/**
 * One turn through the CLI. Returns the same shape as the API provider so the
 * turn runner does not care which engine produced it.
 */
export async function runCliTurn(input: {
  systemPrompt: string;
  context: string;
  history: BrainMessage[];
  modelId: string;
  effort: string;
  /** Directories the model may read, when the customer sent attachments. */
  readableDirs?: string[];
}): Promise<BrainResult> {
  const bin = resolveBin();
  if (!bin) throw new Error(CLI_NOT_FOUND);

  const workspace = path.join(getSecret('WA_MEDIA_ROOT') || process.cwd(), '_cli-workspace');
  fs.mkdirSync(workspace, { recursive: true });

  const dirs = [...new Set(input.readableDirs || [])].filter((d) => d && fs.existsSync(d));

  const args = [
    '-p',
    '--output-format', 'json',
    '--system-prompt', input.systemPrompt,
    '--json-schema', JSON.stringify(REPLY_SCHEMA),
    // No tools at all normally. Read is granted only when there is an image to
    // look at, and scoped to the folders those files are in.
    '--tools', dirs.length ? 'Read' : '',
    '--model', input.modelId || 'sonnet',
    '--effort', input.effort || 'low',
    '--no-session-persistence',
    '--safe-mode',
  ];

  for (const d of dirs) args.push('--add-dir', d);
  if (dirs.length) args.push('--permission-mode', 'dontAsk');

  const stdin = buildTranscript(input.history, input.context);
  const timeoutMs = getSecretNumber('WA_CLI_TIMEOUT_MS', 120_000);
  const token = getSecret('CLAUDE_CODE_OAUTH_TOKEN');

  await acquire(getSecretNumber('WA_CLI_MAX_CONCURRENT', 2));

  try {
    const envelope = await new Promise<Record<string, any>>((resolve, reject) => {
      // shell:false is MANDATORY — a shell would split the JSON schema and the
      // system prompt on whitespace and the CLI would reject both.
      const child = spawn(bin, args, {
        cwd: workspace,
        shell: false,
        windowsHide: true,
        env: {
          ...process.env,
          // A configured token wins; with neither, the CLI falls back to its own
          // stored login from `claude /login`.
          ...(token ? { CLAUDE_CODE_OAUTH_TOKEN: token } : {}),
        },
      });

      let out = '';
      let errText = '';
      let done = false;

      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        try {
          child.kill('SIGKILL');
        } catch {
          /* already gone */
        }
        reject(new Error(`Claude CLI: délai de ${Math.round(timeoutMs / 1000)}s dépassé.`));
      }, timeoutMs);

      child.stdout.on('data', (d) => (out += d));
      child.stderr.on('data', (d) => (errText += d));

      child.on('error', (err) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        reject(new Error(`Claude CLI: ${err.message}`));
      });

      child.on('close', (code) => {
        if (done) return;
        done = true;
        clearTimeout(timer);

        if (code !== 0) {
          const text = (errText || out).trim();
          if (/not logged in|authentication|oauth/i.test(text)) {
            return reject(
              new Error(
                'Claude CLI non authentifié. Lancez `claude setup-token` et renseignez ' +
                  'CLAUDE_CODE_OAUTH_TOKEN dans Variables & Secrets.'
              )
            );
          }
          return reject(new Error(`Claude CLI (code ${code}): ${text.slice(0, 300)}`));
        }

        try {
          resolve(JSON.parse(out));
        } catch {
          // Not the JSON envelope; hand the raw text to the payload parser.
          resolve({ result: out });
        }
      });

      child.stdin.end(stdin);
    });

    const payload = parsePayload(envelope.result ?? envelope) || {};

    const intents: BrainIntents = {
      lead: payload.lead && typeof payload.lead === 'object' ? payload.lead : null,
      confirm: payload.action === 'confirm' ? String(payload.reason || 'Commande confirmée.') : null,
      reject: payload.action === 'reject' ? String(payload.reason || 'Refusé.') : null,
      human: payload.action === 'human' ? String(payload.reason || 'Escalade demandée.') : null,
      media: payload.send_media
        ? [{ product: String(payload.send_media).trim(), note: '' }]
        : [],
    };

    // A subscription turn has no billable tokens. Reported honestly as zero
    // rather than invented, so the admin's cost view shows "no cost data"
    // instead of a plausible fiction.
    const usage = envelope.usage || {};

    return {
      reply: String(payload.reply || '').trim(),
      intents,
      usage: {
        inputTokens: Number(usage.input_tokens) || 0,
        outputTokens: Number(usage.output_tokens) || 0,
        cacheReadTokens: Number(usage.cache_read_input_tokens) || 0,
        cacheWriteTokens: Number(usage.cache_creation_input_tokens) || 0,
      },
      stopReason: 'end_turn',
      refusal: null,
    };
  } finally {
    release();
  }
}
