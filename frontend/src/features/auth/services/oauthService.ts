import { axiosInstance } from '@/api/axiosInstance';

export interface OAuthProvidersResponse {
  providers: ('google' | 'microsoft')[];
}

/**
 * Fetches the list of OAuth2 providers that are currently enabled at the
 * infrastructure level (env-flag enabled). Returns an empty array on error
 * so that the UI degrades gracefully when the backend is unreachable.
 */
export async function fetchEnabledOAuthProviders(): Promise<OAuthProvidersResponse['providers']> {
  try {
    const response = await axiosInstance.get<OAuthProvidersResponse>('/auth/oauth2/providers');
    return response.data.providers ?? [];
  } catch {
    return [];
  }
}
