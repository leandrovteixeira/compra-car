/** Deterministic Ford XLS MY2027 HTML evidence parser and PDF normalization.
 * Does not infer ABSENT from a missing HTML equipment label.
 */
import type {FordSourceClaim27} from './ford-xls-2027-source-fusion';
import {FORD_XLS_2027_URL} from './ford-xls-my2027-source-audit';
const fold=(s:string)=>s.normalize('NFKD').replace(/[\u0300-\u036f]/gu,'')
 .toLowerCase().replace(/\s+/gu,' ').trim();
const snapshot=(plain:string,from:string,to:string)=>{
 const f=fold(plain),a=f.indexOf(from),b=f.indexOf(to,a+from.length);
 return a>=0?f.slice(a,b>a?b:undefined):'';
};
export function normalizeFordPdfTechnicalClaim27(c:FordSourceClaim27):FordSourceClaim27{
 const label=fold(c.rawLabel);
 const raw=/Celula XLS 4WD:\s*([^|]+)/iu.exec(
   c.evidenceExcerpt.normalize('NFKD').replace(/[\u0300-\u036f]/gu,''))?.[1]?.trim()??'';
 const unit=/\(kg\)/u.test(label)?'kg':/\(mm\)/u.test(label)?'mm':
  /\(l\)/u.test(label)?'L':c.unit;
 if(c.value!==null)return {...c,unit:unit??null};
 const tech:readonly [RegExp,RegExp,string][]=[
  [/^potencia$/u,/^(\d+)\s*cv\b/iu,'cv'],
  [/^torque$/u,/^(\d+)\s*nm\b/iu,'Nm'],
  [/^transmissao$/u,/^at\s*(\d+)\s*vel\b/iu,'velocidades']
 ];
 for(const [name,value,kind] of tech){
  const n=name.test(label)?value.exec(raw):null;
  if(n)return {...c,value:n[1]!,unit:kind,availability:'STANDARD'};
 }
 if(label==='tracao'&&/^4wd$/iu.test(raw))
  return {...c,value:'4WD',unit:null,availability:'STANDARD'};
 return c;
}
export function extractFordXlsHtmlClaims27(input:{
 visibleText:string;sha256:string;pdfClaims:readonly FordSourceClaim27[];
}):readonly FordSourceClaim27[]{
 if(!/^[a-f0-9]{64}$/u.test(input.sha256)||input.visibleText.length<100)
  throw new Error('FORD_XLS_HTML_EVIDENCE_INVALID');
 const body=fold(input.visibleText);
 const motor=snapshot(input.visibleText,'motor e transmissao','dimensoes e capacidade');
 const dimensions=snapshot(input.visibleText,'dimensoes e capacidade','conectividade via app ford');
 const equipment=snapshot(input.visibleText,'exterior','motor e transmissao');
 if(motor.length<80||dimensions.length<80||equipment.length<100)
  throw new Error('FORD_XLS_HTML_SECTIONS_MISSING');
 const rules:readonly {name:RegExp;section:string;extract:RegExp;unit:string|null;fixed?:string}[]=[
  {name:/^potencia$/u,section:motor,extract:/potencia\s+(\d+)\s*cv/iu,unit:'cv'},
  {name:/^torque$/u,section:motor,extract:/torque\s+(\d+)\s*nm/iu,unit:'Nm'},
  {name:/^tracao$/u,section:motor,extract:/tracao\s+(4wd|4x4)/iu,unit:null},
  {name:/^transmissao$/u,section:motor,extract:/transmissao\s+automatica\s+de\s+(\d+)\s+velocidades/iu,unit:'velocidades'},
  {name:/^peso do veiculo em ordem de marcha \(kg\)$/u,section:dimensions,extract:/peso do veiculo em ordem de marcha\s*\(kg\)\s*(\d{3,4})/iu,unit:'kg'},
  {name:/^capacidade de carga \(kg\)$/u,section:dimensions,extract:/capacidade de carga\s*\(kg\)\s*(\d{3,4})/iu,unit:'kg'},
  {name:/^capacidade de imersao \(mm\)$/u,section:dimensions,extract:/capacidade de imersao\s*\(mm\)\s*(\d{2,4})/iu,unit:'mm'},
  {name:/^tanque de combustivel \(l\)$/u,section:dimensions,extract:/tanque de comb[ui]stivel\s*\(l\)\s*(\d{2,3})/iu,unit:'L'},
  {name:/^altura do veiculo \(mm\)$/u,section:dimensions,extract:/altura do veiculo\s*\(mm\)\s*(\d{3,4})/iu,unit:'mm'},
  {name:/^largura do veiculo com espelhos \(mm\)$/u,section:dimensions,extract:/largura do veiculo com espelhos\s*\(mm\)\s*(\d{3,4})/iu,unit:'mm'},
  {name:/^comprimento do veiculo \(mm\)$/u,section:dimensions,extract:/comprimento do veiculo\s*\(mm\)\s*(\d{3,4})/iu,unit:'mm'},
  {name:/^distancia entre eixos \(mm\)$/u,section:dimensions,extract:/distancia entre eixos\s*\(mm\)\s*(\d{3,4})/iu,unit:'mm'},
  {name:/^entradas usb$/u,section:equipment,extract:/entradas usb\s+(\d+)/iu,unit:null},
  {name:/^alto-falantes$/u,section:equipment,extract:/alto[ -]falantes\s+(\d+)/iu,unit:null},
  {name:/^pontos de amarracao de carga$/u,section:equipment,extract:/pontos de amarracao de carga\s+(\d+)/iu,unit:null},
  {name:/^painel de instrumentos colorido/u,section:equipment,extract:/painel de instrumentos colorido[^|]{0,150}?\s+(\d{1,2})\s*["”″]/iu,unit:'inch'},
  {name:/^tela central multifuncional touch screen hd$/u,section:equipment,extract:/sistema multimidia sync 4 com tela touch screen\s+(\d{1,2})\s*["”″]/iu,unit:'inch'}
 ];
 const result:FordSourceClaim27[]=[];
 for(const pdf of input.pdfClaims){
  const label=fold(pdf.rawLabel);
  const rule=rules.find(r=>r.name.test(label));
  let evidence='';
  let value:string|null=null,unit:string|null=null;
  if(rule){
   const match=rule.extract.exec(rule.section);
   if(!match)continue;
   evidence=match[0];value=match[1]!.toUpperCase()==='4WD'?'4WD':match[1]!;
   unit=rule.unit;
  }else{
   if(label.length<8||!equipment.includes(label))continue;
   evidence=pdf.rawLabel;
  }
  result.push({concept:pdf.concept,rawLabel:pdf.rawLabel,value,unit,
   availability:'STANDARD',scope:'XLS_MY2027_PAGE',sourcePage:null,
   sourceUrl:FORD_XLS_2027_URL,sourceSha256:input.sha256,
   evidenceExcerpt:'Página Ford XLS MY2027: '+evidence});
 }
 return result;
}
