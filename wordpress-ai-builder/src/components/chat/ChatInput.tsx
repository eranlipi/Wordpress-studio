import React, { useRef, useState, useCallback } from 'react';
import type { AppMode } from '../../types';

interface ChatInputProps {
  onSend: (message: string) => void;
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  disabled: boolean;
}

export function ChatInput({ onSend, mode, onModeChange, disabled }: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    // Auto-resize textarea
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 150) + 'px';
    }
  };

  return (
    <div className="border-t border-gray-100 bg-white p-3">
      {/* Mode toggle */}
      <div className="flex gap-1 mb-2">
        {(['build', 'planning'] as AppMode[]).map((m) => (
          <button
            key={m}
            onClick={() => onModeChange(m)}
            className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
              mode === m
                ? 'bg-violet-600 text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {m === 'build' ? '⚡ Build' : '📋 Plan'}
          </button>
        ))}
        <span className="text-xs text-gray-400 ml-auto self-center">
          {mode === 'build' ? 'Generates page directly' : 'Creates a plan first'}
        </span>
      </div>

      {/* Input row */}
      <div className="flex gap-2 items-end bg-gray-50 rounded-xl border border-gray-200 focus-within:border-violet-400 focus-within:ring-1 focus-within:ring-violet-300 transition-all p-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={
            mode === 'build'
              ? 'Describe your page... (Enter to send)'
              : 'Describe what you want to build...'
          }
          rows={1}
          className="flex-1 bg-transparent text-sm resize-none outline-none text-gray-800 placeholder-gray-400 max-h-[150px] py-1 px-1"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          className="flex-shrink-0 w-8 h-8 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-200 text-white rounded-lg flex items-center justify-center transition-colors"
        >
          {disabled ? (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
