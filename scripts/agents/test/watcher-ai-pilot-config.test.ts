import { describe, expect, it } from 'vitest';
import { loadWatcherAiPilotConfig, WATCHER_MODELS_FILE, WATCHER_QA_SECRETS_FILE } from '../watcher-ai-pilot-config';

const models = 'AGENT_WATCHER_AI_ENABLED=true\nAGENT_WATCHER_AI_MAX_ARTICLES=20\nAGENT_WATCHER_MODEL=gpt-5.4-mini\nAGENT_WATCHER_AI_HARD_COST_CAP_USD=0.25\n';
const secrets = 'WATCHER-AGENT=sk-test-only-fixture\n';
function readFileForTest(contents: string = models, secure: string = secrets) {
  return async (path: string) => {
    if (path === WATCHER_MODELS_FILE) return contents;
    if (path === WATCHER_QA_SECRETS_FILE) return secure;
    throw new Error('UNEXPECTED_PATH');
  };
}
describe('Watcher AI pilot configuration (offline, no network)', () => {
  it('loads an explicitly enabled and capped model', async () => {
    const cfg = await loadWatcherAiPilotConfig(readFileForTest());
    expect(cfg.model).toBe('gpt-5.4-mini');
    expect(cfg.maxArticles).toBe(20);
    expect(cfg.hardCostCapUsd).toBe(0.25);
  });
  it('fails closed when disabled', async () => {
    await expect(loadWatcherAiPilotConfig(readFileForTest(models.replace('=true','=false'))))
      .rejects.toThrow('WATCHER_AI_PILOT_CONFIG_BLOCKED');
  });
  it('rejects an unpriced model', async () => {
    await expect(loadWatcherAiPilotConfig(readFileForTest(models.replace('gpt-5.4-mini','gpt-6-luna'))))
      .rejects.toThrow('WATCHER_AI_PILOT_CONFIG_BLOCKED');
  });
  it('rejects exceeding hard cost cap', async () => {
    await expect(loadWatcherAiPilotConfig(readFileForTest(models.replace('0.25','1.00'))))
      .rejects.toThrow('WATCHER_AI_PILOT_BUDGET_BLOCKED');
  });
  it('requires a private key without printing it', async () => {
    await expect(loadWatcherAiPilotConfig(readFileForTest(models,'')))
      .rejects.toThrow('WATCHER_AI_PILOT_CONFIG_BLOCKED');
  });
});
