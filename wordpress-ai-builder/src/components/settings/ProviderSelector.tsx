import React from 'react';
import type { AIProvider, ModelsResponse } from '../../types';

interface ProviderSelectorProps {
  provider: AIProvider;
  model: string;
  models: ModelsResponse | null;
  onProviderChange: (p: AIProvider) => void;
  onModelChange: (m: string) => void;
}

export function ProviderSelector({
  provider,
  model,
  models,
  onProviderChange,
  onModelChange,
}: ProviderSelectorProps) {
  const providers: { id: AIProvider; name: string; logo: string }[] = [
    { id: 'claude', name: 'Anthropic Claude', logo: '🟣' },
    { id: 'gemini', name: 'Google Gemini',    logo: '🔵' },
  ];

  const availableModels = models?.[provider] ?? [];

  return (
    <div className="space-y-3">
      {/* Provider toggle */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
          AI Provider
        </label>
        <div className="grid grid-cols-2 gap-2">
          {providers.map(({ id, name, logo }) => (
            <button
              key={id}
              onClick={() => onProviderChange(id)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                provider === id
                  ? 'border-violet-500 bg-violet-50 text-violet-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}
            >
              <span>{logo}</span>
              <span>{name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Model selector */}
      {availableModels.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
            Model
          </label>
          <select
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
          >
            {availableModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
