/** Ford Ranger September 2026 matrix source interpreter.
 * Source PDF page 2 visually audited. The third printed column is XLS 4WD,
 * and its engine row (not its title) identifies it as the 3.0 V6 Diesel.
 * The PDF does NOT independently establish model-year 2027.
 */
import type {FordSourceClaim27,FordEquipmentAvailability27} from './ford-xls-2027-source-fusion';
export const RANGER_XLS_MATRIX_PDF=
 'https://www.ford.com.br/content/dam/Ford/website-assets/latam/br/nameplate/2025/nova-geracao-ranger/pdf/fbr-ranger-ficha-tecnica.pdf';
export const RANGER_FORD_MATRIX_HEADERS_27=
 ['XLS 4x4','Black','XLS 4WD','XLT 4WD','Limited'] as const;
const folded=(s:string)=>s.normalize('NFKD').replace(/[\u0300-\u036f]/gu,'')
 .toLowerCase().replace(/\s+/gu,' ').trim();
export type RangerXlsMatrixBinding27=Readonly<{
 page:number;headers:readonly string[];
 columnIndex:number;engineRowLabel:string;
 engineCells:readonly string[];transmissionRowLabel:string;
 transmissionCells:readonly string[];
}>;
export type RangerXlsMatrixCell27=Readonly<{
 ordinal:number;page:number;rowLabel:string;columnHeader:string;
 legendExcerpt:string;rawCell:string;rawRowExcerpt:string;
 concept:string;value:string|null;unit:string|null;
 availability:FordEquipmentAvailability27;
 rowSection:'EXTERIOR'|'INTERIOR'|'SAFETY'|'TECHNOLOGY'|'MULTIMEDIA'|'PERFORMANCE'|'DIMENSIONS';
}>;
export function validateFordRangerXlsMatrixBinding27(binding:RangerXlsMatrixBinding27):void{
 const headers=RANGER_FORD_MATRIX_HEADERS_27;
 if(binding.page!==2||binding.columnIndex!==2||binding.headers.length!==headers.length||
   binding.headers.some((v,i)=>folded(v)!==folded(headers[i]!))||
   binding.engineCells.length!==5||binding.transmissionCells.length!==5||
   !/motor\s*3[.,]0\s*v6.*diesel/u.test(folded(binding.engineRowLabel))||
   !/transmissao/u.test(folded(binding.transmissionRowLabel))||
   !/\bx\b/u.test(folded(binding.engineCells[2]!))||
   !/(?:at\s*10|auto(?:matica)?\s*10|10\s*vel)/u.test(folded(binding.transmissionCells[2]!))||
   !['-','–','—'].includes(binding.engineCells[0]!.trim())||
   !['-','–','—'].includes(binding.engineCells[1]!.trim()))
    throw new Error('FORD_XLS_MATRIX_COLUMN_IDENTITY_UNVERIFIED');
}
export function validateFordRangerXlsMatrix27(input:{
 pdfUrl:string;sha256:string;binding:RangerXlsMatrixBinding27;
 cells:readonly RangerXlsMatrixCell27[];
}):readonly FordSourceClaim27[]{
 if(input.pdfUrl!==RANGER_XLS_MATRIX_PDF||!/^[a-f0-9]{64}$/u.test(input.sha256)||
    input.cells.length>250)throw new Error('FORD_XLS_MATRIX_SOURCE_INVALID');
 validateFordRangerXlsMatrixBinding27(input.binding);
 const seen=new Set<number>();
 return input.cells.map(cell=>{
  if(!Number.isInteger(cell.ordinal)||cell.ordinal<1||seen.has(cell.ordinal)||
    cell.page!==2||!cell.rowLabel?.trim()||!cell.concept?.trim()||
    !cell.rawRowExcerpt?.trim()||folded(cell.columnHeader)!=='xls 4wd'||
    !['EXTERIOR','INTERIOR','SAFETY','TECHNOLOGY','MULTIMEDIA','PERFORMANCE','DIMENSIONS'].includes(cell.rowSection)||
    typeof cell.rawCell!=='string'||cell.rawCell.length>200||
    !['STANDARD','OPTIONAL','NOT_AVAILABLE','UNKNOWN'].includes(cell.availability))
    throw new Error('FORD_XLS_MATRIX_CELL_INVALID');
  seen.add(cell.ordinal);
  // Golden row checks were visually verified against page 2 of the
  // September 2026 manufacturer PDF. They are QA invariants for detecting
  // spatial column drift in model-extracted table coordinates.
  const golden:readonly [RegExp,'x'|'-'][]=[
    [/^ajuste eletrico da altura dos farois$/u,'x'],
    [/^bagageiro de teto$/u,'-'],
    [/^degraus? de acesso a cacamba$/u,'x'],
    [/^estribo plataforma$/u,'-'],
    [/^farois de neblina em led$/u,'-']
  ];
  const row=folded(cell.rowLabel);
  const expectedAnchor=golden.find(([pattern])=>pattern.test(row))?.[1];
  const actualAnchor=['-','–','—'].includes(cell.rawCell.trim())?'-':cell.rawCell.trim().toLowerCase();
  if(expectedAnchor&&actualAnchor!==expectedAnchor)
    throw new Error('FORD_XLS_MATRIX_GOLDEN_ROW_MISMATCH');
  const raw=cell.rawCell.trim();
  const dash=['-','–','—'].includes(raw);
  const check=/^x$/iu.test(raw);
    const isNumber=/^\d+(?:[.,]\d+)?(?:\s*(?:["”″]|pol|cv|nm|kg|mm|l))?$/iu.test(raw);
  const expected:FordEquipmentAvailability27=check||isNumber?'STANDARD':
    dash?'NOT_AVAILABLE':'UNKNOWN';
  // The PDF uses an x as present in the printed equipment table. Its separate
  // "Kit Opcional da versão Limited" section must NEVER create XLS optionality.
  if(cell.availability!==expected)
    throw new Error('FORD_XLS_MATRIX_AVAILABILITY_MISMATCH');
  // Evidence cannot be only an auto-generated title/column header.
  if(!cell.rawRowExcerpt.toLocaleLowerCase('pt-BR').includes(
       cell.rowLabel.slice(0,Math.min(12,cell.rowLabel.length)).toLocaleLowerCase('pt-BR')))
    throw new Error('FORD_XLS_MATRIX_ROW_EVIDENCE_MISSING');
  return {
    concept:cell.concept,rawLabel:cell.rowLabel,
    value:cell.value,unit:cell.unit,availability:expected,
    sourceUrl:input.pdfUrl,sourceSha256:input.sha256,
    sourcePage:cell.page,scope:'XLS_MATRIX_CELL' as const,
    evidenceExcerpt:[
      'Coluna impressa 3/5: XLS 4WD (motor 3.0 V6 Diesel, AT10)',
      'Seção: '+cell.rowSection,'Linha: '+cell.rawRowExcerpt,
      'Célula: '+(raw||'(sem leitura)'),
      'Interpretação determinística: '+expected,
      'Kit Opcional Limited: excluído'
    ].join(' | ')
  };
 });
}
