const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

export class InvalidBrowserUrlError extends Error {
  public constructor(public readonly input: string) {
    super('Only valid HTTP(S) URLs are allowed.');
    this.name = 'InvalidBrowserUrlError';
  }
}

export function normalizeBrowserUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new InvalidBrowserUrlError(input);
  }

  const candidate = /^[a-zA-Z][a-zA-Z\d+.-]*:/u.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new InvalidBrowserUrlError(input);
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol) || !parsed.hostname) {
    throw new InvalidBrowserUrlError(input);
  }

  return parsed.toString();
}

export function safeUrlForLog(input: string): string {
  try {
    const parsed = new URL(input);
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
      return parsed.protocol;
    }

    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return '[INVALID_URL]';
  }
}
