import { describe, expect, it } from 'vitest';
import { assessMmvEvidence, mmvCorroborationLevel } from '../src/agents';

describe('MMV evidence confidence', () => {
  it('treats manufacturer + FIPE as cross-primary corroboration', () => {
    expect(
      mmvCorroborationLevel([
        { kind: 'MANUFACTURER', sourceKey: 'jeep.com.br' },
        { kind: 'FIPE', sourceKey: '001234-5' },
      ]),
    ).toBe('CROSS_PRIMARY');
  });

  it('never marks Sprint 20D evidence as automation eligible', () => {
    const result=assessMmvEvidence({
      reasonCode:'NEW_COMMERCIAL_VARIANT',
      extractionConfidence:0.98,
      sources:[
        {kind:'MANUFACTURER',sourceKey:'jeep.com.br'},
        {kind:'FIPE',sourceKey:'001234-5'},
      ],
    });
    expect(result).toMatchObject({
      corroborationLevel:'CROSS_PRIMARY',
      readiness:'HIGH',
      maturity:'VALIDATION',
      automationEligible:false,
    });
  });

  it('keeps high-risk identity changes below HIGH even with cross-primary evidence', () => {
    for(const reasonCode of ['POSSIBLE_RENAME','POSSIBLE_BODY_SPLIT','POSSIBLE_SUCCESSOR','POSSIBLE_DISCONTINUATION','AMBIGUOUS_IDENTITY'] as const){
      expect(assessMmvEvidence({
        reasonCode,
        extractionConfidence:0.99,
        sources:[
          {kind:'MANUFACTURER',sourceKey:'official.example'},
          {kind:'FIPE',sourceKey:'fipe-code'},
        ],
      }).readiness).toBe('MEDIUM');
    }
  });

  it('caps conflicting or insufficient evidence at LOW', () => {
    for(const warning of ['CONFLICTING_SOURCES','INSUFFICIENT_EVIDENCE'] as const){
      expect(assessMmvEvidence({
        reasonCode:'NEW_COMMERCIAL_VARIANT',
        extractionConfidence:1,
        sources:[
          {kind:'MANUFACTURER',sourceKey:'a'},
          {kind:'FIPE',sourceKey:'b'},
        ],
        warnings:[warning],
      }).readiness).toBe('LOW');
    }
  });

  it('treats secondary-only evidence as lead-only LOW readiness', () => {
    expect(assessMmvEvidence({
      reasonCode:'NEW_MODEL',
      extractionConfidence:1,
      sources:[{kind:'SECONDARY',sourceKey:'marketplace'}],
    })).toMatchObject({corroborationLevel:'SECONDARY_ONLY',readiness:'LOW'});
  });

  it('uses multiple manufacturer sources as same-kind corroboration but not HIGH', () => {
    expect(assessMmvEvidence({
      reasonCode:'NEW_MODEL',
      extractionConfidence:0.98,
      sources:[
        {kind:'MANUFACTURER',sourceKey:'configurator'},
        {kind:'MANUFACTURER',sourceKey:'technical-sheet'},
      ],
    })).toMatchObject({
      corroborationLevel:'MULTI_SOURCE_SAME_KIND',
      readiness:'MEDIUM',
      distinctSources:2,
    });
  });
});
