/** Strict sandbox patch manifest admission. No filesystem, git, or shell side effects. */
export interface EngineeringPatchManifest {
  readonly branch: string;
  readonly baseCommit: string;
  readonly files: readonly {readonly path:string;readonly beforeSha256:string;readonly afterSha256:string}[];
  readonly maxChangedFiles: number;
}
const sha=/^[a-f0-9]{64}$/u;
export function validateEngineeringPatchManifest(m:EngineeringPatchManifest): readonly string[] {
  const errors:string[]=[];
  if(!/^engineering\/candidate-[a-z0-9-]{1,50}$/u.test(m.branch)) errors.push('UNSAFE_BRANCH');
  if(!/^[a-f0-9]{40}$/u.test(m.baseCommit)) errors.push('INVALID_BASE_COMMIT');
  if(!Number.isInteger(m.maxChangedFiles)||m.maxChangedFiles<1||m.maxChangedFiles>20
    ||m.files.length===0||m.files.length>m.maxChangedFiles) errors.push('FILE_LIMIT');
  const paths=new Set<string>();
  for(const file of m.files) {
    const p=file.path;
    if(!/^(packages\/(core|adapter-openai)\/|scripts\/agents\/)[a-zA-Z0-9_./-]+$/u.test(p)
      ||p.split('/').some(x=>x==='..'||x==='.')
      ||p.endsWith('/')||p.includes('//')
      ||p.startsWith('scripts/agents/.')||p.includes('/.env')
      ||p.includes('/node_modules/')||p.includes('/.github/')) errors.push('UNSAFE_PATH');
    if(paths.has(p)) errors.push('DUPLICATE_PATH');
    paths.add(p);
    if(!sha.test(file.beforeSha256)||!sha.test(file.afterSha256)) errors.push('INVALID_FILE_HASH');
  }
  return [...new Set(errors)];
}
