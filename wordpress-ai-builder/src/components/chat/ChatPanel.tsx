import React from 'react';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { PlanDisplay } from '../planning/PlanDisplay';
import { useAppStore } from '../../store/appStore';
import { useChat } from '../../hooks/useChat';

export function ChatPanel() {
  const {
    mode, setMode,
    messages, isStreaming, streamStatus,
    plan, planStatus,
  } = useAppStore();

  const { sendMessage } = useChat();

  const showPlan = plan !== null && planStatus !== 'idle';

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">AI</span>
          </div>
          <span className="font-semibold text-gray-800 text-sm">AI Builder</span>
        </div>
      </div>

      {/* Main content area */}
      {showPlan ? (
        <PlanDisplay />
      ) : (
        <MessageList
          messages={messages}
          isStreaming={isStreaming}
          streamStatus={streamStatus}
        />
      )}

      {/* Input */}
      <ChatInput
        onSend={sendMessage}
        mode={mode}
        onModeChange={setMode}
        disabled={isStreaming || planStatus === 'executing'}
      />
    </div>
  );
}
