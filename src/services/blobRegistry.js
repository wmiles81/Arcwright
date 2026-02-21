/**
 * In-memory registry mapping artifact file paths to blob URLs.
 * Blob URLs are session-scoped — they cannot be persisted across reloads.
 * This module creates/revokes blob URLs as images are generated or loaded.
 */

const registry = new Map();

/**
 * Register a blob URL for an artifact path.
 * If one already exists for that path, revoke the old one first.
 */
export function registerBlob(path, blob) {
  const existing = registry.get(path);
  if (existing) URL.revokeObjectURL(existing);
  const url = URL.createObjectURL(blob);
  registry.set(path, url);
  return url;
}

/**
 * Get the blob URL for a path, or null if not registered.
 */
export function getBlobUrl(path) {
  return registry.get(path) || null;
}

/**
 * Revoke and remove a blob URL.
 */
export function revokeBlob(path) {
  const url = registry.get(path);
  if (url) {
    URL.revokeObjectURL(url);
    registry.delete(path);
  }
}
