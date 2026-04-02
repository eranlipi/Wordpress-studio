import React, { useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import { Spinner } from '../shared/Spinner';
import { useAppStore } from '../../store/appStore';
import type { EditIntent, Message } from '../../types';

const INTENT_CONFIG: Record<EditIntent, { label: string; emoji: string; color: string }> = {
  create:       { label: 'Building new page',    emoji: '✨', color: 'text-violet-600 bg-violet-50' },
  full_rebuild: { label: 'Rebuilding from scratch', emoji: '🔄', color: 'text-blue-600 bg-blue-50' },
  edit_style:   { label: 'Updating styles',      emoji: '🎨', color: 'text-pink-600 bg-pink-50' },
  edit_section: { label: 'Editing section',      emoji: '✏️', color: 'text-amber-600 bg-amber-50' },
  add_section:  { label: 'Adding section',       emoji: '➕', color: 'text-green-600 bg-green-50' },
  fix:          { label: 'Fixing issue',         emoji: '🔧', color: 'text-red-600 bg-red-50' },
};

interface MessageListProps {
  messages: Message[];
  isStreaming: boolean;
  streamStatus: string;
}

export function MessageList({ messages, isStreaming, streamStatus }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const { editIntent } = useAppStore();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center px-6">
          <div className="text-4xl mb-3">✨</div>
          <h3 className="text-gray-700 font-semibold text-lg mb-2">Start building</h3>
          <p className="text-gray-400 text-sm leading-relaxed">
            Describe the page you want to create.<br />
            Switch to <strong>Planning</strong> mode to get a structured plan first.
          </p>
          <div className="mt-4 space-y-2">
            {[
              'Landing page for a yoga studio',
              'Portfolio for a photographer',
              'Coming soon page with email signup',
            ].map((example) => (
              <div
                key={example}
                className="text-xs text-violet-600 bg-violet-50 rounded-lg px-3 py-1.5 cursor-default"
              >
                &ldquo;{example}&rdquo;
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const intentCfg = isStreaming && editIntent ? INTENT_CONFIG[editIntent] : null;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}

      {isStreaming && (
        <div className="flex flex-col gap-1.5 pl-9 py-2">
          {/* Intent badge — appears after server classifies the request */}
          {intentCfg && (
            <div className={`inline-flex items-center gap-1.5 self-start text-xs font-medium px-2.5 py-1 rounded-full ${intentCfg.color}`}>
              <span>{intentCfg.emoji}</span>
              <span>{intentCfg.label}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Spinner size="sm" />
            <span className="text-xs text-gray-400">{streamStatus || 'Thinking...'}</span>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
