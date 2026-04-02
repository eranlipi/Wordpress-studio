import { create } from 'zustand';
import type {
  AppMode,
  EditIntent,
  Message,
  Plan,
  PlanStatus,
  Settings,
  WPPage,
} from '../types';

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

interface AppState {
  // Mode
  mode: AppMode;
  setMode: (mode: AppMode) => void;

  // Settings
  settings: Settings | null;
  setSettings: (s: Settings) => void;

  // Pages sidebar
  pages: WPPage[];
  setPages: (pages: WPPage[]) => void;
  upsertPage: (page: WPPage) => void;

  // Current session
  currentPageId: number | null;
  previewUrl: string | null;
  currentHtml: string;           // ← the live HTML of the current page
  setCurrentPage: (postId: number, previewUrl: string, html?: string) => void;
  setPreviewUrl: (url: string) => void;
  setCurrentHtml: (html: string) => void;

  // Edit intent (set by server during streaming)
  editIntent: EditIntent | null;
  setEditIntent: (intent: EditIntent) => void;

  // Chat messages
  messages: Message[];
  addMessage: (role: Message['role'], content: string) => Message;
  clearMessages: () => void;

  // Streaming state
  isStreaming: boolean;
  streamStatus: string;
  setStreaming: (streaming: boolean, status?: string) => void;

  // Planning
  plan: Plan | null;
  planStatus: PlanStatus;
  setPlan: (plan: Plan) => void;
  setPlanStatus: (status: PlanStatus) => void;
  clearPlan: () => void;

  // Settings modal
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Mode
  mode: 'build',
  setMode: (mode) => set({ mode }),

  // Settings
  settings: null,
  setSettings: (settings) => set({ settings }),

  // Pages
  pages: [],
  setPages: (pages) => set({ pages }),
  upsertPage: (page) =>
    set((state) => {
      const existing = state.pages.findIndex((p) => p.post_id === page.post_id);
      if (existing >= 0) {
        const updated = [...state.pages];
        updated[existing] = page;
        return { pages: updated };
      }
      return { pages: [page, ...state.pages] };
    }),

  // Current session
  currentPageId: null,
  previewUrl: null,
  currentHtml: '',
  setCurrentPage: (postId, previewUrl, html = '') =>
    set({ currentPageId: postId, previewUrl, currentHtml: html }),
  setPreviewUrl: (url) => set({ previewUrl: url }),
  setCurrentHtml: (html) => set({ currentHtml: html }),

  // Edit intent
  editIntent: null,
  setEditIntent: (editIntent) => set({ editIntent }),

  // Messages
  messages: [],
  addMessage: (role, content) => {
    const msg: Message = { id: uid(), role, content, timestamp: Date.now() };
    set((state) => ({ messages: [...state.messages, msg] }));
    return msg;
  },
  clearMessages: () => set({ messages: [] }),

  // Streaming
  isStreaming: false,
  streamStatus: '',
  setStreaming: (isStreaming, streamStatus = '') =>
    set({ isStreaming, streamStatus }),

  // Planning
  plan: null,
  planStatus: 'idle',
  setPlan: (plan) => set({ plan }),
  setPlanStatus: (planStatus) => set({ planStatus }),
  clearPlan: () => set({ plan: null, planStatus: 'idle' }),

  // Settings modal
  settingsOpen: false,
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
}));
