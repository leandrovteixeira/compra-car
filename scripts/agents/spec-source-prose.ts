import type { SourceFact, SourceScope, SourceSection } from '@compra-car/core/agents';
/** Source vocabulary and literal values only; no canonical field lookup. */
export function proseFacts(
  section: SourceSection,
  heading = '',
  method: SourceFact['method'] = 'HTML_PROSE',
): SourceFact[] {
  const text = section.text.replace(/\s+/gu, ' ').trim();
  if (!text || text.length > 1000) return [];
  const result: SourceFact[] = [];
  const add = (label: string, value: string, unit: string | null) => {
    if (!result.some((f) => f.label === label && f.value === value && f.unit === unit))
      result.push({ ...section, text, label, value, unit, method });
  };
  // Explicit label/value quantities. Sentence boundaries prevent values from a different subject.
  const quantities =
    /(pot[eê]ncia(?: máxima)?|torque(?: máximo)?|cilindrada|comprimento|largura|altura|distância entre.eixos|capacidade(?: do tanque)?|velocidade máxima|aceleração|peso|volume)\s*(?:[:=]|é|de|com|até|máxim[oa] de)?\s*(\d+(?:[.,]\d+)?)\s*(cm³|cm3|mm|cm|m|l|litros?|cv|kw|nm|kgfm|kg|km\/h|s)\b/giu;
  for (const m of text.matchAll(quantities)) add(m[1]!, m[2]!, m[3]!);
  const engine =
    /\b([Mm]otor)\s+(\d{2,4}\s*[A-Z]{2,}\b|[Tt]\d{3}\b|\d[.,]\d(?:\s*(?:turbo|[A-Z]{2,}(?:\s+[A-Z]{2,})*))?\b)/gu;
  for (const m of text.matchAll(engine)) add(m[1]!, m[2]!, null);
  // Heading supplies the literal observed label, not a canonical synonym for power.
  if (heading && /motor|pot[eê]ncia|torque|dimens|capacidad|velocidad|acelera/iu.test(heading)) {
    for (const m of text.matchAll(
      /(?<![\d.,])(\d+(?:[.,]\d+)?)\s*(cv|kW|Nm|kgfm|cm³|mm|km\/h)\b/gu,
    ))
      if (!result.some((f) => f.value === m[1] && f.unit === m[2])) add(heading, m[1]!, m[2]!);
  }
  for (const m of text.matchAll(
    /\b(transmissão|câmbio)\s*(?:[:=]|é|de)?\s*((?:automátic[oa]|manual|automatizad[oa])(?:\s+de\s+\d+\s+(?:velocidades|marchas))?)/giu,
  ))
    add(m[1]!, m[2]!, null);
  for (const m of text.matchAll(
    /\b(combustível|tipo de combustível)\s*[:=]?\s*(Total Flex|Flex|Gasolina|Diesel|Elétrico|Etanol)\b/giu,
  ))
    add(m[1]!, m[2]!, null);
  // Labelled equipment presence only; mention in a manual is not presence in the requested version.
  for (const m of text.matchAll(
    /(?:^|[;|])\s*([^;|:]{2,80}):\s*(não disponível|não possui|disponível|de série|opcional)(?=[.;|]|$)/giu,
  ))
    add(m[1]!.trim(), m[2]!, null);
  return result;
}
export const blankSpecScope = (): SourceScope => ({
  model: null,
  version: null,
  modelYear: null,
  shared: false,
  matrix: false,
  currentLineup: false,
});
