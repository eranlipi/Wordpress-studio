import { useCallback } from 'react';
import { streamGenerate, generate } from '../api/client';
import { useAppStore } from '../store/appStore';
import type { SSEDoneBuildEvent, SSEDonePlanEvent } from '../types';

export function useChat() {
  const {
    mode,
    currentPageId,
    messages,
    addMessage,
    setStreaming,
    setCurrentPage,
    setPreviewUrl,
    setPlan,
    setPlanStatus,
  } = useAppStore();

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      addMessage('user', content);
      setStreaming(true, 'Connecting to AI...');

      // Build history for context (last 10 messages, user/assistant only)
      const history = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));

      const streamMode = mode === 'planning' ? 'plan' : 'build';
      const postId = currentPageId ?? 0;

      const cleanup = streamGenerate(
        content,
        postId,
        streamMode,
        history,
        (msg) => {
          setStreaming(true, msg);
        },
        (data) => {
          setStreaming(false);

          if (data.type === 'plan') {
            const planData = (data as unknown as SSEDonePlanEvent).plan;
            setPlan(planData);
            setPlanStatus('pending_approval');
            addMessage('assistant', `I've created a plan for your page: **${planData.title}**\n\n${planData.description}\n\nThe plan has ${planData.steps.length} sections. Review it on the right and approve to start building.`);
          } else {
            const buildData = data as unknown as SSEDoneBuildEvent;
            setCurrentPage(buildData.post_id, buildData.preview_url);
            addMessage('assistant', 'Page generated! You can see the preview on the right. Ask me to make any changes.');
          }

          cleanup();
        },
        (errMsg) => {
          setStreaming(false);
          addMessage('system', `Error: ${errMsg}`);
          cleanup();
        }
      );
    },
    [mode, currentPageId, messages, addMessage, setStreaming, setCurrentPage, setPlan, setPlanStatus]
  );

  const sendMessageFallback = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      addMessage('user', content);
      setStreaming(true, 'Generating...');

      try {
        const history = messages
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .slice(-10)
          .map((m) => ({ role: m.role, content: m.content }));

        const result = await generate(content, currentPageId ?? 0, history);
        setCurrentPage(result.post_id, result.preview_url);
        addMessage('assistant', 'Page generated! See the preview on the right.');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        addMessage('system', `Error: ${msg}`);
      } finally {
        setStreaming(false);
      }
    },
    [currentPageId, messages, addMessage, setStreaming, setCurrentPage]
  );

  return { sendMessage, sendMessageFallback };
}
