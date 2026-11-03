/**
 * Sprint 27 — deterministic parser for the technical-data section of GWM H6 PDF text.
 * This is a text adapter, NOT a PDF downloader and NOT an LLM matcher.
 * All source labels are retained; canonical mappings require approved aliases.
 */
export type GwmTechnicalValue27 = Readonly<{
  fieldKey: string;
  sourceLabel: string;
  kind: 'numeric' | 'text';
  value: number | string;
  unit?: string;
  methodology?: 'INMETRO' | 'WLTP';
  qualifier?: string;
  sourceLine: number;
}>;
export type GwmTechnicalExtraction27 = Readonly<{
  observations: readonly GwmTechnicalValue27[];
  unresolved: readonly { line: number; text: string; reason: string }[];
  summary: Readonly<{ recognizedFields: number; numeric: number; text: number; unresolvedLines: number; llmCalls: 0 }>;
}>;

const FIELDS: readonly [string,string][] = [
  ['motor','Motor (combustão) '],['valves','Válvulas '],['cylinders','Cilindros '],
  ['electric_motors','Motores elétricos '],['battery','Bateria LFP (Kwh) '],
  ['charge_ac','Carregamento AC – 0 a 100% (6,6 kW) '],
  ['charge_dc','Carregamento DC 20 – 80% (33 kW/h) '],
  ['urban','Consumo urbano km/l (INMETRO) '],
  ['road','Consumo rodoviário km/l (INMETRO) '],
  ['range','Autonomia modo 100% elétrico '],['power','Potência combinada (cv) '],
  ['acceleration','0 – 100 km/h (s) '],['torque','Torque (Nm / kgfm) '],
  ['transmission','Transmissão '],['traction','Tração '],
  ['brakes','Freios '],['steering','Direção '],['top_speed','Velocidade máxima (km/h) '],
  ['weight','Peso (kg) '],['tires','Pneus '],
  ['trunk','Capacidade porta-malas (l) '],['tank','Tanque de combustível (l) '],
  ['towing','Capacidade máxima de reboque (kg) '],
  ['length','Comprimento (mm) '],['width','Largura (mm) '],
  ['wheelbase','Entre-eixos '],['height','Altura (mm) '],
  ['clearance','Vão-livre do solo (mm) '],
  ['approach','Ângulo de ataque (graus) '],['departure','Ângulo de saída (graus) '],
];
const SINGLE_NUMERIC = new Set([
  'valves','cylinders','battery','power','acceleration','weight','tank','towing',
  'length','width','wheelbase','height','clearance','approach','departure',
]);
const TEXT_FIELDS = new Set(['motor','transmission','traction','steering','tires','brakes']);
const number = (s: string): number => Number(s.replace(/\.(?=\d{3}(?:\D|$))/gu,'').replace(',','.'));

export function extractGwmH6Technical27(sourceText: string): GwmTechnicalExtraction27 {
  const observations: GwmTechnicalValue27[] = [];
  const unresolved: {line:number;text:string;reason:string}[] = [];
  const lines = sourceText.split(/\r?\n/u);
  const start = lines.findIndex(line => line.trim() === 'DADOS TÉCNICOS');
  if (start === -1) throw new Error('GWM_TECHNICAL_SECTION_MISSING');
  for (let index = start + 1; index < lines.length; index++) {
    const line = lines[index]!.trim();
    if (!line || line === 'DIMENSÕES') continue;
    const field = FIELDS.find(([,prefix])=>line.startsWith(prefix));
    if (!field) {unresolved.push({line:index+1,text:line,reason:'UNRECOGNIZED_OR_WRAPPED'});continue;}
    const [key,prefix]=field, raw=line.slice(prefix.length).trim();
    const emit=(fieldKey:string,value:number|string,kind:'numeric'|'text',extra:Partial<GwmTechnicalValue27>={})=>{
      observations.push({fieldKey,sourceLabel:prefix.trim(),value,kind,sourceLine:index+1,...extra});
    };
    const numeric=(fieldKey:string,fragment:string,extra:Partial<GwmTechnicalValue27>={}):boolean=>{
      if(!/^[0-9]+(?:[.,][0-9]+)*$/u.test(fragment.trim()))return false;
      const v=number(fragment.trim());
      if(!Number.isFinite(v))return false;
      emit(fieldKey,v,'numeric',extra);return true;
    };
    if (SINGLE_NUMERIC.has(key)) {
      if (!numeric(key,raw)) unresolved.push({line:index+1,text:line,reason:'NUMERIC_PARSE_FAILED'});
    } else if (TEXT_FIELDS.has(key)) {
      emit(key,raw,'text');
    } else if (key === 'urban' || key === 'road') {
      const m=/^ETANOL:\s*([\d.,]+)\s*\|\s*GASOLINA:\s*([\d.,]+)$/iu.exec(raw);
      if(m){numeric(key+'_ethanol',m[1]!,{unit:'km/L',methodology:'INMETRO'});numeric(key+'_gasoline',m[2]!,{unit:'km/L',methodology:'INMETRO'});}
      else unresolved.push({line:index+1,text:line,reason:'FUEL_SPLIT_FAILED'});
    } else if(key==='range'){
      const m=/^([\d.,]+) km \(WLTP\)\s*\|\s*([\d.,]+) km \(INMETRO\)$/iu.exec(raw);
      if(m){numeric('range_wltp',m[1]!,{unit:'km',methodology:'WLTP'});numeric('range_inmetro',m[2]!,{unit:'km',methodology:'INMETRO'});}
      else unresolved.push({line:index+1,text:line,reason:'RANGE_SPLIT_FAILED'});
    } else if(key==='torque'||key==='trunk'){
      const m=/^([\d.,]+)\s*\/\s*([\d.,]+)$/u.exec(raw);
      if(m){
        numeric(key==='torque'?'torque_nm':'trunk_seats_up',m[1]!,{unit:key==='torque'?'Nm':'L'});
        numeric(key==='torque'?'torque_kgfm':'trunk_seats_down',m[2]!,{unit:key==='torque'?'kgfm':'L'});
      } else unresolved.push({line:index+1,text:line,reason:'COMPOSITE_SPLIT_FAILED'});
    } else if(key==='top_speed'){
      const m=/^([\d.,]+)(?:\s+(.+))?$/u.exec(raw);
      if(m)numeric(key,m[1]!,{unit:'km/h',qualifier:m[2]});
      else unresolved.push({line:index+1,text:line,reason:'TOP_SPEED_PARSE_FAILED'});
    } else if(key==='charge_ac'||key==='charge_dc'){
      const m=/^([\d.,]+)\s*(h|min)\s*\(aprox\.\)$/iu.exec(raw);
      if(m)numeric(key,m[1]!,{unit:m[2],qualifier:'approximately'});
      else unresolved.push({line:index+1,text:line,reason:'CHARGE_DURATION_PARSE_FAILED'});
    } else if(key==='electric_motors'){
      const m=/^(\d+)\s+(dianteiro|traseiro)$/iu.exec(raw);
      if(m)numeric(key,m[1]!,{unit:'unit',qualifier:m[2]});
      else unresolved.push({line:index+1,text:line,reason:'MOTOR_COUNT_PARSE_FAILED'});
    }
  }
  return {observations,unresolved,summary:{
    recognizedFields:observations.length,
    numeric:observations.filter(v=>v.kind==='numeric').length,
    text:observations.filter(v=>v.kind==='text').length,
    unresolvedLines:unresolved.length,llmCalls:0,
  }};
}
