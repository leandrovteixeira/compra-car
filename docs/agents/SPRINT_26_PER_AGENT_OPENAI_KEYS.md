# Sprint 26 — Dedicated OpenAI API keys for QA agents

Status: code ready; keys MUST be created by the operator and configured in Railway secrets before QA worker promotion. No secret value belongs in Git, chat or an issue.

| Agent | Required env var | When required |
| --- | --- | --- |
| Brand Connector | `OPENAI_BRAND_CONNECTOR_API_KEY` | Real OpenAI source research |
| MMV Discovery | `OPENAI_MMV_DISCOVERY_API_KEY` | Real discovery, ambiguity adjudication and market lookup |
| Model Year | `OPENAI_MODEL_YEAR_API_KEY` | Only for independent AI research; NOT required when reusing a completed MMV parent run |
| Price | `OPENAI_PRICE_AGENT_API_KEY` | Only when `PRICE_AGENT_LLM_ENABLED=1`; deterministic Price has no OpenAI key dependency |

Shared non-secret model setting: `OPENAI_AGENT_MODEL` (required for Brand/MMV/independent MY).
MMV adjudication can use `OPENAI_ADJUDICATION_MODEL`.

## Railway configuration
- Create keys within distinct OpenAI projects if independent spend limits are desired. Four keys in the SAME project are not four independent provider budgets.
- Link the four secrets to the **QA agent worker service**, preferably via Railway shared variables referenced by that service. A shared variable definition that is not linked to the worker is not available in its process environment.
- Do NOT set these values on the public web client; they are server-only.
- Keep `APP_ENV=qa`, the QA-only Supabase URL, and existing service-role restrictions.
- Do not deploy a new worker until keys are present, provider project budgets are configured, and the cost-admission limits for the smoke are verified.
- No fallback to the legacy `OPENAI_API_KEY` is permitted. Leave it unset or disabled in the worker.
- One disabled agent key must fail only that agent's job. The worker should continue serving deterministic Price, MY reuse and other agents.

## Local environment
Use your existing ignored `open_ai.env` with entries named as above (do not commit it).
For a local file at the repository root, set
`COMPRA_CAR_AGENT_ENV_FILE=open_ai.env` in the invoking environment before running the CLIs.
The loader uses this path relative to the repository root; default without override is
`apps/web/.env.local`.

## Preflight tests
1. Confirm each variable EXISTS in the QA worker without printing any secret.
2. Check that disabled `OPENAI_API_KEY` is not used anywhere in the four live paths.
3. Test Price with `PRICE_AGENT_LLM_ENABLED=0` and NO Price key.
4. Test Model Year with valid `parentRunId` and NO Model Year key; this path reuses evidence.
5. Test each active AI agent with only its own key. Missing key must fail safely before provider request.
6. Validate cost admission **before** executing GWM, monitor usage and stop at each stage for review.
7. Promote worker alone only after these checks. Avoid reactivating duplicate QA/production schedules.

## Tasman caution
The `BASIC / GL / PGL-PRO` string is a composite/version enumeration, not a valid single commercial MMV. The QA review projection omits grouped labels and proposals containing only the model name. Preserve raw evidence, do not auto-split into inferred catalog rows; recover GL/other individually corroborated versions.

No provider call, key creation, data migration, or agent paid smoke was triggered by these code changes.
