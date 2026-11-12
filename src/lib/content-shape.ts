import { isPlainObject } from './deep-merge';

function shapeForArray(items: unknown[]): unknown {
  if (items.length === 0) return undefined;

  if (items.every((item) => isPlainObject(item))) {
    const shape: Record<string, unknown> = {};
    for (const item of items) {
      for (const [key, value] of Object.entries(item)) {
        if (!(key in shape)) shape[key] = value;
      }
    }
    return shape;
  }

  return items[0];
}

/**
 * Ensures the edited Markdown keeps the same keys and value types as the
 * fallback dictionary. This runs at build time so a typo in the admin panel
 * fails the build instead of silently rendering an empty page.
 */
export function assertShape(
  defaults: unknown,
  value: unknown,
  path = 'content',
): void {
  if (value === undefined) return;

  if (Array.isArray(defaults)) {
    if (!Array.isArray(value)) {
      throw new Error(`[content] "${path}" must be an array.`);
    }
    const itemShape = shapeForArray(defaults);
    if (itemShape === undefined) return;
    value.forEach((item, index) => {
      assertShape(itemShape, item, `${path}[${index}]`);
    });
    return;
  }

  if (isPlainObject(defaults)) {
    if (!isPlainObject(value)) {
      throw new Error(`[content] "${path}" must be an object.`);
    }
    for (const [key, item] of Object.entries(value)) {
      if (!(key in defaults)) {
        throw new Error(`[content] Unknown key "${path}.${key}".`);
      }
      assertShape(defaults[key], item, `${path}.${key}`);
    }
    return;
  }

  if (typeof value !== typeof defaults) {
    throw new Error(
      `[content] "${path}" must be ${typeof defaults}, got ${typeof value}.`,
    );
  }
}
