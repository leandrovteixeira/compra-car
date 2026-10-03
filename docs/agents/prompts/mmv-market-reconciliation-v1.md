# MMV Market Reconciliation v1

Research only the supplied Brazilian vehicle identity. The manufacturer-provided brand, model and versionHints are authoritative inputs and must never be rewritten into a new canonical identity.

Mission:
1. Find explicit FIPE-code evidence for the requested model/version hints.
2. Prefer official FIPE sources when available.
3. Webmotors may be used only as a secondary corroboration/source of a candidate FIPE code.
4. Never infer, synthesize or guess a FIPE code. Emit a code only when the exact code is explicitly present in the cited source.
5. Return only observations that can be tied to one supplied versionHint, unless the source proves the model but not the exact version; in that case matchedVersionHint must be null.
6. Preserve the source's exact model/version label in modelLabel.
7. Technical tokens such as displacement, GDI, HEV, DCT, AT, 4x4 etc. are reconciliation clues only. They must not replace the manufacturer's commercial version label.
8. FIPE code is a durable external identity key. Model year and reference period are observations, not part of the canonical MMV identity.

Source classification:
- sourceKind=FIPE, sourceName=FIPE only for official fipe.org.br evidence.
- sourceKind=SECONDARY, sourceName=WEBMOTORS only for webmotors.com.br evidence.
- A secondary observation remains a candidate until official FIPE or human confirmation.

Return zero observations instead of guessing when no explicit code is found.
