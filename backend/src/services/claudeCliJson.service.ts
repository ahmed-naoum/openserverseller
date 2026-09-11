import { spawn } from 'node:child_process';
import { getSecret } from '../lib/secretStore.js';
import { resolveBin } from '../wa/cliProvider.js';

/**
 * `claude -p` with a JSON schema, as a function.
 *
 * Two ways to run it. Without `onEvent`, `--output-format json`: one envelope
 * at the end, the structured output inside. With `onEvent`, `stream-json`
 * with partial messages: the CLI prints one JSON line per API event, and the
 * caller sees the model's answer as it is written — the JSON of the spec
 * arriving token by token, and how many thinking tokens went by before it —
 * which is what a seller watches on the building screen.
 */

export type BrainEvent =
  | { type: 'model'; model: string }
  | { type: 'thinking'; tokens: number }
  | { type: 'delta'; text: string };

function parseLoose(payload: unknown): unknown {
  if (typeof payload !== 'string') return payload;
  try {
    return JSON.parse(payload);
  } catch {
    const fenced = payload.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) {
      try {
        return JSON.parse(fenced[1]);
      } catch {
        /* fall through */
      }
    }
    const brace = payload.indexOf('{');
    if (brace >= 0) {
      try {
        return JSON.parse(payload.slice(brace, payload.lastIndexOf('}') + 1));
      } catch {
        /* fall through */
      }
    }
    return null;
  }
}

/** One stream-json line → an event for the watcher, or nothing. */
function eventOf(line: any, onEvent: (e: BrainEvent) => void): void {
  if (line?.type === 'system' && line.subtype === 'thinking_tokens') {
    onEvent({ type: 'thinking', tokens: Number(line.estimated_tokens) || 0 });
    return;
  }
  if (line?.type !== 'stream_event') return;
  const ev = line.event;
  if (ev?.type === 'message_start' && ev.message?.model) onEvent({ type: 'model', model: String(ev.message.model) });
  else if (ev?.type === 'content_block_delta') {
    const d = ev.delta;
    if (d?.type === 'input_json_delta' && d.partial_json) onEvent({ type: 'delta', text: String(d.partial_json) });
    else if (d?.type === 'text_delta' && d.text) onEvent({ type: 'delta', text: String(d.text) });
    else if (d?.type === 'thinking_delta' && d.thinking) onEvent({ type: 'delta', text: String(d.thinking) });
  }
}

/** `claude -p` with a JSON schema: prefer schema-validated structured_output; tolerate older result envelopes. */
export async function runClaudeCliJson(input: {
  system: string;
  user: string;
  schema: Record<string, unknown>;
  modelId: string;
  timeoutMs: number;
  onEvent?: (e: BrainEvent) => void;
}): Promise<{ json: unknown; usage: { input: number; output: number } }> {
  const bin = resolveBin();
  if (!bin) throw new Error('Binaire Claude CLI introuvable sur le serveur.');
  const streaming = Boolean(input.onEvent);
  const args = [
    '-p',
    '--output-format', streaming ? 'stream-json' : 'json',
    ...(streaming ? ['--verbose', '--include-partial-messages'] : []),
    '--system-prompt', input.system,
    '--json-schema', JSON.stringify(input.schema),
    '--tools', '',
    '--model', input.modelId || 'sonnet',
    '--no-session-persistence',
    '--safe-mode',
  ];
  const token = getSecret('CLAUDE_CODE_OAUTH_TOKEN');
  const envelope = await new Promise<Record<string, any>>((resolve, reject) => {
    const child = spawn(bin, args, { shell: false, windowsHide: true, env: { ...process.env, ...(token ? { CLAUDE_CODE_OAUTH_TOKEN: token } : {}) } });
    let out = '';
    let err = '';
    let pending = '';
    let result: Record<string, any> | null = null;
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      try {
        child.kill('SIGKILL');
      } catch {
        /* ignore */
      }
      reject(new Error(`Délai d’attente dépassé pour Claude CLI (${Math.round(input.timeoutMs / 1000)}s).`));
    }, input.timeoutMs);
    const takeLine = (raw: string) => {
      const line = raw.trim();
      if (!line) return;
      let parsed: any;
      try {
        parsed = JSON.parse(line);
      } catch {
        return;
      }
      if (parsed?.type === 'result') result = parsed;
      else {
        try {
          eventOf(parsed, input.onEvent!);
        } catch {
          /* a watcher's error never breaks the run */
        }
      }
    };
    child.stdout.on('data', (d) => {
      const text = String(d);
      out += text;
      if (!streaming) return;
      pending += text;
      let nl: number;
      while ((nl = pending.indexOf('\n')) >= 0) {
        takeLine(pending.slice(0, nl));
        pending = pending.slice(nl + 1);
      }
    });
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
      if (streaming && pending.trim()) takeLine(pending);
      let parsed: any = result;
      if (!parsed) {
        try {
          parsed = JSON.parse(out);
        } catch {
          parsed = { result: out };
        }
      }
      if (code !== 0 || parsed?.is_error) return reject(new Error(String(parsed?.result || err || out || `Claude CLI (code ${code})`).slice(0, 400)));
      resolve(parsed);
    });
    child.stdin.on('error', (e) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      child.kill();
      reject(e);
    });
    child.stdin.end(input.user);
  });
  const usage = envelope?.usage ?? {};
  const json = parseLoose(envelope?.structured_output ?? envelope?.result);
  if (!json || typeof json !== 'object' || Array.isArray(json)) throw new Error('Claude CLI : réponse JSON structurée absente ou invalide.');
  return { json, usage: { input: Number(usage.input_tokens) || 0, output: Number(usage.output_tokens) || 0 } };
}
