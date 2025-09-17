export const safeStr = (v: any, fallback = ''): string =>
  (v ?? fallback).toString();

export const joinWithSpace = (
  ...parts: Array<string | null | undefined>
): string =>
  parts
    .filter(Boolean)
    .map((p) => String(p).trim())
    .filter(Boolean)
    .join(' ');
