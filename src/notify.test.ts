
import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { sendTelegram, deps } from './notify.ts';

// Save original deps to restore after tests
const originalDeps = { ...deps };

describe('sendTelegram', () => {
  // Save original env
  const originalEnv = { ...process.env };

  before(() => {
    process.env.TELEGRAM_BOT_TOKEN = 'test_token';
    process.env.TELEGRAM_CHAT_ID = 'test_chat_id';
  });

  after(() => {
    process.env = originalEnv;
  });

  // Restore deps after each test
  afterEach(() => {
    Object.assign(deps, originalDeps);
  });

  it('should use direct API first', async () => {
    // Mock isQuietHours
    deps.isQuietHours = () => false;

    // Mock sendTelegramDirect to succeed
    let directCalled = false;
    deps.sendTelegramDirect = async (msg) => {
      directCalled = true;
      assert.strictEqual(msg, 'test message');
      return true;
    };

    // Mock execSync to fail if called
    deps.execSync = (() => {
      throw new Error('Should not call execSync');
    }) as any;

    const result = await sendTelegram('test message');
    assert.strictEqual(result, true);
    assert.strictEqual(directCalled, true);
  });

  it('should fallback to execSync if direct API fails', async () => {
    // Mock isQuietHours
    deps.isQuietHours = () => false;

    // Mock sendTelegramDirect to fail
    deps.sendTelegramDirect = async () => false;

    // Mock execSync to succeed and capture args
    let execCalled = false;
    deps.execSync = ((cmd: string, opts: any) => {
      execCalled = true;
      assert.ok(cmd.includes('openclaw message send'));
      assert.ok(cmd.includes('--message \'test message\''));
      assert.strictEqual(opts.timeout, 10000);
      return 'ok';
    }) as any;

    const result = await sendTelegram('test message');
    assert.strictEqual(result, true);
    assert.strictEqual(execCalled, true);
  });

  it('should handle quiet hours', async () => {
    // Mock isQuietHours to true
    deps.isQuietHours = () => true;

    // Mock others to ensure they are not called
    deps.sendTelegramDirect = async () => { throw new Error('Should not be called'); return false; };
    deps.execSync = (() => { throw new Error('Should not be called'); return ""; }) as any;

    const result = await sendTelegram('test message');
    assert.strictEqual(result, false);
  });

  it('should return false if both methods fail', async () => {
    // Mock isQuietHours
    deps.isQuietHours = () => false;

    // Mock sendTelegramDirect to fail
    deps.sendTelegramDirect = async () => false;

    // Mock execSync to throw
    deps.execSync = (() => {
      throw new Error('Exec failed');
    }) as any;

    // Suppress console.error for this test
    const originalConsoleError = console.error;
    console.error = () => {};

    try {
        const result = await sendTelegram('test message');
        assert.strictEqual(result, false);
    } finally {
        console.error = originalConsoleError;
    }
  });
});
