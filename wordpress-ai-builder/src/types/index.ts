// ─── App Config ───────────────────────────────────────────────────────────────

export interface WPABConfig {
  nonce: string;
  restUrl: string;
  siteUrl: string;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export type AIProvider = 'claude' | 'gemini';

export interface Settings {
  active_provider: AIProvider;
  active_model: string;
  has_claude_key: boolean;
  has_gemini_key: boolean;
  claude_key_masked: string;
  gemini_key_masked: string;
}

export interface ModelOption {
  id: string;
  name: string;
}

export interface ModelsResponse {
  claude: ModelOption[];
  gemini: ModelOption[];
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
}

// ─── Pages ────────────────────────────────────────────────────────────────────

export type PageStatus = 'draft' | 'publish' | 'private';

export interface WPPage {
  post_id: number;
  title: string;
  status: PageStatus;
  modified: string;
  preview_url: string;
  permalink: string;
}

export interface CreatePageResult {
  post_id: number;
  preview_url: string;
  edit_url: string;
}

export interface UpdatePageResult {
  post_id: number;
  preview_url: string;
  html?: string;
}

// ─── Planning ─────────────────────────────────────────────────────────────────

export type StepType = 'hero' | 'header' | 'section' | 'content' | 'footer' | 'gallery' | 'cta';

export interface PlanStep {
  id: number;
  title: string;
  description: string;
  type: StepType;
  status?: 'pending' | 'executing' | 'done';
}

export interface Plan {
  title: string;
  description: string;
  steps: PlanStep[];
}

// ─── App State ────────────────────────────────────────────────────────────────

export type AppMode = 'build' | 'planning';

export type PlanStatus = 'idle' | 'pending_approval' | 'executing' | 'done';

// ─── SSE Events ───────────────────────────────────────────────────────────────

export interface SSEProgressEvent {
  message: string;
  step: number;
  total: number;
}

export interface SSEDoneBuildEvent {
  type: 'build';
  html: string;
  post_id: number;
  preview_url: string;
}

export interface SSEDonePlanEvent {
  type: 'plan';
  plan: Plan;
}

export type SSEDoneEvent = SSEDoneBuildEvent | SSEDonePlanEvent;

export interface SSEErrorEvent {
  code: string;
  message: string;
}
