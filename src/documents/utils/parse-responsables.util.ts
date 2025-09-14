export function parseResponsables(input: unknown): any {
  if (typeof input === 'string') {
    try {
      return JSON.parse(input);
    } catch {
      return null;
    }
  }
  if (input && typeof input === 'object') {
    return input as any;
  }
  return null;
}

