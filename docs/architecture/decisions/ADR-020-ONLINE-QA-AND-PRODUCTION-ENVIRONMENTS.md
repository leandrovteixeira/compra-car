# ADR — Online QA + Production as the only Compra Car environments

## Status
Accepted — 2026-10-05

## Decision
Compra Car uses two persistent online environments:

1. **QA / Staging**
   - Railway QA application
   - Supabase Staging project `shfsjyjxmgwnlexmdkcs`
   - all development validation, agent runs, human review and smoke tests happen here
   - test/QA data never migrates to Production

2. **Production**
   - Railway Production application
   - Production Supabase
   - remains untouched during development
   - receives only reviewed code and migrations
   - Production data is changed only through an explicitly approved production data operation/import

Local execution is optional for coding/debugging, not a third persistent environment.

## Promotion rule
QA first. Promote code/migrations only after QA validation. Never promote QA data.

## Agent rule
Automated discovery, MMV reconciliation, Specs and Pricing agents operate against QA during development. Human review and explicit apply actions remain separate.

## Safety
Any tool or agent that cannot prove its target environment must fail closed rather than assume Production or Staging.
