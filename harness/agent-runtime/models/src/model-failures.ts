import {
  CONTEXT_WINDOW_EXCEEDED_CODE,
  LlmError,
  ProviderRequestId,
  QUOTA_EXCEEDED_CODE,
} from '@deepseek-ai/dsh-llm';
import { z } from 'zod';

const providerError = z.object({
  code: z.string().min(1).nullish(),
  type: z.string().min(1).nullish(),
});
const errorEnvelope = z.object({ error: providerError });
const quotaCodes = new Set([
  'insufficient_quota',
  'credit_balance_exhausted',
  'organization_spend_limit_exceeded',
  'project_spend_limit_exceeded',
  'organization_usage_limit_exceeded',
]);

// 只使用结构化 code/type，不读取可能包含私密内容的 provider message。
export function modelProviderFailureCode(value: unknown): string {
  const parsed = providerError.safeParse(value);
  if (!parsed.success) return 'PROVIDER_ERROR';
  const { code, type } = parsed.data;
  if (code === 'context_length_exceeded') return CONTEXT_WINDOW_EXCEEDED_CODE;
  if ((code && quotaCodes.has(code)) || type === 'insufficient_quota') return QUOTA_EXCEEDED_CODE;
  if (code === 'rate_limit_exceeded' || code === 'slow_down' || type === 'rate_limit_error')
    return 'RATE_LIMIT';
  if (
    code === 'server_error' ||
    code === 'server_is_overloaded' ||
    type === 'service_unavailable_error'
  )
    return 'SERVER';
  return 'PROVIDER_ERROR';
}

export function modelHttpFailureCode(status: number, value: unknown): string {
  if (!Number.isInteger(status) || status < 400 || status > 599)
    throw new Error('Model HTTP failure requires a status from 400 through 599.');
  if (status === 401 || status === 403) return 'AUTH';
  const code = modelProviderFailureCode(value);
  if ((status === 400 || status === 413) && code === CONTEXT_WINDOW_EXCEEDED_CODE) return code;
  if (status === 429) return code === QUOTA_EXCEEDED_CODE ? code : 'RATE_LIMIT';
  if (status >= 500) return 'SERVER';
  if (status === 408) return 'TIMEOUT';
  return 'HTTP_ERROR';
}

export function modelRetryAfterMs(value: string | null, now = Date.now()): number | undefined {
  if (!value?.trim()) return undefined;
  const seconds = Number(value);
  const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - now;
  return Number.isFinite(delay) && delay > 0 ? delay : undefined;
}

async function httpProviderError(
  response: Response,
  maxBytes: number,
  signal: AbortSignal,
): Promise<unknown> {
  signal.throwIfAborted();
  if (![400, 413, 429].includes(response.status) || !response.body) return undefined;
  const mediaType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
  if (!mediaType || !/^application\/(?:[a-z0-9.+-]+\+)?json$/.test(mediaType)) return undefined;
  const reader = response.body.getReader();
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) return undefined;
      chunks.push(value);
    }
    let value: unknown;
    try {
      value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      return undefined;
    }
    const parsed = errorEnvelope.safeParse(value);
    return parsed.success ? parsed.data.error : undefined;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function modelHttpFailure(
  response: Response,
  maxBytes: number,
  signal: AbortSignal,
): Promise<LlmError> {
  signal.throwIfAborted();
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0)
    throw new Error('Model HTTP error byte limit must be a positive safe integer.');
  if (response.status < 400 || response.status > 599)
    throw new Error('Model HTTP failure requires a status from 400 through 599.');
  const provider = await httpProviderError(response, Math.min(maxBytes, 64 * 1024), signal);
  signal.throwIfAborted();
  const requestId = response.headers.get('x-request-id')?.trim();
  const delay = modelRetryAfterMs(response.headers.get('retry-after'));
  return new LlmError(
    `Model endpoint returned HTTP ${response.status}.`,
    modelHttpFailureCode(response.status, provider),
    {
      status: response.status,
      ...(delay === undefined ? {} : { providerRetryAfterMs: delay }),
      ...(requestId ? { requestId: ProviderRequestId(requestId) } : {}),
    },
  );
}
