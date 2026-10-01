import { describe, expect, it } from 'vitest';
import {
  classifyMmvVersionChange,
  proposeBodyModelResolution,
  type OfficialProductCandidate,
} from '../src/agents';

const base: OfficialProductCandidate = {
  brand: 'Jeep',
  model: 'Renegade',
  bodyStyle: null,
  taxonomy: 'VARIANT',
  officialVersionLabel: 'Longitude T270',
  trim: 'Longitude',
  powertrainLabel: 'T270',
  engineDisplacement: 1.3,
  engineLabel: '1.3 Turbo',
  propulsion: 'ICE',
  transmission: 'AT6',
  drivetrain: '4x2',
  productionYear: null,
  modelYear: null,
  confidence: 0.95,
  evidence: [
    {
      url: 'https://www.jeep.com.br/renegade',
      title: 'Renegade',
      excerpt: 'Longitude T270',
      evidenceType: 'MODEL_PAGE',
    },
  ],
};

describe('MMV body/model proposals', () => {
  it('proposes A3 Sedan as review-only when body is explicit and absent from model label', () => {
    expect(
      proposeBodyModelResolution({
        ...base,
        brand: 'Audi',
        model: 'A3',
        bodyStyle: 'Sedan',
      }),
    ).toEqual({
      reasonCode: 'POSSIBLE_BODY_SPLIT',
      currentModel: 'A3',
      bodyStyle: 'Sedan',
      proposedModel: 'A3 Sedan',
      requiresReview: true,
      evidence: expect.any(Array),
    });
  });

  it('does not propose a split when body is already present or unknown', () => {
    expect(proposeBodyModelResolution({ ...base, model: 'A3 Sedan', bodyStyle: 'Sedan' })).toBeNull();
    expect(proposeBodyModelResolution({ ...base, model: 'A3', bodyStyle: null })).toBeNull();
  });
});

describe('MMV version-change reason classifier', () => {
  it('classifies T270 -> T270 MHEV as a new commercial variant proposal', () => {
    expect(
      classifyMmvVersionChange(base, {
        ...base,
        officialVersionLabel: 'Longitude T270 MHEV',
        powertrainLabel: 'T270 MHEV',
        propulsion: 'MHEV',
      }).reasonCode,
    ).toBe('NEW_COMMERCIAL_VARIANT');
  });

  it('classifies same visible label with different powertrain as distinct powertrain identity', () => {
    const previous = { ...base, model: 'Commander', officialVersionLabel: 'Overland' };
    const next = {
      ...previous,
      powertrainLabel: '2.2T Diesel',
      propulsion: 'ICE' as const,
      engineDisplacement: 2.2,
      drivetrain: '4x4',
    };
    expect(classifyMmvVersionChange(previous, next).reasonCode).toBe(
      'SAME_LABEL_DISTINCT_POWERTRAIN',
    );
  });

  it('classifies AT vs AT6 naming as descriptor-only when powertrain identity is unchanged', () => {
    const previous = { ...base, officialVersionLabel: 'Longitude T270 AT' };
    const next = { ...base, officialVersionLabel: 'Longitude T270 AT6' };
    expect(classifyMmvVersionChange(previous, next).reasonCode).toBe(
      'DESCRIPTOR_ONLY_VARIATION',
    );
  });

  it('falls back to possible rename when structured powertrain evidence does not prove novelty', () => {
    const previous = {
      ...base,
      officialVersionLabel: 'Longitude',
      powertrainLabel: null,
      propulsion: null,
      engineDisplacement: null,
    };
    const next = { ...previous, officialVersionLabel: 'Longitude Plus' };
    expect(classifyMmvVersionChange(previous, next).reasonCode).toBe('POSSIBLE_RENAME');
  });
});
