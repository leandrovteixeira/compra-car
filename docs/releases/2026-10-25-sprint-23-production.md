# Sprint 23 production promotion — 2026-10-25

## Authorized release

The owner explicitly approved promoting the QA UX/access/pricing application to production and using real production data. QA data must never be copied. Agent development and automatic agent execution remain in QA while Sprints 24–26 continue.

Application baseline: QA `59444884bc69763d72b761d4472c687b53287f0d`.
Previous production: `9ccf69eb6af4a534f7c037221364c86f752d3f98`, Railway deployment `8c573cd2-5f59-4c59-9534-dee49694c622`.
Production branch `main` and QA diverged after `4d4840c33276845ddd62748847588e7e3b47073f`. The four production comparison commits are superseded by the reviewed QA comparison implementation; the release merge records both histories with the accepted QA source tree. No Legacy content differs.

## Targets

- Railway project: Compra Car Production (`150c6eba-75ab-4fbd-9649-23a6c2eb9f00`)
- Environment: production (`b7c40d23-dc75-4e2b-9e94-dc2a5cd24aef`)
- Web service: `7337bb02-db95-4e22-a3a2-a80d675732cf`
- URL: https://compra-carweb-production.up.railway.app
- Supabase production: `ltbeykzccckdwpzyeywu`
- Supabase QA: `shfsjyjxmgwnlexmdkcs`

## Database promotion allowlist

Apply only these reviewed migrations, in order, before changing application source:

1. `20261018153000_admin_product_spec_started_view.sql`
2. `20261018194000_audited_published_price_correction.sql`
3. `20261018195000_atomic_manual_price_publish.sql`
4. `20261020151000_sprint_23c_account_organizations.sql`
5. `20261020210500_sprint_23c_profile_upgrade.sql`
6. `20261020211200_sprint_23c_profile_edit_grants.sql`
7. `20261020223500_sprint_23c_review_corporate.sql`
8. `20261025195856_sprint_23_production_read_view_hardening.sql`
9. `20261025200141_sprint_23_organization_membership_rls_fix.sql`

The last two migrations were tested in QA before production: service-role view still returns 354 started products; RLS tests confirm a member sees only their own organization, a nonmember sees neither fixture organization, and authenticated users cannot write privilege grants. All fixture rows rolled back. The policy fix qualifies the outer organization ID, avoiding the previous `m.organization_id = m.id` bug.

Do not run all pending migrations or any seed/import/data reconciliation command. Agent cost budgets, source monitoring, MMV/model-year and QA price-job migrations are outside this release. No worker or scheduler is provisioned in production; APP_ENV must be `production` and all Supabase URLs must reference the production project. Existing secrets remain unchanged.

The sole verified active production administrator is the owner. Create an explicit Master access grant for that existing owner only, preserving the prior full administrative capability in the new entitlement model. Do not copy any QA account/grant/organization, activate the pending seller, or create Early Access seed data.

## Data preservation baseline

| Table | Rows | Content fingerprint |
| --- | ---: | --- |
| products | 354 | 26ac90d2f48952fb8a2c1abbdf5fac7b |
| specs | 321 | 8b59033f823531ca6a1034aa9b9ee227 |
| product_specs | 49052 | d2b2e0380da2d337e473a7aca404b49b |
| product_public_prices | 818 | 232e4dda76e11d68b18f18bdfb4906ec |
| commercial_policies | 20 | b71156eb82abfa26244b293c41a4924c |

Fingerprints are MD5 of sorted per-row MD5 hashes of row_to_json, used only as a change detector. Recheck after migration and publication. Existing profiles and historical agent runs/findings remain intact; only the explicit owner access configuration is added.

## Verification and rollback

QA baseline already passed 33 focused tests, typecheck and GitHub release-gate build. Repository-wide checks retain existing debt: six unrelated core failures, lint warnings and formatting drift. This release adds SQL security hardening and operational documentation, not additional application behavior.

Verify new SQL functions exist, service-only pricing RPC access, RLS and owner entitlement, unchanged production data fingerprints, terminal Railway SUCCESS, /api/health and public catalog/comparison/login routes. Never create a real price or policy just to smoke-test production.

Preserve the prior successful deployment for application rollback. New schemas/columns and pricing functions remain additive/backward compatible; do not drop them as rollback. Repoint to the previous source commit/build if runtime verification fails.

Known scope limitations: this is an initial owner-operated production rollout. Corporate price-list access through the legacy admin layout and public signup/SMTP were documented as pending in the Sprint 23C route audit; this release does not certify those flows or turn on automated production agents. Authenticated end-user browser validation remains part of the owner's first real session.
