/** Verified Ford XLS-column extraction contract.
 * PDF model-year is intentionally not inferred; apply only after a separate
 * MY-specific official source corroborates the exact XLS configuration.
 */
import type {FordSourceClaim27,FordEquipmentAvailability27} from './ford-xls-2027-source-fusion';

export type RangerXlsMatrixCell27=Readonly<{
  ordinal:number;page:number;
  rowLabel:string;columnHeader:string;legendExcerpt:string;
  rawCell:string;rawRowExcerpt:string;
  concept:string;value:string|null;unit:string|null;
  availability:FordEquipmentAvailability27;
}>;
export const RANGER_XLS_MATRIX_PDF=
 'https://www.ford.com.br/content/dam/Ford/website-assets/latam/br/nameplate/2025/nova-geracao-ranger/pdf/fbr-ranger-ficha-tecnica.pdf';
const folded=(v:string)=>v.normalize('NFKD').replace(/[\u0300-\u036f]/gu,'')
 .toLowerCase().replace(/\s+/gu,' ').trim();
function isXls30Column(value:string):boolean{
 const text=folded(value);
 return /\bxls\b/u.test(text)&&/3[.,]?0/u.test(text)&&
   /(?:v6|diesel)/u.test(text)&&/(?:4x4|4wd)/u.test(text);
}
export function validateFordRangerXlsMatrix27(input:{
  pdfUrl:string;sha256:string;cells:readonly RangerXlsMatrixCell27[];
}):readonly FordSourceClaim27[]{
 if(input.pdfUrl!==RANGER_XLS_MATRIX_PDF||!/^[a-f0-9]{64}$/u.test(input.sha256)||
   input.cells.length>250)throw new Error('FORD_XLS_MATRIX_SOURCE_INVALID');
 const seen=new Set<number>();
 return input.cells.map(cell=>{
  if(!Number.isInteger(cell.ordinal)||cell.ordinal<=0||seen.has(cell.ordinal)||
    !Number.isInteger(cell.page)||cell.page<=0||cell.page>100||
    !cell.rowLabel.trim()||!cell.concept.trim()||
    !cell.rawRowExcerpt.trim()||!cell.columnHeader.trim()||
    !isXls30Column(cell.columnHeader)||
    cell.rawCell.length>200||cell.rowLabel.length>500||
    !['STANDARD','OPTIONAL','NOT_AVAILABLE','UNKNOWN'].includes(cell.availability))
     throw new Error('FORD_XLS_MATRIX_CELL_INVALID');
  seen.add(cell.ordinal);
  // Missing or unclear legends cannot establish factory availability.
  if(cell.availability!=='UNKNOWN'&&!cell.legendExcerpt.trim())
    throw new Error('FORD_XLS_MATRIX_LEGEND_MISSING');
  if(cell.availability==='NOT_AVAILABLE'&&!cell.rawCell.trim())
    throw new Error('FORD_XLS_MATRIX_ABSENCE_NOT_PROVEN');
  return {
    concept:cell.concept,rawLabel:cell.rowLabel,
    value:cell.value,unit:cell.unit,availability:cell.availability,
    sourceUrl:input.pdfUrl,sourceSha256:input.sha256,
    sourcePage:cell.page,scope:'XLS_MATRIX_CELL',
    evidenceExcerpt:[
      'Coluna: '+cell.columnHeader,
      'Linha: '+cell.rawRowExcerpt,
      'Célula: '+(cell.rawCell||'(sem leitura)'),
      'Legenda: '+(cell.legendExcerpt||'(indeterminada)')
    ].join(' | ')
  };
 });
}
