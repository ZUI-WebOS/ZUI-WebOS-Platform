const secretPatterns: readonly [RegExp, string][] = [
  [/\b(?:password|passphrase|privatekey|token)\s*[=:]\s*\S+/giu, "[REDACTED]"],
  [/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/gu, "[REDACTED_ADDRESS]"],
  [/\b(?:prisoner|developer)@\S+/giu, "[REDACTED_CONNECTION]"],
];

export function sanitize(value: string): string {
  return secretPatterns.reduce((current, [pattern, replacement]) => {
    return current.replace(pattern, replacement);
  }, value);
}

export interface Logger {
  result(value: unknown): void;
  error(value: unknown): void;
}

export function createLogger(json: boolean): Logger {
  const render = (value: unknown): string => {
    const output = json
      ? JSON.stringify(value, null, 2)
      : typeof value === "string"
        ? value
        : JSON.stringify(value, null, 2);
    return sanitize(output);
  };

  return {
    result(value: unknown) {
      process.stdout.write(`${render(value)}\n`);
    },
    error(value: unknown) {
      process.stderr.write(`${render(value)}\n`);
    },
  };
}
