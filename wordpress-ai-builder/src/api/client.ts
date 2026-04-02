import type {
  Settings,
  ModelsResponse,
  WPPage,
  CreatePageResult,
  UpdatePageResult,
  Plan,
} from '../types';

let _config = { nonce: '', restUrl: '', siteUrl: '' };

export function initClient(config: typeof _config): void {
  _config = config;
}

// ─── Base fetch ───────────────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${_config.restUrl}${path}`;
  const res = await fetch(url, {
    ...options,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'X-WP-Nonce': _config.nonce,
      ...options.headers,
    },
  });

  const body = await res.json();

  if (!res.ok) {
    const msg = body?.message ?? body?.data?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return body as T;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export const getSettings = (): Promise<Settings> =>
  apiFetch('/settings');

export const saveSettings = (data: Record<string, string>): Promise<{ success: boolean; settings: Settings }> =>
  apiFetch('/settings', { method: 'POST', body: JSON.stringify(data) });

export const getModels = (): Promise<ModelsResponse> =>
  apiFetch('/models');

// ─── Pages ────────────────────────────────────────────────────────────────────

export const listPages = (): Promise<WPPage[]> =>
  apiFetch('/pages');

export const createPage = (title: string): Promise<CreatePageResult> =>
  apiFetch('/pages', { method: 'POST', body: JSON.stringify({ title }) });

export const updatePage = (postId: number, html: string, title?: string): Promise<UpdatePageResult> =>
  apiFetch(`/pages/${postId}`, {
    method: 'PUT',
    body: JSON.stringify({ html, ...(title ? { title } : {}) }),
  });

export const publishPage = (postId: number): Promise<{ post_id: number; permalink: string }> =>
  apiFetch(`/pages/${postId}/publish`, { method: 'PUT', body: '{}' });

export const getPreviewUrl = (postId: number): Promise<{ post_id: number; preview_url: string }> =>
  apiFetch(`/pages/${postId}/preview-url`);

// ─── AI Generation ────────────────────────────────────────────────────────────

interface GenerateResult extends UpdatePageResult {
  html: string;
}

export const generate = (
  prompt: string,
  postId: number,
  history: Array<{ role: string; content: string }>
): Promise<GenerateResult> =>
  apiFetch('/generate', {
    method: 'POST',
    body: JSON.stringify({ prompt, post_id: postId, history }),
  });

// ─── Planning ─────────────────────────────────────────────────────────────────

export const createPlan = (prompt: string): Promise<Plan> =>
  apiFetch('/plan', { method: 'POST', body: JSON.stringify({ prompt }) });

export const executePlan = (
  plan: Plan,
  postId: number
): Promise<GenerateResult & { post_id: number }> =>
  apiFetch('/plan/execute', {
    method: 'POST',
    body: JSON.stringify({ plan, post_id: postId }),
  });

// ─── SSE Streaming ────────────────────────────────────────────────────────────

export function streamGenerate(
  prompt: string,
  postId: number,
  mode: 'build' | 'plan',
  history: Array<{ role: string; content: string }>,
  onProgress: (msg: string) => void,
  onDone: (data: Record<string, unknown>) => void,
  onError: (msg: string) => void
): () => void {
  const controller = new AbortController();

  fetch(`${_config.restUrl}/stream`, {
    method: 'POST',
    signal: controller.signal,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'X-WP-Nonce': _config.nonce,
    },
    body: JSON.stringify({ prompt, post_id: postId, mode, history }),
  })
    .then(async (res) => {
      if (!res.ok || !res.body) {
        const text = await res.text();
        onError(`HTTP ${res.status}: ${text.slice(0, 200)}`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const rawData = line.slice(6);
            try {
              const data = JSON.parse(rawData);
              if (currentEvent === 'progress') {
                onProgress(data.message ?? '');
              } else if (currentEvent === 'done') {
                onDone(data);
              } else if (currentEvent === 'error') {
                onError(data.message ?? 'Unknown error');
              }
            } catch {
              // ignore parse errors on keep-alive lines
            }
            currentEvent = '';
          }
        }
      }
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        onError(err.message ?? 'Stream failed');
      }
    });

  // Return cleanup function
  return () => controller.abort();
}
