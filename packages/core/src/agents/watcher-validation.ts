import { createHash } from 'node:crypto';

export function watcherRecord(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

export function watcherText(value: unknown, max: number, code: string): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > max ||
    /[\u0000-\u001f\u007f]/u.test(value)
  )
    throw new Error(code);
  const normalized = value.trim().normalize('NFC');
  if (normalized.length > max) throw new Error(code);
  return normalized;
}

/** Strict timestamp with explicit timezone; Date.parse alone accepts impossible dates. */
export function watcherTimestamp(value: unknown): string {
  const code = 'WATCHER_INVALID_DATE';
  if (typeof value !== 'string') throw new Error(code);
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/u.exec(
      value,
    );
  if (!match) throw new Error(code);
  const [, year, month, day, hour, minute, second, , zone] = match;
  const y = Number(year),
    m = Number(month),
    d = Number(day);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (
    y < 1 ||
    m < 1 ||
    m > 12 ||
    d < 1 ||
    d > days[m - 1] ||
    Number(hour) > 23 ||
    Number(minute) > 59 ||
    Number(second) > 59 ||
    (zone !== 'Z' &&
      (Number(zone.slice(1, 3)) > 14 ||
        Number(zone.slice(4)) > 59 ||
        (Number(zone.slice(1, 3)) === 14 && Number(zone.slice(4)) !== 0)))
  )
    throw new Error(code);
  const time = Date.parse(value);
  if (!Number.isFinite(time)) throw new Error(code);
  const date = new Date(time);
  if (date.getUTCFullYear() < 1 || date.getUTCFullYear() > 9999) throw new Error(code);
  return date.toISOString();
}

export function watcherRank(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw new Error('WATCHER_INVALID_SOURCE_RANK');
  return value;
}

/** Fixed arrays at call sites define field order; never hash arbitrary object insertion order. */
export function watcherDigest(namespace: string, fields: readonly unknown[]): string {
  return namespace + ':sha256:' + createHash('sha256').update(JSON.stringify(fields)).digest('hex');
}

export function watcherEvidenceFingerprint(value: unknown): string {
  if (typeof value !== 'string' || !/^watcher-evidence\/1:sha256:[a-f0-9]{64}$/u.test(value))
    throw new Error('WATCHER_INVALID_FINGERPRINT');
  return value;
}
