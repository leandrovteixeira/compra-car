import { describe, it, expect } from 'vitest';
import { createJobClaimError, safeJobClaimRpcCode } from '../agent-job-claim-error';

describe('QA agent worker: sanitize RPC claim failures', () => {
  it('keeps only allowlisted RPC/SQLSTATE codes', () => {
    expect(safeJobClaimRpcCode({ code: 'PGRST202', message: 'secret-token' })).toBe('PGRST202');
    expect(safeJobClaimRpcCode({ code: '42501' })).toBe('42501');
    expect(safeJobClaimRpcCode({ code: '55P03' })).toBe('55P03');
  });
  it('does not emit provider messages or unknown codes', () => {
    expect(safeJobClaimRpcCode({ code: 'CUSTOM-secret-token' })).toBe('UNKNOWN');
    expect(safeJobClaimRpcCode(undefined)).toBe('UNKNOWN');
    expect(createJobClaimError({ code: 'PGRST202', details: 'secret-token' }).message)
      .toBe('AGENT_JOB_CLAIM_FAILED [PGRST202]');
    expect(createJobClaimError({ code: 'PGRST202 secret-token' }).message)
      .toBe('AGENT_JOB_CLAIM_FAILED [UNKNOWN]');
  });
});
