# Sprint 19C — Brand Connector Agent

Base: `3c7a82c256985f70d3fee641230f2d6c0764c026`, branch `sprint-19c-brand-connector-agent`.

Atualização 19C.2: [runtime, ambiente compartilhado e identidade interna](SPRINT_19C2_RUNTIME_HARDENING.md).
O contrato de pesquisa retorna `observedBrandLabel` separado; a identidade de run/subject/proposal
vem exclusivamente da entrada. Um rótulo oficial diferente não renomeia o target e não causa
rejeição por comparação textual. Mercado, evidências e todas as validações de ativação permanecem.

## Responsabilidade e fronteiras

O connector responde como pesquisar uma marca em um mercado. Contém domínios, entry points, termos de busca e terminologia de navegação. Não faz matching MMV, PY/MY, extração final de specs ou preços. Nenhum comando desta capability modifica o catálogo. Adicionar uma marca manual não cria Product.

Contratos, validação, resolver e agent ficam em `packages/core/src/agents`; o acesso a dados fica exclusivamente em `packages/adapter-supabase`. O provider tem schema próprio no `adapter-openai`. A Agent Platform continua responsável por runs, findings, evidências e reviews; não há infraestrutura duplicada.

## Registro e sincronização

`brand_connector_targets` identifica `(market, brand_key)`. A chave usa a normalização textual existente: trim, espaços colapsados e comparação case-insensitive; não aplica fuzzy nem remove diferenças semânticas. Mercado usa duas letras maiúsculas, BR por padrão. Origens: CATALOG e MANUAL. Pausar só altera `enabled` e preserva connectors e histórico.

`syncCatalogBrands()` lê `products.brand` pelo adapter, pagina por id e avança pela quantidade efetivamente recebida até uma página vazia. Funciona mesmo quando Max Rows é menor que a página solicitada. Faz deduplicação lógica e upsert com `ignoreDuplicates`: não substitui origem, ator nem pausa existentes. Retorna contagens adicionadas/existentes. A execução é explícita pelo botão administrativo; carregamentos de página não fazem writes. O scan não é um snapshot transacional: alterações concorrentes do catálogo podem ser incorporadas na próxima sincronização.

## Discovery, health e rebuild

- DISCOVERY sem connector ativo: `NEW_BRAND_CONNECTOR`, revisão obrigatória.
- HEALTH CHECK com ACTIVE: `CONNECTOR_HEALTHY` informativo, ou `CONNECTOR_DRIFT` com revisão. Incerteza, warnings, falta de checks ou mudança de fingerprint resultam conservadoramente em drift.
- REBUILD: drift, nova proposta, review e ativação explícita. Não há terceiro pipeline.

Se o health check não consegue propor nenhum domínio oficial, registra drift com evidências
e sem proposal ativável. A ausência de replacement não altera nem revoga o ACTIVE existente.

O provider pesquisa sinais de oficialidade e registra evidências separadas em `agent_evidence`. Domínio candidato não é trusted automaticamente. A verificação não usa scraper HTTP próprio; usa web research. A fixture Volkswagen e fixtures healthy/drift são sintéticas, sem afirmação de descoberta atual.

## Review e ativação

**Accept ≠ Activate.** Accept só insere review. `Ativar connector` é uma ação separada, server-side admin, que valida finding compatível, run COMPLETED, última review ACCEPT, target, escopo, proposta e fingerprint.

A RPC `activate_brand_connector` usa SECURITY INVOKER e acesso exclusivo de service_role. A validação detalhada e o hash são responsabilidade do adapter privilegiado; a RPC compara a proposta imutável e fingerprint armazenados, revalida review e escopo, bloqueia o target e cria a versão atomicamente. Um advisory lock por finding, também adquirido por trigger BEFORE INSERT em reviews, serializa ativação com novas decisões sem conceder UPDATE em reviews. Não há chamadas externas durante a transação.

Mesmo fingerprint ativo retorna a versão existente. Conteúdo novo de drift aceito cria N+1, tornando N SUPERSEDED. O índice parcial permite só um ACTIVE. Propostas antigas não sobrescrevem uma configuração mais recente. Supersession é interna à ativação; não há método público separado que possa deixar o target sem ACTIVE.

As duas tabelas têm RLS, nenhuma policy de browser e grants mínimos ao service_role. A função confia na autorização admin do servidor; nunca deve ser chamada com credenciais privilegiadas no browser. Activated_by vem do perfil autenticado, não do formulário.

## Definição e URLs

Validação limita tamanhos e tipos, aceita somente hostnames DNS públicos e URLs HTTP/HTTPS sem credenciais, portas não padrão ou parâmetros de credenciais. IPs literais, localhost, domínios internos, esquemas não HTTP e sufixos maliciosos são recusados. Subdomínios usam igualdade ou `endsWith('.' + domain)`. Não há fetch arbitrário de URLs do operador. Como não há resolução DNS/fetch direto, DNS rebinding não é verificado; qualquer futuro cliente HTTP deve validar DNS e cada redirect antes do acesso.

O SHA-256 usa definição normalizada, brand key e arrays deduplicados/ordenados. Não inclui timestamps, run, confidence ou review. Tipos de fonte: MODEL_INDEX, MODEL_PAGE, CONFIGURATOR, TECHNICAL_SHEET, PRICE_LIST, MEDIA_CENTER, OTHER_OFFICIAL. A cobertura não exige todos os tipos. Terminologia é apenas vocabulário de navegação, sem conversões técnicas.

## Bootstrap e MMV

A migration `20260914172157_sprint_19c_brand_connectors.sql` inclui targets Toyota/Jeep e v1 com exatamente os domínios e hints dos registries 19A. Não inventa source entries ou termos. O bloco de dados é idempotente e não substitui histórico existente. Testes comparam o JSON SQL com a exportação dos built-ins e seus fingerprints.

O runtime MMV prefere ACTIVE persistido e usa fallback explícito built-in quando ausente. Falha de persistência não é tratada como ausência. Definições iguais ao bootstrap mantêm exatamente a política de hostnames 19A, inclusive a restrição de subdomínios Toyota. Connectors novos usam a semântica declarada de domínio/subdomínio. Não há alteração no matcher nem branching de marca nele.

`parseAgentArguments` aceita marca textual, independente do registry. `BrandConnectorResolver` decide a disponibilidade. Ausência de connector resulta em `BRAND_CONNECTOR_REQUIRED`. O provider MMV recebe a fonte resolvida, com entry points e hints. O MMV ainda opera em BR; o registro operacional suporta mercados separados.

## Operação local

```sh
pnpm agent:brand-connector:dry-run -- --brand Volkswagen --market BR --mode discover --provider fixture
pnpm agent:brand-connector:dry-run -- --brand Jeep --market BR --mode health-check --provider fixture
pnpm agent:brand-connector:dry-run -- --brand Volkswagen --market BR --mode health-check --provider fixture --fixture-state drift
```

Sem `--persist-findings`: somente `.local-reports/agents/brand-connector/<UUID>.json` e `.md`, zero DB writes. O modo fixture não precisa de banco. Com opt-in, apenas Agent Platform recebe dados; não cria targets nem ativa propostas. O UUID da run é preservado e replay usa idempotência da plataforma.

O provider OpenAI exige configuração explícita `OPENAI_API_KEY`, `OPENAI_AGENT_MODEL`, `SUPABASE_URL` e `SUPABASE_SERVER_KEY`; não há modelo default. O banco é consultado para resolver o modo/connector. Não executar pesquisa real sem autorização manual. **Zero chamadas OpenAI e zero writes Supabase remotos durante implementação e testes.**

Desde a 19C.2, os dois CLIs carregam `<repo-root>/apps/web/.env.local` antes de validar essa
configuração. `COMPRA_CAR_AGENT_ENV_FILE` escolhe outro arquivo; caminhos relativos são
resolvidos na raiz. Valores já definidos no ambiente, inclusive vazios, têm prioridade.
O loader usa a sintaxe nativa Node, não expande referências entre variáveis, não modifica
`process.env` e não escreve no arquivo nem no hard link. Arquivos opcionais indisponíveis
não impedem fixtures; configuração real ausente gera código seguro antes de qualquer cliente.

Admin: `/admin/agents/brands`, criação manual, sincronização, pausa/enable, ACTIVE/version, última run e detalhe/histórico. Findings de connector apresentam domínios, fontes, hints, avisos e evidências estruturados. O redesenho geral de UX fica para Sprint 24.

## Futuro e limites

Capability de health check periódico disponível programaticamente; scheduling somente na Sprint 23. Essa sprint chamará `syncCatalogBrands()`, depois `listMissingConnectorTargets()` e `discoverMissingConnectors()`, respeitando `enabled`. A operação que lista candidatos já existe; a orquestração/batch OpenAI não foi implementada.

Não há cron, worker, loop autônomo, Sprint 20, 21, 22 ou redesign completo 24. O monitoramento pausado não revoga a configuração ativa usada pelo MMV.

Validação local de banco: aplicar 19B e 19C em PostgreSQL descartável e executar `supabase/tests/brand_connector_19c_local.sql`, que usa role service_role e rollback. Não aplicar este roteiro em produção/staging como parte da validação local.

Referências consultadas: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [OpenAI web search](https://developers.openai.com/api/docs/guides/tools-web-search), [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).
