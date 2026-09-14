import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

export type AgentEnvironment = Readonly<Record<string, string | undefined>>;

/** Node's dotenv grammar, without mutating process.env or writing environment files. */
export async function loadAgentEnvironment(
  repositoryRoot: string,
  environment: AgentEnvironment = process.env,
): Promise<AgentEnvironment> {
  let defaults: AgentEnvironment = {};
  try {
    const file = resolve(
      repositoryRoot,
      environment.COMPRA_CAR_AGENT_ENV_FILE?.trim() || 'apps/web/.env.local',
    );
    const content = await readFile(file, 'utf8');
    // An optional malformed/unreadable file must never crash a fixture or reveal its contents.
    if (!content.includes('\0')) {
      defaults = Object.fromEntries(
        Object.entries(parseEnv(content)).filter(([key]) => /^[a-zA-Z_][a-zA-Z0-9_]*$/u.test(key)),
      );
    }
  } catch {
    /* Configuration is checked by each CLI before constructing real providers/clients. */
  }
  return {
    ...defaults,
    ...Object.fromEntries(Object.entries(environment).filter(([, value]) => value !== undefined)),
  };
}
