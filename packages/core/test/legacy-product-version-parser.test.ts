import { describe, expect, it } from 'vitest';
import {
  parseLegacyProductVersion,
  toyotaFixtureCatalog,
  transmissionComparisonKey,
} from '../src/agents';
const parse = (version: string) =>
  parseLegacyProductVersion({ ...toyotaFixtureCatalog[0]!, version });
describe('conservative historical version parser', () => {
  it('parses XRE without reconstructing any product label', () => {
    const parsed = parse('XRE 2.0 CVT');
    expect(parsed).toMatchObject({
      trim: 'XRE',
      engineDisplacement: 2,
      transmission: 'CVT',
      propulsion: 'ICE',
      propulsionBasis: 'LEGACY_EXPANDED_CONVENTION',
      conflictingTokens: false,
    });
    expect(parsed.product.version).toBe('XRE 2.0 CVT');
  });
  it('parses XRX HEV explicitly', () =>
    expect(parse('XRX 1.8 HEV CVT')).toMatchObject({
      trim: 'XRX',
      engineDisplacement: 1.8,
      propulsion: 'HEV',
      transmission: 'CVT',
      propulsionBasis: 'EXPLICIT_TOKEN',
    }));
  it('parses Jeep expanded nomenclature without inventing T270', () => {
    expect(parse('Longitude 1.3 TGDI AT MHEV')).toMatchObject({
      trim: 'Longitude',
      engineDisplacement: 1.3,
      propulsion: 'MHEV',
      transmission: 'AT',
      engineLabel: 'TGDI',
      powertrainLabel: null,
      extraTokens: ['TGDI'],
    });
  });
  it.each(['MHEV', 'HEV', 'PHEV', 'BEV', 'EV', 'ICE'])('recognizes propulsion token %s', (token) =>
    expect(parse('Trim ' + token).propulsion).toBe(token === 'EV' ? 'BEV' : token),
  );
  it.each(['CVT', 'AT', 'DHT', 'MT'])('recognizes transmission %s', (token) =>
    expect(parse('Trim 1.5 ' + token).transmission).toBe(token),
  );
  it.each([1.0, 1.3, 1.5, 1.8, 2.0, 2.4])('recognizes displacement %s', (value) =>
    expect(parse('Trim ' + value.toFixed(1) + ' CVT').engineDisplacement).toBe(value),
  );
  it('preserves multi-token trim prefix and explicit drivetrain', () =>
    expect(parse('GR Sport 2.0 AT 4x4')).toMatchObject({ trim: 'GR Sport', drivetrain: '4X4' }));
  it('keeps missing fields unknown, including ambiguous DHT propulsion', () => {
    expect(parse('XRE')).toMatchObject({
      trim: 'XRE',
      propulsion: null,
      engineDisplacement: null,
      transmission: null,
    });
    expect(parse('XRE 1.5 DHT').propulsion).toBeNull();
    expect(parse('XRE 1.5 CVT UNKNOWN').propulsion).toBeNull();
  });
  it('does not parse numeric product identifiers as engine displacement', () =>
    expect(parse('T270 AT').engineDisplacement).toBeNull());
  it.each(['XRX 1.5 2.0 CVT', 'XRX HEV MHEV CVT', 'XRX 1.5 CVT AT'])(
    'flags conflicting tokens: %s',
    (value) => expect(parse(value).conflictingTokens).toBe(true),
  );
  it('supports case and whitespace without rewriting the original string', () => {
    expect(parse('  xRe   2.0 cVt  ')).toMatchObject({
      trim: 'xRe',
      engineDisplacement: 2,
      transmission: 'CVT',
    });
    expect(parse('  xRe   2.0 cVt  ').product.version).toBe('  xRe   2.0 cVt  ');
  });
  it('uses only an explicit Direct Shift CVT equivalence', () => {
    expect(transmissionComparisonKey('Direct Shift CVT')).toBe('cvt');
    expect(transmissionComparisonKey('automatic')).toBe('automatic');
  });
});
