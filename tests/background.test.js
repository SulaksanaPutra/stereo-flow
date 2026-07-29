const test = require('node:test');
const assert = require('node:assert');

// Mock Chrome API environment for background worker state tests

class MockChromeStorage {
  constructor() {
    this.data = {};
  }
  async get(keys) {
    if (typeof keys === 'string') {
      return { [keys]: this.data[keys] };
    }
    if (Array.isArray(keys)) {
      const res = {};
      keys.forEach(k => { res[k] = this.data[k]; });
      return res;
    }
    return { ...this.data };
  }
  async set(obj) {
    Object.assign(this.data, obj);
  }
  async clear() {
    this.data = {};
  }
}

test('Background State Management - Tab captured state lifecycle', async () => {
  const sessionStore = new MockChromeStorage();

  // 1. Initial empty state
  let { capturedTabs = {} } = await sessionStore.get('capturedTabs');
  assert.deepStrictEqual(capturedTabs, {});

  // 2. Start tab capture
  const tabId = 101;
  capturedTabs[tabId] = {
    tabId,
    title: 'YouTube Music',
    favIconUrl: 'https://youtube.com/favicon.ico',
    pan: 0,
    volume: 1.5,
    isMuted: false,
    isMono: false
  };
  await sessionStore.set({ capturedTabs });

  // 3. Verify store updated
  let storeState = await sessionStore.get('capturedTabs');
  assert.strictEqual(storeState.capturedTabs[101].volume, 1.5);
  assert.strictEqual(storeState.capturedTabs[101].title, 'YouTube Music');

  // 4. Update Audio Params
  storeState.capturedTabs[101].pan = -0.5;
  storeState.capturedTabs[101].isMono = true;
  await sessionStore.set({ capturedTabs: storeState.capturedTabs });

  let updatedState = await sessionStore.get('capturedTabs');
  assert.strictEqual(updatedState.capturedTabs[101].pan, -0.5);
  assert.strictEqual(updatedState.capturedTabs[101].isMono, true);

  // 5. Clean up tab
  delete updatedState.capturedTabs[101];
  await sessionStore.set({ capturedTabs: updatedState.capturedTabs });

  let finalState = await sessionStore.get('capturedTabs');
  assert.deepStrictEqual(finalState.capturedTabs, {});
});

test('Background State Management - Reset All Tabs action', async () => {
  const sessionStore = new MockChromeStorage();

  const capturedTabs = {
    101: { tabId: 101, pan: -0.8, volume: 2.0, isMuted: true, isMono: false },
    102: { tabId: 102, pan: 0.5, volume: 0.5, isMuted: false, isMono: true }
  };
  await sessionStore.set({ capturedTabs });

  // Perform Reset All
  const { capturedTabs: state } = await sessionStore.get('capturedTabs');
  for (const id in state) {
    state[id].pan = 0;
    state[id].volume = 1.0;
    state[id].isMuted = false;
    state[id].isMono = false;
  }
  await sessionStore.set({ capturedTabs: state });

  const resetState = await sessionStore.get('capturedTabs');
  assert.strictEqual(resetState.capturedTabs[101].pan, 0);
  assert.strictEqual(resetState.capturedTabs[101].volume, 1.0);
  assert.strictEqual(resetState.capturedTabs[101].isMuted, false);

  assert.strictEqual(resetState.capturedTabs[102].pan, 0);
  assert.strictEqual(resetState.capturedTabs[102].volume, 1.0);
  assert.strictEqual(resetState.capturedTabs[102].isMono, false);
});
