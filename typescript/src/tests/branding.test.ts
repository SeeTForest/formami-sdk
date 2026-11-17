import assert from 'node:assert/strict';
import test from 'node:test';
import type { FormamiPayload, FormamiRequest, UmamiPayload, UmamiRequest } from '../core/index.js';
import { FormamiHttpTransport, UmamiHttpTransport } from '../node/index.js';
import { WebAnalyticsClient, type FormamiTracker, type UmamiTracker } from '../web/index.js';
import { baseConfig } from './helpers.js';

test('legacy public types and transport imports remain compatible', () => {
  const payload: UmamiPayload = { website: baseConfig().websiteId };
  const currentPayload: FormamiPayload = payload;
  const legacy: UmamiRequest = { type: 'event', payload: currentPayload };
  const current: FormamiRequest = legacy;
  assert.equal(current, legacy);
  assert.equal(FormamiHttpTransport, UmamiHttpTransport);
});

test('browser prefers Formami, falls back to Umami and controls both consent keys', async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  try {
    for (const currentGlobal of [true, false]) {
      let currentCalls = 0;
      let legacyCalls = 0;
      const currentTracker: FormamiTracker = {
        track: async () => { currentCalls++; }, identify: async () => undefined,
      };
      const legacyTracker: UmamiTracker = {
        track: async () => { legacyCalls++; }, identify: async () => undefined,
      };
      const storage = new Map<string, string>();
      const fakeWindow = {
        ...(currentGlobal ? { formami: currentTracker } : {}),
        umami: legacyTracker,
        localStorage: {
          setItem: (key: string, value: string) => storage.set(key, value),
          removeItem: (key: string) => storage.delete(key),
        },
      };
      Object.defineProperty(globalThis, 'window', { configurable: true, value: fakeWindow });
      Object.defineProperty(globalThis, 'document', { configurable: true, value: {} });
      const client = new WebAnalyticsClient(baseConfig());
      assert.equal(client.track('feature_used', { feature: 'scan' }).accepted, false);
      client.setConsent('granted');
      client.track('feature_used', { feature: 'scan' });
      await client.flush();
      assert.equal(currentCalls, currentGlobal ? 1 : 0);
      assert.equal(legacyCalls, currentGlobal ? 0 : 1);
      client.setConsent('withdrawn');
      assert.equal(storage.get('formami.disabled'), '1');
      assert.equal(storage.get('umami.disabled'), '1');
      client.setConsent('granted');
      assert.equal(storage.size, 0);
      client.disable();
      assert.equal(storage.size, 2);
      assert.equal(client.track('feature_used', { feature: 'scan' }).code, 'disabled');
    }
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
