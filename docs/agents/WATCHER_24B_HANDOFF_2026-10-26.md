# Sprint 24B — handoff entre notebooks (2026-10-26)

## Fonte canônica
- GitHub: `leandrovteixeira/compra-car`, branch `sprint-24-watcher-local`.
- Base do código 24B: commit `22080a0e9c31953c177fe0d70e5907bfaaaefe49`.
- QA exclusivamente: Supabase project ref `shfsjyjxmgwnlexmdkcs` (Compra Car Staging).
- Produção não autorizada para operações do Watcher.

## Progresso verificado
- 24B.1–24B.3 motor determinístico/candidate discovery/AI gate implementados localmente, com IA desligada.
- 24B.4A schema, adapter e testes locais implementados; histórico: 436 testes Watcher e 49 cenários PostgreSQL 17.6 PASS no notebook anterior. Ainda não repetidos neste ambiente.
- SQL fonte: `supabase/migrations/20261026191808_sprint_24b4a_watcher_intelligence.sql`, SHA-256 `41b202c9287ea7eb3654fbe499c70645a53c0111a19523bf8aaeb5156a677011`.
- Aplicado somente em QA via Supabase administrativa, registrando versão **`20261027001054_sprint_24b4a_watcher_intelligence`**. **Não aplicar novamente** `20261026191808` ao QA; versões estão mapeadas em `WATCHER_QA_24B_MIGRATION_APPLIED.md`.
- Postflight: 4 tabelas intelligence com RLS; 3 RPCs security invoker, EXECUTE somente service_role; 20 artigos, 20 revisions, 20 feed items preservados.
- Nova consulta read-only: zero intelligence units, zero intelligence candidates e zero intelligence receipts. **Ainda não houve processamento real dos 20 artigos.**

## Próximos passos
1. Validar dados do lote com leitura somente QA e obter contexto canônico de marcas/MMV.
2. Construir/habilitar executor de piloto QA separado das operações RSS, com verificações explícitas de identidade QA, versões, leases/fencing, limite 100 e receipt; IA desligada.
3. Executar projeção determinística dos 20 artigos em modo read-only primeiro; comparar replay e fingerprints.
4. Só então persistir via `watcher_commit_intelligence` em QA em operação controlada, conferir readback e auditoria, e reportar sinais, candidatos, abstenções e evidências reais. Nada de apply para catálogo/comercial ou produção.

## Restrições
- Não executar `supabase migration repair`, `db pull` ou broad `db push` para reconciliar QA; histórico local das branches diverge.
- Não usar Codex Cloud checkout `work` baseado em `main` para validar 24B; branch de código é `sprint-24-watcher-local`.
- Sem novas chamadas LLM, sem scheduler, sem alterações em produção.
