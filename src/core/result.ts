// Small result type shared across src/core. Rejections are values, not thrown
// exceptions: every rule in this module reports "not allowed" as data so the
// UI can react to it instead of catching an exception that reaches a user.

export type Result<T = void> = { ok: true; value: T } | { ok: false; reason: string };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err(reason: string): Result<never> {
  return { ok: false, reason };
}
