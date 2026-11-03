import { describe, expect, it } from 'vitest';
import { parseBaicSpecMatrix27, parseBaicSpecCell27 } from '../src/agents/spec-agent-baic-matrix';
const sample = [
  'Especificações técnicas — Arcfox T1 (Brasil)',
  'Nº       Especificação       PRO       MAX',
  ' 1.3   Potência máxima (kW)                         70                       70',
  ' 4.2   Teto panorâmico de vidro fixo               —                        ●',
  ' 6.3   Ajuste do banco do motorista',
  ' 7.6   Alto-falantes                                4                        6',
].join('\n');
describe('Spec Agent BAIC PDF layout adapter', () => {
 it('isolates malformed rows without inferring inventory completeness', () => {
   const result = parseBaicSpecMatrix27(sample);
   expect(result.rows).toHaveLength(3);
   expect(result.issues).toHaveLength(1);
   expect(result.issues[0]?.rowId).toBe('6.3');
   expect(result.complete).toBe(false);
 });
 it('parses binary availability and qualified numeric comparison operators', () => {
   expect(parseBaicSpecCell27('●')).toEqual({kind:'binary',availability:'STANDARD'});
   expect(parseBaicSpecCell27('○')).toEqual({kind:'binary',availability:'OPTIONAL'});
   expect(parseBaicSpecCell27('—')).toEqual({kind:'binary',availability:'NOT_AVAILABLE'});
   expect(parseBaicSpecCell27('≥310')).toEqual({kind:'numeric',value:310,operator:'>='});
   expect(parseBaicSpecCell27('≤25min')).toEqual({kind:'numeric',value:25,operator:'<=',unit:'min'});
   expect(parseBaicSpecCell27('42,3')).toEqual({kind:'numeric',value:42.3,operator:'='});
 });
 it('does not silently collapse qualified or multi-valued cells', () => {
   expect(parseBaicSpecCell27('● Com espelho iluminado').kind).toBe('ambiguous');
   expect(parseBaicSpecCell27('459 l / 1352 l').kind).toBe('text');
 });
 it('does not accept unrelated documents as complete inventory', () => {
   expect(parseBaicSpecMatrix27('1.1   ABS      ●       ●').complete).toBe(false);
 });
});
