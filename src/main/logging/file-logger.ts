import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const REDACTED = '[REDACTED]';
const SENSITIVE_KEY = /(?:password|passwd|token|access_token|refresh_token|cookie|set-cookie|authorization|otp|recovery_code|client_secret)/i;
const BEARER_VALUE = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;
const SENSITIVE_QUERY = /([?&](?:token|access_token|refresh_token|code|key|secret)=)[^&#\s]+/gi;

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogContext = Record<string, unknown>;

export function redactValue(value: unknown, keyHint?: string): unknown {
  if (keyHint && SENSITIVE_KEY.test(keyHint)) {
    return REDACTED;
  }

  if (typeof value === 'string') {
    return value
      .replace(BEARER_VALUE, 'Bearer [REDACTED]')
      .replace(SENSITIVE_QUERY, '$1[REDACTED]');
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, redactValue(nested, key)]),
    );
  }

  return value;
}

export function normalizeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return { value: String(error) };
}

export class FileLogger {
  private readonly filePath: string;

  public constructor(logDirectory: string) {
    mkdirSync(logDirectory, { recursive: true });
    this.filePath = join(logDirectory, 'foundation.jsonl');
  }

  public debug(event: string, context: LogContext = {}): void {
    this.write('debug', event, context);
  }

  public info(event: string, context: LogContext = {}): void {
    this.write('info', event, context);
  }

  public warn(event: string, context: LogContext = {}): void {
    this.write('warn', event, context);
  }

  public error(event: string, context: LogContext = {}): void {
    this.write('error', event, context);
  }

  private write(level: LogLevel, event: string, context: LogContext): void {
    const payload = {
      timestamp: new Date().toISOString(),
      level,
      event,
      context: redactValue(context),
    };

    appendFileSync(this.filePath, `${JSON.stringify(payload)}\n`, { encoding: 'utf8' });
  }
}
