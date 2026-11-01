import { useState, useEffect } from 'react';
import { useConfig } from '@/lib/config/useConfig';
import { fetchEnabledOAuthProviders } from '../services/oauthService';

type OAuthProvider = 'google' | 'microsoft';

interface UseOAuthProvidersResult {
  /** Providers enabled at the env level AND at the site_config level. */
  providers: OAuthProvider[];
  loading: boolean;
}

/**
 * Returns the list of OAuth2 providers that are enabled.
 *
 * A provider is shown only when **both** conditions are true:
 *  1. The env-level flag is on (`OAUTH_*_ENABLED=true`) → confirmed via the
 *     `/auth/oauth2/providers` API endpoint.
 *  2. The runtime site_config toggle is `'true'` (`oauth_*_enabled` key) →
 *     read via the existing `useConfig()` hook.
 *
 * This dual-gate means an admin can enable/disable providers in the Settings
 * panel without touching env variables.
 */
export function useOAuthProviders(): UseOAuthProvidersResult {
  const config = useConfig();
  const [envProviders, setEnvProviders] = useState<OAuthProvider[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEnabledOAuthProviders().then((list) => {
      setEnvProviders(list);
      setLoading(false);
    });
  }, []);

  // Filter by the runtime site_config toggle on top of the env-level flag
  const providers = envProviders.filter((p) => {
    if (p === 'google') return config.oauth_google_enabled === 'true';
    if (p === 'microsoft') return config.oauth_microsoft_enabled === 'true';
    return false;
  });

  return { providers, loading };
}
