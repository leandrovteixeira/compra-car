import type {
  SpecDocument27, SpecEvidence27, SpecObservation27, SpecTarget27,
} from './spec-agent-reconciliation';
import { parseBaicSpecCell27, type SpecMatrixParse27 } from './spec-agent-baic-matrix';

/**
 * Creates a non-persistent normalized document for ONE selected version.
 * The caller MUST supply the independently validated target/MY; BAIC source
 * documents do not establish a model year on their own.
 */
export function buildBaicSpecDocument27(input: {
  matrix: SpecMatrixParse27;
  target: SpecTarget27;
  version: 'PRO' | 'MAX';
  /** Explicit human/validator attestation: parsed rows represent full equipment inventory. */
  validatedInventoryComplete?: boolean;
  evidence: SpecEvidence27;
}): { document: SpecDocument27; reviewRows: readonly { rowId:string; reason:string; raw:string }[] } {
  const {matrix,target,evidence,version} = input;
  if (target.version.trim().toUpperCase() !== version)
    throw new Error('BAIC_VERSION_MISMATCH');
  const reviewRows: {rowId:string;reason:string;raw:string}[] =
    matrix.issues.map(issue=>({rowId:issue.rowId,reason:issue.reason,raw:issue.excerpt}));
  const observations: SpecObservation27[] = [];
  for (const row of matrix.rows) {
    const raw = version === 'PRO' ? row.pro : row.max;
    const cell = parseBaicSpecCell27(raw);
    if (cell.kind === 'ambiguous') {
      reviewRows.push({rowId:row.rowId,reason:'AMBIGUOUS_CELL',raw});
      continue;
    }
    const rowEvidence = {...evidence,documentPage:row.page};
    const base = {label:row.label,evidence:rowEvidence};
    if (cell.kind === 'binary') {
      observations.push({...base,kind:'binary',value:cell.availability});
    } else if (cell.kind === 'numeric') {
      const labelUnit = /\((kWh|kW|km|kg|mm|s|h|L|N·m)\)/iu.exec(row.label)?.[1];
      const cycle = /\b(PBEV|NEDC|WLTP|WLTC)\b/iu.exec(row.label)?.[1]?.toUpperCase();
      observations.push({...base,kind:'numeric',value:cell.value,
        ...(cell.unit || labelUnit ? {unit:cell.unit || labelUnit} : {}),
        ...(cycle ? {methodology:cycle} : {}),
        comparisonOperator:cell.operator});
    } else {
      // Descriptive equipment values need a canonical scale mapping and review.
      // Never silently turn an arbitrary text value into a binary STANDARD.
      observations.push({...base,kind:'scale',value:cell.value});
    }
  }
  const document: SpecDocument27 = {
    target,evidence,observations,
    completeEquipmentInventory:input.validatedInventoryComplete === true && matrix.complete && reviewRows.length === 0,
  };
  return {document,reviewRows};
}
