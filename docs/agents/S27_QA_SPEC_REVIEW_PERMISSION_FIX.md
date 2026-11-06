# Sprint 27 — QA Spec Review permission correction (2026-11-05)

## Symptom

Operator selecting `CO_0017` for the official Ford Ranger finding `Painel de instrumentos colorido de 8’’` could not canonicalize. No `agent_reviews` receipt nor `spec_field_aliases` row was created.

## Root cause

The QA `s27_canonicalize_spec_finding` function was `SECURITY INVOKER`, correctly running as `service_role`, but it selected an immutable `agent_findings` row `FOR UPDATE`. That requires `UPDATE` permission on `agent_findings`, deliberately not granted to `service_role`. The transaction aborted with Postgres `42501: permission denied for table agent_findings`.

## Applied fix

Migration `s27_qa_spec_review_fix_immutable_finding_read` replaces the following statement in **both** functions `public.s27_canonicalize_spec_finding` and `public.s27_decide_spec_finding`:

```sql
select * into f from public.agent_findings where id=p_finding for update;
```

with:

```sql
select * into f from public.agent_findings where id=p_finding;
```

The `agent_review_cases` row remains locked `FOR UPDATE` for canonicalization. No broad table `UPDATE` grants or security-definer escalation were added.

## Verification

As `SET LOCAL ROLE service_role` in a rollback-only transaction, canonicalization of finding `04cee22a-9be6-47b9-a00a-0c41dd676ed3` against `CO_0017` (id 206) returned `APPROVED`, and `DEFER` returned successfully for the same finding in a separate rollback-only transaction. No test alias/review persisted, and operator approval remains pending.

The Web QA searchable combobox is a separate UX change and has its own build/deploy lifecycle. Production untouched.
