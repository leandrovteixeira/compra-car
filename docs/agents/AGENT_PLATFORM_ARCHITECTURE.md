# Agent Platform Architecture — referência canônica

## Fechamento final — Sprint 20 / 20.1 / 20.2 / 20.2.1

**SPRINT 20 — MODEL YEAR AGENT: COMPLETE / REAL STRUCTURED END-TO-END VALIDATED.**

[Estado final, smoke real, validações e exclusões](SPRINT_20_CHECKPOINT.md). Smoke real COMPLETED, run `97ebfdad-4882-45fd-ae78-638cfa440ba7`, conforme evidência fornecida pelo operador: oito MMVs com MY, oito MODEL_YEAR_MATCHED, quatro NEW_MODEL_YEAR e zero OpenAI. Seções locais/sem commit abaixo são históricas; Spec Source (21) é a etapa atual.

## Roadmap atual

| Sprint | Componente | Estado |
| --- | --- | --- |
| 19A | MMV Discovery | ✅ |
| 19B | Agent Platform | ✅ |
| 19C | Brand Connector | ✅ |
| 20 | Model Year Agent | ✅ COMPLETE / REAL STRUCTURED END-TO-END VALIDATED |
| 21 | Spec Source | ← CURRENT |
| 22 | Spec Reconciliation | Futuro |
| 23 | Price Intelligence | Futuro |
| 24 | FIPE Search Agent | Futuro; não implementado |
| 25 | Orchestration / Scheduler | Futuro |
| 26 | Agent Operator UX | Futuro |

## Identidade e catálogo

MMV = Brand + Model + Version. O catálogo físico atual conserva ocorrências
MMV + Production Year + Model Year. CatalogMmvIdentity é uma projeção virtual,
agrupada por labels canônicos normalizados; anos, Active/Public e número de linhas
não determinam identidade. Labels diferentes não se fundem por similaridade.
Não são criadas tabelas de MMV, versões canônicas ou aliases nesta fase.

Official naming is authoritative. Legacy Compra-Car naming is transitional.
A pesquisa preserva o nome oficial, enquanto a reconciliação preserva a identidade
do catálogo. Não há renomeação automática. O nome histórico do CLI New Product Check
corresponde a MMV Discovery. [Contrato MMV](NEW_PRODUCT_CHECK_AGENT.md).

## Agentes especializados

| Tipo | Pergunta / responsabilidade | Findings | Fronteira |
| --- | --- | --- | --- |
| BRAND_CONNECTOR | Onde e como pesquisar fontes oficiais da marca/mercado? | NEW_BRAND_CONNECTOR, CONNECTOR_HEALTHY, CONNECTOR_DRIFT | Não altera catálogo |
| MMV_DISCOVERY | Quais marcas, modelos e versões existem oficialmente e no catálogo? | MMV_MATCHED, NEW_MODEL, NEW_VERSION, AMBIGUOUS_MMV | Não decide anos |
| MODEL_YEAR | For this resolved MMV, which official Model Years are observable? | MODEL_YEAR_MATCHED, NEW_MODEL_YEAR | Sem Production Year ou materialização |
| Spec Source (21, local) | O que o fabricante afirmou para MMV + MY? | SpecObservation, sem findings persistidos | Sem Spec Master |
| Spec Reconciliation (22, futura) | O que a observação significa no modelo canônico? | Reconciliação futura | Fora da Sprint 21 |
| PRICE_INTELLIGENCE | Qual preço público é suportado por fonte e referência temporal? | NEW_PRICE, PRICE_CHANGE | Não publica nem altera preço automaticamente |

FIPE Search Agent está reservado à Sprint 24. Ainda não há contrato operacional
implementado ou tipo central de FIPE Search nesta Sprint; códigos FIPE são apenas candidatos observados pelo Model Year Agent.

### Brand Connector — 19C

Targets de marca/mercado e configurações versionadas ACTIVE/SUPERSEDED. Propostas
ficam em findings até review e ativação explícita; Accept nunca ativa sozinho.
Ativação usa transação, bloqueio por target, advisory lock por finding compartilhado
com INSERT de reviews, revalidação da última review e índice de ACTIVE único.
Reviews são append-only. Sync explícito não modifica produtos, specs ou preços.

OperationalBrandConnectorResolver obtém ACTIVE por port; compatibilidade MMV mantém
fallback controlado Toyota/Jeep. O Model Year CLI real exige ACTIVE. Domínios, hosts,
subdomínios autorizados, fontes e hints são declarativos; marcas novas não adicionam
branches ao matcher. Termos comerciais não autorizam equivalências técnicas implícitas.
[Brand Connector 19C](BRAND_CONNECTOR_AGENT_19C.md).

### MMV Discovery — 19A

Discovery de modelos, resolução de variantes, validação de evidências, projeção do
catálogo e matching determinístico. Restrições estruturais incluem trim, propulsão,
cilindrada na precisão comum, transmissão e tração. Nomes comerciais são preservados;
ausência de dados não prova equivalência. NEW_MODEL é agregado por modelo;
NEW_VERSION é por variante. Ambiguidade é sobre identidades, não sobre product rows.
PY/MY históricos podem aparecer no report MMV, mas não classificam nem desempatam MMV.
POSSIBLE_YEAR_CHANGE é compatibilidade histórica e não é emitido.

### Model Year Agent — Sprint 20

Recebe catálogo atual, MMV_MATCHED da última run MMV_DISCOVERY COMPLETED da marca/BR
e connector ACTIVE. Só pesquisa identidade ainda existente e única no catálogo,
sem última decisão REJECT/DEFER. NEW_MODEL/NEW_VERSION, mesmo ACCEPTed, e
AMBIGUOUS_MMV não liberam pesquisa automaticamente. Skips são métricas.

MY é a dimensão canônica de pesquisa. Production Year permanece dado legado fora
do contrato, schema, busca, comparação e decisão. knownModelYears é distinct MY.
ano/modelo 2026/2027 contribui apenas MY 2027. Um ano isolado sem marcador explícito
não é interpretado como par. URL, data, copyright e lançamento não provam MY.

Na Sprint 20.2, a coleta estruturada agrupa MMVs por marca/modelo. O adapter Webmotors resolve páginas compartilhadas por ano; o core vincula versões deterministicamente. Tiers: STRUCTURED_AUTOMOTIVE_DATA, MANUFACTURER_OFFICIAL e AUTHORIZED_DEALER. Fallback oficial só atende alvos não resolvidos; concessionárias exigem opt-in e prova oficial de autorização. Pesquisa ampla de publicações foi removida por custo e baixa cobertura. Rejeições e limites de orçamento permanecem auditáveis sem virar findings.

FIPE code candidates são evidência em JSON, associados à identidade MMV/MY. Futuro fluxo: MMV ↔ FIPE code mapping com proveniência/histórico → MY → mês de referência → valor FIPE. Não pertencem inerentemente a uma linha de produto/PY. A Sprint 24 será responsável por canonicalização e histórico mensal; nenhuma tabela/escrita foi adicionada na 20.2. Detalhes e limites: [Sprint 20.2](SPRINT_20_2_STRUCTURED_MY_FIPE_BRIDGE.md).

Reconciliação apenas positiva: MODEL_YEAR_MATCHED é informativo, proposal=null;
NEW_MODEL_YEAR exige review e propõe somente mmvIdentity + modelYear. Múltiplos MYs
são independentes, deduplicados por MMV + MY. Ausência de evidência explícita gera
métricas, sem finding/review item. Ausência de MY histórico não é conclusão negativa.
Accept confirma a observação, sem materializar produto ou preencher Production Year.
[Model Year Agent 20](MODEL_YEAR_AGENT_20.md).

### Spec Source — Sprint 21

Extrai fatos atômicos com evidência e applicability por MMV + MY. Não acessa Spec Master.
[Contratos, adaptadores e limites](SPEC_SOURCE_AGENT_21.md).

### Spec Reconciliation — Sprint 22, futura

Interpretará as observações no modelo canônico, com revisão e materialização separadas.
Não implementada neste slice.

### Price Intelligence — futuro

Prioriza montadora, configurador, lista oficial e fonte estruturada explicitamente
aprovada. Proposta preserva produto/MMV, valor/moeda, referência temporal, fonte,
confidence e capturedAt. Captura não substitui data de referência; fontes oficiais
e externas não se misturam silenciosamente. Não sobrescreve histórico ou preço canônico.

## Plataforma compartilhada e review

Agent → Finding → Evidence → Review. Ação canônica, quando existir, será separada,
concreta e revalidada contra catálogo atual. Nenhum agente aprova a própria alteração.

agent_runs guarda execução, escopo, estado, configuração e métricas; agent_findings
guarda sujeito, proposta, payload e fingerprint; agent_evidence preserva proveniência;
agent_reviews registra decisões humanas append-only. COMPLETED congela observações
na aplicação. Persistência usa opt-in --persist-findings e mantém UUID do report.
Replay equivalente é idempotente; conteúdo divergente é conflito. Accept não executa
proposal nem altera catálogo. [Plataforma 19B](AGENT_PLATFORM_19B.md).

A migration 20 amplia somente CHECK de agent_type. PRODUCT_YEAR continua aceito no
banco para histórico; código novo emite MODEL_YEAR. finding_type já aceita texto não
vazio. RLS, grants e isolamento service-role permanecem; browser não ganha policies.
Não se presume ausência de registros legados sem consulta autorizada.

## Fronteiras e limitações

Core contém contratos, projeções e regras determinísticas. adapter-openai pesquisa;
adapter-supabase isola acesso a dados; scripts/agents faz composição operacional.
UI consome contratos, sem nomes de tabelas legadas. Capabilities de leitura e
persistRunBundle não autorizam operações canônicas. Parser e matcher MMV são preservados.

Leituras de catálogo/reviews não são snapshot transacional. Persistência de bundle
pressupõe um writer por run; futura orquestração precisará transação/lease para
concorrência. Identidades e fingerprints dependem de normalização versionada.
Evidência textual não substitui validação independente de conteúdo de páginas.

## Orquestração e evolução — futuras

Dependência conceitual: Brand Connector ACTIVE → MMV resolvida → observação MY →
Specs → Preços. Cada etapa pode exigir review e bloquear downstream; aceitar uma
etapa não autoriza alterações canônicas posteriores. Scheduler, retries entre agentes,
leases, idempotência distribuída e UX completa pertencem ao roadmap futuro.

Production Year pode tornar-se obsoleto no modelo canônico. Direção a avaliar:
MMV → MY → revisão de configuração válida a partir de data X, permitindo mudanças
de specs dentro do mesmo MY. Nenhum schema dessa direção é criado na Sprint 20.

## Roadmap de agentes

19A MMV Discovery ✅ → 19B Agent Platform ✅ → 19C Brand Connector ✅ → 20 Model Year Agent ✅ → **21 Spec Source ← CURRENT** → 22 Spec Reconciliation → 23 Price Intelligence → 24 FIPE Search Agent → 25 Orchestration / Scheduler → 26 Agent Operator UX. Model Year pode produzir candidatos de código FIPE; FIPE Search Agent possui a canonicalização de identidade e valor.


## Spec Source — decisão Sprint 21.5

Discovery → política central (OWNER MANUAL excluído) → router → Terra Document Intelligence → validação determinística → Sol opcional (máximo1, capUSD1/documento) → inventário → aplicabilidade → SpecObservations. Sem persistência Agent Platform/Supabase neste slice. Spec Master apenas na Sprint22. Fonte vigente: SPEC_SOURCE_AGENT_21.md.
