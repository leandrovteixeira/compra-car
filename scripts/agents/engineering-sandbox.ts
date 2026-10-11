import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute, sep } from 'node:path';
import { validateEngineeringPatchManifest, type EngineeringPatchManifest } from '@compra-car/core/agents';

/**
 * Offline, file-only sandbox executor. Caller owns a disposable workspace.
 * No shell, Git, network, credentials, autonomous patch synthesis or promotion.
 * The base is read-only; no writes happen until all inputs are validated.
 */
export async function applyEngineeringPatchInSandbox(
  workspace: string,
  manifest: EngineeringPatchManifest,
  replacements: Readonly<Record<string,string>>,
): Promise<readonly string[]> {
  const errors = validateEngineeringPatchManifest(manifest);
  if(errors.length) throw new Error('ENGINEERING_PATCH_INVALID_MANIFEST');
  const root = resolve(workspace);
  const verified: {path:string;content:string}[]=[];
  const declared=new Set(manifest.files.map(f=>f.path));
  if(Object.keys(replacements).length!==declared.size ||
    Object.keys(replacements).some(p=>!declared.has(p)))
    throw new Error('ENGINEERING_PATCH_CONTENT_MISMATCH');
  for(const file of manifest.files) {
    const target=resolve(root,file.path);
    const rel=relative(root,target);
    if(isAbsolute(rel)||rel==='..'||rel.startsWith('..'+sep))
      throw new Error('ENGINEERING_PATCH_TRAVERSAL');
    // Symlinks are refused: real paths must match exactly.
    const {realpath,lstat}=await import('node:fs/promises');
    const resolvedFile=await realpath(target);
    if(resolvedFile!==target || (await lstat(target)).isSymbolicLink())
      throw new Error('ENGINEERING_PATCH_SYMLINK');
    const current=await readFile(target);
    const hash=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
    if(hash(current)!==file.beforeSha256) throw new Error('ENGINEERING_PATCH_BASE_MISMATCH');
    const replacement=replacements[file.path]!;
    if(hash(replacement)!==file.afterSha256) throw new Error('ENGINEERING_PATCH_HASH_MISMATCH');
    verified.push({path:target,content:replacement});
  }
  // A safe operator must supply a truly disposable, isolated workspace and run CI externally.
  for(const file of verified) await writeFile(file.path,file.content,{flag:'w'});
  return verified.map(f=>relative(root,f.path));
}
