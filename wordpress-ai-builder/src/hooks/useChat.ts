import { useCallback } from 'react';
import { streamGenerate, suggestTitle, updatePage } from '../api/client';
import { useAppStore } from '../store/appStore';
import type { EditIntent, SSEDoneBuildEvent, SSEDonePlanEvent } from '../types';

// Human-readable labels for each intent
const INTENT_LABELS: Record<EditIntent, string> = {
  create:       'Built new page',
  full_rebuild: 'Rebuilt page from scratch',
  edit_style:   'Updated styles',
  edit_section: 'Edited section',
  add_section:  'Added new section',
  fix:          'Fixed issue',
};

const INTENT_EMOJIS: Record<EditIntent, string> = {
  create:       '✨',
  full_rebuild: '🔄',
  edit_style:   '🎨',
  edit_section: '✏️',
  add_section:  '➕',
  fix:          '🔧',
};

export function useChat() {
  const {
    mode,
    currentPageId,
    currentHtml,
    messages,
    addMessage,
    setStreaming,
    setCurrentPage,
    setCurrentHtml,
    setEditIntent,
    setPlan,
    setPlanStatus,
    upsertPage,
    pages,
  } = useAppStore();

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      addMessage('user', content);
      setStreaming(true, 'Connecting to AI...');

      // Build history (last 10 user/assistant turns)
      const history = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));

      const streamMode = mode === 'planning' ? 'plan' : 'build';
      const postId = currentPageId ?? 0;

      // For a new page (no post yet), suggest title in the background
      const isFirstMessage = messages.filter((m) => m.role === 'user').length === 0;

      const cleanup = streamGenerate(
        content,
        postId,
        streamMode,
        history,
        currentHtml,
        // onProgress
        (msg) => {
          setStreaming(true, msg);
        },
        // onIntent — server tells us what kind of edit this is
        (intentStr) => {
          const intent = intentStr as EditIntent;
          setEditIntent(intent);
        },
        // onDone
        (data) => {
          setStreaming(false);

          if (data.type === 'plan') {
            const planData = (data as unknown as SSEDonePlanEvent).plan;
            setPlan(planData);
            setPlanStatus('pending_approval');
            addMessage(
              'assistant',
              `I've created a plan for **${planData.title}**\n\n${planData.description}\n\nThe plan has ${planData.steps.length} sections. Review it below and approve to start building.`
            );
          } else {
            const buildData = data as unknown as SSEDoneBuildEvent;
            const intent = buildData.intent ?? 'create';
            const emoji  = INTENT_EMOJIS[intent] ?? '✅';
            const label  = INTENT_LABELS[intent] ?? 'Done';

            // Store the new HTML so the next edit has context
            setCurrentHtml(buildData.html ?? '');
            setCurrentPage(buildData.post_id, buildData.preview_url, buildData.html ?? '');

            // Update the pages sidebar entry
            const existingPage = pages.find((p) => p.post_id === buildData.post_id);
            if (existingPage) {
              upsertPage({ ...existingPage, preview_url: buildData.preview_url });
            }

            addMessage(
              'assistant',
              `${emoji} ${label}! Preview updated on the right.\n\nAsk me to adjust anything — colors, content, layout, or add new sections.`
            );

            // Auto-generate a title for new pages (fire-and-forget)
            if (intent === 'create' && isFirstMessage) {
              suggestTitle(content).then(({ title }) => {
                if (title && title !== 'AI Builder Page') {
                  updatePage(buildData.post_id, buildData.html ?? '', title)
                    .catch(() => {/* non-critical */});
                  const page = pages.find((p) => p.post_id === buildData.post_id);
                  if (page) upsertPage({ ...page, title });
                }
              }).catch(() => {/* non-critical */});
            }
          }

          cleanup();
        },
        // onError
        (errMsg) => {
          setStreaming(false);
          addMessage('system', `Error: ${errMsg}`);
          cleanup();
        }
      );
    },
    [
      mode, currentPageId, currentHtml, messages,
      addMessage, setStreaming, setCurrentPage, setCurrentHtml,
      setEditIntent, setPlan, setPlanStatus, upsertPage, pages,
    ]
  );

  return { sendMessage };
}
