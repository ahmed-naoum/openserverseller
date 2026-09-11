import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  spawn: vi.fn(), bin: vi.fn(), secret: vi.fn(), findSettings: vi.fn(), saveSettings: vi.fn(),
  findModel: vi.fn(), resolveModel: vi.fn(),
}));
vi.mock('node:child_process', () => ({ spawn: mocks.spawn }));
vi.mock('../src/wa/cliProvider.js', () => ({ resolveBin: mocks.bin }));
vi.mock('../src/lib/secretStore.js', () => ({ getSecret: mocks.secret }));
vi.mock('../src/lib/prisma.js', () => ({ prisma: {
  platformSettings: { findUnique: mocks.findSettings, upsert: mocks.saveSettings },
  aiModel: { findFirst: mocks.findModel },
} }));
vi.mock('../src/wa/catalogue.js', () => ({ resolveModel: mocks.resolveModel }));
vi.mock('../src/services/openai.service.js', () => ({
  openaiConfigured: () => false, openaiStatus: () => ({ configured: false, imageModel: 'test-image' }),
  openaiBuilderModel: () => 'test-gpt', openaiChatJson: vi.fn(),
}));

import { runClaudeCliJson } from '../src/services/claudeCliJson.service.js';
import { DEFAULT_BUILDER_SETTINGS, interpretBrief, resolveBuilderModel, setBuilderSettings, studioProviders } from '../src/services/designBrain.service.js';

const request = { system: 'Return a store spec.', user: 'Shoe store', schema: { type: 'object' }, modelId: 'sonnet', timeoutMs: 1000 };
const spec = { niche: 'sport', mood: 'dark', photoSubject: 'red running shoes on a black backdrop' };

function reply(envelope: unknown, code = 0) {
  mocks.spawn.mockImplementation(() => {
    const child = Object.assign(new EventEmitter(), {
      stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), kill: vi.fn(),
    });
    child.stdin.on('finish', () => queueMicrotask(() => {
      child.stdout.write(JSON.stringify(envelope));
      child.emit('close', code);
    }));
    return child;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.bin.mockReturnValue('claude.exe');
  mocks.secret.mockReturnValue(null);
  mocks.findSettings.mockResolvedValue(null);
  mocks.saveSettings.mockResolvedValue({});
  mocks.findModel.mockResolvedValue(null);
  mocks.resolveModel.mockResolvedValue(null);
});

describe('Claude CLI store integration', () => {
  it('reads structured_output ahead of the human-readable result', async () => {
    reply({ result: 'Done.', structured_output: spec, usage: { input_tokens: 12, output_tokens: 25 } });
    expect(await runClaudeCliJson(request)).toEqual({ json: spec, usage: { input: 12, output: 25 } });
    const [, args, options] = mocks.spawn.mock.calls[0];
    expect(options).toMatchObject({ shell: false, windowsHide: true });
    expect(args).toContain('--safe-mode');
    expect(args[args.indexOf('--tools') + 1]).toBe('');
  });

  it('accepts older JSON result envelopes', async () => {
    reply({ result: JSON.stringify(spec) });
    expect((await runClaudeCliJson(request)).json).toEqual(spec);
  });

  it('rejects an empty envelope instead of pretending a store was generated', async () => {
    reply({ result: '', usage: {} });
    await expect(runClaudeCliJson(request)).rejects.toThrow('JSON');
  });

  it('surfaces authentication failures', async () => {
    reply({ is_error: true, result: 'Not logged in' });
    await expect(runClaudeCliJson(request)).rejects.toThrow('Not logged in');
  });

  it('uses the explicit CLI selection ahead of catalogue defaults', async () => {
    const model = await resolveBuilderModel({ ...DEFAULT_BUILDER_SETTINGS, modelId: 99, cliModel: 'opus' });
    expect(model).toMatchObject({ provider: 'claude-cli', modelId: 'opus' });
    expect(mocks.findModel).not.toHaveBeenCalled();
    expect(mocks.resolveModel).not.toHaveBeenCalled();
  });

  it('does not silently switch an explicit CLI choice to a paid API when CLI is missing', async () => {
    mocks.bin.mockReturnValue(null);
    const settings = { ...DEFAULT_BUILDER_SETTINGS, enabled: true, cliModel: 'sonnet' as const };
    expect(await resolveBuilderModel(settings)).toBeNull();
    expect((await studioProviders(settings)).claude.available).toBe(false);
  });

  it('saves and clears the explicit CLI choice', async () => {
    expect((await setBuilderSettings({ cliModel: 'haiku' })).cliModel).toBe('haiku');
    mocks.findSettings.mockResolvedValue({ value: { cliModel: 'haiku' } });
    expect((await setBuilderSettings({ cliModel: null })).cliModel).toBeNull();
    expect((await setBuilderSettings({ cliModel: 'invalid' as any })).cliModel).toBe('haiku');
  });

  it('delivers Claude’s photo subject to the store composer and records token usage', async () => {
    reply({ structured_output: spec, result: '', usage: { input_tokens: 12, output_tokens: 25 } });
    const result = await interpretBrief({ prompt: 'A running shoe store', settings: { ...DEFAULT_BUILDER_SETTINGS, enabled: true, cliModel: 'sonnet' } });
    expect(result.engine.ai).toBe(true);
    expect(result.engine.model).toBe('Claude CLI (sonnet)');
    expect(result.spec).toMatchObject(spec);
    expect(mocks.saveSettings).toHaveBeenCalledWith(expect.objectContaining({
      update: { value: expect.objectContaining({ inputTokens: 12, outputTokens: 25, failures: 0 }) },
    }));
  });
});
