import { useConfig } from './useConfig';
import { ConfigKey, SiteConfig } from './types';

export const useConfigValue = <K extends ConfigKey>(key: K): SiteConfig[K] => {
  const config = useConfig();
  return config[key];
};
