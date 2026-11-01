// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { consentedDeviceId, saveConsent } from './telemetryConsent';

describe('telemetry consent', () => {
  beforeEach(() => localStorage.clear());

  it('creates no id before a choice', () => {
    expect(consentedDeviceId()).toBeNull();
    expect(localStorage.getItem('examprep_device_id')).toBeNull();
  });

  it('creates no id for essential only, and removes an old one', () => {
    localStorage.setItem('examprep_device_id', 'old-device-id');
    saveConsent('essential');
    expect(consentedDeviceId()).toBeNull();
    expect(localStorage.getItem('examprep_device_id')).toBeNull();
  });

  it('removes an id left from before consent was asked', () => {
    localStorage.setItem('examprep_device_id', 'old-device-id');
    expect(consentedDeviceId()).toBeNull();
    expect(localStorage.getItem('examprep_device_id')).toBeNull();
  });

  it('creates a stable id after consent', () => {
    saveConsent('visits');
    const id = consentedDeviceId();
    expect(id).toBeTruthy();
    expect(consentedDeviceId()).toBe(id);
  });
});
