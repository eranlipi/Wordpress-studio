import { useEffect, useCallback } from 'react';
import { getSettings, saveSettings, getModels } from '../api/client';
import { useAppStore } from '../store/appStore';
import type { Settings, ModelsResponse } from '../types';
import { useState } from 'react';

export function useSettings() {
  const { settings, setSettings } = useAppStore();
  const [models, setModels] = useState<ModelsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      const s = await getSettings();
      setSettings(s);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load settings';
      setError(msg);
    }
  }, [setSettings]);

  const loadModels = useCallback(async () => {
    try {
      const m = await getModels();
      setModels(m);
    } catch {
      // non-critical
    }
  }, []);

  const save = useCallback(
    async (data: Record<string, string>): Promise<Settings> => {
      setLoading(true);
      setError(null);
      try {
        const result = await saveSettings(data);
        setSettings(result.settings);
        return result.settings;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to save settings';
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [setSettings]
  );

  useEffect(() => {
    loadSettings();
    loadModels();
  }, [loadSettings, loadModels]);

  return { settings, models, loading, error, save, reload: loadSettings };
}
