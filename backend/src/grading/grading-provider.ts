import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
export class ProviderFailure extends Error {
  constructor(
    public readonly code: string,
    public readonly retryable: boolean,
  ) {
    super(code);
  }
}
@Injectable()
export class GradingProvider {
  // Provider-neutral JSON gateway. Endpoint and credentials are server-only environment settings.
  async evaluate(input: {
    model: string;
    instructions: string;
    schema: Prisma.JsonValue;
    settings: Prisma.JsonValue;
    context: unknown;
  }): Promise<unknown> {
    const endpoint = process.env.GRADING_PROVIDER_URL;
    if (!endpoint) throw new ProviderFailure('PROVIDER_NOT_CONFIGURED', false);
    let url: URL;
    try {
      url = new URL(endpoint);
    } catch {
      throw new ProviderFailure('PROVIDER_NOT_CONFIGURED', false);
    }
    if (
      url.protocol !== 'https:' &&
      !(
        url.protocol === 'http:' &&
        ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      )
    )
      throw new ProviderFailure('INSECURE_PROVIDER_URL', false);
    try {
      const response = await fetch(url, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(45000),
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.GRADING_PROVIDER_KEY
            ? { Authorization: 'Bearer ' + process.env.GRADING_PROVIDER_KEY }
            : {}),
        },
        body: JSON.stringify(input),
      });
      if (!response.ok)
        throw new ProviderFailure(
          'HTTP_' + response.status,
          response.status === 429 || response.status >= 500,
        );
      // Bound raw output before parsing or persisting it.
      const reader = response.body?.getReader();
      if (!reader) throw new ProviderFailure('EMPTY_PROVIDER_RESPONSE', false);
      const chunks: Uint8Array[] = [];
      let length = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > 1024 * 1024) {
          await reader.cancel();
          throw new ProviderFailure('PROVIDER_RESPONSE_TOO_LARGE', false);
        }
        chunks.push(value);
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch (error) {
      if (error instanceof ProviderFailure) throw error;
      if (error instanceof SyntaxError)
        throw new ProviderFailure('INVALID_JSON', false);
      throw new ProviderFailure('PROVIDER_UNAVAILABLE', true);
    }
  }
}
