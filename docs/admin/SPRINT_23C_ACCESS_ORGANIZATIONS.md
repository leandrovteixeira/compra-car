# Sprint 23C.1 — Access Control & Organizations

## Scope and initial delivery

- Branch: `sprint-23c-access-organizations`.
- Environment: QA/Staging only; production remains untouched.
- This iteration introduces a pure, independently testable entitlement matrix and prepares the organization architecture. The matrix is **not yet wired to the existing routes**.
- Existing `profiles.role` enum is `seller | admin`; no implicit conversion to new privileges is allowed.
- No SMTP or Resend dependency in this iteration.

## Roles and guest access

Guest (visitor) is a session condition, **not** a database role. It has read access to public vehicle specifications and comparisons limited to three vehicles. Public is authenticated and adds Export/Share. Corporate has eight-vehicle comparisons and a price list. Admin has operational access except Agents and Settings. Master has full platform access.

Future features remain visible but disabled **only for authorized roles**:
- TPVA and Chat: Corporate, Admin, Master
- News, Education and Current Policies: Admin, Master

Disable/hide is cosmetic only. Server actions, API handlers, and database RLS must enforce the same access policy before release.

## Organization plan

A Corporate organization may have multiple members, but organizational membership must not automatically share member activity, personal data, contract pricing or history. An internal `Compra Car — Early Access` organization may accommodate invited professionals, with individual grants and expirations. It must not be used as a shared-data tenant.

Existing users keep their legacy profile and capabilities until migration has a reviewed mapping. Global Master and Admin privileges must be granted only by trusted operators in the server/database, never through user-editable metadata.

## Release prerequisites

1. Integrate server-verified account roles and explicit corporate grants, preserving the current production behavior.
2. Apply reviewed SQL migration on Staging and verify RLS with anonymous, Public, Corporate, Admin and Master identities.
3. Connect entitlement checks to sidebar, page layouts, Server Actions and export/share endpoints.
4. Implement invite/membership administration and audit trail.
5. Add email/password signup, verification, password reset and SMTP in a subsequent stage; public signup remains gated until deliverability is configured.
6. Run `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` on Node 22 before merge or QA deployment.
