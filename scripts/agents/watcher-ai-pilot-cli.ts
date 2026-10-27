import { readFile, writeFile, mkdir, open } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import OpenAI from 'openai';
import { loadWatcherAiPilotConfig } from './watcher-ai-pilot-config';

// Manual-only, no QA writes, no agent scheduler, no searches or external tools.
// Each article is its own bounded structured-extraction API call.
const directory = resolve(process.cwd(), '../../.local-reports/watcher-24b');
const requested = process.argv[2];
const sourceFile = process.argv[3];
const MAX_OUTPUT_TOKENS = 400;
const RESERVE_PER_ARTICLE_USD = 0.01;
const inputPricePerMillion = 0.05;
const outputPricePerMillion = 0.25;
const approvedModel = 'gpt-6-luna';

type Item = {revisionId: string; events: {quote: string; field: string}[]};
function halt(reason: string): never { throw new Error(reason); }
function failClosed(input: unknown): Item[] {
  if (!input || typeof input !== 'object' || !('eventDetection' in input) ||
      !Array.isArray(input.eventDetection)) return halt('WATCHER_AI_INPUT_INVALID');
  const list = input.eventDetection as Item[];
  if (list.length !== 20 || new Set(list.map(x => x.revisionId)).size !== 20 ||
      list.some(x => !x || typeof x.revisionId !== 'string' || !Array.isArray(x.events) ||
        x.events.some(e => typeof e.quote !== 'string' || e.quote.length > 1200)))
    return halt('WATCHER_AI_INPUT_INVALID');
  return list;
}
const schema = {
  type: 'object', additionalProperties: false,
  properties: {
    events: {type:'array', maxItems:5, items: {
      type:'object', additionalProperties:false,
      properties:{
        category:{type:'string',enum:['NEW_MODEL','NEW_VERSION','MODEL_YEAR','POWERTRAIN','FACELIFT','MSRP','PROMOTION','MARKET_ENTRY','INDUSTRIAL','CORPORATE','EDUCATIONAL','OTHER']},
        brand:{type:['string','null']}, model:{type:['string','null']}, version:{type:['string','null']},
        market:{type:'string',enum:['BR','FOREIGN','UNKNOWN']},
        evidence:{type:'string'}, uncertain:{type:'boolean'},
      },
      required:['category','brand','model','version','market','evidence','uncertain'],
    }},
  }, required:['events'],
} as const;
try {
  if (requested !== '--run-once' || !sourceFile || process.argv.length !== 4)
    halt('WATCHER_AI_MANUAL_OPT_IN_REQUIRED');
  const config = await loadWatcherAiPilotConfig();
  if (config.model !== approvedModel) halt('WATCHER_AI_MODEL_NOT_PRICED');
  if (!sourceFile.startsWith(directory + '\\') || !sourceFile.endsWith('.json'))
    halt('WATCHER_AI_INPUT_PATH_DENIED');
  const items = failClosed(JSON.parse(await readFile(sourceFile,'utf8')));
  await mkdir(directory,{recursive:true});
  const lockPath = resolve(directory,'ai-pilot-once.lock');
  const lock = await open(lockPath,'wx');
  try { await lock.writeFile('STARTED — manual pilot, no automatic retry\n'); }
  finally { await lock.close(); }
  const client = new OpenAI({apiKey:config.apiKey,maxRetries:0,timeout:20000});
  const results: unknown[] = [];
  let spent = 0;
  for (const item of items) {
    if (spent + RESERVE_PER_ARTICLE_USD > config.hardCostCapUsd + 1e-9)
      halt('WATCHER_AI_BUDGET_EXHAUSTED');
    // This pilot reads only excerpts from the locally saved deterministic preview.
    // An article with no supported event still goes to AI for independent coverage.
    const text = item.events.map(e => e.quote).filter(Boolean).join('\n').slice(0,2400);
    // Preview eventDetection may be empty for some articles. Do not make an empty API call.
    if (!text) { results.push({revisionId:item.revisionId,skipped:'NO_TEXT_IN_EVENT_PREVIEW'}); continue; }
    const response = await client.responses.create({
      model:config.model, max_output_tokens:MAX_OUTPUT_TOKENS,
      instructions:'Classifique fatos automotivos a partir SOMENTE do texto fornecido. Não invente fatos, marcas, modelos ou versões. evidence deve ser uma substring literal do texto. Rumores devem ser uncertain=true. Oferta de desconto não é MSRP. Responda em JSON estrito.',
      input:text,
      text:{format:{type:'json_schema',name:'watcher_news_events_v1',strict:true,schema}},
      store:false,
    });
    const actual = (response.usage?.input_tokens ?? 0)*inputPricePerMillion/1e6 +
      (response.usage?.output_tokens ?? 0)*outputPricePerMillion/1e6;
    spent+=actual;
    if (spent>config.hardCostCapUsd) halt('WATCHER_AI_BUDGET_EXCEEDED');
    if (!response.output_text) halt('WATCHER_AI_EMPTY_RESULT');
    const parsed=JSON.parse(response.output_text) as {events:{evidence:string}[]};
    if (!Array.isArray(parsed.events) ||
      parsed.events.some(e=>typeof e.evidence !== 'string' || !text.includes(e.evidence)))
      halt('WATCHER_AI_EVIDENCE_MISMATCH');
    results.push({revisionId:item.revisionId,events:parsed.events,usage:response.usage});
  }
  const file = resolve(directory,'ai-pilot-'+createHash('sha256').update(sourceFile).digest('hex').slice(0,12)+'.json');
  await writeFile(file,JSON.stringify({schemaVersion:'watcher-ai-pilot/1',model:config.model,sourceFile,
    articles:items.length,spentUsd:spent,results},null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify({status:'PASS',model:config.model,articles:items.length,costUsd:spent,resultFile:file}));
} catch (error) {
  const allowed=['WATCHER_AI_MANUAL_OPT_IN_REQUIRED','WATCHER_AI_MODEL_NOT_PRICED','WATCHER_AI_INPUT_PATH_DENIED',
    'WATCHER_AI_INPUT_INVALID','WATCHER_AI_BUDGET_EXHAUSTED','WATCHER_AI_BUDGET_EXCEEDED',
    'WATCHER_AI_EMPTY_RESULT','WATCHER_AI_EVIDENCE_MISMATCH'];
  const code=error instanceof Error && allowed.includes(error.message) ? error.message : 'WATCHER_AI_PILOT_BLOCKED';
  console.error(code);
  process.exitCode=1;
}
