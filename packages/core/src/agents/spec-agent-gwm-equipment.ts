/**
 * Layout-aware, deterministic extraction of manufacturer equipment bullet claims
 * from the first four pages of the GWM H6 PHEV19 Flex PDF.
 * The result is an inventory of SOURCE CLAIMS, not an authoritative binary catalog.
 * Compound claims are intentionally not silently expanded into canonical equipment.
 */
export type GwmEquipmentCategory27 =
  | 'EXTERIOR'|'INTERIOR'|'SEGURANÇA ATIVA E PASSIVA'|'ENTRETENIMENTO'
  | 'ILUMINAÇÃO'|'VIDROS E ESPELHOS'|'AR CONDICIONADO';
export interface GwmEquipmentClaim27 {
  readonly page: number;
  readonly category: GwmEquipmentCategory27;
  readonly column: 'left'|'right';
  readonly sourceLabel: string;
  readonly ordinal: number;
}
export interface GwmEquipmentExtraction27 {
  readonly claims: readonly GwmEquipmentClaim27[];
  readonly metrics: {readonly totalClaims:number;readonly byPage:Readonly<Record<number,number>>;readonly llmCalls:0;readonly databaseWrites:0};
  readonly warnings: readonly string[];
}
const PAGE_CATEGORIES:readonly GwmEquipmentCategory27[]=[
  'EXTERIOR','SEGURANÇA ATIVA E PASSIVA','ENTRETENIMENTO','VIDROS E ESPELHOS'
];
const HEADING_CATEGORIES=new Set<GwmEquipmentCategory27>([
  'EXTERIOR','INTERIOR','SEGURANÇA ATIVA E PASSIVA','ENTRETENIMENTO',
  'ILUMINAÇÃO','VIDROS E ESPELHOS','AR CONDICIONADO'
]);
type MutableClaim={page:number;category:GwmEquipmentCategory27;column:'left'|'right';sourceLabel:string};
export function extractGwmEquipmentClaims27(layoutText:string):GwmEquipmentExtraction27 {
  const pages=layoutText.split('\f');
  if(pages.length<4)throw new Error('GWM_EQUIPMENT_PAGES_MISSING');
  const claims:GwmEquipmentClaim27[]=[];
  const warnings:string[]=[];
  for(let pageNo=1;pageNo<=4;pageNo++){
    const page=pages[pageNo-1]!;
    const dual=pageNo===1||pageNo===3;
    const splitAt=pageNo===1?60:61;
    let category=PAGE_CATEGORIES[pageNo-1]!;
    let started=false;
    const active:Record<'left'|'right',MutableClaim|null>={left:null,right:null};
    const flush=(column:'left'|'right')=>{
      const item=active[column];
      if(item){
        const label=item.sourceLabel.replace(/\s+/gu,' ').trim();
        if(label)claims.push({...item,sourceLabel:label,ordinal:claims.length+1});
        active[column]=null;
      }
    };
    for(const rawLine of page.split(/\r?\n/u)){
      const clean=rawLine.trim();
      if(pageNo===1&&clean==='CORES DISPONÍVEIS')break;
      if(pageNo===1&&clean.includes('EXTERIOR')&&clean.includes('INTERIOR')){started=true;continue;}
      if(HEADING_CATEGORIES.has(clean as GwmEquipmentCategory27)){
        category=clean as GwmEquipmentCategory27;started=true;
        flush('left');flush('right');
        continue;
      }
      if(/^•\s*ILUMINAÇÃO$/u.test(clean)){
        flush('left');flush('right');category='ILUMINAÇÃO';started=true;continue;
      }
      if(!started)continue;
      const slices:Record<'left'|'right',string>=dual
        ? {left:rawLine.slice(0,splitAt),right:rawLine.slice(splitAt)}
        : {left:rawLine,right:''};
      for(const column of ['left','right'] as const){
        const chunk=slices[column].trim();
        if(!chunk)continue;
        if(chunk.startsWith('•')){
          flush(column);
          const sourceLabel=chunk.slice(1).trim();
          // On page 1 the columns have independent headings, not per-row headings.
          const assignedCategory=pageNo===1?(column==='left'?'EXTERIOR':'INTERIOR'):category;
          active[column]={page:pageNo,category:assignedCategory,column,sourceLabel};
        }else if(active[column]){
          active[column]!.sourceLabel+=' '+chunk;
        }
      }
    }
    flush('left');flush('right');
    if(!claims.some(item=>item.page===pageNo))warnings.push('PAGE_'+pageNo+'_EMPTY');
  }
  const byPage:Record<number,number>={};
  for(const item of claims)byPage[item.page]=(byPage[item.page]??0)+1;
  return {claims,metrics:{totalClaims:claims.length,byPage,llmCalls:0,databaseWrites:0},warnings};
}
