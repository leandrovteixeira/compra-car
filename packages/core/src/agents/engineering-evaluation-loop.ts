import { evaluateEngineeringIteration, type EngineeringIterationInput } from './engineering-iteration-gate';

export interface EngineeringPatchProposal {
  readonly id: string;
  readonly hypothesis: string;
  readonly changedPaths: readonly string[];
  readonly expectedImpact: string;
}
export interface EngineeringCandidateResult {
  readonly proposal: EngineeringPatchProposal;
  readonly outcome: 'REJECTED' | 'READY_FOR_REVIEW';
  readonly reasons: readonly string[];
  readonly costDeltaUsd: number | null;
}
export interface EngineeringLoopResult {
  readonly iterations: readonly EngineeringCandidateResult[];
  readonly stopReason: 'NO_CANDIDATES' | 'ITERATION_LIMIT' | 'PLATEAU' | 'HUMAN_REVIEW_REQUIRED';
}
/**
 * Runs bounded, offline evaluation of prepared candidate patches.
 * An external sandbox/CI produces the evidence; this coordinator never executes
 * untrusted code, writes repositories, invokes models, or performs a merge.
 */
export async function runEngineeringEvaluationLoop(
  proposals: readonly EngineeringPatchProposal[],
  evidenceFor: (proposal: EngineeringPatchProposal) => Promise<EngineeringIterationInput>,
  options: { readonly maxIterations: number; readonly maxPlateau: number } = {
    maxIterations: 3, maxPlateau: 2,
  },
): Promise<EngineeringLoopResult> {
  if (!Number.isInteger(options.maxIterations) || options.maxIterations < 1 || options.maxIterations > 10
      || !Number.isInteger(options.maxPlateau) || options.maxPlateau < 1 || options.maxPlateau > 10)
    throw new Error('ENGINEERING_INVALID_LIMITS');
  const iterations: EngineeringCandidateResult[] = [];
  let plateau = 0;
  const ids = new Set<string>();
  for (const proposal of proposals) {
    if (iterations.length >= options.maxIterations) {
      return { iterations, stopReason: 'ITERATION_LIMIT' };
    }
    if (!proposal.id.trim() || !proposal.hypothesis.trim() || !proposal.expectedImpact.trim()
        || ids.has(proposal.id) || proposal.changedPaths.length === 0
        || proposal.changedPaths.some(path => !path.trim() || path.startsWith('/')
          || path.split('/').includes('..') || path.startsWith('.git/'))) {
      throw new Error('ENGINEERING_INVALID_PROPOSAL');
    }
    ids.add(proposal.id);
    const evidence = await evidenceFor(proposal);
    // No automatic approval: humanApproval=true remains review-only.
    const decision = evaluateEngineeringIteration(evidence);
    const rejected = decision.decision === 'REJECT';
    iterations.push({
      proposal,
      outcome: rejected ? 'REJECTED' : 'READY_FOR_REVIEW',
      reasons: decision.reasons,
      costDeltaUsd: decision.costDeltaUsd,
    });
    if (!rejected) return { iterations, stopReason: 'HUMAN_REVIEW_REQUIRED' };
    plateau++;
    if (plateau >= options.maxPlateau) return { iterations, stopReason: 'PLATEAU' };
  }
  return { iterations, stopReason: 'NO_CANDIDATES' };
}
