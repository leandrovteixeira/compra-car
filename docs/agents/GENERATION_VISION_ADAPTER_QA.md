# Generation Classifier — Dedicated OpenAI Vision Adapter (Sprint 26 extension)

## Current state (Nov 4, 2026)

Review-only, opt-in, isolated branch `sprint-26-generation-ai-adapter`. The autonomous `agent-worker` does not load these new adapters by default; it still runs the pre-adapter branch in Railway QA. This PR does not deploy or update any Supabase schema.

- Core `mmv-generation-evidence.ts` compares *two distinct official MY documents* for wheelbase, length, width, height and powertrain architecture. Unverified/missing sources = null signal, not zero.
- `OpenAIGenerationVisionAdapter`: exactly one Responses API vision request, **two low-detail image inputs**, structured JSON-only response, `store:false`, `maxRetries:0`, no web search tools, independent API key, usage callback triggered before output validation.
- `OpenAIGenerationAssessmentProvider` binds the evidence pair to a unique matched MMV and MY, and supplies the existing standard Generation Classifier's three signals. No direct canonical writes.
- `generation-one-shot.ts`: explicit, bounded pilot. Offline mode makes no API calls or database changes. Live QA requires the dedicated key and two vetted local manufacturer-image captures bound to MY2026 and MY2027.

## Pilot commands

```bash
pnpm --filter @compra-car/agents exec tsx generation-one-shot.ts \
  docs/agents/fixtures/gwm-h6-2026-2027-generation.json --offline
```

For a paid live QA attempt, an operator must first prepare two image files **from the official GWM MY2026 and MY2027 sources**, with comparable angles. Update the manifest's `designSources` and `images` with their documented sources and local image paths. Then run in QA-only authorized worker context:

```bash
pnpm --filter @compra-car/agents exec tsx generation-one-shot.ts \
  docs/agents/fixtures/gwm-h6-2026-2027-generation.json --live-qa
```

Live checks: `APP_ENV=qa`, QA Supabase project reference in URL, `SUPABASE_SERVER_KEY` and `OPENAI_GENERATION_CLASSIFIER_API_KEY`. Model is pinned to `gpt-5.4-mini-2026-03-17`; use the official $0.75/M input, $0.075/M cached, $4.50/M output pricing. Any different model is rejected until rates are reviewed. Call is admitted only if conservative budget preflight <= US$2; *actual charge is an external billing event, so a preflight is not a mathematically guaranteed hard cap*. One call, zero retries, and usage is recorded before semantic validation. If provider does not return usage, the action fails closed.

## H6 official-source metadata smoke

Source snapshots:
- MY2026 PDF GWM: 4703×1886×1730 mm, 2738 mm wheelbase; 1.5 turbo gasoline PHEV19.
- MY2027 Flex PDF GWM: same four dimensions; 1.5 turbo Flex PHEV19.

```json
{
  "classification":"UNKNOWN",
  "score":null,
  "signals":[
    {"dimension":"design","severity":null,"evidenceCount":0},
    {"dimension":"powertrain","severity":1,"evidenceCount":2},
    {"dimension":"dimensions","severity":0,"evidenceCount":2}
  ],
  "usage":null,
  "reviewOnly":true,
  "canonicalWrites":false
}
```

This is **not** confirmation of MINOR_CHANGE: visual design must be assessed from officially traced, comparable MY photographs before reaching a complete classification. The manufacturer press release about the **2026 facelift** is not evidence of a **new 2027 generation** by itself; correct MY binding matters.

## Telemetry

Live QA pilot inserts a `MMV_DISCOVERY` `agent_runs` RUNNING row before the provider call, and one `agent_ai_usage_events` event on response (including failed semantic validation), then transitions the run to COMPLETED/FAILED. It reports input, cached input, output, estimated USD (from real token counts), and zero web searches. Cached tokens are recorded in the run summary; the ledger schema has no dedicated cached-input column.

## Testing

CI `generation-vision-adapter.yml` gates the adapter typecheck, simulated Responses API contract, source-binding tests, deterministic generation tests, scripts typecheck, and offline H6 smoke. CI uses **no credentials**, no paid calls, and makes no QA/Production data changes.

## Follow-on integration before semi-autonomy

1. Brand Connector (or a trusted source-capture adapter) discovers two authoritative MY image pairs plus source hashes, avoids false MY labels and ambiguous camera angles.
2. Run one real, paid, under-budget GWM visual pilot using the already provisioned QA key. Confirm API usage event and reason in QA DB.
3. Connect the approved `OpenAIGenerationAssessmentProvider` into the regular MMV Discovery runtime with an event trigger, not daily all-MMV polling. Reconcile QA branch and test existing Reviews.
4. Approved generation findings feed Spec Agent's *advisory* carry-over policy. The definitive spec rule `UNKNOWN = NOT_AVAILABLE` is untouched.
