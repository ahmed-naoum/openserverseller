/**
 * WhatsApp AI agent — API client and shared types.
 *
 * Kept in its own module rather than appended to lib/api.ts because the feature
 * spans two very different audiences (an account's agent studio and the
 * SUPER_ADMIN console) and both need the same types.
 *
 * Every endpoint here answers `{ status: 'success', data }` like the rest of the
 * platform, so callers read `res.data.data`.
 */

import { api } from './api';

/* ------------------------------------------------------------------ */
/* types                                                               */
/* ------------------------------------------------------------------ */

/**
 * Les rôles réellement proposés.
 *
 * VISION n'y est plus : rien ne le lisait. Les photos du client sont jointes
 * directement à la requête du CERVEAU, donc c'est le drapeau « Vision » de la
 * ligne du cerveau qui décide si une photo peut partir — pas un modèle à part.
 */
export type ModelRole = 'BRAIN' | 'STT' | 'TTS';

export interface AiModel {
  id: number;
  provider: string;
  modelId: string;
  label: string;
  role: ModelRole;
  isEnabled: boolean;
  isDefault: boolean;
  supportsEffort: boolean;
  supportsVision: boolean;
  supportsThinking: boolean;
  supportsMidSystem: boolean;
  supportsFallbacks: boolean;
  /**
   * Réservé à la plateforme : invisible dans le sélecteur d'un compte, et
   * refusé comme défaut de rôle. Un admin l'assigne compte par compte depuis
   * « Comptes agent » — c'est la seule porte.
   */
  adminOnly: boolean;
  inputCostPerMTokCents: number;
  outputCostPerMTokCents: number;
  maxOutputTokens: number;
  notes: string | null;
  sortOrder: number;
}

/** Un contrôle du test : « le moteur a répondu », « la transcription correspond »… */
export interface ModelTestCheck {
  label: string;
  ok: boolean;
  detail?: string | null;
}

/**
 * Ce que rend POST /admin/ai/models/:id/test.
 *
 * Un modèle en panne arrive en 200 avec `ok: false` : l'échec EST la réponse, et
 * il doit voyager avec la transcription, les tentatives et le message du
 * fournisseur — tout ce qu'un 4xx jetterait.
 */
export interface ModelTestResult {
  ok: boolean;
  role: ModelRole;
  provider: string;
  modelId: string;
  label: string;
  ms: number;
  /** Une ligne, pour la ligne du tableau. */
  summary: string;
  /** Ce que le modèle a produit : la réponse, la transcription, le texte lu. */
  sample: string | null;
  /** TTS uniquement — un fichier à écouter, pour ne pas croire sur parole. */
  audioUrl: string | null;
  checks: ModelTestCheck[];
  error: string | null;
  usage: { inputTokens: number; outputTokens: number } | null;
  costCents: number | null;
}

export interface AiVoice {
  id: number;
  provider: string;
  voiceId: string;
  label: string;
  locale: string | null;
  gender: string | null;
  isEnabled: boolean;
  isDefault: boolean;
  /** Edge: rate/pitch/volume are real SSML controls. */
  supportsProsody: boolean;
  /** A named emotion, or (Gemini) a free-text delivery instruction. */
  supportsStyle: boolean;
  styles: string[];
  sortOrder: number;
}

export interface VoicePreset {
  id: number;
  name: string;
  voiceRef: number | null;
  provider: string;
  voiceId: string;
  /** Percent delta. This is the "speed" slider. */
  rate: number;
  pitch: number;
  volume: number;
  style: string | null;
  styleDegree: number | null;
  stylePrompt: string | null;
  /** Shipped presets cannot be deleted. */
  isSystem: boolean;
}

export interface KnowledgeBase {
  business: {
    name: string;
    what_we_sell: string;
    languages: string;
    country: string;
    currency: string;
    delivery: string;
    payment: string;
    returns: string;
    hours: string;
    website: string;
  };
  playbook: string;
  offers: { name: string; details: string; valid_until?: string }[];
  faq: { q: string; a: string }[];
  objections: { objection: string; response: string }[];
  examples: { customer: string; agent: string }[];
  tone: { persona: string; style: string; emoji: string; rules: string[] };
  goal: { objective: string; required_fields: string[]; confirmation_script: string };
}

export interface AgentConfig {
  id: number;
  userId: number;
  enabled: boolean;
  displayName: string | null;
  timezone: string;
  brainModelId: number | null;
  brainModel?: AiModel | null;
  effort: string;
  maxOutputTokens: number;
  historyMessages: number;
  sttModelId: number | null;
  sttEnabled: boolean;
  sttPrompt: string | null;
  /** Moteurs de repli, dans l'ordre, chacun « provider:modelId ». */
  sttChain: string[];
  /** Tentatives SUPPLÉMENTAIRES par moteur avant de passer au suivant. */
  sttRetries: number;
  ttsModelId: number | null;
  activeVoiceId: number | null;
  ttsMode: 'never' | 'mirror' | 'always';
  ttsMaxChars: number;
  /**
   * Voice engines tried IN ORDER after the selected one, as "provider:modelId".
   *
   * This is not a nicety. The best-sounding engine is a preview-tier Live model
   * that fails often; without a chain, most voice notes simply never get sent.
   */
  ttsChain: string[];
  /** Attempts per link before moving to the next. */
  ttsRetries: number;
  /**
   * Transcribe the produced audio back and check it really says the reply.
   * Defaults to the Live models only — they are the ones that answer the text
   * instead of reading it.
   */
  ttsVerify: 'never' | 'live_only' | 'always';
  /**
   * What happens when the whole chain fails. `text_only` is the default on
   * purpose: silently swapping to a different voice mid-conversation is worse
   * than sending no voice note.
   */
  ttsOnFailure: 'text_only' | 'fallback_edge';
  ttsTimeoutMs: number;
  kb: KnowledgeBase;
  /**
   * The brain is an admin-managed model the account cannot select or change.
   *
   * Such a model is deliberately absent from the account's model list, so the
   * picker cannot represent it — render it read-only rather than as a select
   * showing some other model, which saving would silently make true.
   */
  brainLocked?: boolean;
  replyTo: 'all' | 'ads_only';
  adKeywords: string | null;
  typingDelayMs: number;
  replyDelayMs: number;
  handoffKeywords: string;
  workingHoursEnabled: boolean;
  workingHoursStart: string;
  workingHoursEnd: string;
  afterHoursMessage: string | null;
  afterConfirmed: 'support' | 'stop';
  maxRepliesPerContact: number;
  maxRepliesPerDay: number;
  minSecondsBetweenReplies: number;
  maxInputChars: number;
  readImages: boolean;
  readVideos: boolean;
  videoFrames: number;
  maxMediaMb: number;
  maxMediaPerTurn: number;
  sendCatalogueMedia: boolean;
  autoCreateLead: boolean;
  promptVersion: number;
}

/** Une ligne du banc d'essai. */
export interface SandboxMessage {
  id: number;
  direction: 'IN' | 'OUT';
  kind: string;
  body: string | null;
  transcript: string | null;
  fromAgent: boolean;
  hasMedia: boolean;
  createdAt: string;
}

/**
 * L'état du tour, et c'est ce qui rend le banc diagnostique plutôt que
 * simplement conversationnel : une réponse qui n'arrive pas a une raison, et
 * la raison est ici.
 */
export interface SandboxTurn {
  id: number;
  status: 'PENDING' | 'CLAIMED' | 'DONE' | 'FAILED' | 'SKIPPED' | 'BLOCKED_NO_CREDITS';
  skipReason: string | null;
  lastError: string | null;
  costCents: number;
  inputTokens: number;
  outputTokens: number;
  createdAt: string;
  finishedAt: string | null;
}

export interface SandboxState {
  contact: {
    id: number;
    status: string;
    draft: Record<string, unknown> | null;
    aiEnabled: boolean;
    aiReplyCount: number;
    leadId: number | null;
  };
  messages: SandboxMessage[];
  turns: SandboxTurn[];
}

export type SessionStatus =
  | 'DISCONNECTED'
  | 'QR'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'LOGGED_OUT'
  | 'BANNED';

export interface AgentStatus {
  enabled: boolean;
  agentEnabled?: boolean;
  prerequisites?: {
    brainModel: boolean;
    whatsappConnected: boolean;
    hasProducts: boolean;
    hasCredits: boolean;
  };
  session?: {
    status: SessionStatus;
    desiredState: 'ON' | 'OFF';
    phoneNumber: string | null;
    pushName: string | null;
    lastError: string | null;
    lastConnectedAt: string | null;
  };
  credits?: WaCredits;
  unread?: number;
}

export interface WaCredits {
  enabled: boolean;
  /** Integer CENTS. Never a float — format with formatWaMoney. */
  balance: number;
  /** How many agent replies the balance still pays for. */
  affordable: number;
  totalGranted: number;
  totalConsumed: number;
  priceCents: number;
}

export interface ProductProfile {
  id: number;
  productId: number;
  enabled: boolean;
  agentPriceMad: number | null;
  oldPriceMad: number | null;
  sellingCopy: string | null;
  benefits: string | null;
  variants: string | null;
  stockNote: string | null;
  objections: { objection: string; response: string }[];
  mediaUrls: string[];
  notes: string | null;
}

export interface AgentProduct {
  id: number;
  sku: string;
  nameFr: string;
  nameAr: string;
  description: string | null;
  retailPriceMad: number;
  stockStatus: string;
  images: { imageUrl: string; isPrimary: boolean }[];
  videoUrls: string[];
  profile: ProductProfile | null;
}

export interface WaConversation {
  id: number;
  /** `2126…@s.whatsapp.net`, or `1234…@lid` for a privacy-masked contact. */
  jid: string;
  /**
   * The dialable number, or null when WhatsApp masks it behind a @lid identity.
   *
   * Null is common and not an error. Do not fall back to the digits in the jid:
   * on a @lid contact those are an opaque identifier that merely looks like a
   * phone number, and a lead created from one cannot be called.
   */
  phone: string | null;
  pushName: string | null;
  source: 'AD' | 'ORGANIC' | 'MANUAL';
  adHeadline: string | null;
  aiEnabled: boolean;
  status: 'NEW' | 'QUALIFIED' | 'CONFIRMED' | 'REJECTED' | 'HUMAN';
  draft: Record<string, any> | null;
  leadId: number | null;
  unreadCount: number;
  lastMessageAt: string | null;
}

export interface WaMessage {
  id: number;
  direction: 'IN' | 'OUT';
  kind: 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT' | 'STICKER';
  body: string | null;
  mediaMime: string | null;
  transcript: string | null;
  transcribed: boolean;
  fromAgent: boolean;
  createdAt: string;
}

export interface AdminAccountRow {
  id: number;
  uuid: string;
  email: string;
  phone: string | null;
  name: string;
  role: 'VENDOR' | 'INFLUENCER';
  isActive: boolean;
  createdAt: string;
  entitlement: { enabled: boolean; since: string | null };
  agent: { enabled: boolean; autoCreateLead: boolean; brain: string | null } | null;
  session: { status: SessionStatus; desiredState: string; phoneNumber: string | null; lastError: string | null } | null;
  credits: { balance: number; affordable: number; totalGranted: number; totalConsumed: number };
  conversations: number;
}

/* ------------------------------------------------------------------ */
/* money                                                               */
/* ------------------------------------------------------------------ */

/**
 * `1234` -> `"$12.34"`.
 *
 * Balances are integer cents on the wire for the same reason they are integer
 * cents in the database: a tariff of $0.02 has no exact binary representation,
 * and a ledger that no longer sums to its balance cannot be audited. Divide
 * only here, at the display edge.
 */
export function formatWaMoney(cents: number): string {
  const n = Number(cents) || 0;
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  return `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ */
/* account-facing endpoints                                            */
/* ------------------------------------------------------------------ */

export const waAgentApi = {
  /**
   * Never 403s. An account without the entitlement gets
   * `{ enabled: false }`, which is what the navigation checks — so the menu
   * entry is HIDDEN rather than shown and then refused.
   */
  status: () => api.get('/whatsapp-agent/status'),

  getConfig: () => api.get('/whatsapp-agent/config'),
  updateConfig: (data: Partial<AgentConfig> & Record<string, unknown>) =>
    api.put('/whatsapp-agent/config', data),

  getKb: () => api.get('/whatsapp-agent/config'),
  saveKb: (kb: KnowledgeBase) => api.put('/whatsapp-agent/kb', { kb }),
  /** Exactly what the model is told, for the account to read. */
  getPrompt: () => api.get('/whatsapp-agent/prompt'),

  models: () => api.get('/whatsapp-agent/models'),

  /**
   * Le banc d'essai : discuter avec son propre agent sans passer par WhatsApp.
   *
   * Le tour est le VRAI tour — mêmes garde-fous, mêmes crédits, même modèle.
   * Seul le dernier saut change : la réponse est remise localement au lieu
   * d'être envoyée à un numéro. Une commande confirmée sur le banc ne crée
   * jamais de lead facturé.
   */
  sandbox: () => api.get('/whatsapp-agent/sandbox'),
  sandboxSend: (text: string) => api.post('/whatsapp-agent/sandbox/message', { text }),
  sandboxReset: () => api.delete('/whatsapp-agent/sandbox'),

  voices: () => api.get('/whatsapp-agent/voices'),
  createVoice: (data: Partial<VoicePreset>) => api.post('/whatsapp-agent/voices', data),
  updateVoice: (id: number, data: Partial<VoicePreset>) => api.put(`/whatsapp-agent/voices/${id}`, data),
  deleteVoice: (id: number) => api.delete(`/whatsapp-agent/voices/${id}`),
  /**
   * Synthesises a sample with the settings currently on screen, through the
   * same chain a real reply uses.
   *
   * The response carries `provider`, `model`, `fellBackFrom`, `retried` and
   * `attempts` — surface them. An account that hears a preview produced by the
   * third link of the chain has learned something useful about its setup, and
   * hiding it would let them approve a voice they will rarely actually hear.
   */
  previewVoice: (data: Partial<VoicePreset> & { text?: string }) =>
    api.post('/whatsapp-agent/voices/preview', data),

  products: () => api.get('/whatsapp-agent/products'),
  saveProduct: (productId: number, data: Partial<ProductProfile>) =>
    api.put(`/whatsapp-agent/products/${productId}`, data),
  removeProduct: (productId: number) => api.delete(`/whatsapp-agent/products/${productId}`),

  connect: () => api.post('/whatsapp-agent/session/connect'),
  disconnect: () => api.post('/whatsapp-agent/session/disconnect'),
  /**
   * Rebuilds the socket without unlinking. For the case the status badge
   * cannot show: connected, sending fine, receiving nothing.
   */
  reconnect: () => api.post('/whatsapp-agent/session/reconnect'),
  logout: () => api.post('/whatsapp-agent/session/logout'),
  /** Polled while the connect screen is open; the QR rotates every ~20s. */
  qr: () => api.get('/whatsapp-agent/session/qr'),

  credits: () => api.get('/whatsapp-agent/credits'),
  usage: () => api.get('/whatsapp-agent/usage'),

  conversations: (params?: { status?: string; source?: string; q?: string; page?: number; limit?: number }) =>
    api.get('/whatsapp-agent/conversations', { params }),
  messages: (id: number, limit = 80) =>
    api.get(`/whatsapp-agent/conversations/${id}/messages`, { params: { limit } }),
  /** Sending manually always pauses the agent on that chat. */
  send: (id: number, text: string) => api.post(`/whatsapp-agent/conversations/${id}/send`, { text }),
  updateConversation: (id: number, data: { aiEnabled?: boolean; status?: string; draft?: Record<string, any> }) =>
    api.patch(`/whatsapp-agent/conversations/${id}`, data),
  /** Turns the collected draft into a real, billed Lead. */
  promote: (id: number) => api.post(`/whatsapp-agent/conversations/${id}/promote`),

  mediaUrl: (messageId: number) => `/whatsapp-agent/media/${messageId}`,

  /* ---- collected leads --------------------------------------------- */

  /**
   * Every conversation the agent has collected something from.
   *
   * Conversations with an empty draft are excluded server-side — those are
   * chats, not leads.
   */
  leads: (params?: {
    status?: string;
    promoted?: 'all' | 'yes' | 'no';
    source?: string;
    q?: string;
    page?: number;
    limit?: number;
  }) => api.get('/whatsapp-agent/leads', { params }),

  /** Bulk promotion. Each row commits independently; failures come back per row. */
  promoteMany: (contactIds: number[]) =>
    api.post('/whatsapp-agent/leads/promote', { contactIds }),

  /** CSV, UTF-8 with a BOM so Excel opens Arabic and French correctly. */
  exportLeads: (params?: { status?: string; promoted?: 'all' | 'yes' | 'no' }) =>
    api.get('/whatsapp-agent/leads/export', { params, responseType: 'blob' }),
};

export interface CollectedLead {
  contactId: number;
  phone: string | null;
  pushName: string | null;
  source: 'AD' | 'ORGANIC' | 'MANUAL';
  status: 'NEW' | 'QUALIFIED' | 'CONFIRMED' | 'REJECTED' | 'HUMAN';
  draft: Record<string, any> | null;
  /** How many of the nine draft fields the agent has filled. */
  filled: number;
  /**
   * False when already promoted, or when there is still no dialable number —
   * WhatsApp masks it on a @lid contact until the customer gives it.
   */
  canPromote: boolean;
  leadId: number | null;
  lead: { id: number; status: string; createdAt: string; phone: string } | null;
  confirmedAt: string | null;
  lastMessageAt: string | null;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* SUPER_ADMIN endpoints                                               */
/* ------------------------------------------------------------------ */

export const waAdminApi = {
  overview: () => api.get('/admin/ai/overview'),

  models: () => api.get('/admin/ai/models'),
  createModel: (data: Partial<AiModel>) => api.post('/admin/ai/models', data),
  updateModel: (id: number, data: Partial<AiModel>) => api.put(`/admin/ai/models/${id}`, data),
  setDefaultModel: (id: number) => api.post(`/admin/ai/models/${id}/default`),
  /**
   * Réordonne tout un rôle d'un coup : `ids` est l'ordre voulu, pas des rangs.
   *
   * Le classement n'est pas décoratif — resolveModel() retombe sur le modèle
   * activé qui trie EN PREMIER quand un compte n'en a pas choisi un.
   */
  reorderModels: (role: ModelRole, ids: number[]) =>
    api.post('/admin/ai/models/reorder', { role, ids }),
  deleteModel: (id: number) => api.delete(`/admin/ai/models/${id}`),
  /**
   * Un VRAI appel au fournisseur, par la même route de code que l'agent, avec
   * la chaîne de repli désactivée — sinon un moteur mort serait sauvé par le
   * maillon suivant et rapporté comme sain.
   *
   * Ça DÉPENSE : un appel facturé au prix de la ligne. Le délai est long exprès
   * (un TTS Live tient 90 s), bien au-delà des 30 s par défaut du client.
   */
  testModel: (id: number) => api.post(`/admin/ai/models/${id}/test`, {}, { timeout: 180_000 }),

  voices: () => api.get('/admin/ai/voices'),
  createVoice: (data: Partial<AiVoice>) => api.post('/admin/ai/voices', data),
  updateVoice: (id: number, data: Partial<AiVoice>) => api.put(`/admin/ai/voices/${id}`, data),

  accounts: (params?: { role?: string; status?: string; q?: string; page?: number; limit?: number }) =>
    api.get('/admin/ai/accounts', { params }),
  account: (uuid: string) => api.get(`/admin/ai/accounts/${uuid}`),
  /** Platform-owned agent tuning. Sellers cannot set these. */
  updateAccountAgent: (uuid: string, data: Record<string, unknown>) =>
    api.patch(`/admin/ai/accounts/${uuid}/agent`, data),
  /** Turning this off also stops the account's live WhatsApp session. */
  setEntitlement: (uuid: string, enabled: boolean) =>
    api.patch(`/admin/ai/accounts/${uuid}/entitlement`, { enabled }),
  /** `amount` is in dollars; the server converts to integer cents. */
  grantCredits: (uuid: string, amount: number, description?: string, direction: 'GRANT' | 'DEBIT' = 'GRANT') =>
    api.post(`/admin/ai/accounts/${uuid}/credits`, { amount, description, direction }),
};
