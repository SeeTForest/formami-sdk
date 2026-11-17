import assert from 'node:assert/strict';
import test from 'node:test';
import { WebAnalyticsClient, type FormamiTracker } from '../web/index.js';
import { baseConfig } from './helpers.js';

function browserHarness() {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const effects = { storage: 0, dom: 0, globals: 0, sends: 0 };
  const sent: string[] = [];
  const tracker: FormamiTracker = {
    track: async (input?: string | ((properties: Record<string, unknown>) => Record<string, unknown>)) => {
      effects.sends++;
      const payload = typeof input === 'function' ? input({}) : {};
      sent.push(typeof payload.name === 'string' ? payload.name : 'page');
    },
    identify: async () => { effects.sends++; sent.push('identify'); },
  };
  let loaded: FormamiTracker | undefined;
  const scripts: Array<{ listeners: Map<string, () => void> }> = [];
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      get localStorage() {
        effects.storage++;
        throw new Error('Storage is unavailable');
      },
      get formami() { effects.globals++; return loaded; },
      get umami() { effects.globals++; return undefined; },
    },
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      querySelector: () => { effects.dom++; return null; },
      createElement: () => {
        effects.dom++;
        const listeners = new Map<string, () => void>();
        return {
          dataset: {}, listeners,
          addEventListener: (name: string, callback: () => void) => listeners.set(name, callback),
          remove: () => { effects.dom++; },
        };
      },
      head: { appendChild: (script: typeof scripts[number]) => { effects.dom++; scripts.push(script); } },
    },
  });
  return {
    effects, sent, tracker, scripts,
    load: () => { loaded = tracker; scripts.at(-1)?.listeners.get('load')?.(); },
    fail: () => scripts.at(-1)?.listeners.get('error')?.(),
    restore: () => {
      if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
      else Reflect.deleteProperty(globalThis, 'window');
      if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
      else Reflect.deleteProperty(globalThis, 'document');
    },
  };
}

const nextTurn = () => new Promise<void>(resolve => setTimeout(resolve, 0));

function enqueueAll(client: WebAnalyticsClient): void {
  assert.equal(client.track('feature_used', { feature: 'scan' }).accepted, true);
  assert.equal(client.identify('valid_subject_id', { plan: 'free' }).accepted, true);
  assert.equal(client.page({ path: '/home' }).accepted, true);
}

test('all Web hot paths avoid storage, DOM and tracker calls, including overflow and rejection', async t => {
  const browser = browserHarness();
  t.after(browser.restore);
  const client = new WebAnalyticsClient({
    ...baseConfig({ initialConsent: 'granted' }), tracker: browser.tracker, queueCapacity: 2,
  });
  t.after(() => client.disable());
  const before = { ...browser.effects };
  for (let i = 0; i < 1000; i++) enqueueAll(client);
  assert.equal(client.track('unregistered').accepted, false);
  assert.equal(client.identify('person@example.com').accepted, false);
  assert.deepEqual(browser.effects, before);
  await nextTurn();
  assert.deepEqual(browser.sent, ['identify', 'page']);
  assert.equal(browser.effects.storage, before.storage);
});

test('after tracker load failure, all Web hot paths defer retry until after returning', async t => {
  const browser = browserHarness();
  t.after(browser.restore);
  const client = new WebAnalyticsClient(baseConfig({ initialConsent: 'granted' }));
  t.after(() => client.disable());
  browser.fail();
  await nextTurn();
  const before = { ...browser.effects };
  enqueueAll(client);
  assert.deepEqual(browser.effects, before);
  assert.equal(browser.scripts.length, 1);
  await nextTurn();
  assert.equal(browser.scripts.length, 2);
  assert.equal(browser.effects.storage, before.storage);
  browser.load();
  await nextTurn();
  assert.deepEqual(browser.sent, ['feature_used', 'identify', 'page']);
});

for (const action of ['withdrawn', 'disable'] as const) {
  test(`${action} cancels a queued tracker retry and drops all pending Web events`, async t => {
    const browser = browserHarness();
    t.after(browser.restore);
    const client = new WebAnalyticsClient(baseConfig({ initialConsent: 'granted' }));
    browser.fail();
    await nextTurn();
    enqueueAll(client);
    if (action === 'disable') client.disable();
    else client.setConsent('withdrawn');
    const before = { ...browser.effects };
    await nextTurn();
    assert.deepEqual(browser.effects, before);
    assert.equal(browser.scripts.length, 1);
    assert.deepEqual(browser.sent, []);
  });
}

test('withdrawing consent while a tracker loads prevents late completion from sending', async t => {
  const browser = browserHarness();
  t.after(browser.restore);
  const client = new WebAnalyticsClient(baseConfig({ initialConsent: 'granted' }));
  enqueueAll(client);
  client.setConsent('withdrawn');
  browser.load();
  await nextTurn();
  assert.deepEqual(browser.sent, []);
  client.setConsent('granted');
  const before = { ...browser.effects };
  assert.equal(client.page({ path: '/' }).accepted, true);
  assert.deepEqual(browser.effects, before);
  await nextTurn();
  assert.deepEqual(browser.sent, ['page']);
  client.disable();
});
