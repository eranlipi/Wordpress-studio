import React from 'react';
import ReactMarkdown from 'react-markdown';
import type { Message } from '../../types';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser      = message.role === 'user';
  const isSystem    = message.role === 'system';
  const isError     = isSystem && message.content.startsWith('Error:');

  if (isSystem) {
    return (
      <div className={`flex justify-center my-2`}>
        <div className={`text-xs px-3 py-1.5 rounded-full ${isError ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-gray-100 text-gray-500'}`}>
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center text-white text-xs font-bold mr-2 mt-1 flex-shrink-0">
          AI
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? 'bg-violet-600 text-white rounded-tr-sm'
            : 'bg-gray-100 text-gray-800 rounded-tl-sm'
        }`}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="text-sm prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
