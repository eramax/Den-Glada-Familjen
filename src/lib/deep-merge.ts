export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function clone<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => clone(item)) as T;
  if (isPlainObject(value)) {
    const copy: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) copy[key] = clone(item);
    return copy as T;
  }
  return value;
}

function mergeTwo(base: unknown, override: unknown): unknown {
  if (override === undefined) return clone(base);
  if (Array.isArray(override)) return override.map((item) => clone(item));
  if (isPlainObject(base) && isPlainObject(override)) {
    const merged: Record<string, unknown> = clone(base);
    for (const [key, value] of Object.entries(override)) {
      merged[key] = mergeTwo(merged[key], value);
    }
    return merged;
  }
  return clone(override);
}

/**
 * Deep merge where arrays are replaced (not concatenated) and the base object
 * is never mutated. Used to layer edited Markdown content over the fallback
 * dictionaries.
 */
export function deepMerge<T>(base: T, ...overrides: unknown[]): T {
  let result: unknown = clone(base);
  for (const override of overrides) result = mergeTwo(result, override);
  return result as T;
}
