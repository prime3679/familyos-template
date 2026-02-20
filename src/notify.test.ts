import { test } from 'node:test';
import assert from 'node:assert';
import { formatAlert } from './notify.ts';

test('formatAlert - basic formatting', () => {
  const message = 'Something happened';
  const expected = '🔔 *FamilyOS Alert*\n\nSomething happened';
  assert.strictEqual(formatAlert(message), expected);
});

test('formatAlert - empty message', () => {
  const message = '';
  const expected = '🔔 *FamilyOS Alert*\n\n';
  assert.strictEqual(formatAlert(message), expected);
});

test('formatAlert - special characters', () => {
  const message = '!@#$%^&*()_+';
  const expected = '🔔 *FamilyOS Alert*\n\n!@#$%^&*()_+';
  assert.strictEqual(formatAlert(message), expected);
});
