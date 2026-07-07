import { RuleMatch } from './types';

/** Run a regex globally over content, collecting matches via a builder callback. */
export function scan(
  content: string,
  pattern: RegExp,
  buildMatch: (m: RegExpExecArray) => RuleMatch | null,
): RuleMatch[] {
  const results: RuleMatch[] = [];
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `g${pattern.flags}`);
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const result = buildMatch(m);
    if (result !== null) results.push(result);
  }
  return results;
}

/** Build a fix function that applies a single global regex replacement. */
export function globalReplace(
  from: RegExp,
  to: string | ((m: string, ...g: string[]) => string),
): (content: string) => string {
  return (content) =>
    content.replace(
      new RegExp(from.source, from.flags.includes('g') ? from.flags : `g${from.flags}`),
      to as string,
    );
}

/** Escape forward slashes for use inside a RegExp string literal. */
export function escPath(p: string): string {
  return p.replace(/\//g, '\\/');
}

/**
 * Extract the leading major version number from a semver/range string.
 * Handles common prefixes: ^, ~, >=, <=, >, <, =.
 *   "^16.0.0" → 16
 *   ">=18.0.0" → 18
 *   "17.0.0"  → 17
 * Returns NaN if no leading digit sequence is found.
 */
export function parseMajorVersion(ver: string): number {
  const stripped = ver.replace(/^[^\d]+/, '');
  return parseInt(stripped, 10);
}
