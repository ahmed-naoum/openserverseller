/**
 * One agent turn: build the request, run the tool loop, return what the agent
 * decided. Ported from the standalone project's src/providers/api.js.
 *
 * THE OTHER ENGINE. The standalone project's `cli` provider — shelling out to
 * the `claude` binary against a personal subscription — is in wa/cliProvider.ts
 * and reachable from runTurn() below, but every model that uses it is marked
 * `adminOnly`. It is for testing and for numbers the platform itself runs; a
 * paying tenant can never select it, because one subscription token serving
 * many tenants shares a rate limit, a two-wide concurrency lane, and reports no
 * per-account cost to bill against. This file's API path is the tenant path.
 *
 * WHAT WAS DELIBERATELY NOT PORTED
 *
 *   `max_tokens: maxOutput + 2500`. That was manual headroom for thinking
 *   tokens under an older API. Thinking is adaptive now and the headroom is a
 *   named constant below, so the reason for the number is not lost.
 *
 * WHAT CHANGED FOR CORRECTNESS
 *
 *   The per-customer context block used to be pushed as a mid-conversation
 *   `{role:'system'}` message unconditionally, with a retry that folded it into
 *   the last user turn when the model rejected it. That is a real capability
 *   difference, not an error to recover from: Opus 5 accepts the role, Sonnet 5
 *   returns 400. It is now decided up front from AiModel.supportsMidSystem, so
 *   the common path never spends a failed round trip. Keeping it out of the
 *   user turn matters because the block carries the wall clock and changes
 *   every message — inside the cached prefix it would break the cache hit.
 *
 * NO TEMPERATURE. The standalone project never set one, and on the Claude 5
 * family sampling parameters are removed and return 400.
 */

import Anthropic from '@anthropic-ai/sdk';
import { getSecret } from '../lib/secretStore.js';
import { CLI_PROVIDER, runCliTurn } from './cliProvider.js';
import { waLog } from '../services/waLogs.service.js';

/** Room for adaptive thinking on top of the reply the account asked for. */
const THINKING_HEADROOM_TOKENS = 4000;

export interface BrainModel {
  /** 'anthropic' for the API, 'claude-cli' for the admin-only subscription engine. */
  provider: string;
  modelId: string;
  supportsEffort: boolean;
  supportsThinking: boolean;
  supportsMidSystem: boolean;
  supportsFallbacks: boolean;
  maxOutputTokens: number;
}

/**
 * Who this turn is for, so its model traffic lands on the right account in the
 * activity log. Optional: the CLI test harnesses call runTurn() with no
 * conversation behind them, and an untagged row is better than no row.
 */
export interface BrainLogContext {
  userId?: number | null;
  contactId?: number | null;
  contactJid?: string | null;
  contactName?: string | null;
  turnId?: number | null;
}

export interface BrainMessage {
  role: 'user' | 'assistant';
  content: string | Anthropic.ContentBlockParam[];
}

/** What the agent decided this turn. Applying it is the caller's job. */
export interface BrainIntents {
  /** Partial customer details, merged into the draft. */
  lead: Record<string, unknown> | null;
  /** Non-null when the agent confirmed the order; the read-back summary. */
  confirm: string | null;
  /** Non-null when the agent marked the chat rejected; the reason. */
  reject: string | null;
  /** Non-null when the agent escalated; the reason. */
  human: string | null;
  /** Products whose photos/video the customer asked to see. */
  media: { product: string; note: string }[];
}

export interface BrainResult {
  reply: string;
  intents: BrainIntents;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
  };
  stopReason: string | null;
  /** Set when a safety classifier declined and no fallback rescued the turn. */
  refusal: string | null;
}

/**
 * The five tools. Every one is optional-only except where a value is the whole
 * point of the call, because a required field the model cannot fill makes it
 * skip the call entirely and lose the data it did have.
 */
const TOOLS: Anthropic.Tool[] = [
  {
    name: 'save_lead',
    description:
      'Record customer details as soon as you learn them. Call repeatedly; partial data is expected and each call merges into what is already known.',
    input_schema: {
      type: 'object',
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
  {
    name: 'confirm_order',
    description:
      'Mark the order confirmed. Only after the customer has explicitly agreed to the order you read back to them.',
    input_schema: {
      type: 'object',
      properties: { summary: { type: 'string', description: 'The order as you read it back.' } },
      required: ['summary'],
    },
  },
  {
    name: 'mark_rejected',
    description:
      'The customer said no, it is a wrong number, or they are not the buyer.',
    input_schema: {
      type: 'object',
      properties: { reason: { type: 'string' } },
      required: ['reason'],
    },
  },
  {
    name: 'request_human',
    description:
      'Hand over to a teammate: they asked for a person, complained about an existing order, got angry, or asked something the knowledge base cannot answer.',
    input_schema: {
      type: 'object',
      properties: { reason: { type: 'string' } },
      required: ['reason'],
    },
  },
  {
    name: 'send_product_media',
    description:
      'Send the photos or video of a product. Only for products listed as having them.',
    input_schema: {
      type: 'object',
      properties: {
        product: { type: 'string', description: 'Exact product name from the catalogue.' },
        note: { type: 'string' },
      },
      required: ['product'],
    },
  },
];

let client: Anthropic | null = null;
let clientKey: string | null = null;

/**
 * One client per distinct key rather than a module singleton. The key lives in
 * the encrypted secret store and an admin can rotate it from the dashboard
 * without a restart; a singleton captured at import would keep using the old
 * one until the process died.
 */
function getClient(): Anthropic {
  const apiKey = getSecret('ANTHROPIC_API_KEY');
  if (!apiKey) {
    throw new Error(
      'Aucune clé Anthropic configurée. Renseignez ANTHROPIC_API_KEY dans Variables & Secrets.'
    );
  }
  if (!client || clientKey !== apiKey) {
    client = new Anthropic({ apiKey });
    clientKey = apiKey;
  }
  return client;
}

const emptyIntents = (): BrainIntents => ({
  lead: null,
  confirm: null,
  reject: null,
  human: null,
  media: [],
});

/**
 * Runs one turn.
 *
 * The loop is bounded at five iterations. The agent has no tool that fetches
 * anything, so it has no legitimate reason to need more, and an unbounded loop
 * on a per-customer-message path is how one stuck conversation drains a day's
 * budget.
 */
export async function runTurn(input: {
  systemPrompt: string;
  context: string;
  history: BrainMessage[];
  model: BrainModel;
  effort: string;
  maxOutputTokens: number;
  /** Folders the CLI engine may read, when the customer sent attachments. */
  readableDirs?: string[];
  /** Tags every row this turn writes to the activity log. */
  log?: BrainLogContext;
}): Promise<BrainResult> {
  const log = input.log || {};
  const startedAt = Date.now();
  // The CLI engine is a whole different mechanism — a spawned process reading a
  // text transcript and answering with one JSON object, rather than the
  // Messages API with native tools. It returns the same BrainResult, so nothing
  // downstream has to know which one ran.
  if (input.model.provider === CLI_PROVIDER) {
    try {
      const cli = await runCliTurn({
        systemPrompt: input.systemPrompt,
        context: input.context,
        history: input.history,
        modelId: input.model.modelId,
        effort: input.effort,
        readableDirs: input.readableDirs,
      });
      waLog({
        ...log,
        category: 'BRAIN',
        event: 'brain.answer',
        message: cli.reply ? `Réponse rédigée : « ${preview(cli.reply)} »` : 'Le modèle n’a rien écrit.',
        request: { engine: 'claude-cli', model: input.model.modelId, effort: input.effort, question: lastCustomerText(input.history) },
        response: { reply: cli.reply, intents: cli.intents, stopReason: cli.stopReason, refusal: cli.refusal },
        meta: { provider: CLI_PROVIDER, modelId: input.model.modelId },
        durationMs: Date.now() - startedAt,
        inputTokens: cli.usage.inputTokens,
        outputTokens: cli.usage.outputTokens,
      });
      return cli;
    } catch (err) {
      waLog({
        ...log,
        category: 'BRAIN',
        event: 'brain.error',
        message: 'Le moteur CLI n’a pas produit de réponse.',
        meta: { provider: CLI_PROVIDER, modelId: input.model.modelId },
        error: err,
        durationMs: Date.now() - startedAt,
      });
      throw err;
    }
  }

  const anthropic = getClient();
  const intents = emptyIntents();

  const usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };

  // The stable half: rendered on save, byte-identical between turns, and the
  // only block carrying cache_control.
  const system: Anthropic.TextBlockParam[] = [
    { type: 'text', text: input.systemPrompt, cache_control: { type: 'ephemeral' } },
  ];

  const messages: Anthropic.MessageParam[] = [...(input.history as Anthropic.MessageParam[])];

  if (input.model.supportsMidSystem) {
    // Appended after the last user turn, which is where the API requires it.
    messages.push({ role: 'system', content: input.context } as unknown as Anthropic.MessageParam);
  } else {
    foldContextIntoLastUserTurn(messages, input.context);
  }

  const maxTokens =
    Math.min(Math.max(64, input.maxOutputTokens), input.model.maxOutputTokens) +
    (input.model.supportsThinking ? THINKING_HEADROOM_TOKENS : 0);

  let reply = '';
  let stopReason: string | null = null;
  let refusal: string | null = null;

  for (let turn = 0; turn < 5; turn++) {
    const params: Record<string, unknown> = {
      model: input.model.modelId,
      max_tokens: maxTokens,
      system,
      messages,
      tools: TOOLS,
    };

    if (input.model.supportsThinking) params.thinking = { type: 'adaptive' };
    if (input.model.supportsEffort) params.output_config = { effort: input.effort };

    // Server-side refusal fallbacks. Without them a safety classifier declining
    // one customer message leaves the agent with nothing to send and the chat
    // simply goes quiet; with them the API re-runs the turn on a fallback model
    // inside the same call. Only Opus 5 / Fable 5 accept the parameter, so it is
    // gated on the capability flag and forces the beta endpoint.
    const useFallbacks = input.model.supportsFallbacks;
    if (useFallbacks) {
      params.betas = ['server-side-fallback-2026-07-01'];
      params.fallbacks = 'default';
    }

    // What was asked, before it is asked. Written at DEBUG because it is one
    // row per model round trip; the system prompt is deliberately summarised
    // rather than copied — it is byte-identical on every turn of an account and
    // already stored once in WhatsappAgent.compiledPrompt.
    waLog({
      ...log,
      level: 'DEBUG',
      category: 'BRAIN',
      event: 'brain.request',
      message: turn === 0 ? `Appel du modèle ${input.model.modelId}.` : `Relance du modèle après outils (tour ${turn + 1}).`,
      request: {
        model: input.model.modelId,
        maxTokens,
        effort: input.model.supportsEffort ? input.effort : null,
        thinking: input.model.supportsThinking,
        fallbacks: useFallbacks,
        systemPromptChars: input.systemPrompt.length,
        context: input.context,
        historyMessages: messages.length,
        customerMessage: lastCustomerText(messages as BrainMessage[]),
        tools: TOOLS.map((t) => t.name),
      },
      meta: { iteration: turn + 1, provider: input.model.provider, modelId: input.model.modelId },
    });

    const callStartedAt = Date.now();

    // Cast at the boundary: `fallbacks`, and the mid-conversation system role,
    // are newer than the installed SDK's types.
    let response: Anthropic.Message;
    try {
      response = useFallbacks
        ? await (anthropic.beta.messages.create as any)(params)
        : await (anthropic.messages.create as any)(params);
    } catch (err) {
      // The single most useful row in this whole table: an overloaded model, a
      // dead key, a 400 on a parameter the model does not accept. Without the
      // request beside it, the same error message could mean any of the three.
      waLog({
        ...log,
        category: 'BRAIN',
        event: 'brain.error',
        message: `Le modèle ${input.model.modelId} a refusé la requête.`,
        request: {
          model: input.model.modelId,
          maxTokens,
          effort: input.model.supportsEffort ? input.effort : null,
          fallbacks: useFallbacks,
          historyMessages: messages.length,
          customerMessage: lastCustomerText(messages as BrainMessage[]),
        },
        response: {
          status: (err as any)?.status ?? null,
          type: (err as any)?.error?.type ?? (err as any)?.name ?? null,
          body: (err as any)?.error ?? null,
        },
        meta: { iteration: turn + 1, provider: input.model.provider, modelId: input.model.modelId },
        error: err,
        durationMs: Date.now() - callStartedAt,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
      });
      throw err;
    }

    usage.inputTokens += response.usage?.input_tokens || 0;
    usage.outputTokens += response.usage?.output_tokens || 0;
    usage.cacheReadTokens += (response.usage as any)?.cache_read_input_tokens || 0;
    usage.cacheWriteTokens += (response.usage as any)?.cache_creation_input_tokens || 0;
    stopReason = response.stop_reason;

    if (response.stop_reason === 'refusal') {
      refusal = (response as any).stop_details?.explanation || 'Réponse refusée par le filtre de sécurité.';
      break;
    }

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    );

    // Text accumulates across iterations rather than being overwritten: the
    // model often writes the customer-facing line in the same block as its
    // tool calls, and taking only the final iteration would drop it.
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    if (text) reply = reply ? `${reply}\n${text}` : text;

    waLog({
      ...log,
      level: 'DEBUG',
      category: 'BRAIN',
      event: 'brain.response',
      message: toolUses.length
        ? `Le modèle a appelé ${toolUses.length} outil(s) : ${toolUses.map((t) => t.name).join(', ')}.`
        : `Le modèle a répondu (${text.length} caractères).`,
      response: {
        text,
        stopReason: response.stop_reason,
        toolCalls: toolUses.map((t) => ({ name: t.name, input: t.input })),
        usage: {
          inputTokens: response.usage?.input_tokens || 0,
          outputTokens: response.usage?.output_tokens || 0,
          cacheReadTokens: (response.usage as any)?.cache_read_input_tokens || 0,
          cacheWriteTokens: (response.usage as any)?.cache_creation_input_tokens || 0,
        },
      },
      meta: { iteration: turn + 1, modelId: input.model.modelId },
      durationMs: Date.now() - callStartedAt,
      inputTokens: response.usage?.input_tokens || 0,
      outputTokens: response.usage?.output_tokens || 0,
    });

    if (!toolUses.length) break;

    messages.push({ role: 'assistant', content: response.content });

    // All tool_results go back in ONE user message. Splitting them across
    // several silently teaches the model to stop calling tools in parallel.
    const results: Anthropic.ToolResultBlockParam[] = toolUses.map((call) =>
      applyToolCall(call, intents)
    );
    messages.push({ role: 'user', content: results });
  }

  const result: BrainResult = { reply: reply.trim(), intents, usage, stopReason, refusal };

  // The one row that is always written, whatever the log level: what the
  // customer asked, what the agent decided to answer, and what it cost. This is
  // the line a support conversation starts from.
  waLog({
    ...log,
    level: result.reply ? 'INFO' : 'WARN',
    category: 'BRAIN',
    event: 'brain.answer',
    message: result.reply
      ? `Réponse rédigée : « ${preview(result.reply)} »`
      : 'Le modèle n’a rien écrit à envoyer au client.',
    request: { customerMessage: lastCustomerText(input.history), context: input.context },
    response: {
      reply: result.reply,
      intents: result.intents,
      stopReason: result.stopReason,
      refusal: result.refusal,
      usage: result.usage,
    },
    meta: {
      modelId: input.model.modelId,
      provider: input.model.provider,
      effort: input.model.supportsEffort ? input.effort : null,
      // What the agent DID, flattened, so the list reads without opening rows.
      confirmed: !!result.intents.confirm,
      rejected: !!result.intents.reject,
      escalated: !!result.intents.human,
      savedFields: Object.keys(result.intents.lead || {}),
      mediaRequested: result.intents.media.map((m) => m.product),
    },
    durationMs: Date.now() - startedAt,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  });

  return result;
}

/** First line of a reply, for a log message that has to fit on one row. */
const preview = (text: string, max = 160): string => {
  const flat = String(text || '').replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
};

/**
 * The customer's last words, pulled out of whatever shape the history is in.
 *
 * Tool results are user-role messages too, so a naive "last user turn" would
 * log `[{type:'tool_result'…}]` as the question — which is exactly the row
 * someone would be reading to find out what the customer actually said.
 */
function lastCustomerText(history: BrainMessage[] | Anthropic.MessageParam[]): string | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const message = history[i] as BrainMessage;
    if (message.role !== 'user') continue;

    if (typeof message.content === 'string') return preview(message.content, 2000);

    const blocks = (message.content || []) as Anthropic.ContentBlockParam[];
    if (blocks.some((b: any) => b?.type === 'tool_result')) continue;

    const text = blocks
      .filter((b: any) => b?.type === 'text')
      .map((b: any) => b.text)
      .join(' ')
      .trim();
    const media = blocks.filter((b: any) => b?.type === 'image' || b?.type === 'document').length;

    if (text) return preview(media ? `${text} [+${media} pièce(s) jointe(s)]` : text, 2000);
    if (media) return `[${media} pièce(s) jointe(s), sans texte]`;
  }
  return null;
}

/**
 * Records what a tool call asked for and returns the result block.
 *
 * Nothing here touches the database. The turn runner applies the intents once,
 * after the loop, so a turn that later fails cannot leave a half-applied
 * confirmation behind.
 */
function applyToolCall(call: Anthropic.ToolUseBlock, intents: BrainIntents): Anthropic.ToolResultBlockParam {
  const input = (call.input || {}) as Record<string, any>;
  let content = 'ok';

  switch (call.name) {
    case 'save_lead':
      intents.lead = { ...(intents.lead || {}), ...input };
      content = 'Saved. Keep going — do not thank the customer for information they did not just give you.';
      break;

    case 'confirm_order':
      intents.confirm = String(input.summary || '').trim() || 'Commande confirmée.';
      content = 'Order marked confirmed.';
      break;

    case 'mark_rejected':
      intents.reject = String(input.reason || '').trim() || 'Refusé.';
      content = 'Marked rejected.';
      break;

    case 'request_human':
      intents.human = String(input.reason || '').trim() || 'Escalade demandée.';
      content = 'A teammate has been notified. Stop selling and keep your reply short.';
      break;

    case 'send_product_media':
      intents.media.push({
        product: String(input.product || '').trim(),
        note: String(input.note || '').trim(),
      });
      content = 'The files are being sent to the customer now.';
      break;

    default:
      content = `Unknown tool "${call.name}".`;
  }

  return { type: 'tool_result', tool_use_id: call.id, content };
}

/**
 * Fallback for models that reject a mid-conversation system role: prepend the
 * context to the last user turn.
 *
 * It is marked as internal in the same words the system-message path uses, so
 * the model treats it as operator context rather than as something the customer
 * typed — a customer message that quotes the block back is otherwise
 * indistinguishable from the real thing.
 */
function foldContextIntoLastUserTurn(messages: Anthropic.MessageParam[], context: string): void {
  const marked = `${context}\n\n[End of internal context. The customer's actual message follows.]\n\n`;

  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== 'user') continue;

    if (typeof m.content === 'string') {
      messages[i] = { role: 'user', content: `${marked}${m.content}` };
    } else {
      messages[i] = {
        role: 'user',
        content: [{ type: 'text', text: marked }, ...(m.content as Anthropic.ContentBlockParam[])],
      };
    }
    return;
  }

  // No user turn at all (an agent-initiated follow-up). The context becomes the
  // turn, because the API requires the conversation to end on one.
  messages.push({ role: 'user', content: marked });
}

/**
 * The volatile per-customer block.
 *
 * Everything here changes between messages — the collected fields, the lead
 * status, the wall clock — which is exactly why it is kept out of the cached
 * system prompt.
 */
export function buildContext(input: {
  phone: string | null;
  pushName: string | null;
  source: string;
  adHeadline?: string | null;
  adBody?: string | null;
  adSourceUrl?: string | null;
  draft: Record<string, unknown> | null;
  status: string;
  timezone: string;
  /**
   * Whether this reply will be spoken aloud, and under what rule.
   *
   * The model has no other way to know. Synthesis happens AFTER it writes, so
   * from its point of view it is a text-only agent — and it says so: asked "can
   * you send a voice note?" it answered "sorry, I can only write here", and
   * that answer was then delivered as an eleven-second voice note.
   */
  voice?: { enabled: boolean; mode: string; willSpeak: boolean; maxChars?: number } | null;
}): string {
  const lines: string[] = [];

  lines.push(
    input.phone
      ? `Customer WhatsApp number: ${input.phone}`
      : 'Customer phone number: NOT AVAILABLE — you must ask them for it before confirming.'
  );
  if (input.pushName) lines.push(`Their WhatsApp display name: ${input.pushName}`);

  if (input.source === 'AD') {
    lines.push('They arrived by clicking a Meta ad, so they already saw this:');
    if (input.adHeadline) lines.push(`  Ad headline: ${input.adHeadline}`);
    if (input.adBody) lines.push(`  Ad copy: ${input.adBody}`);
    if (input.adSourceUrl) lines.push(`  Ad link: ${input.adSourceUrl}`);
  } else {
    lines.push('They messaged organically, not from an ad.');
  }

  const known = Object.entries(input.draft || {})
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
    .map(([k, v]) => `  ${k}=${v}`);

  if (known.length) {
    lines.push('Already collected — do not ask for these again:');
    lines.push(...known);
  }

  if (input.voice?.enabled) {
    lines.push('');
    lines.push('*** YOU HAVE A VOICE ***');
    lines.push(
      input.voice.willSpeak
        ? 'This reply WILL be sent to the customer as a WhatsApp voice note, spoken aloud in your own voice.'
        : 'Your replies can be sent as WhatsApp voice notes, spoken aloud in your own voice.'
    );
    lines.push(
      input.voice.mode === 'always'
        ? 'Every reply you write is spoken.'
        : 'You speak when the customer sends you a voice note, or when they ask you to.'
    );
    // The failure this exists to stop, stated as a rule rather than left to be
    // inferred: the model cannot observe its own audio and will otherwise deny
    // having it.
    lines.push('NEVER tell a customer you cannot send or record audio — you can, and you do.');
    lines.push('When you are being spoken, write the way a person talks: no markdown, no bullet lists, few or no emoji.');

    // THE LENGTH BUDGET HAS TO REACH THE MODEL.
    //
    // Voice used to be dropped for being too long, after the fact and without
    // telling anyone: the reply was synthesised only if it came in under
    // ttsMaxChars, and otherwise went out as text. The model was never told the
    // limit existed, so it had no way to write to it — it just kept producing
    // 400-character answers that were silently converted into walls of text.
    //
    // Customer 212637547479 is what that costs. He could not read, said so, and
    // asked for audio again and again; three consecutive answers came in at
    // 415, 312 and 320 characters against a 300 cap, and every one of them
    // reached him as written Darija. Two of those answers open by telling him,
    // in text, that they are being spoken to him.
    //
    // So the budget is a writing instruction now, given before the fact, rather
    // than a filter applied after it.
    if (input.voice.willSpeak && input.voice.maxChars) {
      lines.push(
        `Keep this reply under ${input.voice.maxChars} characters. It is being spoken aloud, and a voice note longer than that is one nobody listens to. Say the single most useful thing and stop; you can always continue in the next message.`
      );
    }
  }

  if (input.status === 'CONFIRMED') {
    lines.push('');
    lines.push('*** THIS ORDER IS ALREADY CONFIRMED — YOU ARE NOW IN AFTER-SALE MODE ***');
    lines.push('Do not sell, do not re-confirm, do not read the order back again.');
    lines.push('- If they want to cancel: acknowledge it and call request_human.');
    lines.push('- If they want to change the address, quantity or variant: call save_lead with the change, then call request_human.');
    lines.push('- If they ask where their order is: give the delivery information from the knowledge base and nothing more.');
    lines.push('- Anything else: answer briefly, or escalate.');
  }

  const now = new Date().toLocaleString('fr-MA', { timeZone: input.timezone || 'Africa/Casablanca' });

  return `[Internal context — not from the customer, never quote it]\n${lines
    .filter(Boolean)
    .join('\n')}\nCurrent time: ${now}`;
}
