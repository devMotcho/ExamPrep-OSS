import { useState, useEffect, useCallback } from 'react';
import { useConfig } from '@/lib/config/useConfig';
import { useToast } from '@/context/ToastContext';
import { configService } from '../services/configService';
import { getErrorMessage } from '@/shared/utils/errors';
import { defaultConfig } from '@/lib/config/defaults';
import type { ConfigKey, SiteConfig } from '@/lib/config/types';

export function useSettings() {
  const currentConfig = useConfig();
  const { toast } = useToast();

  const [formData, setFormData] = useState<SiteConfig>({ ...defaultConfig });
  const [baselineConfig, setBaselineConfig] = useState<SiteConfig>({ ...defaultConfig });
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [unsavedGroups, setUnsavedGroups] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchAllSettings = async () => {
      try {
        const response = await configService.getAll();
        const entities = response.data;
        const configMap = entities.reduce((acc: any, entity: any) => {
          acc[entity.key] = entity.value;
          return acc;
        }, {});
        
        const merged = { ...defaultConfig, ...configMap };
        if (active) {
          setFormData(merged);
          setBaselineConfig(merged);
          setLoadingSettings(false);
        }
      } catch (err) {
        console.error('Failed to load full settings:', err);
        // Fallback to public config context if secure endpoint fails
        const merged = { ...defaultConfig, ...currentConfig };
        if (active) {
          setFormData(merged);
          setBaselineConfig(merged);
          setLoadingSettings(false);
        }
      }
    };

    fetchAllSettings();
    return () => {
      active = false;
    };
  }, [currentConfig]);

  const handleChange = useCallback((key: ConfigKey, value: string, group: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setUnsavedGroups((prev) => new Set(prev).add(group));
  }, []);

  const handleReset = useCallback((activeGroup: string) => {
    setFormData({ ...baselineConfig });
    setUnsavedGroups((prev) => {
      const next = new Set(prev);
      next.delete(activeGroup);
      return next;
    });
  }, [baselineConfig]);

  const handleSaveGroup = useCallback(async (
    group: string,
    keysInGroup: ConfigKey[],
  ) => {
    const updates = keysInGroup.reduce((acc, key) => {
      if (formData[key] !== baselineConfig[key]) acc[key] = formData[key];
      return acc;
    }, {} as Record<string, string>);

    if (Object.keys(updates).length === 0) {
      setUnsavedGroups((prev) => { const next = new Set(prev); next.delete(group); return next; });
      return;
    }

    setIsSaving(true);
    try {
      const { data: saved } = await configService.bulkSave(updates);
      // The server can clear a secret that belongs to a changed host or endpoint.
      const cleared = saved.filter((entity: { key: string; value: string }) =>
        entity.value === '' && !(entity.key in updates) && formData[entity.key as ConfigKey]);
      const result = { ...formData };
      cleared.forEach((entity: { key: string }) => { result[entity.key as ConfigKey] = ''; });
      setFormData(result);
      setBaselineConfig(result);
      setUnsavedGroups((prev) => { const next = new Set(prev); next.delete(group); return next; });
      window.dispatchEvent(new CustomEvent('app-config-updated'));
      toast({
        type: 'success',
        message: cleared.length > 0
          ? 'Settings saved. The stored password or secret key was cleared with this change: enter it again.'
          : 'Settings saved successfully.',
      });
    } catch (err) {
      toast({ type: 'error', message: getErrorMessage(err, 'Failed to save settings. Please try again.') });
    } finally {
      setIsSaving(false);
    }
  }, [formData, baselineConfig, toast, setBaselineConfig]);

  return { formData, unsavedGroups, isSaving, loadingSettings, handleChange, handleReset, handleSaveGroup };
}
