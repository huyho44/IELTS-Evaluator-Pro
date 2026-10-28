// Error messages/meta can contain connection strings, SQL parameters or provider
// payloads. Keep only diagnostic identifiers and stack frames, never messages.
export function workerError(error: unknown): string {
  const seen = new Set<unknown>();
  function describe(value: unknown, depth = 0): unknown {
    if (!value || typeof value !== 'object' || depth > 4 || seen.has(value))
      return undefined;
    seen.add(value);
    const item = value as Record<string, unknown>;
    const identifier = (v: unknown) =>
      typeof v === 'string' && /^[A-Za-z0-9_]+$/.test(v) ? v : undefined;
    return {
      name: identifier(item.name),
      code: identifier(item.code),
      stack: typeof item.stack === 'string'
        ? item.stack.split('\n').filter(line => /^\s+at /.test(line) && !/[:/]\/|password|token|secret|@/i.test(line)).join('\n')
        : undefined,
      cause: describe(item.cause, depth + 1),
      errors: Array.isArray(item.errors)
        ? item.errors.map(child => describe(child, depth + 1)) : undefined,
    };
  }
  return JSON.stringify(describe(error) ?? { name: 'UnknownError' });
}
