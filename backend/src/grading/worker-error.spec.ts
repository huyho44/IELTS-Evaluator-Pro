import { expect, it } from 'vitest';
import { workerError } from './worker-error.js';

it('logs nested error codes and frames without messages or credentials', () => {
  const error = new AggregateError([
    Object.assign(new Error('postgresql://user:password@host/db'), {
      code: 'ECONNREFUSED',
    }),
  ], 'secret token');
  const log = workerError(error);
  expect(log).toContain('ECONNREFUSED');
  expect(log).toContain('AggregateError');
  expect(log).toContain('at ');
  expect(log).not.toContain('postgresql://');
  expect(log).not.toContain('secret token');
  expect(log).not.toContain('user:password');
});

it('handles non-errors and circular causes', () => {
  expect(workerError(null)).toContain('UnknownError');
  const error = new Error('private');
  error.cause = error;
  expect(() => workerError(error)).not.toThrow();
  expect(workerError(error)).not.toContain('private');
});
