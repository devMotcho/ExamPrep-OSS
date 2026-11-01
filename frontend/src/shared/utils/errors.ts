/**
 * Safely extracts an error message from an unknown catch value.
 * Replaces all `(err as any).response?.data?.message` patterns.
 */
export function getErrorMessage(err: unknown, fallback = 'An unexpected error occurred.'): string {
  if (typeof err === 'object' && err !== null) {
    const obj = err as Record<string, unknown>;
    const response = obj['response'];
    if (typeof response === 'object' && response !== null) {
      const data = (response as Record<string, unknown>)['data'];
      if (typeof data === 'object' && data !== null) {
        const message = (data as Record<string, unknown>)['message'];
        if (typeof message === 'string') return message;
      }
      // Map generic status codes to human-readable error messages if no custom message was returned
      const status = (response as Record<string, unknown>)['status'];
      if (status === 401) {
        return 'Invalid email or password. Please try again.';
      }
      if (status === 403) {
        return 'You do not have permission to perform this action.';
      }
      if (status === 404) {
        return 'The requested resource could not be found.';
      }
      if (status && typeof status === 'number' && status >= 500) {
        return 'Internal server error. Please try again later.';
      }
    }
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

/**
 * Extracts a field-level error map from an API validation response.
 * Returns null if the response is not a validation error.
 */
export function getFieldErrors(err: unknown): Record<string, string> | null {
  if (typeof err === 'object' && err !== null) {
    const obj = err as Record<string, unknown>;
    const response = obj['response'];
    if (typeof response === 'object' && response !== null) {
      const data = (response as Record<string, unknown>)['data'];
      if (typeof data === 'object' && data !== null) {
        const errors = (data as Record<string, unknown>)['errors'];
        if (typeof errors === 'object' && errors !== null) {
          return errors as Record<string, string>;
        }
      }
    }
  }
  return null;
}
