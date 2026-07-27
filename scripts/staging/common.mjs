import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export const STAGING_REF = 'shfsjyjxmgwnlexmdkcs';
export const OPERATIONAL_REF = 'ltbeykzccckdwpzyeywu';
export const SAMPLE_PATH = new URL('./.data/minimal-sample.json', import.meta.url);
const STAGING_HOSTNAME = `${STAGING_REF}.supabase.co`;
const OPERATIONAL_HOSTNAME = `${OPERATIONAL_REF}.supabase.co`;

export function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function validatedSupabaseUrl(value, expectedHostname, label) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} URL is invalid.`);
  }
  if (
    parsed.protocol !== 'https:' ||
    parsed.hostname !== expectedHostname ||
    parsed.username ||
    parsed.password ||
    parsed.port ||
    parsed.pathname !== '/' ||
    parsed.search ||
    parsed.hash
  )
    throw new Error(
      `${label} URL must be exactly https://${expectedHostname}/ without credentials.`,
    );
  return parsed.origin;
}

export function assertStaging() {
  const ref = required('STAGING_PROJECT_REF');
  if (ref === OPERATIONAL_REF) throw new Error('Refusing to write to the operational project.');
  if (ref !== STAGING_REF) throw new Error(`Unexpected staging ref: ${ref}`);
  const url = validatedSupabaseUrl(required('STAGING_SUPABASE_URL'), STAGING_HOSTNAME, 'Staging');
  return { url, key: required('STAGING_SERVICE_ROLE_KEY') };
}

export function assertOperationalReadOnly() {
  const ref = required('OPERATIONAL_PROJECT_REF');
  if (ref !== OPERATIONAL_REF) throw new Error(`Unexpected operational ref: ${ref}`);
  const url = validatedSupabaseUrl(
    required('OPERATIONAL_SUPABASE_URL'),
    OPERATIONAL_HOSTNAME,
    'Operational',
  );
  return { url, key: required('OPERATIONAL_PUBLISHABLE_KEY') };
}

export async function operationalGet(path) {
  const { url, key } = assertOperationalReadOnly();
  if (typeof path !== 'string' || !path.startsWith('/rest/v1/'))
    throw new Error('Operational reads are limited to REST table GET requests.');
  const response = await fetch(`${url}${path}`, {
    method: 'GET',
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`GET ${path}: ${response.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

export async function request(base, key, path, options = {}) {
  const contentHeaders = options.body ? { 'Content-Type': 'application/json' } : {};
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...contentHeaders,
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  if (!response.ok)
    throw new Error(`${options.method ?? 'GET'} ${path}: ${response.status} ${text}`);
  return { data: text ? JSON.parse(text) : null, headers: response.headers };
}

export async function exactCount(base, key, table, filter = '') {
  const result = await request(base, key, `/rest/v1/${table}?select=*&limit=1${filter}`, {
    headers: { Prefer: 'count=exact' },
  });
  return Number(result.headers.get('content-range')?.split('/')[1]);
}

export async function saveSample(sample) {
  await mkdir(dirname(SAMPLE_PATH.pathname.slice(1)), { recursive: true });
  await writeFile(SAMPLE_PATH, `${JSON.stringify(sample, null, 2)}\n`, 'utf8');
}

export async function loadSample() {
  return JSON.parse(await readFile(SAMPLE_PATH, 'utf8'));
}

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function todayWindow() {
  const start = new Date().toISOString().slice(0, 10);
  const endDate = new Date(`${start}T00:00:00Z`);
  endDate.setUTCDate(endDate.getUTCDate() + 30);
  return { start, end: endDate.toISOString().slice(0, 10) };
}
