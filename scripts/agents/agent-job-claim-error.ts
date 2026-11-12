/** QA-only diagnostic for claim_next_agent_job failures. Never log raw RPC errors. */
const safeRpcCodes = new Set([
  '42501', // permission denied
  '57014', // query cancelled / statement timeout
  '55P03', // lock not available
  '53300', // too many connections
  '08000', '08001', '08003', '08004', '08006', '08007', '08P01', // connection failures
  'PGRST000', 'PGRST001', 'PGRST002', 'PGRST003', // PostgREST connectivity/pool
  'PGRST202', // RPC not found in schema cache
  'PGRST301', // JWT invalid
]);

export function safeJobClaimRpcCode(value: unknown): string {
  if (typeof value !== 'object' || value === null || !('code' in value)) return 'UNKNOWN';
  const code = value.code;
  return typeof code === 'string' && safeRpcCodes.has(code) ? code : 'UNKNOWN';
}

export function createJobClaimError(value: unknown): Error {
  return new Error(`AGENT_JOB_CLAIM_FAILED [${safeJobClaimRpcCode(value)}]`);
}
