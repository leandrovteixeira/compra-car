/** Separates a source equipment concept from an explicit measured value.
 * Pure, conservative parsing: a missing measure is UNKNOWN, not zero.
 * It never assigns equipment to a vehicle or converts units.
 */
export type SeparatedSpecClaim27=Readonly<{
  rawLabel:string;
  specLabel:string;
  observedValue:string|null;
  observedUnit:string|null;
  valueSource:'EMBEDDED_LABEL'|'NONE';
}>;

// Restricted to an explicitly dimensioned digital/colored instrument cluster.
// Avoid generic stripping of voltages, capacities and powertrain identifiers:
// a 12 V auxiliary battery is NOT equivalent to an HV traction battery.
const cluster=/^(painel de instrumentos\s+(?:colorido|digital))(?:\s+de)?\s+(\d+(?:[.,]\d+)?)\s*(?:polegadas?|pol\.?|["“”″]|[’‘]{2}|'{2})(?:\s+configur[aá]vel\s+atrav[eé]s\s+de\s+comandos\s+no\s+volante)?\s*$/iu;

export function separateSpecConceptAndValue27(rawLabel:string):SeparatedSpecClaim27{
  if(typeof rawLabel!=='string'||!rawLabel.trim()||rawLabel.length>500)
    throw new Error('SPEC_LABEL_INVALID');
  const cleaned=rawLabel.replace(/\s+/gu,' ').trim();
  const match=cluster.exec(cleaned);
  if(match){
    return {
      rawLabel:cleaned,specLabel:match[1]!.trim(),
      observedValue:match[2]!.replace(',','.'),
      observedUnit:'inch',valueSource:'EMBEDDED_LABEL'
    };
  }
  return {rawLabel:cleaned,specLabel:cleaned,
    observedValue:null,observedUnit:null,valueSource:'NONE'};
}
