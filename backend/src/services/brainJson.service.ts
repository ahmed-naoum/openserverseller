import Anthropic from '@anthropic-ai/sdk';
import { getSecret } from '../lib/secretStore.js';
import { runClaudeCliJson, type BrainEvent } from './claudeCliJson.service.js';
import { openaiChatJson } from './openai.service.js';
import { getBuilderSettings, resolveBuilderModel, resolveGptModel, type BuilderProvider, type BuilderSettings } from './designBrain.service.js';

/**
 * One question, one JSON answer, whichever brain the admin configured.
 *
 * The store builder and the store agent both work the same way: a system
 * prompt, a user message, a JSON schema for the answer. This is the single
 * place that knows how to get that answer from each provider —
 *   · Anthropic API: a forced tool call whose input is the schema,
 *   · Claude CLI: `claude -p --json-schema`, spawned without a shell,
 *   · OpenAI: chat completions with a JSON-schema response format.
 * Callers sanitise what comes back; nothing here trusts the model.
 */

export interface AskJsonInput {
  provider: BuilderProvider;
  system: string;
  user: string;
  schema: Record<string, unknown>;
  schemaName: string;
  maxOutputTokens: number;
  timeoutMs?: number;
  settings?: BuilderSettings;
  /** The answer as it is written (and the model's name once known), for a live screen. */
  onEvent?: (e: BrainEvent) => void;
}

export interface AskJsonResult {
  json: unknown;
  /** Human label of the model that answered, e.g. "Claude CLI (sonnet)". */
  model: string;
  usage: { input: number; output: number };
}

let anthropic: Anthropic | null = null;
let anthropicKey = '';
function anthropicClient(): Anthropic {
  const apiKey = getSecret('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('Aucune clé Anthropic configurée (ANTHROPIC_API_KEY dans Variables & Secrets).');
  if (!anthropic || anthropicKey !== apiKey) {
    anthropic = new Anthropic({ apiKey });
    anthropicKey = apiKey;
  }
  return anthropic;
}

/** The same request, streamed: the tool input's JSON and thinking as they arrive, then the final message. */
export async function streamAnthropic(client: Anthropic, params: Record<string, unknown>, timeoutMs: number, onEvent: (e: BrainEvent) => void): Promise<Anthropic.Message> {
  const stream = (client.messages.stream as any)(params, { timeout: timeoutMs });
  let thinking = 0;
  for await (const ev of stream as AsyncIterable<any>) {
    if (ev?.type === 'message_start' && ev.message?.model) onEvent({ type: 'model', model: String(ev.message.model) });
    else if (ev?.type === 'content_block_delta') {
      const d = ev.delta;
      if (d?.type === 'input_json_delta' && d.partial_json) onEvent({ type: 'delta', text: String(d.partial_json) });
      else if (d?.type === 'thinking_delta') {
        thinking += String(d.thinking ?? '').length / 4 || 8;
        onEvent({ type: 'thinking', tokens: Math.round(thinking) });
      }
    }
  }
  return (await stream.finalMessage()) as Anthropic.Message;
}

export async function askJson(input: AskJsonInput): Promise<AskJsonResult> {
  const settings = input.settings ?? (await getBuilderSettings());
  const timeoutMs = input.timeoutMs ?? 180_000;

  if (input.provider === 'openai') {
    const gpt = await resolveGptModel(settings);
    const r = await openaiChatJson({
      model: gpt.modelId,
      system: `${input.system}\n\nAnswer with one JSON object only, matching the ${input.schemaName} schema.`,
      user: input.user,
      schema: input.schema,
      schemaName: input.schemaName,
      maxOutputTokens: gpt.maxOutputTokens ? Math.min(input.maxOutputTokens, gpt.maxOutputTokens) : input.maxOutputTokens,
      timeoutMs,
      onDelta: input.onEvent ? (t) => input.onEvent!({ type: 'delta', text: t }) : undefined,
    });
    input.onEvent?.({ type: 'model', model: gpt.modelId });
    return { json: r.json, model: `GPT (${gpt.modelId})`, usage: r.usage };
  }

  const model = await resolveBuilderModel(settings);
  if (!model) throw new Error('Aucun modèle Claude activé pour le constructeur.');
  if (model.provider === 'claude-cli') {
    const r = await runClaudeCliJson({ system: input.system, user: input.user, schema: input.schema, modelId: model.modelId, timeoutMs, onEvent: input.onEvent });
    return { json: r.json, model: `Claude CLI (${model.modelId})`, usage: r.usage };
  }

  const client = anthropicClient();
  const tool: Anthropic.Tool = { name: input.schemaName, description: 'Your answer.', input_schema: input.schema as unknown as Anthropic.Tool['input_schema'] };
  const params: Record<string, unknown> = {
    model: model.modelId,
    max_tokens: Math.min(input.maxOutputTokens, model.maxOutputTokens || input.maxOutputTokens),
    system: input.system,
    tools: [tool],
    tool_choice: { type: 'tool', name: input.schemaName },
    messages: [{ role: 'user', content: input.user }],
  };
  if (model.supportsEffort) params.output_config = { effort: 'medium' };
  const response = input.onEvent ? await streamAnthropic(client, params, timeoutMs, input.onEvent) : ((await (client.messages.create as any)(params, { timeout: timeoutMs })) as Anthropic.Message);
  const use = response.content.find((c) => c.type === 'tool_use') as Anthropic.ToolUseBlock | undefined;
  const usage = (response as any).usage ?? {};
  return { json: use?.input ?? null, model: model.modelId, usage: { input: Number(usage.input_tokens) || 0, output: Number(usage.output_tokens) || 0 } };
}
