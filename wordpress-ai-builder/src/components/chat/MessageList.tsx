import React, { useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import { Spinner } from '../shared/Spinner';
import type { Message } from '../../types';

interface MessageListProps {
  messages: Message[];
  isStreaming: boolean;
  streamStatus: string;
}

export function MessageList({ messages, isStreaming, streamStatus }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}

      {isStreaming && (
        <div className="flex items-center gap-2 pl-9 py-2">
          <Spinner size="sm" />
          <span className="text-xs text-gray-400">{streamStatus || 'Thinking...'}</span>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
