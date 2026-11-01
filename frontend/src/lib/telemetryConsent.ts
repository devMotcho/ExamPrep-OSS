const CONSENT_KEY = 'cookie_consent';
const DEVICE_KEY = 'examprep_device_id';
export const CONSENT_CHANGED_EVENT = 'cookie-consent-changed';

export type ConsentChoice = 'essential' | 'visits';

export const readConsent = (): string | null => {
  try {
    return localStorage.getItem(CONSENT_KEY);
  } catch {
    return null;
  }
};

export const saveConsent = (choice: ConsentChoice): void => {
  try {
    localStorage.setItem(CONSENT_KEY, choice);
    if (choice !== 'visits') localStorage.removeItem(DEVICE_KEY);
  } catch {
    // Without storage the banner returns next time, and nothing is counted.
  }
  window.dispatchEvent(new Event(CONSENT_CHANGED_EVENT));
};

/** The id visits are counted under. It only exists after the visitor agreed to it, and is removed otherwise. */
export const consentedDeviceId = (): string | null => {
  try {
    if (readConsent() !== 'visits') {
      localStorage.removeItem(DEVICE_KEY);
      return null;
    }
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
};
