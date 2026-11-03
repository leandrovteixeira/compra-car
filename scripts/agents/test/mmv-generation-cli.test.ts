import { describe, expect, it } from 'vitest';
import { parseAgentArguments } from '../run-new-product-check';

describe('MMV generation sidecar CLI gate', () => {
  it('accepts an explicit generation-evidence document for a normal MMV run', () => {
    const args = parseAgentArguments([
      '--brand','Toyota','--provider','fixture',
      '--generation-evidence','docs/agents/my-generation-evidence.json',
    ]);
    expect(args.generationEvidencePath).toBe('docs/agents/my-generation-evidence.json');
    expect(args.discoveryOnly).toBe(false);
    expect(args.persistFindings).toBe(false);
  });
  it('keeps legacy runs unchanged by default', () => {
    expect(parseAgentArguments(['--brand','Toyota','--provider','fixture'])
      .generationEvidencePath).toBeNull();
  });
  it('rejects discovery-only, duplicate and missing sidecars', () => {
    expect(() => parseAgentArguments([
      '--brand','Toyota','--provider','fixture',
      '--discovery-only','--generation-evidence','x.json',
    ])).toThrow('INVALID_AGENT_ARGUMENTS');
    expect(() => parseAgentArguments([
      '--brand','Toyota','--provider','fixture',
      '--generation-evidence','x.json','--generation-evidence','y.json',
    ])).toThrow('INVALID_AGENT_ARGUMENTS');
    expect(() => parseAgentArguments([
      '--brand','Toyota','--provider','fixture','--generation-evidence',
    ])).toThrow('INVALID_AGENT_ARGUMENTS');
  });
});
