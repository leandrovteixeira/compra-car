# Watcher Sprint 24B — Opt-in OpenAI benchmark of 20 Motor1 articles

This is an **offline-code implementation**, not evidence of an executed API pilot.

## Architecture
- Existing RSS ingestion and QA read-only preview remain unchanged.
- The new pilot reads the latest **locally saved** `intelligence-preview-*.json` from the 20-article QA run. No new RSS requests, no Supabase writes, no catalog mutation.
- Processes **all 20 article title/excerpt pairs** regardless of deterministic event coverage, with one Responses API call per article, structured JSON, literal evidence validation, zero SDK retries and `store:false`.
- `gpt-5.4-mini` pinned for this pilot only. Existing agents retain their current model configuration.
- Manual-only, default DISABLED. An exclusive receipt prevents accidental replay of a possibly billable batch; partial per-article results are saved locally. Do not delete an execution receipt to work around an error without reconciling API usage.
- Hard intended **pilot budget policy US$ 0.25**, with US$ 0.0125 reserved per article and measured cost tracked using $0.75/1M input tokens, $4.50/1M output tokens. **This is an application-side guard, not a provider-enforced spending limit; an in-flight request cannot be cancelled retroactively when charged.** No browser search, no tools, max 400 output tokens/call.
- First run requires approved QA source preview and API key. Do not copy private env files or keys into Git.

## Configuration

Example file: `config/agent-models.env.example` → private `C:/Dev/.secrets/compra-car/agent-models.env`.
Only the Watcher pilot reads these flags presently; other agent entries are placeholders for future consolidation, not a runtime routing change.

```ini
AGENT_WATCHER_MODEL=gpt-5.4-mini
AGENT_WATCHER_AI_ENABLED=true
AGENT_WATCHER_AI_MAX_ARTICLES=20
AGENT_WATCHER_AI_HARD_COST_CAP_USD=0.25
```

The existing private `C:/Dev/.secrets/compra-car/staging.env` must also include `OPENAI_API_KEY`. Never expose its value.

## Validation (before spending API balance)

```powershell
cd C:\Dev\compra-car-s24
git pull --ff-only
pnpm --filter @compra-car/agents exec vitest run test/watcher-ai-pilot-config.test.ts
pnpm --filter @compra-car/adapter-openai typecheck
pnpm --filter @compra-car/agents typecheck
```

Do not run the billable pilot until all tests and typechecks pass; investigate any failures first.

## Manual pilot (billable; once per saved preview)

```powershell
$report = Get-ChildItem .local-reports\watcher-24b\intelligence-preview-*.json |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1
pnpm watcher:qa:ai:pilot --run-once $report.FullName
```

Results are written exclusively to local `.local-reports/watcher-24b/`, not to the database. Compare every extracted entity/event against the exact original title/excerpt. **No automatic approval or canonical insert.** Next milestone is evidence audit and measured precision.

Deployment: no production access, no scheduler and no provider calls occurred when these files were authored.
