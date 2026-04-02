import React, { useState, useEffect } from 'react';
import { ProviderSelector } from './ProviderSelector';
import { useSettings } from '../../hooks/useSettings';
import { useAppStore } from '../../store/appStore';
import type { AIProvider } from '../../types';

export function SettingsModal() {
  const { settingsOpen, setSettingsOpen } = useAppStore();
  const { settings, models, loading, error, save } = useSettings();

  const [provider, setProvider]     = useState<AIProvider>('claude');
  const [model, setModel]           = useState('claude-sonnet-4-6');
  const [claudeKey, setClaudeKey]   = useState('');
  const [geminiKey, setGeminiKey]   = useState('');
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);

  // Sync from loaded settings
  useEffect(() => {
    if (settings) {
      setProvider(settings.active_provider);
      setModel(settings.active_model);
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const data: Record<string, string> = {
        active_provider: provider,
        active_model: model,
      };
      if (claudeKey) data.claude_api_key = claudeKey;
      if (geminiKey) data.gemini_api_key = geminiKey;

      await save(data);
      setSaved(true);
      setClaudeKey('');
      setGeminiKey('');
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // error is shown from hook
    } finally {
      setSaving(false);
    }
  };

  if (!settingsOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) setSettingsOpen(false);
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">AI Builder Settings</h2>
            <p className="text-xs text-gray-400 mt-0.5">Configure your AI provider and API keys</p>
          </div>
          <button
            onClick={() => setSettingsOpen(false)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Provider + Model */}
          <ProviderSelector
            provider={provider}
            model={model}
            models={models}
            onProviderChange={(p) => {
              setProvider(p);
              // Set default model for provider
              if (p === 'claude') setModel('claude-sonnet-4-6');
              else setModel('gemini-2.0-flash');
            }}
            onModelChange={setModel}
          />

          {/* Claude API Key */}
          {provider === 'claude' && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
                Anthropic API Key
              </label>
              <input
                type="password"
                value={claudeKey}
                onChange={(e) => setClaudeKey(e.target.value)}
                placeholder={settings?.has_claude_key ? settings.claude_key_masked : 'sk-ant-...'}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
              />
              {settings?.has_claude_key && !claudeKey && (
                <p className="text-xs text-green-600 mt-1">✅ API key saved</p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                Get your key at{' '}
                <span className="text-violet-600 font-medium">console.anthropic.com</span>
              </p>
            </div>
          )}

          {/* Gemini API Key */}
          {provider === 'gemini' && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
                Google AI API Key
              </label>
              <input
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder={settings?.has_gemini_key ? settings.gemini_key_masked : 'AIza...'}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
              />
              {settings?.has_gemini_key && !geminiKey && (
                <p className="text-xs text-green-600 mt-1">✅ API key saved</p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                Get your key at{' '}
                <span className="text-violet-600 font-medium">aistudio.google.com</span>
              </p>
            </div>
          )}

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={() => setSettingsOpen(false)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 text-white text-sm font-medium px-5 py-2 rounded-xl transition-colors"
          >
            {saving ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving...
              </>
            ) : saved ? (
              <>✅ Saved!</>
            ) : (
              'Save Settings'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
