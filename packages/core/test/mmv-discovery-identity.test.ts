import { describe, expect, it } from 'vitest';
import {
  mmvCommercialVariantDiscriminator,
  mmvDiscoveryIdentityKey,
  projectMmvDiscoveryIdentity,
  type OfficialProductCandidate,
} from '../src/agents';

const base: OfficialProductCandidate = {
  brand: 'Jeep',
  model: 'Commander',
  taxonomy: 'VARIANT',
  officialVersionLabel: 'Overland',
  trim: 'Overland',
  powertrainLabel: null,
  engineDisplacement: null,
  engineLabel: null,
  propulsion: null,
  transmission: null,
  drivetrain: null,
  productionYear: null,
  modelYear: null,
  confidence: 0.95,
  evidence: [
    {
      url: 'https://www.jeep.com.br/commander',
      title: 'Commander',
      excerpt: 'Overland',
      evidenceType: 'MODEL_PAGE',
    },
  ],
};

describe('MMV current discovery identity', () => {
  it('keeps the official visible version label untouched', () => {
    expect(
      projectMmvDiscoveryIdentity({
        ...base,
        powertrainLabel: 'T270 MHEV',
        propulsion: 'MHEV',
      }),
    ).toMatchObject({
      brand: 'Jeep',
      model: 'Commander',
      officialVersionLabel: 'Overland',
      discriminator: {
        commercialPowertrainLabel: 'T270 MHEV',
        propulsion: 'MHEV',
      },
    });
  });

  it('keeps technical powertrain out of identity by default and only discriminates explicitly', () => {
    const mhev = {
      ...base,
      powertrainLabel: 'T270 MHEV',
      propulsion: 'MHEV' as const,
      engineDisplacement: 1.3,
    };
    const diesel = {
      ...base,
      powertrainLabel: '2.2T Diesel',
      propulsion: 'ICE' as const,
      engineDisplacement: 2.2,
      drivetrain: '4x4',
    };

    expect(mmvDiscoveryIdentityKey(mhev)).toBe(mmvDiscoveryIdentityKey(diesel));
    expect(
      mmvDiscoveryIdentityKey(mhev, { includeCommercialPowertrain: true }),
    ).not.toBe(
      mmvDiscoveryIdentityKey(diesel, { includeCommercialPowertrain: true }),
    );
    expect(projectMmvDiscoveryIdentity(mhev).officialVersionLabel).toBe('Overland');
    expect(projectMmvDiscoveryIdentity(diesel).officialVersionLabel).toBe('Overland');
  });

  it('does not create a different identity from technical engine-label wording alone', () => {
    expect(mmvDiscoveryIdentityKey({ ...base, engineLabel: '1.3 Turbo' })).toBe(
      mmvDiscoveryIdentityKey({ ...base, engineLabel: 'T270' }),
    );
  });

  it('does not create a different identity from transmission descriptors alone', () => {
    const automatic = { ...base, transmission: 'AT' };
    const automaticSix = { ...base, transmission: 'AT6' };

    expect(mmvDiscoveryIdentityKey(automatic)).toBe(mmvDiscoveryIdentityKey(automaticSix));
  });

  it('does not create a different identity from drivetrain alone at this stage', () => {
    expect(mmvDiscoveryIdentityKey({ ...base, drivetrain: '4x2' })).toBe(
      mmvDiscoveryIdentityKey({ ...base, drivetrain: '4x4' }),
    );
  });

  it('uses trim only as fallback when the official version label is absent', () => {
    expect(
      projectMmvDiscoveryIdentity({
        ...base,
        officialVersionLabel: null,
        trim: 'Brightnight',
      }).officialVersionLabel,
    ).toBe('Brightnight');
  });

  it('refuses unresolved model-only observations', () => {
    expect(() =>
      projectMmvDiscoveryIdentity({
        ...base,
        taxonomy: 'MODEL',
        officialVersionLabel: null,
        trim: null,
      }),
    ).toThrow('MMV_RESOLVED_VARIANT_REQUIRED');
  });

  it('preserves the full discriminator as evidence even when not every field forms the key', () => {
    expect(
      mmvCommercialVariantDiscriminator({
        ...base,
        powertrainLabel: 'T270 MHEV',
        propulsion: 'MHEV',
        engineDisplacement: 1.3,
        engineLabel: '1.3 Turbo',
        transmission: 'AT6',
        drivetrain: '4x2',
      }),
    ).toEqual({
      commercialPowertrainLabel: 'T270 MHEV',
      propulsion: 'MHEV',
      engineDisplacement: 1.3,
      engineLabel: '1.3 Turbo',
      transmission: 'AT6',
      drivetrain: '4x2',
    });
  });
});
