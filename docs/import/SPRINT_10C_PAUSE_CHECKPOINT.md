# Sprint 10C — Pause Checkpoint

Status: **PAUSED AFTER EXPERIMENTAL SEGMENTED PIPELINE VALIDATION**
Data: 2026-08-23

## Why paused

O benchmark real mostrou que o pipeline segmentado funciona em vários boundaries, mas o contrato
intermediário atual introduziu complexidade excessiva para o estágio do MVP. A pausa é estratégica:
o trabalho não falhou e ainda não está production-ready.

## What works

- provider OpenAI real e Structured Outputs;
- Document Map, IDs server-owned e Unit Plan determinístico;
- Unit Extraction segmentada com transport/canonical boundaries;
- artifact lifecycle, persistence, DAG/dependencies e retry lifecycle;
- foundation de merge, Semantic Reconciliation e Domain Mapping;
- canonical handoff wiring, diagnostics seguros e feature flag one-shot/segmented;
- smoke real em Staging alcançando Unit Extraction.

## What remains

O benchmark real não concluiu todas as Unit Extractions nem executou com sucesso as etapas reais de
Merge, Semantic Reconciliation, Domain Mapping, canonical handoff, matching ou import segmentado
end-to-end. O último blocker foi `/coverage/status: incompleteDataMarkedComplete` em
`unit-0001-table`; `unit-0002-table` foi sibling abort. Reason codes seguros estão prontos para uma
investigação futura, mas nenhum novo retry deve ser iniciado agora.

## Default runtime

`one_shot` permanece funcional e ativo por default. Segmented continua somente por opt-in e não é
blocker para o MVP. O fluxo aceitável do MVP é PDF → one-shot extraction → canonical validation →
revisão humana/admin → staging/approval → persistência existente.

## Known debts

- o intermediate extraction contract provavelmente está complexo demais;
- campos deriváveis devem migrar para autoridade server-owned, incluindo IDs, ordering,
  back-references, counters, hashes, lifecycle metadata, provenance linkage e coverage determinística;
- comparar Simple Extraction Baseline com o pipeline segmentado atual;
- cross-job artifact reuse não está implementado;
- uma unit bem-sucedida pode não ser publicada quando uma sibling falha;
- usage/providerRunId de output rejeitado localmente pode ser perdido.

## Resume criteria

Retomar somente por decisão explícita. A retomada começa por:

1. executar Simple Extraction Baseline com documento benchmark;
2. definir o resultado comercial mínimo;
3. medir qualidade, custo e latência;
4. revisar quais campos precisam vir da IA;
5. simplificar o intermediate contract;
6. decidir então entre adaptar, simplificar ou descartar parcialmente o pipeline atual.

## Do not do automatically

- não iniciar o próximo coverage retry;
- não executar smoke OpenAI sem autorização explícita;
- não ativar segmented por default;
- não apagar runtime, artifacts, schemas, canonicalizers, reconciliation, Domain Mapping ou testes;
- não continuar edge-case/prompt patches antes da simplification review.

## Next product focus

Comparação utilizável, PDF, compartilhamento/link, WhatsApp, usuários/login, convites, histórico de
comparações e polish mobile.
