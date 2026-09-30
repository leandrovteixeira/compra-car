import { describe, expect, it } from 'vitest';

import {
  normalizeBrandKey,
  validateBrandName,
} from '../src/application/admin/brand-monitoring';

describe('brand monitoring', () => {
  it('normaliza a chave da marca para uso no monitoramento', () => {
    expect(normalizeBrandKey('  Mercedes-Benz  ')).toBe('mercedes-benz');
    expect(normalizeBrandKey('Citroën')).toBe('citroen');
    expect(normalizeBrandKey('BYD')).toBe('byd');
  });

  it('rejeita nomes vazios ou acima do limite', () => {
    expect(validateBrandName('   ')).toBe('Informe o nome da marca.');
    expect(validateBrandName('A'.repeat(101))).toBe(
      'O nome da marca deve ter no máximo 100 caracteres.',
    );
  });

  it('aceita nomes válidos', () => {
    expect(validateBrandName('Omoda')).toBeNull();
  });
});
