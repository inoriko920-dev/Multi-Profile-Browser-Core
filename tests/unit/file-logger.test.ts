import assert from 'node:assert/strict';
import { test } from 'node:test';
import { redactValue } from '../../src/main/logging/file-logger';

test('redacts sensitive object keys recursively', () => {
  const result = redactValue({
    username: 'user@example.com',
    password: 'secret-password',
    nested: {
      access_token: 'abc123',
      safe: 'visible',
    },
  });

  assert.deepEqual(result, {
    username: 'user@example.com',
    password: '[REDACTED]',
    nested: {
      access_token: '[REDACTED]',
      safe: 'visible',
    },
  });
});

test('redacts bearer values and sensitive URL query values', () => {
  const result = redactValue(
    'Authorization: Bearer abc.def.ghi https://example.test/?token=secret&mode=safe',
  );

  assert.equal(
    result,
    'Authorization: Bearer [REDACTED] https://example.test/?token=[REDACTED]&mode=safe',
  );
});
