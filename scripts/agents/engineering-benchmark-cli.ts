import { readFile } from 'node:fs/promises';
import { scoreEngineeringGolden, evaluateEngineeringGoldenGate,
  type EngineeringGoldenCase, type EngineeringObservedCase } from '@compra-car/core/agents';

/** Offline comparison. Inputs must be externally reviewed; no API or database connections. */
export async function runEngineeringBenchmarkCli(
  args: readonly string[],
  log: (message:string)=>void = console.log,
): Promise<number> {
  if(args.length !== 2 || args[0]!=='--golden') throw new Error('ENGINEERING_BENCHMARK_ARGS');
  // Prefer explicit pairing: a JSON file carries expected and baseline/candidate observations.
  const raw=await readFile(args[1]!,'utf8');
  const parsed:unknown=JSON.parse(raw);
  if(!parsed || typeof parsed!=='object') throw new Error('ENGINEERING_INVALID_FIXTURE');
  const obj=parsed as Record<string,unknown>;
  if(obj.schemaVersion!=='engineering-offline-v1'||obj.reviewed!==true
    || !Array.isArray(obj.golden)||!Array.isArray(obj.baseline)||!Array.isArray(obj.candidate))
    throw new Error('ENGINEERING_UNREVIEWED_FIXTURE');
  const gold=obj.golden as EngineeringGoldenCase[];
  const old=scoreEngineeringGolden(gold,obj.baseline as EngineeringObservedCase[]);
  const next=scoreEngineeringGolden(gold,obj.candidate as EngineeringObservedCase[]);
  const gate=evaluateEngineeringGoldenGate(old,next);
  log(JSON.stringify({fixture:args[1],baseline:old,candidate:next,gate}));
  return gate.accepted ? 0 : 2;
}
if(process.argv[1]?.endsWith('engineering-benchmark-cli.ts')){
  void runEngineeringBenchmarkCli(process.argv.slice(2)).then(code=>{process.exitCode=code;})
    .catch(()=>{console.error('ENGINEERING_BENCHMARK_FAILED');process.exitCode=1;});
}
