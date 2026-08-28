# Contexto para agentes de IA

## Pricing UX Fix — Sprint 14E.1 (2026-08-28)

O ledger de `/admin/prices` não usa mais `admin-table-header`, cujo offset pertence ao scroll do
documento. Ele replica a arquitetura do catálogo: `admin-pricing-workspace` limita o viewport,
`admin-pricing-table-scroll` é o único scrollport bidirecional e `admin-pricing-table-header th` fica
sticky em `top: 0`. Paginação permanece fora do trilho rolável. Não reintroduza offsets locais.

O header da Entrada de preços permanece em fluxo normal. A causa do overlap era aplicar a classe
sticky global a uma `div` sem viewport vertical próprio. Se futuramente 100 linhas exigirem scroll
local, crie primeiro um scrollport limitado e só então use sticky em `top: 0` relativo a ele.

Em Criar políticas, a seleção de Modelo/versão, Competência e Preço válido é uma única section com
dividers e três colunas responsivas, sem card dentro de card. Campos usam `ui-field`, o CTA de preço
usa `interactive`, e o empty state é divider-led e compacto. Toda lógica comercial foi preservada.

## Remaining Screens UX — Sprint 14E (2026-08-28)

O audit classificou Veículos, Specs, seleção do vendedor e Comparação como referência A. Usuários e
Auth estavam B; Preços públicos, entrada de Preços, criação/workspace de Políticas e Importações
estavam C por geometria antiga, cards grandes e utilities Slate/Sky locais. Dashboard ficou intacto
por exclusão explícita do escopo. A Sprint 14E alterou apenas apresentação: domínio, contratos,
Supabase, banco, autorização, lifecycle, cálculos, formatters, PDF e `Legacy` não foram tocados.

Primitives recorrentes: `ui-form-grid`, `ui-form-section`, `ui-table-frame` e `ui-badge--info`.
Blue `#9ABCC8` comunica interação/identidade; graphite `#1A1D21` comunica estrutura; orange `#EF7732`
continua atenção rara, nunca CTA genérico. As telas migradas devem preferir tokens semânticos e
controles desktop de 30–36px; `@media (pointer: coarse)` preserva 44px. Aliases Slate/Sky/Cyan ainda
existem para migração incremental de superfícies fora da rodada e não devem ser removidos globalmente.

## Regression fix de Vantagens — Sprint 14D.3b (2026-08-27)

**Vantagens = vantagens objetivas do veículo principal/referência.** O primeiro veículo continua sendo
a referência. O filtro deve usar exclusivamente `row.hasReferenceAdvantage`, calculado pelo engine do
core; não inclua rows cuja vantagem pertença somente a concorrentes e não recrie comparações na web.
Com 3 ou 4 veículos, a row permanece se a referência vencer objetivamente ao menos um concorrente,
que é a semântica histórica de `hasReferenceAdvantage`. Em Vantagens, somente a célula da referência
recebe o check laranja. Completa preserva os markers históricos e Diferenças permanece sem julgamento
ou marker.

A regressão da 14D.3 foi causada por `hasAnyAdvantage`: o campo ampliou o filtro de
`hasReferenceAdvantage` para qualquer `ComparisonOutcome === 'disadvantage'`, fazendo vitórias
exclusivas de concorrentes aparecerem. O campo foi removido da view model interna. A topbar móvel usa
quatro colunas explícitas, marca `CC`, contexto não encolhível e “Mais” iconizado abaixo de 28rem; isso
preserva navegação em 320–400px sem sobreposição. Controles da comparação usam 30px no desktop e o
media query coarse mantém 44px; a toolbar usa `px-2`/`sm:px-3`.

## Modos e formatting da comparação — Sprint 14D.3 (2026-08-27)

`/comparar` usa `mode=differences|advantages`; a ausência de `mode` é Completa. `highlights=true`
continua aceito como alias legado de Vantagens. A view model interna da aplicação acrescenta
`hasDifference` sem alterar `@compra-car/contracts`: diferenças são calculadas no
mapper com os valores brutos (número + unidade normalizada ou presença), antes da string pt-BR.
`false` e `null` de presença continuam semanticamente ausentes, coerentes com a apresentação e o
engine atuais. Categorias sem rows no modo filtrado são omitidas.

Vantagens não recalcula superioridade: `hasReferenceAdvantage` e os `ComparisonOutcome` produzidos pelo
core são a única fonte dos markers. Completa preserva esses markers; Diferenças os oculta para não
misturar julgamento com divergência; Vantagens mostra somente rows com vantagem da referência e marca
somente a célula dela.
`#9ABCC8` identifica o modo ativo e `#EF7732` aparece apenas no pequeno check acessível.

`comparison-number-formatter.ts` concentra número e composição com unidade em funções separadas. Regras
por code: inteiros `PW_0005` (já armazenado em `cc`) e `PW_0015`; duas casas `CO_0017` e `CO_0019`; uma
casa `OW_0002`–`OW_0005`, `PW_0012`, `PW_0023`, `PW_0026`, `PW_0033`, `PW_0035` e `PW_0036`. O
arredondamento é o padrão de `Intl.NumberFormat('pt-BR')`. O PDF continua visualmente inalterado e seu
modo histórico de highlights permanece focado nas vantagens da referência; o formatter central já é
reutilizável pelo mapper que fornece dados à UI e ao PDF.

## Seller Search UX — Sprint 14D.2 (2026-08-27)

A home do vendedor carrega o catálogo público/elegível uma vez por `getCatalogVehicles`, protegido por
`requireRole('seller')` e pelo cache `getCachedCatalogVehicles`; a cadeia use case → repository →
adapter permanece intacta. A busca é local e imediata sobre esse DTO, não consulta Supabase pelo
browser e não mostra resultados quando vazia. `vehicle-search.ts` é o matcher único de tokens para
marca/modelo/versão usado também pelo admin, com normalização de diacríticos, caixa e whitespace.

Clique/toque no resultado adiciona diretamente, exclui o escolhido das opções, limpa a query e devolve
foco ao input. `VehicleSelectionState` mantém somente a lista ordenada. O primeiro é Principal;
remoção preserva ordem e promove implicitamente o próximo. A UX consolida máximo de quatro veículos e
mínimo de dois para comparar, enviando IDs na ordem para `/comparar`. O limite de quatro foi recuperado
da evolução que explicitamente passou a aceitar o quarto; ele continua localizado na seleção, sem
alterar core ou engine de comparação.

Paleta: **Blue = Interaction / Identity**, **Graphite = Structure**, **Orange = Attention**. A variante
opt-in `ui-button--interactive` usa `--color-action-interactive: #9ABCC8`, texto grafite e hover derivado
da família azul. O primary global grafite não mudou. Mobile usa fonte de 16px na busca, targets de 44px,
resultados com scroll vertical limitado e nenhuma dependência de hover ou overflow horizontal.

## Sticky estrutural e alinhamento — Sprint 14D.1c (2026-08-27)

No desktop, `/admin/products` é um workspace abaixo da topbar com três trilhos naturais: page header,
toolbar e resultados `minmax(0, 1fr)`. O documento não é o scroll vertical do catálogo: o mesmo
`admin-catalog-table-scroll` executa os scrolls vertical e horizontal, e cada `th` semântico fica sticky
em `top: 0` dentro dele. Não reintroduza tokens de altura do header/toolbar, somas de offsets ou um
wrapper horizontal diferente do scrollport vertical. No mobile, a página volta ao fluxo vertical e a
tabela preserva overflow horizontal local.

Specs mantém category headers de 32–34px e usa `admin-specs-field-grid`: label até 28rem, value até
22rem, conjunto limitado a 52rem. Numeric, scale/select e tri-state começam no mesmo eixo esquerdo;
numeric reserva 4rem para unidade. Abaixo de 64rem, label/meta e controle refluem em linhas. A toolbar
usa `px-3`, alinhado ao conteúdo e aos category headers.

## Sticky layout e specs — Sprint 14D.1 (2026-08-27)

O stack desktop é topbar → page header → toolbar opcional → table header. Offsets pertencem aos tokens
e classes globais; não introduza valores independentes nas páginas. O catálogo usa
`admin-catalog-sticky`/`admin-catalog-table-header`, e specs usa `admin-page-header` seguido de
`admin-specs-toolbar`. Primary action comum é graphite `#1A1D21`; azul é informação/seleção e laranja
continua attention-only. Specs simples miram 44–48px, categorias 40px e controles ficam alinhados numa
coluna direita de 18rem, preservando 44px em coarse pointers.

## Catálogo pesquisável — Sprint 14C (2026-08-27)

`/admin/products` mantém filtros na URL, mas usa um único `search` com debounce de 275ms para marca,
modelo e versão. Ativo/Público atualizam imediatamente e Limpar remove todos os parâmetros. O reader
continua recebendo somente filtros booleanos; a busca tokenizada ocorre na aplicação, sem full-text ou
mudança no adaptador. Pares de ano são sempre exibidos como **produção/modelo**, sem alterar campos ou
validação. `#9ABCC8` segue como azul oficial; `#315E6D` e `#244B58` são derivados semânticos escuros para
contraste de ação, e `#466F7D` foi removido.

## Application shell — Sprint 14B (2026-08-27)

O shell autenticado concentra `BrandSlot`, `ContextSwitcher` e `UserMenu` em uma topbar compartilhada
de 52px. A role confiável do profile controla os contextos: seller vê apenas Vendedor; admin vê
Administração e Vendedor. A sidebar administrativa é exclusivamente local, usa `usePathname` para o
estado ativo e não possui scroll próprio no desktop. No mobile, a navegação local usa disclosure.
Canvas, surface elevada e seleção possuem tokens semânticos; azul claro apoia seleção/foco e laranja
continua proibido para ação ou navegação.

## Design system light-first — Sprint 14A.1 (2026-08-27)

A UI usa tokens centralizados em `apps/web/src/app/globals.css` e primitives de classe em
`@compra-car/ui`. Inter é a fonte temporária; Söhne deverá substituir somente o token global. A regra
visual é **Orange = Attention, not Action**: `#EF7732` fica reservado à vantagem de comparação e futura
prioridade excepcional, enquanto ações usam interactive azul/grafite. Controles desktop têm 36px,
touch mantém 44px, rows densas têm 48px e surfaces comuns usam 16px. A compatibilidade das utilities
Slate/Sky/Cyan antigas é intencional e permite migração incremental de grids especializados.

## Invite scanner-safe — Sprint 13 QA/Auth (2026-08-27)

Invite usa o mesmo desenho em duas etapas do recovery, mas com estado e semântica próprios. O GET de
`/auth/callback/invite` apenas valida a forma do `TokenHash`, grava `cc-invite-attempt` em cookie
HttpOnly curto e segue para `/auth/invite/confirm`. Somente **Aceitar convite** executa
`verifyOtp(type='invite')`, cria `cc-auth-flow=invite` e abre `/auth/invite`. Scanner GET, confirmação e
verificação do OTP preservam `pending`; apenas a definição bem-sucedida da senha ativa o profile.
Email OTP Expiration continua valendo independentemente. Validação hospedada com convite aprovado e
e-mail corporativo permanece PENDENTE.

## Recovery SSR e tracking — Sprint 13 QA/Auth (2026-08-25)

Recovery usa template Supabase com `RedirectTo + TokenHash + type=recovery`. O callback SSR faz um GET
não consumidor que guarda o hash em cookie HttpOnly curto e redireciona para
`/auth/recovery/confirm`; somente a confirmação explícita via POST chama `verifyOtp` e cria o cookie
`cc-auth-flow=recovery`. A solicitação pública fica em `/forgot-password`, usa
resposta neutra e consulta usuários apenas no servidor privilegiado. O tracking separado é
`profiles.password_recovery_requested_at`: definido após envio bem-sucedido e limpo somente após a
senha ser atualizada. Recovery nunca altera `profiles.status`; active/disabled/pending são preservados.
Rate limits conhecidos do Supabase são explícitos apenas para admins e permanecem neutros no fluxo
público. A validação real no ambiente corporativo com Safe Links continua PENDENTE.

## Ambiente online de testes — Sprint 13 (2026-08-24)

Railway permanece o único alvo: raiz do monorepo, Railpack, build filtrado para
`@compra-car/web...` e start apenas da aplicação web. Runtime Node 22/pnpm 10.34.5; o beta é
`staging`, separado de produção. `GET /api/health` é o probe barato e fica fora do middleware para não
depender de Auth/Supabase. Runbook e checklist: `docs/operations/HOSTED_BETA.md`.

PENDENTE: deploy real, hostname HTTPS, Site URL/allowlist do Supabase, migrations remotas, pgTAP 024 e
smokes com contas/e-mails reais. Não declarar Sprint 13 concluída antes dessas validações externas.

## Ciclo de senha e onboarding — Sprint 12C (2026-08-24)

Redirects Supabase devem apontar exatamente para `/auth/callback/invite` e `/auth/callback/recovery` e estar na Auth redirect allowlist em localhost e no futuro host da Sprint 13. Os callbacks trocam o code PKCE pelo cliente SSR mutável, gravam marcador HttpOnly de fluxo por 15 minutos e seguem para páginas distintas.

Senha é atualizada apenas via `auth.updateUser()` na sessão do próprio usuário. Invite ativa condicionalmente `pending → active` depois da senha; active é idempotente e disabled nunca reativa. Recovery preserva qualquer status. Nenhuma migration 12C foi necessária. E-mail/link real e o pgTAP 024 da 12B permanecem pendentes enquanto Docker/ambiente Auth local estiver indisponível.

## Pedidos de convite — Sprint 12B (2026-08-24)

`user_invite_requests` separa workflow de indicação do status de acesso. Auth user só nasce após aprovação administrativa, que reutiliza `inviteAdminUser` com role `seller`; depois o pedido transiciona condicionalmente de pending para approved. Rejeição preserva histórico. RLS permite authenticated inserir/ler apenas os próprios pedidos; revisão usa service role server-only. Solicitante e revisor são derivados das sessões, nunca do browser. Sprint 12C permanece pendente.

## Ações administrativas de usuários — Sprint 12A.3 (2026-08-24)

As mutações de `/admin/users` seguem UI client pequena → Server Action → operação de aplicação com
`requireRole('admin')` → `AdminUserSupabaseAdapter` → cliente privilegiado server-only. O browser envia
somente intenção/IDs; ator, alvo, e-mail, profile e contagem de admins são carregados no servidor.

Convites usam o trigger `handle_new_auth_user` (`seller/pending`) e depois ajustam nome, role e
`invited_by`; falha posterior do profile é reportada como parcial e não apaga o Auth user. Status
pending não é ativado pela ação genérica. Auto-desativação/auto-rebaixamento e remoção do último admin
ativo são bloqueados. Redirects exigem `AUTH_INVITE_REDIRECT_URL` e `AUTH_RECOVERY_REDIRECT_URL`; a UX
final de aceite/atualização de senha permanece dependência da Sprint 12C. Nenhuma migration foi criada.

## UX administrativa de usuários — Sprint 12A.2 (2026-08-24)

`/admin/users` é uma Server Component somente leitura que consome `loadAdminUsers()`. A página ordena
por criação mais recente e apresenta tabela semântica a partir de `md`, cartões no mobile e estados
de loading, vazio e erro controlado. Labels de role/status, datas em `America/Sao_Paulo` e avisos de
profile ficam nos helpers/componentes de apresentação, nunca no adapter.

Profiles `missing` e `invalid` aparecem como inconsistências e não recebem role/status substitutos.
“Novo usuário” permanece desabilitado até a Sprint 12A.3. Não há Client Component privilegiada,
mutação de usuário, mudança de Auth, migration, RLS ou grants nesta entrega.

## Fundação administrativa de usuários — Sprint 12A.1 (2026-08-24)

`AdminUserDto` é o read model da futura administração: Auth mantém email, criação e último login;
`public.profiles` mantém nome, role e status. `profileState` distingue `valid`, `missing` e `invalid`;
nos dois estados inconsistentes role/status são nulos e nunca recebem fallback permissivo.

`AdminUserSupabaseAdapter` pagina `auth.admin.listUsers()` em lotes de 200 e busca os profiles do
lote em uma única consulta, sem view sobre `auth.users` e sem N+1. O cliente privilegiado é criado
somente por `apps/web/src/auth/admin-client.ts`, marcado `server-only`, com as variáveis privadas já
existentes `SUPABASE_URL` e `SUPABASE_SERVER_KEY`. A operação `loadAdminUsers` exige
`requireRole('admin')` antes de instanciar o adapter. Não adicionar email/timestamps a profiles,
ampliar RLS ou usar `user_metadata` como fonte de autorização.

Nenhuma migration foi necessária: schema, grants e policies de profiles já suportam a composição
confiável server-side. Sprint 12A.2 implementará a UX `/admin/users`; convites e recuperação continuam
fora desta fundação.

## Download e compartilhamento nativo — Sprint 11C (2026-08-24)

A toolbar de `/comparar` oferece ações independentes `Baixar PDF` e `Compartilhar`, ambas sobre a
mesma URL de `/comparar/pdf` produzida por `buildComparisonPdfUrl`. O download usa anchor same-origin
com `download="comparacao-veiculos.pdf"`; não criar Blob para esse caminho.

O compartilhamento fica isolado em `comparison-pdf-share.ts`: busca o PDF, cria `File` com MIME
`application/pdf`, exige `navigator.share` e `navigator.canShare({ files })` e abre o share sheet do
sistema. Ausência de suporte ou falha técnica aciona download; `AbortError` retorna cancelamento sem
fallback. O componente mantém `isSharing`, desabilita o botão e mostra `Preparando...` durante todo o
fluxo. Não substituir por WhatsApp URL, menu próprio, link público, Storage ou sharing server-side.

## Otimização mobile do PDF de comparação — Sprint 11B.3 (2026-08-24)

O único formato de `/comparar/pdf` agora é uma página vertical customizada de 480 × 853 pt, voltada
à leitura digital em smartphones. A área útil tem 460 pt: item com 220 pt e veículos com 120 pt em
comparações de dois ou 80 pt em comparações de três. Não reintroduzir A4 nem seletor de formato sem
nova decisão de produto.

Labels usam até duas linhas e fonte 8,5/8/7,5 pt conforme o comprimento; rows mantêm mínimo de 28 pt
e crescem conforme o wrap. `equipmentGroup` continua fora do PDF por ser redundante com as faixas de
categoria. Valores, filtro e vantagens permanecem derivados dos helpers compartilhados.

O header usa dois blocos `fixed` absolutos sobre `paddingTop: 108`, com nomes em até duas linhas. Não
adicionar `borderRadius`/clipping ao bloco fixo: no React-PDF 4.6.1 esse recorte vazou entre páginas
em stress multipágina. Categorias e rows fluem como siblings, sem wrappers que atravessem páginas;
rows seguem `wrap=false` e categorias usam `minPresenceAhead: 34`.

## Tabela completa do PDF de comparação — Sprint 11B.2 (2026-08-23)

O PDF de `/comparar/pdf` agora renderiza a ficha técnica completa. O model PDF recebe somente as
categorias previamente filtradas e transforma cada valor com os mesmos helpers puros da web. A
geometria mantém tabela de 540 pt: item com 300 pt e o restante dividido entre os veículos, dando
120 pt para dois ou 80 pt para três.

O header React-PDF é `fixed` e ocupa a faixa reservada pelo `paddingTop` de todas as páginas. Rows
usam `wrap=false`; faixas de categoria usam `minPresenceAhead` equivalente à altura mínima de uma
row. Labels do item têm `maxLines: 1` e fonte 9/8/7/6.25 conforme o comprimento. Casos extremos de
tipografia ainda podem exigir medição real de glyphs em uma etapa futura; não criar engine complexa
nem mover comparação para os componentes PDF.

## Foundation do PDF de comparação — Sprint 11B.1 (2026-08-23)

A comparação possui agora a rota server-side `/comparar/pdf`, executada em runtime Node e baseada em
`@react-pdf/renderer` 4.6.1. A rota recebe `vehicles` e `highlights`, reutiliza
`loadComparisonPage`, aplica `filterComparisonCategories` antes de montar o view model e retorna um
PDF A4 portrait com tema escuro, sem storage, snapshot ou persistência.

Esta etapa prova apenas a integração e apresenta título, modo, veículos e contagens filtradas. A
tabela completa, paginação final, header repetido e ajuste fino de fontes permanecem pendentes para
uma etapa posterior. A toolbar abre a rota diretamente em nova aba e usa o wording `Ver vantagens`;
não criar Blob no client nem duplicar a regra de comparação ao evoluir o documento.

## Estado operacional prioritário — Sprint 10C PAUSED (2026-08-23)

Classificação: **PAUSED AFTER EXPERIMENTAL SEGMENTED PIPELINE VALIDATION**. Não retomar o pipeline
segmentado, executar novo smoke OpenAI ou reprocessar o benchmark sem decisão e autorização
explícitas. O runtime continua preservado por feature flag e o default funcional permanece
`one_shot`; o pipeline avançado não é blocker do MVP.

O benchmark real comprovou provider/Structured Outputs, Document Map, IDs server-owned, Unit Plan,
Unit Extraction segmentada e boundaries de transport/canonical, chegando a `unit-0001-table`. Não
chegou a todas as units succeeded nem às etapas reais de merge, reconciliation, Domain Mapping,
handoff, matching ou import segmentado E2E. O último blocker foi
`/coverage/status: incompleteDataMarkedComplete`; diagnostics opt-in agora podem revelar quais dos
sete predicados estáticos causaram a contradição sem expor valores, IDs ou conteúdo documental.

Para uma retomada futura, começar por Simple Extraction Baseline, resultado comercial mínimo e
medição de qualidade/custo/latência; depois revisar quais campos devem ser server-derived e
simplificar o intermediate contract. Não continuar automaticamente pelo próximo coverage retry. Os
checkpoints locais relevantes são `45b2964` e `ae9cd35`. O foco imediato volta ao MVP user-facing:
comparação utilizável, PDF, compartilhamento/link/WhatsApp, usuários e convites, histórico e polish
mobile.

## Correção local — source block excerpt da Unit Extraction (2026-08-23)

Classificação: **READY FOR UNIT EXTRACTION RETRY AFTER EXCERPT BOUNDING FIX**. O retry real mais
recente alcançou `unit-0003-table`, cuja única violação foi `/blocks/2/excerpt: maxLength` na
canonical validation; `unit-0005-section` foi sibling abort. Document Map e Unit Plan passaram.

O contrato canônico mantém `excerpt` required/non-nullable, `minLength: 1` e `maxLength: 1000`. A
projection de Structured Outputs remove limites de string, então um valor longo é aceito no wire e
reconstruído sem redução. Como `blocks[].excerpt` é snippet auxiliar de evidence e o artifact retém
document/page/region e referências separadas, o canonicalizer agora limita somente esse campo ao
prefixo literal de 1.000 Unicode code points antes da validação. Vazio continua inválido;
`evidence.excerpt`, facts, tables, cells e demais valores comerciais não são alterados. O prompt v8
também exige snippet literal curto e proíbe resumo, reticências, placeholder ou dump.

Nenhuma chamada OpenAI, retry, consulta/escrita em Staging, migration ou alteração de `Legacy` foi
executada.

## Correção local — coverage status da Unit Extraction (2026-08-23)

Classificação: **READY FOR UNIT EXTRACTION RETRY AFTER COVERAGE STATUS FIX**. O retry real mais
recente alcançou `unit-0005-table`, que falhou somente em
`/coverage/status: incompleteDataMarkedComplete`; `unit-0006-table` foi sibling abort. Document Map e
Unit Plan passaram. Sem raw output, permanece pendente qual predicado específico tornou COMPLETE
inválido.

A invariant bloqueia complete diante de unit não completa, gap, block incompleto, row/scope não
resolvido, mismatch opcional de vehicles ou mismatch de famílias. Counters são server-owned; status
das units, gaps, unresolved, expectativas e a distinção semântica partial/ambiguous continuam
provider-owned. Como alguns sinais validam ambos os estados, não há downgrade determinístico geral.
O canonicalizer não mudou e nunca promove status. O prompt v7 agora formaliza os três estados e
proíbe COMPLETE otimista ou ocultação de evidence.

Nenhuma chamada OpenAI, retry, consulta/escrita em Staging, migration ou alteração de `Legacy` foi
executada.

## Correção local — blank cells da Unit Extraction (2026-08-23)

Classificação: **READY FOR UNIT EXTRACTION RETRY AFTER BLANK CELL FIX**. O último retry real passou
por Document Map e Unit Plan; a unit 2 falhou na canonical validation com dois `minLength` em
`tables[0].rows[8].cells[*].text`, enquanto a unit 1 recebeu sibling abort.

`tableCell` possui somente `columnId` e `text`; ambos são required/non-nullable e `text` mantém
`minLength: 1`. Rows são sparse: o validator aceita subconjunto das columns e cada cell carrega seu
próprio `columnId`, portanto omitir blank não desloca outras cells. Não existem rowSpan, colSpan ou
estado merged/inherited/unknown. O prompt v6 agora manda omitir cells visualmente blank, preservar
column IDs, não inventar placeholder nem copiar “same as above” e usar coverage gap quando a ausência
for material. Schema, projection, canonicalizer e consumers downstream não mudaram.

Nenhuma chamada OpenAI, retry, consulta/escrita em Staging, migration ou alteração de `Legacy` foi
executada.

## Correção local — required collections do Document Map (2026-08-23)

Classificação: **READY FOR DOCUMENT MAP RETRY AFTER REQUIRED COLLECTION FIX**. O último retry real
retornou Structured Output, mas falhou na transport validation porque `documents[0].issuerHints` foi
omitido. `issuerHints` é required/non-nullable e pode legitimamente ser `[]`; a defesa local funcionou
e não houve reconstruction, canonicalization ou Unit Plan nessa tentativa.

O prompt v3 não mandava explicitamente emitir as quatro hint collections quando vazias. O prompt v4
agora exige todas as collections required, explicita `titleHints`, `issuerHints`, `competenceHints` e
`validityHints`, usa `[]` quando não há entrada suportada e proíbe omissão ou item inventado.
Provenance real continua obrigatória para todo hint presente. Não há preenchimento automático no
servidor; schema, projection, provider, validator e canonicalizer permanecem inalterados. Nenhuma
chamada OpenAI, retry, consulta/escrita em Staging, migration ou alteração de `Legacy` foi executada.

## Correção local — diagnóstico required do Document Map (2026-08-23)

Classificação: **READY FOR DOCUMENT MAP REQUIRED-FIELD DIAGNOSTIC RETRY**. O último retry recebeu o
Structured Output, mas o transport validator encontrou duas properties obrigatórias ausentes em
`documents[0]`; o diagnóstico anterior expunha somente dois eventos `required` indistinguíveis.

`CommercialDocumentMapViolationDiagnostic` agora admite `missingProperty`, preenchido apenas para
erros AJV `required` cujo nome pertença à allow-list derivada das propriedades estáticas do schema.
Params completos, nomes de additional properties, valores e mensagens continuam descartados. O
schema do provider e o compilado pelo validator permanecem o mesmo objeto; schema canônico,
projection e prompt não mudaram. Nenhuma chamada OpenAI, retry, consulta/escrita em Staging,
migration ou alteração de `Legacy` foi executada.

## Correção local — metadata refs do Document Map (2026-08-23)

Classificação: **READY FOR DOCUMENT MAP RETRY AFTER METADATA REF FIX**. O último retry passou por
Structured Output, wire validation e reconstruction, mas falhou no canonicalizer com uma única
`unknown_reference` originada em metadata hints; o Unit Plan não iniciou. Como o smoke anterior não
expôs o diagnostic interno, o path real completo entre as quatro famílias de hint continua PENDENTE.

Metadata hints possuem somente `value` e `sourceBlockIds`. Title, issuer, competence e validity usam
o mesmo namespace `block`, e cada source deve resolver para um `contentBlocks[].contentBlockId` real
emitido no mesmo map. A coleção pode ser vazia, mas um hint presente exige ao menos um source. Essa
provenance não é derivável de ownership ou outra back-reference.

O runtime agora emite `SEGMENTED_DOCUMENT_MAP_CANONICALIZATION` quando diagnostics estão opt-in,
contendo somente total, categories, amostra `{ path, kind, category }` e truncation. O prompt do
Document Map v3 exige definitions reais para todas as refs, orienta omitir o hint sem source block
identificável e proíbe placeholders. Maps de todas as definitions já eram construídos antes dos
hints; portanto não houve correção de ordem. Unknown refs, schema e canonicalizer não foram
relaxados. Nenhuma chamada OpenAI, retry, consulta/escrita em Staging, migration ou alteração de
`Legacy` foi executada.

## Correção local — relationship factIds da Unit Extraction (2026-08-23)

Classificação: **READY FOR UNIT EXTRACTION RETRY AFTER RELATIONSHIP PROMPT FIX**. O último retry real
passou por Document Map e Unit Plan; a unit 4 falhou em transport validation com duas violações
`composition.relationships[*].factIds: minItems`, e a unit 5 foi sibling abort.

O schema atual exige `factIds` com ao menos um fact em todas as seis relationship types e evidence
com ao menos um block. `groupIds` não substitui facts. `APPLIES_TOGETHER` e `MUTUALLY_EXCLUSIVE`
também exigem dois subjects totais; as outras types aceitam um único fact. Relationship group-only é
inválida, enquanto `relationships: []` é a ausência legítima.

O prompt efetivo já era v4, apesar do contexto do retry citar v3. A frase genérica “at least one
actual fact” estava presente, mas não impediu a interpretação group-only/placeholder. O prompt v5
agora proíbe explicitamente `factIds: []`, diz que groups nunca suprem o fact obrigatório, manda
omitir relações sem fact e inclui exemplos abstratos. Não há sanitização server-side: sem o conteúdo
completo, descartar a relação poderia apagar intenção semântica. Schema, `minItems`, projection,
validator e canonicalizer não mudaram. Nenhuma chamada OpenAI, retry, consulta/escrita em Staging,
migration ou alteração de `Legacy` foi executada.

## Correção local — back-reference página–seção do Document Map (2026-08-23)

Classificação: **READY FOR DOCUMENT MAP RETRY AFTER BACK-REFERENCE NORMALIZATION**. O último retry
real passou por Structured Output, wire validation, reconstruction, canonicalização de IDs e JSON
Schema canônico. A única falha foi
`/sections/4/pageIds: missingPageBackReference`; o Unit Plan não iniciou. Os blockers anteriores de
ID/pattern e `headerBlockIds minItems` não reapareceram.

`page.sectionIds` e `section.pageIds` representam a mesma relação de membership. O canonicalizer
agora resolve primeiro todas as referências, forma a união dos pares declarados em qualquer lado e
reprojeta listas únicas e determinísticas nos dois sentidos. Portanto não depende mais da IA repetir
a mesma matemática, não perde relação observada e não inventa par sem evidência. Referência para page
ou section inexistente continua falhando como `unknown_reference` antes da normalização.

Relações com informação adicional não foram generalizadas: tabela–página exige segments ordenados;
notes e content blocks têm ownership singular; entity hints/context edges são direcionais; blocks de
tabela possuem papéis distintos. Schema, validator, transport, prompt, planner, Unit Extraction e
etapas posteriores não mudaram. Nenhuma chamada OpenAI, retry, consulta/escrita em Staging, migration
ou alteração de `Legacy` foi executada.

## Correção local — coverage server-owned na Unit Extraction (2026-08-22)

Classificação: **READY FOR UNIT EXTRACTION RETRY AFTER COVERAGE FIX**. A última execução real
falhou na validação canônica da unit 1 em
`/coverage/completedUnitCount: inconsistentWithUnits`; a unit 3 foi sibling abort.

O v1 não possui `totalUnitCount`; `expectedUnitCount` é `coverage.units.length`, enquanto
`completedUnitCount` conta units com status `complete` e `extractedVehicleCount` é o tamanho de
`vehicleIdentities`. Esses valores required eram copiados do provider. O canonicalizer agora os
reconstrói do próprio artifact, tanto unit-scoped quanto agregado. Status, status das units, gaps,
unresolved, expected vehicles e famílias interpretativas continuam preservados; portanto a correção
não fabrica completeness.

O prompt segmentado v4 limita `coverage.units` à unit corrente e pede sentinel `0` para esses três
campos transport-only antes da substituição server-owned. Schema e invariants não mudaram. Nenhuma
chamada OpenAI, retry, consulta/escrita em Staging, migration ou alteração de `Legacy` foi executada.

## Correção local — placeholders vazios em Unit Extraction composition (2026-08-22)

Classificação: **READY FOR UNIT EXTRACTION RETRY AFTER COMPOSITION FIX**. A última execução real
alcançou a Unit Extraction; a unit 3 falhou na transport validation com quatro `minItems`: dois
`composition.groups[*].memberFactIds` vazios e dois
`composition.relationships[*].factIds` vazios. A unit 4 recebeu abort de sibling após essa falha
fatal.

O contrato distingue ausência legítima de placeholder inválido. `composition`, `groups` e
`relationships` são required no wire, mas as duas coleções externas não têm `minItems` e podem ser
`[]`. Um group existente representa alternativa/cúmulo real e exige ao menos dois member facts e um
scope; uma relationship existente exige ao menos um fact e evidence, e algumas relações ainda exigem
dois subjects no total. Logo objetos com arrays internos vazios não carregam semântica contratual.

O prompt anterior não ordenava a criação de placeholders, porém não explicava como representar
composition não aplicável sob o schema completo do Structured Outputs. O prompt da Unit Extraction
v3 agora proíbe placeholders, exige membros reais e orienta ausência para
`groups: []`/`relationships: []`. Não há hardcode de fabricante. Schema, `minItems`, canonicalizer,
transport validator, timeout e stages posteriores permaneceram intactos. Nenhuma chamada OpenAI,
retry, consulta/escrita em Staging, migration ou alteração de `Legacy` foi executada.

## Correção local — alinhamento do transport validator (2026-08-22)

Classificação: **READY FOR SEGMENTED RETRY AFTER TRANSPORT VALIDATOR ALIGNMENT**. O último retry real
teve provider call succeeded e Structured Output returned, mas o novo wire validator do Document Map
falhou com 82 violações `pattern`. Não houve Unit Plan.

O trace local mostrou que request e validator usam por identidade a mesma constante
`openAITransportDocumentMapSchema`; não existiam duas projeções independentes. A inconsistência era
interna ao schema projetado: o detector removia patterns apenas de
`document|block|table|column|row|vehicle|fact|scope|group|relation|unit|gap`, deixando 20 ocorrências
estruturais para `page|section|note|hint|edge`. Isso reproduziu localmente as falhas em page IDs,
entity hints e context edges. A projection agora reconhece o formato exato de qualquer ID canônico
server-owned, sem remover patterns comerciais como currency/amount/percentage.

Document Map e Unit Extraction possuem guards que provam que o schema compilado no AJV é o mesmo
objeto entregue ao provider. O fluxo das units também foi corrigido para
wire output → transport validation → reconstruction → canonicalization → canonical validation;
antes ele reconstruía e reprojetava o valor para validar, o que podia preencher propriedades wire
ausentes com `null`. IDs model-local passam no wire e são remapeados; `headerBlockIds: []` continua
falhando por `minItems`, e type/required continuam protegidos. Patterns canônicos permanecem intactos
e enforced após os canonicalizers. Prompt v2, schemas canônicos e planner não mudaram. Nenhuma chamada
OpenAI, retry, consulta/escrita em Staging, migration ou alteração de `Legacy` foi executada.

## Correção local — Document Map table header minItems (2026-08-22)

Classificação: **READY FOR DOCUMENT MAP RETRY AFTER MINITEMS FIX**. O retry real mais recente falhou
antes do Unit Plan com uma única violação: `/tables/6/headerBlockIds`, `minItems`. Os antigos erros de
`pattern` não reapareceram. Esta tarefa não consultou o output bruto nem o Staging.

O contrato é inequívoco: `headerBlockIds` é required, non-nullable, array com `minItems: 1`,
`maxItems: 500` e item `block-*`; a projeção OpenAI preserva required/min/max/items e remove apenas o
pattern local/`uniqueItems` aplicáveis. A projection torna propriedades canônicas opcionais
required-nullable no wire, mas nunca torna array items nullable. A reconstruction mapeia arrays sem
filtrar: `[null]` continua `[null]`, mistos continuam mistos e `[]` continua `[]`. Portanto ela não
consegue transformar um array wire não vazio em vazio. O `[]` observado na validação final já precisava
existir no wire; o canonicalizer somente remapeia os elementos existentes.

O runtime antes confiava no `strict: true` remoto e fazia apenas `JSON.parse` do Document Map, sem AJV
local do schema transport. Agora valida o raw response contra `openAITransportDocumentMapSchema`
antes de reconstruction/canonicalization e emite o mesmo diagnóstico seguro. O prompt do Document
Map foi versionado para v2: table só existe com ao menos um header block real; região sem header deve
ser representada por content blocks/sections. Continuação permanece a mesma table, mantém
`headerBlockIds` originais e referencia-os por `inheritedHeaderBlockIds` nos segmentos `CONTINUE`.
Schema, `minItems`, canonicalizer e planner não foram relaxados. Nenhuma chamada OpenAI, retry,
consulta/escrita em Staging, migration ou alteração de `Legacy` foi executada.

## Correção local — provenance de evidence e falha causal da Unit Extraction (2026-08-22)

Classificação: **READY FOR UNIT EXTRACTION RETRY AFTER EVIDENCE REF FIX**. A reconciliação read-only
do batch 117/documento 48 confirmou o Job 45/attempt 8, correlation
`33776123-5d8a-49d7-a18d-161277e4f17a`, sem job ativo, row ou Unit Extraction artifact. Document Map
artifact 3 e Unit Plan artifact 4 succeeded. A primeira causa real de Unit Extraction foi a unit 2:
duas violações `unknownRef` em `documents[0].candidates[*].evidence.blockIds`; a unit 1 apenas recebeu
`ABORTED_SIBLING`. O erro final posicional `UNIT_EXTRACTION_ABORTED_SIBLING` mascarava essa causa.

O contrato foi confirmado como extraction-local: toda `evidence.blockIds` deve resolver contra um
`blocks[].blockId` definido no mesmo `CommercialDocumentExtraction/1`. O Document Map usa outro papel:
seus content block IDs canônicos são provenance de entrada. O Unit Context agora carrega os objetos de
bloco primários e context-only, e o prompt v2 exige que uma fonte usada seja materializada como bloco
documental real, com o ID canônico do mapa reutilizado temporariamente no `blockId`. Assim, o
canonicalizer já existente remapeia a definição e todas as refs pelo mesmo mapa old→new. Citar um ID
sem materializar seu bloco continua `unknownRef`; duplicatas continuam `uniqueItems`; nenhum
placeholder é criado. Context-only pode sustentar interpretação/evidence, mas não originar fato novo
exclusivamente de contexto.

O runtime agora usa seleção determinística de falha. `INVALID_STRUCTURED_OUTPUT`,
`CANONICAL_VALIDATION_FAILED`, `PROVIDER_FAILURE`, `PROVIDER_TIMEOUT` real e
`ORCHESTRATION_TIMEOUT` têm precedência sobre `ABORTED_SIBLING`; ordinal/unit ID servem somente como
desempate dentro da mesma classe. No caso observado, o resultado passa a ser
`UNIT_EXTRACTION_CANONICAL_VALIDATION_FAILED`. A publicação continua all-or-nothing após o retorno do
orchestrator: unit 2 inválida e unit 1 abortada não geram artifacts; Document Map/Unit Plan succeeded
permanecem. Usage/providerRunId da resposta que falhou canonicalmente ainda se perde, dívida já
registrada para retry granular. Nenhum retry/OpenAI, escrita em Staging, acesso a Production,
migration ou alteração de `Legacy` foi executado.

## Correção local — autoridade server-owned dos IDs do Document Map (2026-08-22)

Classificação: **READY FOR SEGMENTED RETRY AFTER DOCUMENT MAP ID CANONICALIZATION**. O último retry
diagnóstico real retornou 358 violações, todas AJV `pattern`; não houve `required`, `type`, `enum`,
`uniqueItems`, referential, semantic ou invariant. A causa confirmada foi autoridade indevida do
modelo sobre IDs locais: a estrutura e as relações estavam coerentes, mas os valores não obedeciam aos
prefixos/patterns canônicos.

O boundary agora executa OpenAI transport output → reconstruction → ID canonicalization server-owned
→ canonical validation → Unit Plan. Os namespaces finais são `document-`, `page-`, `block-`,
`section-`, `table-`, `note-`, `hint-` e `edge-`, usando ordinais determinísticos; document identity é
ligada ao ordinal da source entregue pelo runtime. Todos os definition IDs e refs são remapeados por
kind. Raw ID duplicado no mesmo kind, definição ausente, referência desconhecida ou divergência da
source falham com `DOCUMENT_MAP_CANONICALIZATION_FAILED` e diagnostics contendo somente kind,
category e path. O mesmo raw ID em kinds diferentes é aceito porque os namespaces são separados.

O canonicalizer é puro, não usa conteúdo comercial, UUID, timestamp, random ou locale sorting e é
idempotente para a ordem contratual existente. O schema/pattern canônico e o prompt não foram
alterados. Unit Extraction canonicalizer, Merge, Semantic Reconciliation, Period Resolution, Domain
Mapping e Matching permanecem intactos. Nenhum retry, chamada OpenAI, escrita em Staging, acesso a
Production, migration ou alteração de Legacy foi executado nesta correção.

## Diagnóstico local — Document Map canonical validation (2026-08-22)

Classificação: **READY FOR DOCUMENT MAP DIAGNOSTIC RETRY**. O transport schema continua aceito pela
OpenAI e o blocker real continua sendo a validação canônica anterior ao Unit Plan. O validator agora
expõe somente diagnóstico estrutural seguro: `code`, total real, amostra limitada a 30 com
`path`/`keyword`/`category`, truncation e contagens completas. AJV `params`, actual/expected values,
body, output bruto, evidence, URLs e IDs do provider não entram no erro, log ou banco.

A investigação local provou dois fatos. Primeiro, o total “100” do Job 42/attempt 5 era produzido por
`slice(0, 100)` antes da criação do erro; portanto significa “ao menos 100 na lista AJV daquele run”,
não exatamente 100. Segundo, a reconstrução genérica removia qualquer `null` sem consultar o schema,
inclusive `null` canônico required/nullable. Ela agora é schema-aware e remove apenas a sentinela de
campo optional/non-nullable introduzida pelo wire. Round-trips Geely-like, GWM multipage, Fiat-like e
VW partitioned, além de nested arrays/objects e union oneOf→anyOf, passam localmente.

Com `OPENAI_IMPORT_DIAGNOSTICS=1` fora de produção, uma futura falha em Document Map emite
`SEGMENTED_DOCUMENT_MAP_VALIDATION` antes do generic processing failure. O evento é efêmero e contém
somente total, contagens, amostra estrutural e truncation; o artifact não é publicado quando a
validação falha. Nenhum retry, chamada OpenAI, acesso ao Staging, migration ou alteração de Legacy foi
executado nesta tarefa.

## Checkpoint — Sprint 10C.4D segmented smoke (2026-08-21)

Classificação atual: **SEGMENTED SMOKE TECHNICAL FAIL** no stage
`DOCUMENT_MAP_CANONICAL_VALIDATION`. O pipeline real progrediu por source upload/open, OpenAI
`response_create` bem-sucedido, retorno de Structured Output e reconstrução do transporte; o validator
canônico rejeitou `CommercialDocumentMap/1` com 100 violações. Unit Plan, Unit Extraction, Merge,
Semantic Reconciliation e Domain Mapping não iniciaram. Não investigar as violações neste checkpoint.

Histórico read-only do batch 117/documento 48:

- Job 38/attempt 1: `DOMAIN_MAPPING_PERIOD_UNAVAILABLE`, zero OpenAI;
- Job 39/attempt 2: `SEGMENTED_FAKE_PROVIDER_NOT_INJECTED`, zero OpenAI;
- Job 40/attempt 3: structured provider retornou genericamente `PROVIDER_FAILURE` em
  `response_create`, persistido como `PROCESSING_FAILED`;
- Job 41/attempt 4: HTTP 400 `invalid_json_schema` em `sourceBlockIds.uniqueItems`; Document Map não
  executou semanticamente;
- Job 42/attempt 5, correlation `5c9ff106-37ff-4654-9462-5b5a7c76894b`: transport schema aceito,
  Structured Output retornado e validação canônica falhou com 100 violações.

Estado final: batch/documento/job `failed`, zero jobs ativos, rows, artifacts e dependencies; sem
providerRunId ou usage persistidos e sem promoção. **REAL SEGMENTED PIPELINE: PROGRESSED THROUGH OPENAI
DOCUMENT MAP RESPONSE BUT NOT YET THROUGH CANONICAL DOCUMENT MAP VALIDATION.** Próxima tarefa isolada:
**DIAGNOSE DOCUMENT MAP CANONICAL VALIDATION FAILURE**.

## Correção — observabilidade do primeiro Document Map real (2026-08-21)

O Job 40/attempt 3 do batch 117 falhou no primeiro `response_create` do Document Map após a source
session concluir o upload. Não houve manifest, dependency, row ou Unit Plan. O erro original foi
colapsado em `PROVIDER_FAILURE`; portanto sua causa HTTP/OpenAI não pode ser reconstruída
retroativamente. O structured provider agora reutiliza o error mapping e a sanitização do one-shot,
preserva diagnóstico seguro opt-in com pipeline stage/unit e distingue falhas acionáveis. Request,
schema, prompt e modelo permanecem inalterados. O runtime tenta fechar a source session em `finally`;
não havia persistência do resultado de cleanup no attempt 3. Nenhum retry foi executado.
O retry diagnóstico seguinte confirmou HTTP 400 `invalid_json_schema` em
`properties.sourceBlockIds.uniqueItems`. Document Map e Unit Extraction agora reutilizam a mesma
projeção OpenAI transport-safe e reconstroem a resposta antes da validação canônica. Os schemas core,
prompts e validators não mudaram; constraints removidas do wire continuam obrigatórias no servidor.

## Correção — structured provider segmentado fail-safe (2026-08-21)

O Job 39/attempt 2 do batch 117 é uma falha histórica
`SEGMENTED_FAKE_PROVIDER_NOT_INJECTED`: batch/documento estão `failed`, sem job ativo, row, artifact
ou dependency. A factory structured não escolhe mais fake quando `IMPORT_EXTRACTION_PROVIDER` está
ausente. O modo segmentado resolve sua configuração antes de autorização ou enqueue; fake requer
injeção explícita fora de produção, e o smoke real exige explicitamente `openai`. O one-shot permanece
default e seu comportamento histórico não mudou. Nenhum recovery ou retry foi executado.

## Correção — resolução tardia de período segmentado (2026-08-21)

O Job 38 do batch 117 permanece como tentativa histórica `failed`, sem chamada OpenAI, source session,
artifact, row ou efeito comercial. A causa foi a precondition antecipada que exigia
`batch.competence` antes do Document Map. O runtime segmentado agora permite competence operacional
nula, preserva `competenceCandidates` e `validityCandidates` de `CommercialDocumentExtraction/1`
através de merge e semantic reconciliation e resolve o período explicitamente somente antes do
Domain Mapping. Batch e documento incompatíveis, múltiplos períodos conflitantes e ausência real de
período continuam falhando conservadoramente; nenhuma data é fabricada. Nenhum retry real foi
executado e o próximo gate separado é repetir oficialmente o batch 117.

## Marco — Runtime Orchestration da Sprint 10C.4C (2026-08-21)

Pipeline segmentado implementado no runtime atrás de `IMPORT_EXTRACTION_MODE=segmented`, com default
obrigatório `one_shot`. O E2E fake unit-aware prova artifacts, replay, domain mapping, handoff
canônico, matching e `needs_review`. Nenhum smoke OpenAI segmentado foi executado; 10C.4D permanece
a próxima etapa separada.

## Marco — Artifact Persistence & Security da Sprint 10C.4B (2026-08-20)

A migration local `20260820203801_sprint_10c4b_artifact_persistence.sql` materializa manifest e DAG
relacional, bucket privado `import-processing-artifacts`, lifecycle RPCs hardened, idempotência,
retry/supersession e audit snapshots sem body. O adapter Supabase server-only implementa os ports da
10C.4A e verifica read-back/SHA-256/tamanho antes de succeed; falha de finalização preserva orphan
observável sem cleanup automático. RLS deny-by-default, zero policies e grants mínimos excluem
PUBLIC/anon/authenticated e DELETE.

O segmented pipeline continua sem consumidor: não há ligação a `processAdminImportBatch`, registry,
UI, Server Actions, matching, Policies/Offers, promotion ou one-shot. Não houve acesso remoto nem
`db push`. Retenção continua apenas documentada (365d/180d/review 30d). Documento normativo:
`docs/import/SPRINT_10C4B_ARTIFACT_PERSISTENCE.md`. Próxima etapa: **10C.4C — Runtime Orchestration /
End-to-End Dry Run**, ainda não ativa.

Gates Supabase locais concluídos com CLI `2.109.1`: reset completo verde, migration 10C.4B aplicada
do zero, pgTAP 023 em 43/43, migration list coerente e dry-run local sem pendências. A suíte SQL
completa ficou em 691/693; as duas falhas do teste histórico 016 foram reproduzidas no schema anterior
à 10C.4B e decorrem de duas fixtures com SHA-256 `cccc…` duplicado, não desta sprint.

## Marco — Lifecycle & Artifacts da Sprint 10C.4A (2026-08-20)

`SegmentedImportArtifactManifest/1` define lifecycle provider-agnostic para Document Map, Unit Plan,
Unit Extraction, Merge, Semantic Reconciliation e Domain Mapping. O core agora oferece
canonicalização JSON/SHA-256, idempotency key, paths server-owned, DAG/lineage validators,
transições imutáveis, resolução do latest succeeded e ports para manifest, Storage e auditoria.

Decisão de persistência: JSON imutável em Storage privado + manifest mínimo no Postgres. A 10C.4B
materializou migration e adapters localmente, ainda sem consumidor runtime.
O protocolo reserva queued, marca processing, grava/relê/verifica hash e só então finaliza succeeded;
falha pós-write produz orphan observável, sem deletion automática. Retenção inicial: succeeded 365
dias, failed manifest 180 dias, revisão de orphan após 30 dias, sujeita à decisão jurídica.

10C.3 está concluída internamente. Pipeline segmentado, `processAdminImportBatch`, registry,
one-shot, Prompt v4, matching, persistência comercial e promotion continuam inalterados/inativos.
Documento normativo: `docs/import/SPRINT_10C4A_LIFECYCLE_ARTIFACTS.md`.

## Marco — Domain Mapping da Sprint 10C.3E (2026-08-20)

`mapCommercialDocumentToDomain` consome `SemanticallyReconciledCommercialDocument/1` mais source e
período operacionais explícitos e produz `CommercialDocumentDomainMappingResult/1`. O wrapper mantém
coverage/provenance/issues globais e suas rows usam o contrato existente
`commercial-letter/mmv-payload/1`. `public_price` é o único fact que vira MSRP; Policies são criadas e
deduplicadas antes das Offers; IDs locais e referências são determinísticos; composition
cumulative/alternative, inclusive aninhada, é materializada sem reinterpretar a 10C.3D.

O resultado semântico foi enriquecido com snapshots documentais já conhecidos e provenance passou
a manter document/page/block, tornando a fronteira autossuficiente sem inferência ou retorno à
foundation. Gaps, identity/conflict/scope unresolved e mappings sem campo canônico ficam em review
ou bloqueiam a row. Fixtures 4/13/20/100 passam pelo JSON Schema canônico, com determinismo,
imutabilidade e zero Offer→Policy orphan.

Não há integração com runtime, Product matching, banco, provider, OpenAI, Storage, migration,
promoção, Staging, Production ou Legacy. Documento normativo:
`docs/import/SPRINT_10C3E_DOMAIN_MAPPING.md`. Próximo estágio: **10C.3F — benchmark controlado**.

## Marco — Semantic Reconciliation da Sprint 10C.3D (2026-08-20)

`reconcileCommercialDocumentSemantics` consome `CommercialDocumentReconciliationResult/1` e produz
`SemanticallyReconciledCommercialDocument/1`. Rules propagam scopes estruturados para vehicle
recipients usando indexes exatos de brand/model/version/identity/channel/group; exclusions são
aplicadas antes da materialização e as projeções rule→recipients e recipient→rules são validadas
bidirecionalmente. General rules cobrem deterministicamente 4, 20 e 100 identities.

Aliases não triviais, contexts e precedência só entram por directives documentais explícitas.
Validity disjunta não conflita; overlap incompatível sem `REPLACES`/`CORRECTS` permanece unresolved.
Não há fuzzy inference, IA, Product, Policy, Offer, persistence, migration ou runtime. A Sprint
10C.3D está concluída em core; próximo estágio: **10C.3E — Domain Mapping**. Documento normativo:
`docs/import/SPRINT_10C3D_MERGE_RECONCILIATION.md`.

## Marco histórico — Merge/Reconciliation Foundation da Sprint 10C.3D (2026-08-20)

`reconcileCommercialDocumentExtractions` agora consome DocumentMap, UnitPlan e envelopes de artifacts
unitários em uma primitive pura interna. O resultado versionado reconcilia identities, facts, scopes
e composition com IDs server-owned e provenance completa; equivalência exata deduplica sem perder
contributors e incompatibilidades viram conflitos explícitos, nunca last-write-wins. Coverage cruza
units e partitions, preserva inherited headers e reporta missing/duplicate/unplanned/invalid,
ordinais, dangling refs e mismatch.

Ordenação canônica, testes byte-equivalentes e deep-freeze garantem determinismo/imutabilidade. Não
há Product, Policy, Offer, domain mapping, Supabase, migration, provider, chamada externa ou ativação
runtime. A etapa seguinte foi **Semantic Reconciliation / scope propagation**. Documento
normativo: `docs/import/SPRINT_10C3D_MERGE_RECONCILIATION.md`.

## Marco — Segmented Extraction da Sprint 10C.3C (2026-08-16)

A execução interna/testável recebe `CommercialDocumentMap/1`, plano validado e source privada,
reutiliza um upload por documento e executa N structured extractions delimitadas por unit. O provider
novo é genérico (`source/instructions/schema/signal/metadata`); o plugin/orchestrator cria contexto
primary versus context-only, inherited headers, notes/edges e aplica concorrência default 2,
deadlines por unit/total, stop scheduling e abort de siblings.

O wire usa projeção strict do schema intermediário e round-trip testado. IDs locais são
canonicalizados deterministicamente por unit antes do validator canônico. Correlation, provider run,
usage, duração e erros seguros permanecem fora do domínio, em resultado em memória retryable. Upload
é removido somente após convergência de todas as units; cleanup failure não mascara falha primária.

Nada foi registrado no runtime: `processAdminImportBatch`, provider `openai/4`, registry, prompt
one-shot, matching, adapter/RPCs, banco, migrations, Staging, Production e Legacy permanecem
inalterados. Não houve chamada de modelo nem batch. Próxima etapa: **10C.3D — merge e
reconciliation**. Documento normativo: `docs/import/SPRINT_10C3C_SEGMENTED_EXTRACTION.md`.

## Marco — Document Map da Sprint 10C.3B (2026-08-16)

`CommercialDocumentMap/1` foi implementado em `packages/core` como inventário provider-agnostic de
documents/pages/content blocks, sections, logical tables sem células, notes, entity hints e context
edges. JSON Schema Draft 2020-12 e invariantes puras validam limites, ownership, back-references,
continuações, headers herdados e ausência de dangling refs. O mapa não contém facts comerciais
finais, Policy, Offer, Product, matching ou promoção.

O planner server-owned deriva deterministicamente `CommercialExtractionUnitPlan/1` com units
TABLE/SECTION/FAMILY/CHANNEL/fallback, primary versus context-only, overlap reason, partitions de
tabela lógica e coverage recalculável. Fixtures sintéticas Geely/GWM/Fiat/Volvo/VW-like cobrem regra
geral posterior, tabela 13/13, 17 páginas/12 famílias/100 combinações, canais/eligibility e tabela
densa particionada. Types puros entram no barrel; schema, validator e planner permanecem em subpaths
fora do barrel raiz para não levar Ajv ao Edge.

Runtime, provider `openai/4`, prompts, jobs, adapter Supabase, RPCs, banco, migrations, Staging,
Production e Legacy permanecem inalterados. Nenhum batch/modelo foi executado. Documento normativo:
`docs/import/SPRINT_10C3B_DOCUMENT_MAP.md`. Próxima etapa: **10C.3C — execução segmentada**, ainda
não iniciada.

## Marco — contrato intermediário da Sprint 10C.3A (2026-08-16)

`CommercialDocumentExtraction/1` foi implementado experimentalmente em `packages/core` com types,
JSON Schema Draft 2020-12 e validator puro. O artifact representa documents, source blocks, tabelas
lógicas/continuações, vehicle identities documentais, facts atômicos tipados, scopes explícitos,
composição alternativa/cumulativa e coverage complete/partial/ambiguous. Todos os objetos são strict;
IDs prefixados são locais ao artifact e todas as referências dinâmicas são validadas sem banco.

Fixtures sintéticas provam quatro identities com broad rule/exceção/E-OU, tabela 13/13 multipágina,
escala de doze famílias/cem identities/>100 facts e vinte identities com prices/financiamento por
canal. O contrato recusa campos de autoridade de Product, matching, IDs persistidos, Policy/Offer,
locks, promoção e publicação. A decisão é que IDs do artifact reconciliado sejam server-owned; a
reconstrução pertence às fases futuras de document map/merge, não ao validator 10C.3A.

Nada foi integrado ao runtime: `processAdminImportBatch`, registry/providers, plugin canônico,
adapter Supabase, RPCs, banco, migrations, Staging, Production e Legacy permanecem inalterados.
Nenhuma OpenAI ou batch foi executada. Documento normativo:
`docs/import/SPRINT_10C3A_INTERMEDIATE_CONTRACT.md`. Próxima etapa: **10C.3B — Document Map**.

## Marco — spike de extração intermediária da Sprint 10C.3 (2026-08-14)

O A/B real Geely v4 (batch 116/Job 37) preservou 4/4 MMVs, 4/4 MSRP, período, E/OU, evidence local,
zero Offer→Policy órfã e zero false positive material observado, mas não recuperou nem sinalizou a
regra ampla atribuída às rows EX5; confidence permaneceu 96–97/high. A decisão é pausar tuning
one-shot/Prompt v5 e evoluir a arquitetura, não continuar acumulando instruções no mesmo output.

A spike em `docs/import/SPRINT_10C3_INTERMEDIATE_EXTRACTION_ARCHITECTURE.md` recomenda pipeline
segmentado: document map → extraction units → `CommercialDocumentExtraction/1` conceitual → merge e
reconciliation → domain map → contrato canônico v1 atual. O intermediate preserva blocos, tabelas,
identidades, fatos, relações, scope e evidence, mas não contém Product IDs, Policies/Offers finais,
matching ou promoção. Provider permanece genérico; estratégia, schema intermediário e mapper ficam no
plugin `commercial_letters`; validação, IDs, coverage, matching e lifecycle permanecem server-owned.

Persistência recomendada para evolução futura: artifacts JSON imutáveis no Storage privado e metadata
operacional mínima server-only, após decisão explícita de retention/versioning e migration própria.
Nada disso está ativo: provider continua `openai/4`, schemas atuais continuam v1 e nenhuma OpenAI,
batch, remoto, migration ou Legacy foi tocado nesta spike. Rollout proposto: 10C.3A–F, de contrato a
benchmark.

## Marco — Prompt v4 estático da Sprint 10C.2 (2026-08-14)

O primeiro A/B real Geely v3 (batch 115/Job 36, `gpt-5.6-terra`) sucedeu com 48.384 tokens e quatro
rows: 4/4 MMVs, 4/4 MSRP, período e E/OU corretos, zero Offer→Policy órfã e nenhum false positive
material observado. O v3 recuperou substancialmente financiamento, condição diferida e serviços
associados, mas uma regra documental de escopo amplo ainda não foi propagada para duas rows
abrangidas; confidence permaneceu 97–98/high. Classificação: technically pass / quality fail.

Prompts v1/v2/v3 permanecem exportados. O Prompt v4 ativo e provider `openai/4` acrescentam um
`RULE INVENTORY / SCOPE LEDGER` interno e fecham cobertura nas direções row→regras e
regra→destinatários, com exceptions first, escopo guiado pela linguagem documental, materialização
de regra geral em todas as alternativas aplicáveis e proibição de HIGH diante de destinatário não
reconciliado. Schemas transport/canônico continuam v1; matching e thresholds permanecem server-owned.
O ledger não integra o output. Nenhuma chamada OpenAI ou escrita remota foi feita para o v4; próximo
gate: A/B Geely v4 autorizado separadamente.

## Marco — Prompt v3 estático da Sprint 10C.2 (2026-08-14)

O benchmark v2 revelou perda sistêmica de coverage/contexto: Geely 4/4 com underpropagation e
confidence 92–94; GWM 1/13 e confidence 96; Fiat duas rows para cerca de 100 combinações, 10/12
famílias ausentes e PY/MY compactados; Volvo com cinco Offers referindo Policies inexistentes,
corretamente recusadas antes do matching. Precision local permaneceu prioritária e sem false positive
material observado. VW não foi executado.

Prompt v1/v2 permanecem exportados; v2 está congelado. O Prompt v3 e provider `openai/3`
adicionam inventários, enumeração exaustiva, PY/MY separados, Policy-first, integridade Offer→Policy,
reconciliação quantitativa/familiar, canais, contexto multipágina, E/OU e confidence/completeness.
Schemas continuam v1: fixtures validam 20/100 rows e REVIEW com vocabulário existente. O request não
define `max_output_tokens`; 128k é o teto publicado do modelo, não garantia de caberem 100 rows
verbosas. Mais de 100 combinações exige segmentação futura. Nenhuma OpenAI ou escrita remota foi
executada; próximo gate: A/B Geely v3 controlado e autorizado separadamente.

## Marco — integridade Policy/Offer do Volvo (Sprint 10C.2, 2026-08-14)

O Volvo batch 113/Job 35 concluiu o provider, mas foi recusado antes do matching por cinco Offers com
`policyClientIds: unknownPolicy`; nenhuma row foi persistida. A auditoria local provou que o transport,
parser, reconstrução e sanitização preservam os IDs e não removem/deduplicam Policies, portanto a
orfandade já veio do output do provider. O validator canônico continua recusando Offers parcial ou
totalmente órfãs: não há placeholder, fuzzy matching nem remoção silenciosa. Diagnóstico sanitizado
registra somente volumes e paths. Prompt v2 e benchmark permanecem congelados; Volvo não foi
reexecutado, VW não foi executado e não houve acesso remoto.

## Marco — matching pós-provider robusto em volume (Sprint 10C.2, 2026-08-14)

O retry Fiat Job 33 provou que o provider completava, mas o matching disparava até duas queries por
row em um `Promise.all` de até 100 rows, sem dedupe ou limite de concorrência; anos textuais não
canônicos também podiam chegar a filtros `smallint`. O boundary agora deduplica chaves MMV e usa
chunks de 10 consultas dirigidas. Ano ausente/inválido pula a busca exata e nunca vira wildcard ou
match confirmado; tokens permanecem apenas sugestão. Falha de qualquer chunk aborta o conjunto sem
catálogo parcial. Diagnóstico local/test é sanitizado e a persistência remota continua genérica.
Esta correção foi validada somente com fixtures locais; batch 111 não foi reexecutado e permanece
pendente de autorização separada.

## Marco — timeout determinístico do provider (Sprint 10C.2, 2026-08-14)

O benchmark cross-brand permanece incompleto e congelado. GWM batch 110/Job 31 sucedeu, mas extraiu
1/13 MMVs nominais. Fiat batch 111/Job 32 excedeu o timeout externo de 180 s; o job órfão foi
recuperado pelo reclaim oficial e finalizado atomicamente como `PROVIDER_TIMEOUT`, com batch e
documento 42 em `failed`, zero rows e zero efeito comercial. Volvo 113 e VW 112 não foram executados
naquele checkpoint; Volvo foi executado posteriormente conforme o marco atual e VW segue pendente. O
provider agora aplica deadline server-only configurável (default 480 s, faixa 30–600
s), propaga AbortSignal e converte timeout em `PROVIDER_TIMEOUT`; o application flow usa a fail RPC
atômica. Lease = 900 s e harness = 900 s. Prompt v2, schema, matching, confidence e FakeProvider
permanecem inalterados. Após o checkpoint, retomar Fiat → Volvo → VW.

## Marco — processamento do Import Engine (Sprint 10C, 2026-08-12)

A fundação possui job por tentativa, provider abstrato/FakeProvider, plugin `commercial_letters`, matching conservador e persistência transacional em `pricing_import_rows`. As migrations da Sprint 10C e do reclaim foram aplicadas e a pipeline foi validada funcionalmente no Staging `shfsjyjxmgwnlexmdkcs`. O primeiro baseline semântico válido da 10C.2 usou batch 109, `Geely 202602-01.pdf`, `gpt-5.6-terra` e Prompt/provider v1: 43.804 tokens, custo estimado ~US$ 0,285, quatro rows, 4/4 MMVs e MSRP corretos, precision observada alta, nenhum false positive observado e zero efeito comercial. O recall foi incompleto: faltaram condições financeiras/taxa zero/carência no EX2 MAX e Wallbox ou recarga/carência no EX5 PRO/MAX; confidence 96–98 não refletiu as lacunas. Classificação: `REAL PROVIDER SMOKE TECHNICALLY PASS / QUALITY FAIL`.

O Prompt v1 original permanece identificável e reproduzível. O Prompt/provider v2 adicionou escopo documental explícito, matriz de cobertura por MMV, reconciliação, herança correta de benefícios gerais entre alternativas, contexto de tabelas, completeness em confidence/REVIEW e evidence de escopo. O primeiro A/B v2, batch 114/Job 29, recebeu output do provider mas falhou antes de persistir rows por `overallConfidence.band: inconsistentWithScore`. Após a correção server-owned das bands, o retry oficial Job 30 sucedeu com 46.290 tokens, quatro rows/4 MMVs e confidence 92–94; melhorou sinais de cobertura, mas permaneceu todo `unmatched` e não estabeleceu sozinho qualidade semântica suficiente. A correção mantém o score da IA e deriva todas as bands server-side pelos thresholds canônicos 90/70. Score inválido continua recusado. Preservar provider run/usage em falha pós-provider exige migration/RPC separada e permanece PENDENTE. Prompt v2 está congelado como histórico, Prompt/provider v3 está implementado estaticamente conforme o marco acima e a Sprint ainda não está semanticamente validada.

O hardening adicionou validação JSON Schema real, ownership server-side, lease/reclaim com token, locks e revalidação de batch, correlation/auditoria, limites de payload, ordinal semântico, matching direcionado e pgTAP. O pgTAP remoto não está disponível no projeto, mas reset e 648/648 assertions passaram localmente e os fluxos críticos foram exercitados pelas RPCs, Storage, adapters e application flow reais no Staging. Nenhuma promoção comercial automática foi introduzida.

## Marco — correção final da UI da Sprint 10B (2026-08-11)

- A UI não solicita `dossier_title`; o serviço server-only gera `Importação <data/hora>` em
  `America/Sao_Paulo`. Filename continua sendo somente proveniência conforme ADR-013.
- Para `commercial_letters`, `competence` é hint opcional na ingestão. Ausência trafega como `NULL`;
  nunca usar data atual ou filename. Detecção/confirmação futura pertencem à 10C ou posterior.
- A tabela e o constraint de `pricing_import_batches.competence` já eram anuláveis. A migration
  `20260811232647_sprint_10b_optional_import_competence.sql` substitui somente a RPC de criação.
- A seleção local mantém pares arquivo/papel e acumula seletor e drag-and-drop até 20 PDFs.
  Cada item possui identificador estável usado no input de arquivo e no controle de papel; o
  servidor resolve os pares pela chave do `FormData`, sem arrays paralelos por índice ou fallback.
- A migration foi aplicada apenas no Staging `shfsjyjxmgwnlexmdkcs` como versão remota
  `20260811232647`. O pgTAP relevante passou 36/36 e o rollback deixou zero batches/objetos de teste.
- A auditoria remota confirmou 12 batches históricos `pricing_workflow/manual` com competência nula
  e 2 batches `commercial_letters` existentes com hint preenchido; nenhuma linha foi reescrita.
- Next.js 15.5.20 limita Server Actions a 1 MiB por padrão e o middleware clona 10 MiB por padrão.
  `apps/web/next.config.ts` usa o teto compartilhado de 64 MiB nos dois boundaries; UI e application
  layer aceitam até 60 MiB de arquivos por request, preservando margem multipart e 32 MiB por PDF.
- **PENDENTE:** repetir o teste manual da UI com dois PDFs. Não declarar a Sprint 10B validada antes
  disso.
## Marco — fundação do Import Engine (Sprint 10B, 2026-08-02)

- O Import Engine é módulo oficial e segue o ADR-013: batch é dossiê, documento é arquivo físico e
  rows futuras são unidades de revisão. “A IA interpreta. O domínio decide.”
- O primeiro plugin é `commercial_letters`; nenhum contrato específico de provider, SDK, extração,
  row por MMV, review ou promoção foi conectado nesta etapa.
- PDFs são enviados somente pelo backend admin ao bucket privado `import-engine-documents`, limitados
  a 20 por dossiê e 32 MiB cada, com assinatura mínima, SHA-256 real, duplicidade explícita, retry
  idempotente e compensação de Storage.
- `pricing_import_documents` preserva proveniência, lifecycle e lock. Criação/adição são RPCs
  transacionais server-only; ajuste de papel, rejeição e arquivo exigem CAS e auditoria append-only.
- `page_count` permanece nulo sem leitor local confiável; rejeição/arquivo não removem objetos. A
  política de retenção e o contrato maduro de provider ficam para a Sprint 10C.
- Produção e `Legacy` permanecem intocados. O único remoto autorizado é Compra Car Staging
  (`shfsjyjxmgwnlexmdkcs`).
- A correção autorizada restaurou em migration separada os guards financeiro e de Offer de
  `prevent_terminal_pricing_migration_rule_change`, com acesso a colunas isolado por tabela. A suíte
  pgTAP local passou com 611 testes.
- As três migrations novas foram aplicadas somente ao Staging. **PENDENTE:** pgTAP e smokes remotos
  não foram iniciados porque o conector administrativo atingiu o limite de uso imediatamente após o
  deploy. Não há artefatos de smoke a limpar; Produção não foi consultada.

## Marco — encerramento do workspace comercial (Sprint 9H.5, 2026-08-01)

- “Expirado” é somente apresentação de `ProductPublicPrice`: exige `status = published`, `ends_on`
  não nulo e anterior à data operacional em `America/Sao_Paulo`. O banco continua armazenando
  `published`; não há status, migration ou transição adicional.
- `publish_product_public_price` retorna a linha física sem a relação PostgREST `product`. O adapter
  deve carregar/validar essa relação antes da RPC e agregá-la ao retorno para que um COMMIT válido
  não seja reportado como erro de mapping. Depois de `ok`, refresh nunca pode reclassificar a
  publicação como falha nem liberar nova tentativa.
- O modal de preço e o lote manual compartilham `formatPtBrMoneyInput` e
  `ptBrMoneyCaretPosition`; persistência continua usando conversão decimal canônica já existente.
- Campos administrativos de preço, valor, Rebate, Taxa, Entrada, Prazo e descrição desativam
  autofill e preservam `inputMode`/labels acessíveis.
- Auditoria read-only do Staging: VW Taos/Product 617 tem somente MSRP #29, publicado, iniciado em
  01/08/2026, aberto, lock 2, sem overlap e com auditoria append-only. Produção e `Legacy` seguem
  fora do escopo.

## Marco — polish final do workspace comercial (Sprint 9H.4, 2026-08-01)

- O período especial não copia como sucessoras as Policies que continuam válidas. Uma nova linha do
  mesmo tipo resolve `expectedPredecessorId`/lock e as Offers substituem o membership antigo por
  `policyClientRowId`. O fechamento D−1 permanece exclusivamente na RPC transacional 9H.2.
- O estado vivo da matriz de Offers é comunicado ao workspace. Indicadores e bloqueios de Policy
  devem usar as seleções locais, inclusive linhas novas, sem aguardar persistência ou refresh.
- A criação oficial de preço retorna no estado de sucesso o ID e lock do draft. O modal do workspace
  pode então chamar a publicação individual existente e atualizar os Server Components por
  `router.refresh()`, sem navegação.
- A Sprint 9H.4 não altera schema, RPCs, segurança, contratos públicos ou arquitetura. Produção e
  `Legacy` permanecem fora do escopo.

## Marco — operação mensal final (Sprint 9H.3, 2026-08-01)

- Uma linha copiada carrega `sourcePolicyId` apenas no estado/DTO da UI. Ao copiar Offers, o ID de
  origem precisa virar `policyClientRowId`; Policy expirada nunca pode ser reenviada como
  `policyId`. Membership sem correspondência bloqueia o save.
- O serviço completa por ID as Policies referenciadas nas Offers que ficaram fora da janela de
  histórico. A RPC continua sendo a autoridade final de cobertura integral.
- `invoice_discount` é Desconto NF, valor fixo e participante normal do benefício da Offer.
- Rebate manual reutiliza `commercial_policies.dealer_rebate_amount` e registra método `manual`.
  Zero é persistido como `NULL`; valor positivo deve ser menor ou igual ao benefício. Rebate não
  compõe benefício, preço transacional ou PDF.
- Migration canônica `20260801202216` aplicada somente ao Staging. A validação reversível sobre o Product
  616 confirmou Policies/Offers de setembro e memberships novos, preservando os dados reais de
  agosto. Produção e `Legacy` permanecem fora do escopo.

## Marco — período comercial mensal/especial (Sprint 9H.2, 2026-08-01)

- Não existe entidade persistida de competência: `CommercialPeriod` deriva o mês completo ou um
  intervalo especial interno e Policies/Offers usam as colunas temporais existentes.
- `create_commercial_period_draft` é a única fronteira para rollover conjunto. Exige ator,
  correlation ID e locks esperados, fecha em D−1, audita snapshots e cria somente drafts.
- Offer `published` pode ter apenas `valid_to` alterado dentro dessa RPC; lifecycle, memberships e
  identidade econômica permanecem. `archived` é imutável e rollover mensal retroativo é rejeitado
  segundo `America/Sao_Paulo`.
- O workspace copia a base de D−1 apenas localmente quando o período está vazio. Datas não são
  editadas por linha; o MSRP precisa cobrir o intervalo e continua independente.
- Migration `20260801190935` aplicada somente ao Staging. Validação reversível passou sem resíduo.
- A limpeza transacional Staging-only deixou 0 Policies/Offers e preservou 10 Products, 17 preços,
  1 parameter set, proveniência/auditoria de preço e dados estruturais. O bypass de triggers foi
  `SET LOCAL` e o pós-check confirmou `origin`.
- Produção e `Legacy` não foram tocados. Publicação permanece individual.

## Marco — estabilização de Pricing (Sprint 9E, 2026-07-30)

- Batch Policies não recebe mais `title`, `endsOn` ou seleção de MSRP como autoridade do browser:
  título, vigência aberta e defaults por tipo são normalizados no core antes da persistência.
- MSRP publicado e referência financeira são resolvidos por `startsOn`, exigindo exatamente uma
  correspondência; a mesma função pura alimenta prévia e submissão para evitar divergência temporal.
- IPVA usa 4% e mês derivado do início; seguro usa 3% e prazo de 12/24/36 meses; emplacamento usa 1%.
- O combobox administrativo pesquisa todos os tokens em qualquer ordem e renderiza o popup em portal.
- Máscaras monetárias pt-BR são apenas apresentação; o core converte para decimal string canônica.
  Taxa aceita `0,49`, normaliza para `0.49` e não muda a unidade percentual mensal do domínio.
- Eventos de edição monetária usam normalização tolerante para reagrupar separadores transitórios;
  validação e persistência usam conversão estrita, mantendo display e decimal canônico separados.
  Em policy de valor fixo, tanto `amount` quanto o benefício chegam à RPC como decimal canônico.
- `Taxa` e `Voucher` são labels de UI; os identifiers e títulos persistidos permanecem compatíveis.
- A migration `20260730223142_fix_manual_policy_batch_open_ended_msrp.sql` substitui somente
  `create_manual_policy_batch`: policy aberta aceita MSRP finito válido em `startsOn`, enquanto MSRP
  expirado antes dessa data continua rejeitando o lote inteiro. Foi aplicada somente ao Staging;
  Bônus + IPVA, rejeição temporal e Taxa 24/0,49/60 passaram em transações reversíveis com zero
  resíduo. A revalidação persistente Trade-in + Taxa + IPVA criou o batch 16 e três drafts no
  Staging, incluindo benefício de Taxa de R$ 6.893,41. Produção e `Legacy` seguem fora do escopo.

## Marco — Offer Builder (Sprint 9D, 2026-07-29)

- `/admin/prices/offers` monta `CommercialOffer` em `draft` a partir de MSRP publicado e Policies
  explicitamente selecionadas do mesmo Product; nenhuma Policy é inferida ou publicada.
- O servidor recarrega preço e Policies, recalcula benefício/preço transacional sem floating point e
  persiste Offer, memberships e auditoria em uma única RPC atômica exclusiva de `service_role`.
- A migration `20260729202538_create_commercial_offer_builder.sql` foi aplicada somente no Staging
  `shfsjyjxmgwnlexmdkcs`; o teste remoto reversível de composição, reuso e isolamento passou.
- **PENDENTE:** reset local e pgTAP 011/012/013 não foram executados porque `supabase start` expirou
  antes de criar a stack. A suíte não falhou.

## Marco — Batch Policies (Sprint 9C, 2026-07-29)

- `/admin/prices/policies/input` cria lotes atômicos de até 100 `CommercialPolicy` em `draft`.
- Tipos calculados recarregam MSRP publicado e Parameter Set vigente no servidor; a RPC recalcula e
  rejeita divergência. O browser não é autoridade de valor, ator, correlation ou lifecycle.
- O lote persiste provenance em batches/rows/outputs e auditoria, sem criar Offer ou membership.
- Migrations `20260729190304` e `20260729192018` aplicadas apenas em Staging.
- **PENDENTE:** `supabase start` expirou antes de criar a stack; reset local e pgTAP 011/012 não
  foram executados. A suíte não falhou; o teste remoto reversível passou.

## Marco — Financial Reference Foundation (Sprint 9C-0, 2026-07-29)

- o MVP define spread mensal de `0,30%` e CDI mensal informado manualmente em um
  `financial_parameter_set` versionado;
- a taxa canônica é derivada no banco como CDI mensal decimal + `0.003`, sem floating point e sem
  hardcode em Policies;
- a migration forward-only adiciona proteção contra sobreposição e rollover transacional/auditado,
  preservando histórico, optimistic locking, RLS e publicação oficial;
- `manual` e `api_import` reutilizam `pricing_source_type`; integração externa continua backlog;
- CDI mensal inicial aprovado: `1,1458%`; a referência mensal resultante é `1,4458%` após somar o
  spread de `0,3000%`.
- a migration `20260729174815_add_financial_reference_foundation.sql` foi aplicada somente ao
  Staging `shfsjyjxmgwnlexmdkcs`; V1 foi publicada pelo lifecycle oficial e o rollover remoto
  reversível passou sem deixar fixture;
- **PENDENTE:** reset e pgTAP local não foram executados porque `supabase start` não criou a stack
  após a nova tentativa controlada. Não considerar esse gate aprovado.

## Marco atual — Batch Prices (Sprint 9B, 2026-07-28)

- `/admin/prices/input` recebe até 100 preços públicos manuais em grade; uma linha totalmente vazia
  é ignorada e uma linha parcial bloqueia o lote inteiro;
- cada linha válida cria `ProductPublicPrice` em `draft`; não publica, não edita preço existente e
  não cria Policy ou Offer;
- o fluxo é UI → Server Action → serviço server-only → core → repository → adapter dedicado → RPC
  `create_manual_price_batch`; UI e browser não conhecem tabelas nem recebem `actorId` como input;
- a RPC valida o payload completo antes de escrever e persiste atomicamente
  `pricing_import_batches`, `pricing_import_rows`, `pricing_import_row_outputs`, preços e auditoria;
- valores monetários atravessam as fronteiras como string decimal canônica; entradas `200000`,
  `200000,00`, `200.000` e `200.000,00` são aceitas sem `parseFloat`;
- o seletor lista todos os Products administrativos, inclusive inativos/privados, porque preço pode
  anteceder a publicação do veículo; o adapter consulta apenas os oito campos necessários;
- conflito vigente segue a unique key física `(product_id, starts_on)` e rejeita o lote inteiro;
- `source_type` continua protegido pelo enum PostgreSQL `pricing_source_type`, cuja allowlist inclui
  `manual`; a constraint removida na 9A era redundante e não foi recriada;
- Batch Policies, Offer Builder, revisão, lifecycle terminal, publicação e uploads permanecem fora
  da Sprint 9B.
- a migration `20260728220000_create_manual_price_batch.sql` foi aplicada somente ao Staging
  `shfsjyjxmgwnlexmdkcs`; validação reversível confirmou o fluxo completo e rollback sem alterar as
  contagens preexistentes.

## Marco histórico — ProductPublicPrice administrativo com draft/edit (2026-07-27)

- `/admin/prices` cria preços manuais em `draft` e edita somente `draft`, `needs_review` e
  `rejected`; `published` e `archived` permanecem somente leitura;
- o fluxo segue Server Action, serviço server-only, casos de uso do core, repository e adapter
  dedicado; ator vem do profile administrativo autenticado, nunca do cliente;
- updates filtram atomicamente ID, `lock_version` e status editável; o trigger existente incrementa
  a versão e divergências são reportadas como conflito sem overwrite;
- amount continua string decimal em reais/BRL; entrada pt-BR é normalizada sem `parseFloat`, e a
  listagem apenas oculta centavos na apresentação;
- publicação e demais transições, Offers, Policies, filtros e indicador de ambiente continuam fora
  do escopo.

## Marco atual — Pricing Domain V2 (Sprint 9A, 2026-07-28)

- `CommercialPolicy` pertence a exatamente um Product por `product_id NOT NULL`;
- Offer↔Policy é N:N por `commercial_offer_policies`, e a mesma Policy pode ser reutilizada em Offers
  do mesmo Product;
- a Offer é a fronteira exclusiva de composição de benefícios;
- toda Policy publicável é monetizada, incluindo manutenção; registro gratuito vale 1% do MSRP-base;
- Policy e Offer possuem publicação independente; publicar Offer não modifica Policy;
- batch persistente aceita origem manual, Offer possui optimistic locking e preços terminais têm
  todos os campos históricos protegidos;
- o core calcula benefício e preço transacional com centavos inteiros, sem floating point;
- a migration forward-only é `20260728120000_evolve_pricing_domain_v2.sql` e a decisão está no
  ADR-012.
- em 2026-07-28, a migration foi aplicada somente ao Staging `shfsjyjxmgwnlexmdkcs`; o backfill
  preservou 1 Offer, 1 Policy e 3 preços, criou 1 membership e deixou zero Policy sem Product.

As telas Batch Prices (9B), Batch Policies (9C) e Offer Builder (9D) permanecem fora da Sprint 9A.

## Marco histórico — ProductPublicPrice administrativo em leitura (2026-07-27)

- `/admin/prices` é a primeira fatia vertical de Pricing no Admin Next.js existente;
- `ProductPublicPriceRepository` e `ProductPublicPriceSupabaseAdapter` são dedicados e somente leitura;
- a lista é paginada no servidor, associa Product e não usa `LegacySupabaseAdapter`;
- `ends_on` é consumido como coluna opcional porque foi adicionado pela migration
  `20260726150000_add_pricing_legacy_migration_rules.sql`, apesar da formulação anterior do ADR-011;
- escrita, publicação, CommercialOffer, CommercialPolicy e `commercial_policy_applications`
  permanecem fora desta implementação.

## Marco histórico 2026-07-26 — revisão final da migration de pricing

- O fluxo futuro oficial é `publish_commercial_offer`: valida offer, product, MSRP published e todas
  as policies, publica o agregado atomicamente e audita. UPDATE direto e DELETE de offer terminal
  são bloqueados. `commercial_policy_applications` permanece somente para compatibilidade anterior.
- Rebate ausente é `NULL/NULL`. O rateio proporcional usa centavos inteiros e maiores restos;
  `free_maintenance`, voucher obrigatório e `other` legado possuem regras iguais no SQL e TypeScript.
- Os tipos compartilhados ficam em `@compra-car/contracts`; `registration` e
  `present_value_subsidy` são compatibilidade deprecated e não podem ser publicados no fluxo novo.
- As métricas distinguem ocorrências de issues, offers, policies, prices, sources e entidades. A
  migration e os testes pgTAP continuam apenas preparados, sem aplicação ou escrita no Supabase.

## Marco histórico 2026-07-26 — dealer rebate e policy types anteriores ao V2

- `total_dealer_rebate` agregado é válido no legado. A migração aloca proporcionalmente somente para
  retail, trade-in e financiamento calculáveis; componentes positivos explícitos são autoritativos.
- Ausência de base gera `UNALLOCATED_LEGACY_DEALER_REBATE`, nunca policy genérica. Resíduo monetário
  vai para a última policy na ordem determinística aprovada.
- Naquele desenho, manutenção ainda era não monetizada. O ADR-012 substituiu essa regra por valor
  fixo positivo obrigatório. Nenhum tipo novo é inferido de `others_bonus`.
- Schema permanece apenas na migration não aplicada; dry-run continua read-only e sem persistência.

## Marco histórico 2026-07-26 — pricing legacy dry-run 3.0.0

- `commercial_offer` é o agregado pai: uma por linha legacy, em draft, ligada ao MSRP versionado;
  policies e accumulators referenciam a offer, enquanto `legacy_source_id` é somente auditoria.
- `NULL/NULL/NULL` e `0/0/0` não representam financiamento. O snapshot local produz 459 policies
  financeiras completas, usando CDI mensal `0.011553487442` + spread `0.003`.
- Seguro usa 3% do MSRP por ano; IPVA usa 4% proporcional aos meses restantes. Policies alternativas
  da mesma offer são OR e somente offers com duas ou mais policies recebem accumulator.
- Diferenças contra `total_customer_benefit` são informativas por mudança de metodologia. Migration,
  backfill e publicação permanecem bloqueados e não foram executados.

## Marco 2026-07-26 — pricing legacy dry-run 2.0.0

- Regras confirmadas no simulador: rebates são contribuição da concessionária vinculada à política,
  IPVA é proporcional aos meses restantes do ano e políticas da mesma oferta começam como OR em
  draft com origem `legacy_default`.
- CDI provisório: 14,78% efetivos a.a., convertido para taxa mensal composta em parameter set
  versionado. O benefício oficial de financiamento preserva `present_value_subsidy`; total pago é
  diagnóstico comparativo.
- Zero é valor informado e `NULL` é ausência. Hashes 2.0.0 não são diretamente comparáveis aos 1.0.0.
- Backfill, publicação e aplicação da migration permanecem bloqueados até revisão dos relatórios e
  validation samples do snapshot local.

## Propósito

O Compra Car apoia vendedores de concessionárias em comparações claras entre veículos durante o atendimento e na geração futura de material compartilhável.

## Escopo do MVP

- experiência mobile-first e online;
- catálogo baseado nos dados existentes no Supabase atual;
- seleção de 2 ou mais veículos;
- comparação por linhas normalizadas, diferenças e vantagens auditáveis;
- geração e compartilhamento futuro de PDF com aviso legal;
- identidade visual flexível por marca;
- nenhuma nova carga do Excel ou reestruturação ampla do banco como pré-requisito.

## Tecnologias vigentes

- monorepo com pnpm 10 e Turborepo 2;
- Next.js 15, App Router, React 19 e TypeScript 5;
- Tailwind CSS 4, ESLint 9 e Prettier 3;
- Vitest 4 para testes unitários do domínio;
- Railway com configuração em `railway.json`;
- PWA instalável em modo `standalone`, sem service worker ou offline;
- Supabase atual como fonte inicial de dados via adaptador server-only; as escritas administrativas
  aprovadas ficam restritas a essa fronteira;
- Supabase Auth integrado por `@supabase/ssr`, com cookies e clients Auth separados do adapter legado;
- domínio administrativo documentado em `docs/admin`;
- uma única aplicação Next.js como arquitetura-alvo para as áreas `seller` e `admin`;
- Appsmith preservado somente como referência histórica, sem novas implementações.

## Estrutura arquitetural

```text
apps/web                     aplicação Next.js com seleção e comparação implementadas
packages/contracts           DTOs e contratos públicos
packages/core                domínio, portas e casos de uso puros
packages/adapter-supabase    adaptador server-only; leitura pública e escrita administrativa aprovada
packages/shared              utilitários genéricos
packages/ui                  primitivos visuais futuros
```

Direção de execução vigente:

```text
Next.js → contratos/casos de uso → portas do core ← Legacy Supabase Adapter ← Supabase atual
```

O frontend não pode conhecer tabelas, colunas, queries ou particularidades do Supabase legado. `LegacySupabaseAdapter` é a única fronteira autorizada e implementa as portas do core por DTOs e mappers explícitos.

## Domínio consolidado

### Vehicle

`Vehicle` é uma combinação comercial específica de `brand`, `model`, `version`, `modelYear` e `productionYear`. Também contém `id`, `displayName`, `isActive` e `isPublic`.

Um veículo integra o catálogo público somente quando:

1. `isActive = true` — vigência comercial;
2. `isPublic = true` — revisão e liberação editorial;
3. possui ao menos um item comparável com valor válido conforme a semântica confirmada de `product_specs`.

Esses estados não podem ser confundidos.

### ComparisonItem

- `code` obrigatório e estável identifica uma linha independente;
- `binary`, `numeric` e `scale` são os tipos suportados;
- `scale` usa presença independente no MVP;
- dois codes do mesmo `specSet` continuam em duas linhas;
- não existe cardinalidade `single`/`multiple` nesta fase;
- categories e prefixes de origem não determinam a arquitetura.

### Valores

- `binary`/`scale`: `present: boolean | null`;
- `numeric`: `value: number | null` e `unit: string | null`;
- numeric ausente nunca vira zero;
- associação binary/scale ausente resulta em `null`; somente a comparação `binary` a equipara temporariamente a `false`;
- o domínio não formata `Sim`, `Não` ou travessão.

## Casos de uso implementados

- `ListAvailableBrands`;
- `ListAvailableModels`;
- `ListAvailableVehicles`;
- `GetVehiclesByIds`;
- `CompareVehicles`.

`CompareVehicles` aceita 2 ou mais IDs distintos, preserva a ordem, usa o primeiro como referência, completa células tipadas e calcula o resultado contra todos os concorrentes. `binary` usa presença explícita e temporariamente equipara `null` a `false` apenas ao comparar; `numeric` usa direção positiva/negativa e `scale` não é classificado.

## Decisões registradas

- ADR-001: cada `ComparisonItem.code` representa uma linha.
- ADR-002: itens `scale` não têm cardinalidade no MVP.
- ADR-003: o frontend não acessa o banco legado diretamente.
- ADR-004: `isActive` e `isPublic` têm significados distintos.
- ADR-005: decisão histórica de postergar autenticação, substituída pelo ADR-008.
- ADR-006: o legado é traduzido por DTOs/mappers em um adaptador server-only e somente leitura.
- ADR-008: Supabase Auth, cookies SSR, roles `admin`/`seller` e status `pending`/`active`/`disabled`; a fundação SQL de profiles usa `seller`, foi aplicada pela primeira vez no projeto remoto auditado e passou pela validação estrutural e pelo teste pgTAP.
- ADR-007: registro histórico da adoção do Appsmith na Fase 1, posteriormente substituída parcialmente pelo ADR-010.
- ADR-010: uma única aplicação Next.js contém as áreas `seller` e `admin`; `admin` também acessa `seller`; o Supabase é compartilhado e o Appsmith deixa a arquitetura-alvo.
- ADR-009: preços públicos e políticas comerciais são conceitos separados; o legado misto permanece
  temporariamente.
- ADR-011: detalha o modelo alvo com preço por produto/data, política com valor congelado por
  aplicação/produto, acumuladores explícitos, parâmetros financeiros versionados, imports
  revisáveis, auditoria, RLS e migração incremental forward-only. Cada aplicação separa
  `input_monetary_value` opcional do `monetary_value` final obrigatório e congelado.
- O resultado distingue vantagem, desvantagem, empate, informação desconhecida e item não aplicável.
- Apenas vantagens da referência são destacadas nesta versão.
- O MVP usa o Supabase atual sem depender de nova carga do Excel.
- O importador Excel será ajustado posteriormente à estrutura vigente.

## Restrições vigentes

- não alterar `Legacy` sem autorização e auditoria;
- manter a inspeção inicial do Supabase somente leitura;
- não implementar ou presumir schema físico sem evidência real;
- não expor chaves, tokens ou segredos;
- não acessar Supabase fora do adaptador legado;
- não colocar regras de negócio em `shared` ou na UI;
- não implementar novas regras de vantagem sem documentação;
- não confundir a fundação Auth implementada com os fluxos ainda ausentes de convite, recuperação de senha e gestão de usuários;
- não usar `user_metadata` como fonte de privilégios nem permitir promoção automática para `admin`;
- não fazer o Middleware consultar o banco ou assumir que RLS é a única barreira administrativa;
- não iniciar novas implementações no Appsmith nem remover seus artefatos ou integrações sem decisão específica;
- não implementar PDF ou offline nesta fase concluída.

## Estado atual — 2026-07-25

A infraestrutura do monorepo, o núcleo de domínio, o adaptador legado e os vertical slices de seleção e comparação estão implementados. `packages/core` contém entidades, value objects, erros, portas e casos de uso, inclusive Create/Update administrativos. `packages/contracts` contém aliases, reexportações e DTOs públicos sem duplicação estrutural. `packages/adapter-supabase` implementa as portas de leitura sobre `products`, `specs`, `product_specs` e `unit_conversions` e restringe as escritas administrativas aprovadas a `products` e `product_specs`. `apps/web` conecta seleção, comparação e administração aos casos de uso por camada server-only e composition root.

A fundação Auth está implementada. `@supabase/ssr` mantém a sessão em cookies; o Middleware renova a sessão e redireciona usuários não autenticados; páginas e Server Actions repetem a validação no servidor. `/login` usa e-mail/senha e redirect interno seguro, e o logout é server-side. `public.profiles` é a fonte de role/status; `admin` também acessa a área `seller`; profile ausente, não ativo ou inválido falha fechado.

A baseline legada de 2026-07-24 não capturou o trigger cruzado instalado em `auth.users`, embora
tenha preservado os objetos públicos de profiles. A migration incremental
`20260724235959_restore_auth_profiles_after_baseline.sql` deve executar depois da baseline: ela
restaura o trigger de criação segura do profile e reconcilia funções, triggers públicos,
constraints, foreign keys, RLS, policies e privilégios sem alterar dados válidos. Alterações futuras
na baseline gerada continuam proibidas; correções devem permanecer forward-only.

O MVP-a possui shell administrativo persistente em `/admin/*`, sidebar desktop, menu mobile,
navegação, visão geral e `/admin/products`. A listagem de veículos é server-rendered e usa
`LegacySupabaseAdapter.listAdministrativeVehicles()` após `requireRole('admin')`.
`/admin/products/new` implementa a criação exclusiva do registro principal em `products`, com
normalização e validação puras no core, selects dependentes de anos, checagem normalizada de
duplicidade, payload explícito no adapter, Server Action autorizada e diálogo de sucesso.
`/admin/products/[id]/edit` carrega o produto server-side, reutiliza o formulário e as regras do
Create, exclui o próprio ID da checagem de duplicidade e persiste apenas os sete campos editáveis.
Como a inspeção do banco não encontrou trigger de aplicação, a atualização define `updated_at`
explicitamente no adapter.
`/admin/products/[id]/duplicate` carrega o produto server-side e inicia um novo Create com os sete
campos preenchidos, sem expor o ID original como campo editável. `DuplicateAdministrativeVehicle`
reutiliza o Create e copia todas as associações `product_specs` para o novo ID, preservando numeric,
binary `true`/`false`, scale e `input_unit`. Preços, imagens, documentos e histórico não são
copiados. Falha da ficha impede sucesso e aciona compensação restrita ao novo produto; sem
RPC/migration, criação, cópia e compensação não formam uma transação única.
`/admin/products/[id]/specs` carrega todos os specs ativos e associações do produto, monta no core
uma ficha por hierarquia real e salva numeric, binary e scale em lotes. Torque aceita Nm/kgfm, usa
`unit_conversions` e persiste somente Nm; `PW_0036` permanece `kg/Nm`. Binary administrativo usa
`boolean | null`: associação ausente permanece não informada e não conta, enquanto `true` e `false`
explícitos contam e são preservados. Não houve migration. A atomicidade estrita entre upsert e
delete e a exibição kgfm no MVP-u permanecem evoluções futuras.
`/admin/products` transporta filtros por search params e os aplica server-side no adapter, com
sticky acumulado no desktop e oferece ações Editar e Duplicar por linha. Não existem exclusão,
cadastro de equipamentos ou preços.

A Sprint 9 começou com investigação somente leitura. O inventário em
`docs/data/PRICE_AND_COMMERCIAL_POLICY_INVENTORY.md` confirma que o comparador MVP-u Next.js ainda
não lê preço: seu fluxo termina em `products`, `product_specs` e `specs`. A página histórica
`Análise de Valor` do Appsmith é o único consumidor localizado de
`vw_product_value_current.public_price`; não há CRUD de preço/política no MVP-a.

Na fotografia remota somente leitura de 2026-07-25 existem 292 produtos e 746 linhas em
`product_price_offers`, com 287 produtos cobertos, duas duplicidades produto/mês, um preço zero,
nenhum preço nulo/negativo e meses de junho de 2025 a abril de 2026. Os 746 registros compartilham
o mesmo `created_at`, embora a view “current” ordene por esse timestamp. O modelo mistura MSRP e
política, não possui vigência completa, RLS/policies ou índices temporais, e mantém grants amplos.
A arquitetura da Sprint 9 foi aceita no ADR-011 e detalhada em
`docs/data/PRICE_AND_POLICY_TARGET_SCHEMA.md`, `docs/data/PRICE_AND_POLICY_MIGRATION_PLAN.md` e
`docs/data/PRICE_AND_POLICY_CALCULATION_RULES.md`. O alvo preserva o legado e separa
`product_public_prices`, políticas, aplicações com valor BRL congelado por produto, acumuladores,
parâmetros CDI/spread versionados, importação/revisão e auditoria. Preço não armazena fim: o próximo
`starts_on` encerra o período anterior. Política isolada é sempre válida; apenas acumulador publicado
autoriza soma. IA/API entram em draft/needs_review e nunca publicam.

A revisão final pré-migration diferencia input monetário e resultado econômico. Bônus de varejo,
trade-in, wallbox e `other` persistem input por aplicação e congelam o mesmo valor como resultado;
seguro, IPVA, emplacamento e financiamento mantêm input monetário nulo e calculam o resultado. Os
oito tipos iniciais permanecem enum; tipos administráveis não pertencem ao MVP e benefícios novos
usam `other + manual_amount`. Zero só pode permanecer em draft/needs_review; ausência de preço
publicado é ausência de registro. CDI/spread sem fonte/governança final não bloqueiam tabelas ou
drafts, mas impedem publicar `subsidized_financing` sem parameter set manual versionado e published.

A primeira etapa estrutural foi versionada em
`supabase/migrations/20260725172755_create_pricing_types_and_core_tables.sql`: cinco enums e sete
tabelas centrais, com constraints locais e índices, sem dados, backfill, views, RLS, policies,
grants específicos, funções ou triggers. `source_import_row_id` permanece sem FK até a migration de
importação.

`supabase/migrations/20260725175159_secure_pricing_core_schema.sql` protege exclusivamente esse
core: RLS está habilitado nas sete tabelas, `public`/`anon`/`authenticated` não possuem ACLs nas
tabelas ou nas seis sequences identity e nenhuma policy foi criada. `service_role` possui somente
SELECT/INSERT/UPDATE nas tabelas e USAGE/SELECT nas sequences, sem DELETE, TRUNCATE, REFERENCES,
TRIGGER, MAINTAIN ou UPDATE de sequence. As duas migrations foram aplicadas por
`db reset --local --no-seed`
e a suíte SQL completa passou localmente com 129 testes; nenhum banco remoto foi acessado ou
alterado. Importação/auditoria, validações transacionais, cálculos, views e backfill continuam
pendentes e separados.

Os default privileges globais da baseline permanecem inalterados e ainda concederão ACLs amplas a
objetos futuros criados por `postgres`. Cada migration futura no schema `public` deve revogar
explicitamente os privilégios herdados de seus próprios objetos, sem depender desta proteção do
core e sem alterar defaults de outros domínios.

`supabase/migrations/20260725180750_create_pricing_import_and_audit_tables.sql` adiciona os quatro
enums e as cinco tabelas de batches, rows, outputs, revisão humana e auditoria, além das três FKs
RESTRICT adiadas de `source_import_row_id` para `pricing_import_rows`. A mesma migration habilita
RLS, remove ACLs de browser e concede ao `service_role` SELECT/INSERT/UPDATE nas quatro tabelas
operacionais e somente SELECT/INSERT na auditoria append-only; sequences recebem USAGE/SELECT.
Nenhuma policy, função, trigger, view, backfill ou dado foi criado. `pricing_audit_action.update`
representa correção auditável e exige `reason`, assim como reject/archive. O reset local e os 176
testes SQL passaram; nenhum ambiente remoto foi acessado.

`supabase/migrations/20260725182545_create_pricing_lifecycle_and_audit_triggers.sql` adiciona quatro
funções `SECURITY INVOKER` e 23 triggers para lifecycle e proteção de estados terminais. Sete
tabelas passam a manter `updated_at` e incrementar `lock_version` exatamente uma vez por update;
auditoria é append-only inclusive contra DML do owner; registros published/archived/promoted não
podem regredir para estado mutável nem ser apagados e seus campos econômicos, materiais ou de origem
ficam congelados. Aplicações e
filhos de acumulador respeitam o estado do pai. As funções usam `search_path = ''` e tiveram
`EXECUTE` direto revogado de `public`, `anon`, `authenticated` e `service_role`, sem impedir a
execução indireta pelos triggers. Não foi criado writer genérico de auditoria, publicação,
cálculo, view, policy, backfill ou bypass de sessão. Reset limpo e 219 testes SQL passaram somente
na stack local; nenhum ambiente remoto foi acessado.

`supabase/migrations/20260725184656_create_pricing_validation_and_publication_functions.sql` cria
quatro funções transacionais `SECURITY DEFINER` para publicar preço público, parameter set, política
e acumulador. Somente `service_role` recebe `EXECUTE`; cada chamada trava a linha, valida
`lock_version`, correlation ID e `p_actor_id` consultando `profiles` com `role = admin` e
`status = active`, executa todas as mutações antes do status terminal e grava auditoria na mesma
transação. Seis helpers `SECURITY INVOKER` permanecem sem execução operacional direta. Um trigger
impede publicação direta pelo `service_role` sem variável de sessão, e outro protege rows de batches
promovidos/arquivados, outputs de rows promovidas e reviews append-only.

Políticas publicadas usam `scope_snapshot` v1 com `productIds` numéricos, distintos e exatamente
iguais às aplicações. Os oito tipos são validados por método, input, MSRP publicado, parameter set e
snapshot. Cálculos usam `numeric`, HALF_UP em centavos e tolerância máxima de `1e-10` apenas para
intermediários não arredondados; financiamento preserva principal, PMT, taxa de referência, PV e
versão dos parâmetros. Acumuladores calculam `policy_ids:<ids ordenados>`, materializam apenas a
interseção de produtos e somam valores já congelados. Reset limpo e 293 testes SQL passaram somente
na stack local; não foram criadas views, backfill, seed financeiro real, promoção automática ou
acesso de browser, e nenhum ambiente remoto foi acessado.

`supabase/migrations/20260725191747_create_pricing_read_views.sql` cria cinco views server-only com
`security_invoker = true`: períodos publicados, preço vigente, aplicações de políticas vigentes,
valores materializados de acumuladores e `vw_product_value_current_v2`. ACLs herdadas foram
revogadas de `public`, `anon`, `authenticated` e `service_role`; somente SELECT foi concedido ao
`service_role`. A v2 preserva nomes, ordem e tipos das oito colunas legadas, usa o novo preço atual e
mantém o cálculo legado de `perceived_value_total` sobre specs, pois não há equivalente seguro no
novo modelo. `vw_product_value_current` permaneceu inalterada. Reset limpo e 326 testes SQL passaram
somente localmente; não houve backfill, troca de consumidor ou acesso remoto.

O pacote `@compra-car/pricing-dry-run` implementa a inspeção pré-backfill sem migration e sem escrita
no banco. Aceita URL PostgreSQL local explícita, output, versão do algoritmo, cutoff e modo estrito de
mudança de fotografia; rejeita hosts/portas fora da stack local e confirma transação `REPEATABLE READ
READ ONLY`. Classifica preços, componentes e sugestões de combinação com `decimal.js`, hashes
canônicos e 16 issue codes, sem desempate por `created_at`, sem converter rebates ou publicar
acumuladores. Gera dez artefatos JSON/CSV/README. A fixture produziu 5 candidatos de preço, 1
conflito, 9 candidatos de política, 1 sugestão de acumulador e 11 itens de revisão. O banco local
recriado sem seed permaneceu com todas as fontes em zero e status `SOURCE_CHANGED`; isso valida a
ferramenta, não substitui o dry-run futuro sobre uma fotografia local autorizada do legado real.

`scripts/pricing/export-pricing-legacy-snapshot.ps1` é a única automação autorizada a receber origem
remota. Ela valida URL/allowlist, exige `-ConfirmRemoteExport`, confirma uma transação remota
read-only, gera dump custom data-only temporário das sete tabelas permitidas, exclui e recusa
`SEQUENCE SET`, calcula SHA-256, chama o validador existente e só então publica snapshot e manifesto
sanitizado. Prefere `psql`/`pg_dump` locais e usa `docker run postgres:17` como fallback. O Session
Pooler na porta 5432 é o caminho documentado quando a conexão direta IPv6 falha.

O snapshot real `legacy-pricing.dump` foi validado manualmente em 2026-07-26: formato
`postgres-custom`, 262858 bytes, sete tabelas, SHA-256
`ad982044e1c93dc98e47f180a128d6d7d088fa4ecb0a8c05d88ddd6c6cc0648c`, status `VALIDATED`. Ainda
não houve restore, pricing dry-run real nem alteração do banco local. Os demais scripts mantêm o
alvo exclusivamente local, validam allowlist/hash/conteúdo e encadeiam restore confirmado com o
dry-run, sem bypass remoto, backfill, migration ou publicação no domínio da Sprint 9.

Desde 2026-07-26, `PricingSnapshot.Common.psm1` centraliza a execução dos clientes PostgreSQL. Cada
cliente encontrado localmente permanece prioritário; na ausência, o fluxo usa `docker exec` no
container configurado por `-PostgresContainer` (default `supabase_db_compra-car`) somente depois de
confirmar existência, estado `running` e health `healthy`. O dump é transmitido por `stdin`, sem
cópia para o container, e `PGPASSWORD` é propagado pelo ambiente sem expor seu valor. A porta local
autorizada é confirmada no mapeamento publicado e traduzida para a porta interna somente no
namespace do container. Validações, allowlist, fluxo operacional, relatórios, hashes e manifesto
permanecem inalterados.

A URL de comparação é `/comparar?vehicles=id1,id2[,id3,...]`. A página valida IDs, preserva sua ordem, executa `CompareVehicles`, apresenta categorias e usa `hasReferenceAdvantage` no filtro “Ver destaques”. A UI usa uma única superfície tabular com cabeçalho e primeira coluna fixos, rolagem bidirecional, células com slot estável para checks e estados dedicados de loading, vazio e erro. O domínio e o adapter não conhecem componentes ou parâmetros de URL.

Os testes do core usam repositórios in-memory. Os mappers do adaptador são testados sem rede e a integração real é opt-in por variáveis exclusivas. A UI de negócio e `Legacy` permanecem sem alteração nesta fase.

`supabase/tests/spec_integrity.sql` protege o domínio de Specs com pgTAP, sem DML ou DDL explícito
sobre tabelas permanentes. `SET TRANSACTION READ ONLY` não é usado porque `plan()` pode criar
objetos temporários internos; a execução depende da transação automática revertida por
`supabase test db` e mantém `ROLLBACK` explícito. A suíte lista violações de scale, binary, codes,
referências de `product_specs`, duplicidades, tipos, numeric, identidade estrutural do catálogo e
coerência de tipo por `spec_set`, além de emitir um resumo agregado sem modificar dados permanentes.

A superfície mínima e o mapeamento físico fornecidos para a fase estão registrados em `SUPABASE_INSPECTION_RESULTS.md` e `LEGACY_SUPABASE_MAP.md`. A validação online permanece pendente quando não houver credenciais opt-in e não bloqueia o código ou o MVP.

A arquitetura de autenticação e autorização está em `docs/architecture/AUTHENTICATION_ARCHITECTURE.md`. A migration `20260721222256_create_auth_profiles.sql` foi aplicada uma única vez no projeto remoto Compra Car App, onde `auth.users` e `public.profiles` estavam vazios. Enums, tabela, functions, triggers, policies, RLS e grants foram validados; o teste `supabase/tests/001_auth_profiles.test.sql` passou após a habilitação exclusiva de pgTAP, com rollback das fixtures. Todo usuário novo nasce `seller`/`pending`; nenhuma promoção a `admin` é automática. MFA, `audit_log`, convites, recuperação de senha e gestão de usuários continuam futuros.

O trabalho histórico do Appsmith possui export auditado e implementação parcial: `Admin Modelos` lista produtos, altera atividade e duplica; `Análise de Valor` contém consultas de análise. Essa implementação não é mais o backoffice oficial e não receberá novas mudanças. Criação e edição geral estão implementadas no Next.js; `product_specs`, preços e demais fluxos administrativos continuam pendentes. As regras permanecem descritas como domínio em `docs/admin`.

O export histórico do Appsmith permanece versionado em `appsmith/exports/Compra Car App MVP.json` e foi auditado sem alteração do original. Ele contém três páginas, 27 widgets, 11 actions PostgreSQL, um datasource e nenhum JS Object. Esses artefatos são evidência histórica, não plano executável. Integrações existentes não serão removidas até que seus consumidores e riscos sejam auditados.

## Próximos passos

1. Executar o teste de integração opt-in no ambiente autorizado.
2. Validar cobertura e desempenho com 2 ou 3 veículos reais.
3. Comparar este clone com o `C:\Dev\compra-car` do outro notebook.
4. Avaliar com o negócio as três divergências estruturais de specs encontradas na Sprint 5.
5. Implementar Sprint 9B Batch Prices, 9C Batch Policies e 9D Offer Builder sobre o ADR-012.
6. Concluir MVP e piloto; depois evoluir dados, importador e arquitetura gradualmente.

## Registro histórico — Sprint 1 de Gestão de Produtos no Appsmith (planejamento em 2026-07-22)

O inventário e o plano histórico da Sprint 1 estão em `docs/admin/SPRINT_1_PRODUCT_MANAGEMENT.md`. O export JSON nativo `appsmith/exports/Compra Car App MVP.json`, recebido em 2026-07-22, contém três páginas, 27 widgets, 11 actions PostgreSQL, um datasource e nenhum JS Object. A auditoria não encontrou credencial preenchida; o hostname Supabase foi tratado como metadado de infraestrutura. `Admin Modelos` lista produtos, altera `is_active` e duplica por `duplicate_product_simple`, mas não implementa criação, edição geral nem `product_specs`. As páginas funcionais aparecem apenas como rascunho no pacote.

Esse plano foi superado pelo ADR-010 e não deve ser executado no Appsmith. Seu conteúdo permanece preservado para apoiar o futuro mapeamento de requisitos, riscos e regras para a área `admin` do Next.js.

O escopo da Sprint 1 fica limitado a `products` e `product_specs`, usando `specs` somente como master de metadados e regras de Market Value. Não haverá manutenção de `specs`, `unit_perceived_value` ou `relative_value`, nem Preços, Comparador ou Exportação Excel. O export confirma o nome `duplicate_product_simple`, mas não a sobrecarga porque a action não usa casts; permanece recomendada a chamada explícita `duplicate_product_simple(integer, smallint, smallint, boolean)`, que copia produto e specs sem copiar preços/políticas.

## Backlog pós-MVP

- cardinalidade explícita `single`/`multiple`;
- agrupamento visual opcional de itens `scale`;
- validação de combinações incompatíveis;
- evolução da taxonomia de categorias;
- substituição futura do importador Excel;
- revisão dos prefixes legados;
- evolução e versionamento das regras de vantagem;
- estados detalhados de equipamentos, qualidade e rastreabilidade.

## Pendências

- **PENDENTE:** validação online opt-in e cobertura quantitativa do Supabase atual.
- **PENDENTE:** texto jurídico final.
- **PENDENTE:** marca e participantes do piloto.
- **PENDENTE:** identidade visual autorizada.
- **CONFIRMADO COM RESSALVAS:** o legado usa `product_price_offers.public_price` e `offer_month`,
  misturando MSRP e política; moeda, vigência completa e regra de preço atual permanecem pendentes.
- **CONFIRMADO:** ADR-011 define BRL, preço por `product_id + starts_on`, fim derivado, políticas
  isoladas, aplicações monetárias por produto, acumuladores explícitos e revisão humana obrigatória.
- **PENDENTE:** fonte/convenção do CDI mensal, spread inicial, regra regional de emplacamento,
  correção de preço publicado e escopo futuro por canal/região/concessionária.
- **CONFIRMADO:** pendências de CDI/spread não bloqueiam migrations estruturais; bloqueiam somente a
  publicação real de financiamento subsidiado até existir parameter set revisado e published.
- **PENDENTE:** coluna e semântica do valor monetário master de specs.
- **CONFIRMADO:** export e estrutura históricos do Appsmith, inventariados em `docs/admin/SPRINT_1_PRODUCT_MANAGEMENT.md`.
- **PENDENTE:** mapear consumidores e dependências das integrações históricas antes de eventual remoção.
- **CONFIRMADO:** índice único exato `unique_product` na chave de negócio de veículos; proteção
  normalizada contra concorrência com variações de caixa/espaços permanece pendente.
- **CONFIRMADO COM RESSALVAS:** auditoria remota somente leitura inspecionou 59 `numeric`, 171
  `binary` e 26 grupos `scale`; encontrou divergências `detail != spec_set` em `CO_0044`, `CO_0045`
  e `PW_0042`, sem duplicidade de `detail` nos grupos `scale` nem identidade ausente.
- **PENDENTE:** confirmar como `product_specs.is_present = false` afeta presença, validade e comparabilidade.
- **PENDENTE:** para `getVehiclesByIds`, a rodada Auth mantém elegibilidade restrita a `is_active = true` e `is_public = true`; decidir em `/admin/products` e no catálogo se a consulta por IDs também exigirá specs ativas.
- **CONCLUÍDO:** migration de profiles aplicada e validada no projeto remoto auditado, incluindo pgTAP e rollback das fixtures de teste.
- **PENDENTE:** auditar grants/RLS do catálogo legado e formalizar o runbook operacional de usuários administrativos.

## Marco 2026-08-22 — primeiro Unit Extraction real da Sprint 10C.4D

O Job 44/attempt 7 do batch 117 avançou por Document Map e Unit Plan succeeded e criou plano de 18
units, mas terminou em `UNIT_EXTRACTION_INVALID_STRUCTURED_OUTPUT` sem Unit Extraction artifact ou
row. A unit 2 observada como `PROVIDER_TIMEOUT/APIUserAbortError` era compatível com aborto sibling; a
ordem do error mapping foi corrigida e coberta por regressão concorrente. O timeout de 120 s permanece.

Unit Extraction agora aceita IDs locais model-owned no transport, canonicaliza todos os namespaces e
referências no servidor e só então aplica o schema/invariantes canônicos inalterados. Diagnóstico local
opt-in informa unit, ordinal, fase, paths, keywords, categorias, total e truncation sem conteúdo bruto.
Persistência de sibling succeeded e contabilização de usage/providerRunId antes de uma falha continuam
**PENDENTE** para retry granular. Gate local: **READY FOR UNIT EXTRACTION DIAGNOSTIC RETRY**; não houve
retry, OpenAI, escrita no Staging, migration, acesso a Production ou alteração em `Legacy`.
# Marco 2026-07-30 — Sprint 9E

- Homologação de Pricing estabilizada no código: DTOs RSC são plain objects, numeric do PostgREST é
  convertido na borda para decimal string e as três telas usam o mesmo combobox de Product.
- Auth diferencia ausência real de sessão de indisponibilidade técnica e possui timings DEV-only;
  autorização read-only é deduplicada por renderização, mantendo revalidação nas Server Actions.
- Staging autorizado: `shfsjyjxmgwnlexmdkcs`. Não houve migration, acesso a Produção ou alteração em
  `Legacy`. Smoke autenticado ainda depende de credencial/sessão administrativa fornecida externamente.
## Marco — combinação de políticas (Sprint 9F, 2026-07-31)

O Offer Builder opera em lote por `create_commercial_offer_batch`. MSRP, `valid_from=max(starts_on)` e `valid_to=min(ends_on não nulo de Policies/MSRP)` são autoritativos no servidor. Neste marco histórico, tudo aberto ainda era erro; a Sprint 9G.4 posteriormente tornou `valid_to` nullable para drafts. Qualquer erro desfaz o lote. `loyalty_bonus` é um tipo corrente fixo distinto.
## Marco — refinamento da combinação (Sprint 9F.1, 2026-07-31)

O trigger terminal compartilhado separa estruturalmente o branch exclusivo de
`financial_parameter_sets`, evitando acesso a `valid_to`/`effective_from` em outras tabelas sem
relaxar imutabilidade terminal ou rollover. Naquele momento, a Sprint 9G ainda implementaria consulta
e gestão de Policies e combinações; o marco foi concluído posteriormente conforme registrado abaixo.

## Marco — Sprint 9G (2026-07-31)

O Admin passa a operar Pricing por Product em um workspace único. Quatro RPCs auditadas administram
edição/arquivo de Policies e substituição/arquivo de Offers com controle otimista. Policies usadas
por Offers não arquivadas não podem ser alteradas ou arquivadas. Não há DELETE nem supersession.
Publicação de preço reutiliza `publish_product_public_price`. A etapa seguinte é importação assistida
por IA com revisão e aprovação humana antes da persistência.

A migration administrativa foi aplicada somente ao Staging `shfsjyjxmgwnlexmdkcs`, registrado pelo
Supabase como `20260731172651_sprint_9g_administrative_pricing_workflow`. O pgTAP 016 passou com 16
asserções dentro de transação revertida; a verificação posterior encontrou zero fixture e zero evento
de auditoria residual. Produção e `Legacy` permaneceram intocados.

## Marco — Sprint 9G.1 (2026-07-31)

O grid de Policies não chama mais callbacks do pai dentro de updater funcional de estado. Linhas de
apoio vazias são descartadas antes do envio, enquanto linhas parciais são validadas. Saves bem-sucedidos
revalidam o servidor, executam `router.refresh()` e recompõem a matriz para o Product ainda selecionado.
Labels curtos vêm de `MANUAL_POLICY_DISPLAY_LABELS`. A pilha sticky de Pricing usa
`--admin-topbar-height` e `--admin-page-header-height` como offsets compartilhados.

O Staging confirmado `shfsjyjxmgwnlexmdkcs` possui agora 10 Products. Os IDs 610–617 são oito
veículos reais originados de `Legacy/products.csv`, carregados de forma idempotente por
`scripts/staging/07-expand-admin-dataset.sql`, com 6 preços, 8 Policies, 1 Offer e 2 memberships.
Nenhum dado anterior foi apagado ou arquivado; Produção não foi alterada.
## Sprint 9G.2 — rollover de preço publicado

`publish_product_public_price` serializa por `product_id` e, ao publicar em D, encerra o único
predecessor publicado sobreposto em D-1. A alteração de `ends_on` continua bloqueada fora da RPC,
gera auditoria `update` correlacionada e incrementa o lock. Publicação retroativa quando já existe
preço publicado em D ou depois é rejeitada; múltiplos predecessores sobrepostos não são escolhidos
automaticamente. A RPC `rollover_product_public_price` é o caminho administrativo controlado para
reparar um par predecessor/sucessor já publicado.
## Sprint 9G.3 — UX administrativa estabilizada

A lista de preços ordena no banco por `updated_at DESC` por padrão e aceita sort/direção na URL.
Server Actions de batch retornam somente DTO JSON simples. O workspace comercial preserva o Product
selecionado após refresh, mostra sucesso explícito e mantém N combinações preenchidas mais uma linha
vazia trailing. Publicação múltipla e exclusão física de Policy continuam **PENDENTE**: ambas exigem
RPCs administrativas novas antes de qualquer frontend.
## Sprint 9G.4 — vigência aberta de Offers

Offers `draft` podem ter `validTo = null`. A derivação usa o maior início das Policies e o menor fim
não nulo entre Policies e MSRP; ausência de fins significa vigência aberta. Batch e replace são
atômicos, e duplicidade compara `NULL` com `IS NOT DISTINCT FROM`. `publish_commercial_offer`
revalida o agregado e bloqueia Offers abertas com erro funcional até nova decisão de lifecycle.

O checkpoint das Sprints 9G–9G.4 encerra o workflow atual após validação manual. As migrations foram
aplicadas somente ao Staging; Produção e `Legacy` permanecem intocados. Refinamentos posteriores de
UX para a operação mensal de Prices, Policies e Offers continuam pendentes e fora deste checkpoint.
## Marco — operação mensal de Policies (Sprint 9H, 2026-08-01)

O workspace comercial opera por Product, competência em `YYYY-MM` e data-base. Competência é apenas
contexto de URL; as datas de domínio continuam `starts_on`/`ends_on`. A leitura usa interseção mensal,
histórico limitado e matriz elegível na data-base.

`create_manual_policy_batch_with_rollover` encerra, cria e audita numa única transação. O predecessor
não terminal/`published` do mesmo tipo recebe D−1 com `lock_version`; futuro, sobreposição, estado
stale ou Offer não arquivada incompatível rejeitam tudo. `archived`/`rejected` não participam.
A migration foi aplicada somente ao Staging; Produção não foi tocada.

Na investigação 9H.1, o rollover da Taxa #66 do Product 616 para `2026-09-01` foi reproduzido em
transação revertida. O benefício calculado para 24 meses, taxa mensal de 0,49% e entrada de 60%
foi R$ 8.186,01; a RPC rejeitou com SQLSTATE `55000` porque as Offers #26 e #28 ainda dependem da
predecessora. A UX expõe esses IDs e o correlation ID e não altera lifecycle automaticamente.

A prévia do grid usa o Product fixado pelo workspace e as mesmas funções puras do envio. O
cabeçalho mensal é 2×2, a competência usa dropdown N−6/N+6 e Offers existentes/novas ocupam a
mesma matriz. Drafts podem substituir memberships pela RPC existente; published/archived são
somente leitura. Nenhuma migration ou RPC adicional foi necessária na 9H.1.
