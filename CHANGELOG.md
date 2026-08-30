# Changelog

## 2026-08-30 — Refinamento dos formulários de veículo (Sprint 14H)

- alinha Novo e Editar Veículo à surface, campos, labels e hierarquia de ações do design system
  consolidado, mantendo um único formulário compartilhado e largura máxima adequada;
- organiza Marca, Modelo e Versão na primeira linha desktop e Ano produção, Ano modelo, Ativo e
  Público na segunda, com controles compactos e reflow seguro em 390, 360 e 320px;
- preserva normalização, duplicidade, acoplamento Ativo/Público, validação produção/modelo, ações,
  autorização, domínio, banco, Supabase e demais fluxos funcionais;
- adiciona cobertura estrutural para geometria compartilhada, ordem dos campos, densidade responsiva
  e hierarquia action/commit.

## 2026-08-30 — Nova regeneração dos ícones PWA pelo master do usuário

- preserva byte a byte o novo `app-icon-master.png` 1134×1134, SHA-256
  `2FCA372E70FA47C6602FE6D89C987ABA3083B4193EB8B549E74AD95D811E407D`, após remoção deliberada dos
  derivados anteriores pelo usuário;
- recria os PNGs 192, 512, maskable 512, Apple 180 e icon 512 do Next exclusivamente por Lanczos3,
  com canvas integral, RGB opaco e sem crop, zoom, reposicionamento, sharpening ou IA;
- neutraliza README e teste para não dependerem de cor ou conteúdo visual de masters anteriores,
  preservando validações estruturais de formato, dimensões, alpha, paths e maskable;
- mantém manifest, metadata, filenames, comportamento PWA, auth, banco, Supabase e `Legacy`
  inalterados.

## 2026-08-29 — Derivados do master PWA atualizado pelo usuário

- preserva byte a byte o novo `app-icon-master.png` 1134×1134 fornecido pelo usuário, SHA-256
  `77D3AFEF1A8AC2D34332934D1C92E64D7233F203E926F15A62118A944E69351F`;
- regenera exclusivamente por Lanczos3, sem crop, reposicionamento, padding, sharpening ou IA, os
  derivados 192, 512, maskable 512, Apple 180 e icon 512 do Next;
- mantém todos os derivados em PNG sRGB de três canais, sem transparência, preservando canvas,
  proporções, background e safe area integrais do master;
- mantém filenames, manifest, metadata, identidade, comportamento PWA, auth, banco, Supabase e
  `Legacy` inalterados.

## 2026-08-28 — Reinstalação PWA após remoção (Sprint 14G.4)

- mantém “Instalar aplicativo” oculto somente durante execução standalone e restaura a ação quando o
  site volta a ser aberto no navegador após a remoção da PWA;
- reavalia a estratégia de instalação em `pageshow` e no retorno de visibilidade, sem gravar estado
  permanente de instalação ou recusa;
- preserva o prompt nativo quando `beforeinstallprompt` existe e usa as instruções compartilhadas no
  Android/Chromium, iOS/iPadOS e Chromium desktop quando o evento não está disponível;
- mantém onboarding pós-convite, posição/densidade/acessibilidade do User Menu, manifest, metadata,
  ícones, standalone, auth, Supabase, banco e demais domínios inalterados.

## 2026-08-28 — Instalação pelo menu da aplicação (Sprint 14G.3)

- adiciona “Instalar aplicativo” antes de “Sair” no menu do usuário somente quando há prompt nativo
  ou orientação manual útil, mantendo a densidade e os touch targets existentes;
- reutiliza `usePwaInstall` para prompt Chromium, detecção standalone/iOS/iPadOS e fallback mobile,
  sem duplicar listeners ou estado de instalação;
- extrai as instruções compactas compartilhadas pelos entry points pós-convite e User Menu e oculta
  a ação em standalone ou desktop sem suporte;
- preserva onboarding 14G.2, logout, manifest, metadata, ícones, auth, Supabase, banco, offline,
  comparação, PDF, pricing, Import Engine e `Legacy`.

## 2026-08-28 — Oferta de instalação pós-convite (Sprint 14G.2)

- insere uma etapa opcional no `AuthShell` somente depois da criação e ativação bem-sucedidas da
  senha de um novo convidado, antes do destino autenticado normal;
- dispara o prompt nativo quando disponibilizado pelo navegador, apresenta instruções manuais no
  iOS e em mobile sem prompt, e segue direto em standalone ou desktop sem mecanismo útil;
- mantém “Agora não” como saída imediata e deixa a instalação posterior a cargo da opção já
  disponível no menu do navegador, sem persistência adicional;
- preserva manifest, ícones, metadata, menu da aplicação, lifecycle de senha, scanner-safe invite,
  Supabase, banco, roles, comparação, PDF, pricing, Import Engine e `Legacy`.

## 2026-08-28 — Ícone PWA fornecido pelo usuário (Sprint 14G.1)

- substitui o monograma temporário pelo app icon aprovado: carro frontal graphite sobre fundo
  uniforme `#9ABCC8`, sem texto, crop, reposicionamento ou cantos arredondados;
- preserva a exportação aprovada `icone_temp.png` byte a byte como master 1134×1134 e gera por
  resampling de alta qualidade os derivados 192, 512, maskable 512, Apple 180 e icon 512 do Next;
- reutiliza a safe area original para maskable, centraliza os paths consumidos por manifest/metadata
  e remove os três SVGs de monograma sem alterar comportamento PWA;
- mantém manifest, standalone, scope, start URL, theme/background, auth, responsive, domínio,
  Supabase, banco, PDF, Import Engine e `Legacy` inalterados.

## 2026-08-28 — Mobile, responsive e web app instalável (Sprint 14G)

- centraliza nome provisório, descrição e cores de instalação e substitui o manifest legado por uma
  configuração full-scope `standalone`, com `start_url` neutra e metadata Apple/Next;
- adiciona os assets PNG provisórios de 192px, 512px, maskable e Apple touch icon, derivados de um
  monograma `CC` simples em azul/graphite e preparado para substituição;
- amplia apenas em coarse pointers os alvos próprios de topbar, context switcher, menu de usuário e
  navegação, mantém inputs mobile em 16px e confina dialogs ao viewport com scroll interno;
- preserva scroll horizontal local em tabelas/comparação, sticky somente desktop, fluxos, auth,
  domínio, banco, Supabase, Import Engine, PDF aprovado e `Legacy`;
- documenta breakpoints, instalação Android/iOS, ausência deliberada de offline, dívida visual do PDF
  e QA visual autenticado/dispositivo real ainda pendente.

## 2026-08-28 — Boundaries verticais do PDF (Sprint 14F.5)

- reserva explicitamente a altura real do header fixo antes do conteúdo, eliminando a sobreposição
  sobre a primeira row ou categoria sem reintroduzir separadores;
- faz a row governar a altura das células, que passam a se esticar dentro dela sem `minHeight`
  concorrente, confinando o background de vantagem antes da categoria seguinte;
- preserva palette, tipografia, densidade, markers, modos, orientação e regras de paginação.

## 2026-08-28 — Cor de seções e simplificação do header PDF (Sprint 14F.4)

- remove completamente a bottom rule graphite do header repetido, sem substituir por outra barra;
- mantém o destaque azul suave da referência e a hierarquia por fundos, tipografia, spacing e
  divisores verticais sutis;
- troca category headers para azul oficial `#9ABCC8` com texto graphite `#1A1D21`, preservando
  densidade, largura, paginação e checks de vantagem em laranja `#EF7732`.

## 2026-08-28 — Helper de busca e regra contínua do PDF (Sprint 14F.3)

- remove a superfície visual do helper vazio da busca do vendedor, mantendo a superfície apenas para
  loading, erro, limite e resultados de uma query;
- ancora uma única regra graphite absoluta dentro da row fixa do header PDF, com largura numérica da
  tabela e camada acima do destaque azul da referência;
- preserva busca, seleção, markers de Diferenças, categorias, orientação, fonte e paginação.

## 2026-08-28 — Parsing numérico canônico de specs (Sprint 14F.2)

- centraliza o parsing de números reais, texto pt-BR e texto canônico antes da persistência de specs;
- corrige `PW_0005` em `cc`: `"2.000"` passa a ser armazenado como `2000`, permitindo apresentação
  `2.000 cc`, sem conversão implícita por magnitude;
- preserva células numéricas como numbers, rejeita lixo e parsing parcial e exige contexto explícito
  quando ponto pode representar milhar pt-BR ou decimal canônico;
- mantém `product_specs.value numeric(14,4)`, sem migration ou alteração dos dados atuais de staging.

## 2026-08-28 — Markers em Diferenças e headers PDF (Sprint 14F.1)

- restaura markers objetivos de referência e concorrentes nas linhas semanticamente diferentes,
  onscreen e no PDF, reutilizando os outcomes e flags existentes sem alterar o filtro;
- fixa uma regra graphite explícita no header repetido do PDF e fecha as faixas graphite de categoria,
  evitando depender da renderização implícita de borders em quebras de página;
- preserva Vantagens restrito à referência, Complete com todos os markers, fonte mínima, orientação,
  paginação, sharing pipeline, formatters, domínio, Supabase, banco e `Legacy`.

## 2026-08-28 — Redesign visual do PDF de comparação (Sprint 14F)

- alinha o PDF à identidade white/graphite/blue/orange, com brand slot substituível, hierarquia
  editorial compacta, data de geração, cabeçalho repetido e paginação;
- preserva legibilidade em A4 retrato para 2 veículos e A4 paisagem para 3–4, mantendo labels e
  valores principais em 9pt e separando marca/modelo, versão e ano produção/modelo;
- transporta Completa, Diferenças e Vantagens até a rota e filtra pelo mesmo view model da tela,
  inclusive no download e compartilhamento, com compatibilidade para `highlights=true`;
- mantém vazios filtrados como PDFs válidos e preserva engine, formatters, pipeline server-side,
  filename, autenticação, contratos, Supabase, banco e `Legacy`.

## 2026-08-28 — Hierarquia semântica de botões (Sprint 14E.3)

- separa tamanho funcional (`action`, `commit`, `micro`) de variante visual no primitive compartilhado;
- consolida Action em 32px/semibold, Commit em 36px/medium e Micro em 30px/semibold no desktop,
  preservando mínimo de 44px em coarse pointers;
- alinha Nova importação e Novo usuário em `action + interactive` e migra ações representativas de
  Veículos, Pricing, Policies, Specs, Seller Selection e tabelas sem vincular tamanho à cor;
- mantém `compact` como alias transitório de Micro e preserva laranja exclusivamente para atenção.

## 2026-08-28 — Alinhamento final de Pricing e Policies (Sprint 14E.2)

- normaliza o combobox administrativo de veículo com `ui-field`, alinhando sua altura, tipografia,
  border, radius e foco aos campos adjacentes de preços e competência;
- adiciona padding horizontal à form section de Criar políticas sem reintroduzir card nesting;
- compacta tipografia e ação de Preço válido e reorganiza o estado vazio para ação seguida de
  mensagem auxiliar, preservando comportamento e touch targets coarse.

## 2026-08-28 — Correção visual de Pricing (Sprint 14E.1)

- ancora o header do ledger de preços ao scrollport próprio, com `th` sticky em `top: 0`, reutilizando
  a arquitetura já validada no catálogo de Veículos;
- remove o sticky global indevido do header da Entrada de preços, mantendo header e linhas no mesmo
  fluxo compacto e eliminando o recorte da primeira linha;
- transforma Modelo/versão, Competência e Preço válido em uma única form section horizontal,
  removendo o card nesting e reduzindo substancialmente a altura inicial de Criar políticas;
- preserva sorting, paginação, ações, status, regras de pricing, contratos, autorização, Supabase,
  Import Engine, Auth, PDF e `Legacy`.

## 2026-08-28 — Consolidação visual das telas restantes (Sprint 14E)

- compacta listas e grids de Preços e Políticas sem alterar cálculo, lifecycle ou persistência;
- transforma Importações em uma superfície administrativa densa, reduz cards aninhados e alinha
  filtros, upload, documentos, status e ações aos primitives compartilhados;
- faz cleanup conservador em Usuários e consolida o dialog de convite, preservando ações e estados;
- reforça a identidade azul em Auth, ações interativas, uploads e badges informativos, mantendo
  grafite estrutural, laranja raro e cores semânticas de status;
- adiciona primitives genéricos de form grid/section, table frame e informational badge; banco,
  Supabase, contratos, domínio, autorização, dashboard, PDF e `Legacy` permanecem inalterados.

## 2026-08-27 — Correção de Vantagens e refinamento responsivo

- recupera a semântica histórica: Vantagens mostra somente vantagens objetivas do primeiro veículo,
  usando `hasReferenceAdvantage` do engine existente, inclusive com 3 ou 4 veículos;
- limita o check laranja à coluna da referência nesse modo, sem alterar Completa ou Diferenças;
- reorganiza a topbar estreita com grid explícita, marca compacta e gatilho “Mais” responsivo;
- compacta segmented control e ações da comparação para 30px no desktop, preservando 44px em
  dispositivos coarse e adicionando padding horizontal discreto à toolbar.

## 2026-08-27 — Modos e formatação da comparação

- adiciona os modos URL-backed Completa, Diferenças e Vantagens num segmented control acessível;
- decide Diferenças por valores semânticos brutos e mantém Vantagens estritamente apoiado nos outcomes
  do engine existente, omitindo categorias vazias;
- compacta a tabela light-first, preserva sticky/scroll horizontal local e usa laranja somente no
  pequeno marcador acessível de vantagem;
- centraliza apresentação numérica pt-BR por spec code, sem alterar armazenamento, unidade, contratos
  ou o PDF visual.

## 2026-08-27 — Busca unificada de veículos do vendedor

- substitui Marca → Modelo → Versão → Adicionar por busca tokenizada em marca, modelo e versão, com
  inclusão em um toque sobre o catálogo público/elegível autorizado e cacheado;
- apresenta selecionados numa lista ordenada compacta, identifica o primeiro como Principal, preserva
  produção/modelo e oferece remoção acessível com promoção implícita do próximo veículo;
- consolida quatro veículos como limite da seleção, mantém mínimo de dois e preserva a ordem enviada à
  comparação;
- adiciona a variante compartilhada `interactive` em azul oficial com texto grafite, mantendo laranja
  exclusivo para atenção e o primitive primary existente sem impacto global.

## 2026-08-27 — Sticky estrutural e grid de especificações

- substitui os offsets acumulados do catálogo por um workspace desktop com header e toolbar em trilhos
  naturais e um único scrollport vertical/horizontal para a tabela;
- mantém o header semântico sticky no scrollport da própria tabela, sem cópia visual ou recorte por um
  ancestral de overflow concorrente;
- limita a grid interna de specs a 52rem, compartilha a origem de uma value column de até 22rem e
  reserva um slot consistente de 4rem para unidades numéricas;
- alinha o padding da toolbar de specs com categories e fields, preservando a densidade vertical.

## 2026-08-27 — Sticky layout e densidade de especificações

- centraliza o stack sticky administrativo e elimina offsets mágicos que cortavam o header do catálogo;
- muda ações primary para graphite e preserva azul para informação/seleção;
- compacta toolbar, categorias, linhas, controles e tri-state da entrada de especificações.

## 2026-08-27 — Busca e UX do catálogo de veículos

- substitui Marca/Modelo/Versão por busca unificada automática com debounce e filtros booleanos imediatos;
- compacta toolbar, tabela, status e ações do catálogo, preservando rotas e autorização;
- padroniza globalmente pares de ano como produção/modelo e remove `#466F7D` da paleta independente.

## 2026-08-27 — Shell e navegação da aplicação

- consolida marca, troca de contexto autorizada e conta/logout em uma topbar compartilhada e compacta;
- limita a sidebar administrativa à navegação local, com estado ativo discreto e menu móvel;
- adiciona hierarquia semântica de canvas, surface elevada e seleção, além de microações mais densas.

## 2026-08-27 — Design system e densidade light-first

- centraliza paleta semântica, tipografia Inter temporária, densidade, radius e estados visuais;
- adiciona primitives compartilhadas para buttons, fields, surfaces, badges e tabelas densas;
- adapta shells e autenticação à interface clara e reserva o laranja para vantagem/atenção.

## 2026-08-27 — Aceite de convite resistente a scanners

- torna o GET inicial do convite não consumidor e exige confirmação explícita antes de `verifyOtp`;
- guarda o hash por curto prazo em cookie HttpOnly separado e preserva o onboarding `pending → active`.

## 2026-08-25 — Hardening do ciclo de recuperação de senha

- apresenta feedback controlado para rate limits do Supabase Auth também no envio de convites
  administrativos, reutilizando a mesma taxonomia tipada do recovery;
- torna o recovery resistente a scanners de e-mail: o primeiro GET apenas guarda o hash em cookie
  HttpOnly curto e a verificação do OTP ocorre somente após confirmação explícita por POST;
- trata rate limits de envio do Supabase com mensagem administrativa controlada e preserva a resposta
  pública neutra contra enumeração;
- alinha recovery hospedado ao padrão SSR `TokenHash + verifyOtp(type='recovery')`;
- adiciona “Esqueci minha senha” com resposta neutra contra enumeração;
- registra solicitações em `profiles.password_recovery_requested_at`, limpa o indicador após troca de
  senha e preserva integralmente o status de acesso;
- exibe a redefinição pendente separadamente na tabela e nos cartões administrativos.

## 2026-08-24 — Correção SSR do aceite de convite

- troca o callback de convite administrativo de code/PKCE para `TokenHash + verifyOtp`, compatível com
  links abertos em outro navegador ou dispositivo;
- constrói redirects de convite e recovery a partir das callbacks externas confiáveis configuradas,
  evitando o origin interno do proxy Railway;
- documenta o template obrigatório de Invite User no Supabase.

## 2026-08-24 — Ajuste visual de QA em usuários administrativos

- evita que o menu de ações da tabela desktop seja recortado pelo container e centraliza verticalmente
  o conteúdo das linhas, preservando cartões móveis, ações e cantos arredondados.

## 2026-08-24 — Ambiente online de testes (Sprint 13)

- prepara o deploy Railway com Node 22, pnpm fixado e healthcheck dedicado em `/api/health`, fora do
  middleware autenticado e sem dependência do Supabase;
- completa o template `staging` com callbacks separadas de convite e recuperação;
- documenta arquitetura, variáveis, Supabase Auth, migrations e checklist repetível do beta hospedado;
- registra deploy real, inspeção remota e testes de e-mail como validações operacionais pendentes sem
  acesso autenticado aos provedores.

## 2026-08-24 — Aceite, onboarding e recuperação de senha (Sprint 12C)

- adiciona callbacks PKCE separados em `/auth/callback/invite` e `/auth/callback/recovery`, com sessão SSR e destinos internos fixos;
- adiciona formulários móveis de senha em `/auth/invite` e `/auth/recovery`, sem user ID, tokens ou credenciais privilegiadas no browser;
- ativa condicionalmente somente profiles `pending` após senha de convite definida; recovery nunca altera status e disabled permanece disabled;
- trata links inválidos, repetição idempotente e falha parcial senha-atualizada/ativação-falhou sem armazenar ou registrar senhas;
- não requer migration e mantém signup público inexistente.

## 2026-08-24 — Pedidos de convite (Sprint 12B)

- adiciona `user_invite_requests` com ownership RLS, histórico, transições pending→approved/rejected e unicidade parcial de e-mail pendente;
- permite ao usuário ativo solicitar e acompanhar convites sem criar Auth user imediatamente;
- adiciona fila em `/admin/users`, aprovação/rejeição condicional e reutiliza o convite 12A com role fixa `seller`;
- preserva falhas parciais/concor­rência de forma diagnosticável, sem aprovação automática ou onboarding 12C.

## 2026-08-24 — Ações administrativas de usuários (Sprint 12A.3)

- torna “Novo usuário” funcional com convite oficial do Supabase Auth, profile automático ajustado
  para nome/role selecionados e status inicial `pending`;
- adiciona alteração de role, ativação/desativação de acesso e solicitação de recuperação de senha por
  Server Actions autorizadas, com revalidação de `/admin/users`;
- bloqueia auto-desativação, auto-rebaixamento, remoção do último admin ativo, mutação de pending e de
  profiles ausentes/inválidos;
- adiciona menus responsivos e dialogs de confirmação, feedback controlado e redirects de e-mail
  configurados por `AUTH_INVITE_REDIRECT_URL` e `AUTH_RECOVERY_REDIRECT_URL`;
- preserva o trigger existente de criação de profiles e não adiciona migration, senha administrativa,
  signup público ou reparo implícito de inconsistências.

## 2026-08-24 — Administração de usuários somente leitura (Sprint 12A.2)

- adiciona `/admin/users` como workspace administrativo protegido e alimentado exclusivamente por
  `loadAdminUsers()`;
- apresenta usuários em tabela semântica no desktop e cartões compactos no mobile, com nome, e-mail,
  role, status, criação e último acesso;
- torna profiles ausentes ou inválidos visíveis sem aplicar role/status permissivos;
- adiciona estados controlados de carregamento, erro e lista vazia, além de formatação brasileira e
  ordenação determinística por criação mais recente;
- ativa o módulo na navegação e mantém “Novo usuário” desabilitado até a Sprint 12A.3. Nenhuma
  mutação administrativa ou migration foi adicionada.

## 2026-08-24 — Fundação administrativa de usuários (Sprint 12A.1)

- adiciona `AdminUserDto`, compondo identidade do Supabase Auth com nome, role e status de
  `public.profiles`, sem duplicar email ou timestamps no profile;
- representa profiles ausentes ou inválidos explicitamente e mantém role/status nulos nesses casos,
  sem conceder autorização implícita;
- adiciona adapter paginado sobre `auth.admin.listUsers()` com uma consulta de profiles por lote,
  tratamento sanitizado de erros e validação dos enums existentes;
- cria cliente Auth Admin em módulo `server-only`, reutilizando `SUPABASE_URL` e
  `SUPABASE_SERVER_KEY` sem expor credenciais `NEXT_PUBLIC_*`;
- adiciona operação de aplicação que executa `requireRole('admin')` antes de criar o cliente
  privilegiado ou consultar usuários;
- cobre mapping, opcionais, inconsistências, paginação, falhas e autorização. Nenhuma migration,
  policy, view, signup, convite ou UX de gestão foi criada.

## 2026-08-24 — Download e compartilhamento nativo do PDF

- substitui a ação genérica `Gerar PDF` por `Baixar PDF` e `Compartilhar`, com SVGs inline,
  touch targets de 44 px e reorganização responsiva na toolbar;
- mantém uma única URL construída por `buildComparisonPdfUrl`, preservando todos os parâmetros
  `vehicles` e `highlights=true` quando ativo;
- baixa diretamente a rota `/comparar/pdf` com filename `comparacao-veiculos.pdf`, sem gerar Blob no
  client para o fluxo de download;
- implementa compartilhamento explícito via `fetch` → `Blob` → `File(application/pdf)` →
  `navigator.canShare` → `navigator.share`, com estado `Preparando...` e bloqueio de cliques;
- usa download como fallback para ausência de file sharing, resposta/fetch falhos ou erro técnico,
  mas trata `AbortError` como cancelamento voluntário sem download;
- adiciona testes isolados das APIs de browser, URL, filename/MIME, fallback, cancelamento e estado
  visual, sem link público, Storage, persistência ou integração específica com aplicativos.

## 2026-08-24 — Otimização mobile do PDF de comparação

- substitui A4 portrait pelo formato vertical customizado de 480 × 853 pt, com 10 pt de margem
  lateral e tabela estrutural de 460 pt;
- adota primeira coluna de 220 pt e colunas de 120 pt para dois veículos ou 80 pt para três,
  preservando a ordem e o primeiro veículo como referência;
- permite labels em até duas linhas com fonte 8,5/8/7,5 pt, rows de altura variável e valores
  centralizados, sem renderizar o `equipmentGroup` redundante;
- aumenta discretamente o header para nomes de veículos em duas linhas e separa seus blocos fixos
  para repetição estável no React-PDF, sem recorte arredondado que vaze entre páginas;
- eleva `minPresenceAhead` para 34 pt, mantém rows com `wrap=false` e achata wrappers de fluxo para
  impedir clipping em categorias multipágina;
- atualiza a cobertura automatizada de página, geometrias, wrap, tipografia, header e paginação e
  valida cinco PDFs reais de dois/três veículos, completo/vantagens e stress multipágina.

## 2026-08-23 — Tabela completa do PDF de comparação

- evolui o PDF A4 portrait para uma ficha técnica completa com header fixo, nomes dos veículos,
  categorias, rows, valores e indicação visual de vantagem;
- mantém 540 pt de largura estrutural, com primeira coluna de 300 pt e colunas de 120 pt para dois
  veículos ou 80 pt para três veículos;
- reutiliza `filterComparisonCategories`, `shouldShowAdvantageCheck` e
  `getComparisonValuePresentation`, sem duplicar filtro, comparação ou formatação de presença;
- adiciona redução de fonte por comprimento, label limitado a uma linha, rows indivisíveis e
  proteção de categoria contra orphan por `minPresenceAhead`;
- cobre geometrias, filtro, ordem/referência, header, valores, vantagens, labels longos, quatro
  cenários de dois/três veículos e paginação real com 90 rows.

## 2026-08-23 — Foundation server-side do PDF de comparação

- adiciona `@react-pdf/renderer` 4.6.1 ao app web e uma rota Node em `/comparar/pdf`, com saída A4
  portrait, tema escuro full-page, headers controlados e sem persistência;
- reutiliza `loadComparisonPage` e `filterComparisonCategories`, preservando `vehicles` e
  `highlights=true` sem recalcular vantagens no documento;
- inclui o botão `Gerar PDF`, atualiza o wording visível para `Ver vantagens` e cobre parâmetros,
  URL, view model de dois/três veículos, filtro, documento PDF e respostas HTTP;
- mantém a entrega limitada à foundation: a tabela completa, paginação e header repetido continuam
  fora desta etapa.

## 2026-08-23 — Pausa estratégica do pipeline segmentado da Sprint 10C

- classifica a Sprint 10C como `PAUSED AFTER EXPERIMENTAL SEGMENTED PIPELINE VALIDATION`, sem apagar
  runtime, schemas, artifacts, canonicalizers, reconciliation, Domain Mapping, testes ou feature flag;
- registra que o benchmark real chegou à Unit Extraction, mas não concluiu todas as units nem o
  caminho segmentado real até matching/import E2E;
- mantém `one_shot` como default funcional e declara o pipeline segmentado avançado não bloqueante
  para o MVP;
- reposiciona o roadmap para comparação utilizável, PDF, compartilhamento/link/WhatsApp, usuários,
  convites, histórico e polish mobile; retomada futura começa por baseline e simplification review.

## 2026-08-23 — Reasons seguros para coverage COMPLETE inválido

- adiciona allow-list estática e ordenada dos sete predicados de
  `incompleteDataMarkedComplete` aos diagnostics opt-in da Unit Extraction;
- preserva a mensagem pública curta e não expõe counts, expected values, family names, IDs,
  mensagens de gaps, excerpts ou output do provider;
- mantém invariant, artifact, canonicalizer e prompt v8 inalterados e adiciona regressões isoladas
  dos sete blockers, combinação, COMPLETE válido e propagação segura pelo segmented runtime.

## 2026-08-23 — Bounding de source block excerpt na Unit Extraction

- registra a falha canônica isolada de `unit-0003-table` em `/blocks/2/excerpt: maxLength` e o
  sibling abort de `unit-0005-section`, após Document Map e Unit Plan concluídos;
- preserva `CommercialDocumentExtraction/1`, inclusive `minLength: 1` e `maxLength: 1000`, e limita
  no canonicalizer somente o prefixo literal de `blocks[].excerpt` por Unicode code point;
- sobe o prompt da Unit Extraction de v7 para v8 e exige snippet literal curto, sem resumo,
  reticências, placeholder ou dump de parágrafo/tabela/documento;
- adiciona regressões de projection/transport/reconstruction/canonical validation, fronteiras do
  limite, Unicode, vazio inválido, frozen input, determinismo e preservação de facts/evidence refs.

## 2026-08-23 — Consistência de coverage status na Unit Extraction

- registra que `unit-0005-table` falhou somente em
  `/coverage/status: incompleteDataMarkedComplete` e que `unit-0006-table` foi sibling abort após
  Document Map e Unit Plan concluídos;
- formaliza os sete bloqueadores de `complete` e mantém status/provider semantics separados dos três
  counters reconstruídos pelo servidor;
- confirma que não existe downgrade universal seguro entre `partial` e `ambiguous`; o canonicalizer
  não mascara a contradição e a invariant permanece ativa;
- sobe o prompt da Unit Extraction de v6 para v7, explicita complete/partial/ambiguous, gaps,
  unresolved e proíbe COMPLETE otimista;
- adiciona regressões para todos os blockers, preservação de partial/ambiguous, ausência de promoção,
  multi-unit, frozen input, determinismo e counters server-owned.

## 2026-08-23 — Blank cells da Unit Extraction

- registra a falha canônica real da unit 2 em duas `tables[].rows[].cells[].text: minLength`, seguida
  de sibling abort da unit 1, após Document Map e Unit Plan concluídos;
- confirma que cells são sparse e keyed por `columnId`, sem dependência do índice nem obrigação de
  cobrir todas as columns; blank visual é representado pela ausência dessa cell;
- mantém `text` required/non-nullable com `minLength: 1`, sem trim, fallback, placeholder ou mudança
  de schema, pois merged/inherited/unknown não possuem estados próprios no contrato atual;
- sobe o prompt da Unit Extraction de v5 para v6, orientando omissão de blank, preservação dos demais
  `columnId`, proibição de conteúdo inventado e coverage gap quando material;
- adiciona regressões de wire versus canonical boundary, blank inicial/intermediário/final,
  rowSpan/colSpan não suportados, frozen input e determinismo.

## 2026-08-23 — Required collections do Document Map

- registra a falha real de transport validation por omissão de `documents[0].issuerHints`, uma
  collection required/non-nullable que aceita `[]`;
- sobe o prompt do Document Map de v3 para v4, exige todas as collections required, explicita as
  quatro hint collections e diferencia array vazio legítimo de hint inventado;
- mantém provenance obrigatória para hints presentes e preserva o transport validator sobre o raw
  wire, sem preenchimento automático, alteração de schema, projection, provider ou canonicalizer;
- adiciona inventário testável das required arrays que aceitam `[]` e regressões de issuer vazio,
  omitido, válido com provenance e dangling.

## 2026-08-23 — Diagnóstico seguro de required no Document Map

- registra que o último retry falhou na validação do transport schema com dois campos obrigatórios
  ausentes em `documents[0]`, cujos nomes não eram preservados pelo sanitizer;
- adiciona `missingProperty` opcional aos diagnostics somente para `keyword: required` e somente
  quando o nome pertence às propriedades estáticas do schema;
- mantém descartados os demais params do AJV, incluindo nomes de `additionalProperties`, valores,
  patterns e mensagens, sem alterar schema, projection, validator contract ou prompt;
- cobre sanitizer, runtime segmentado, truncation e identidade entre o schema enviado ao provider e
  o schema compilado pelo transport validator, com smoke externo desligado.

## 2026-08-23 — Materialização e diagnóstico de metadata refs no Document Map

- registra que o último retry passou por Structured Output, wire validation e reconstruction, mas
  falhou na canonicalização com uma `unknown_reference` em metadata hints antes do Unit Plan;
- confirma que title/issuer/competence/validity hints referenciam somente
  `contentBlocks[].contentBlockId` por `sourceBlockIds`, obrigatório e com ao menos um item por hint;
- adiciona o evento opt-in `SEGMENTED_DOCUMENT_MAP_CANONICALIZATION`, limitado a total, categories,
  amostra `{ path, kind, category }` e truncation, sem raw IDs ou conteúdo documental;
- sobe o prompt do Document Map para v3, exige que toda ref possua definition real no mesmo artifact,
  orienta omitir hint sem source real e proíbe placeholders;
- mantém unknown refs estritas e comprova indexação global, cross-kind isolado, same-kind duplicate,
  deep-freeze, determinismo e idempotência sem alterar schema ou canonicalizer.

## 2026-08-23 — Reforço de factIds em relationships da Unit Extraction

- registra que Document Map e Unit Plan passaram no último retry e que a unit 4 falhou somente em
  dois `composition.relationships[*].factIds: minItems`, seguida de sibling abort da unit 5;
- confirma que todas as relationship types exigem ao menos um fact e evidence, enquanto somente
  `APPLIES_TOGETHER`/`MUTUALLY_EXCLUSIVE` exigem dois subjects totais;
- corrige a versão factual anterior do prompt: o runtime efetivo já estava em v4 e continha a regra
  genérica de um fact, mas não dizia explicitamente que groups não substituem esse requisito;
- sobe o prompt segmentado para v5, proíbe `factIds: []`, orienta omitir relações group-only e inclui
  exemplos abstratos válidos/inválidos;
- preserva schema, `minItems`, projection, validator e canonicalizer, sem sanitizar output raw com
  possível intenção semântica;
- adiciona regressões de collection vazia, empty/group-only, fact-only, fact+group e relações
  combinatórias com subjects insuficientes.

## 2026-08-23 — Normalização de back-reference página–seção no Document Map

- registra que o último retry passou por wire validation, reconstruction, ID canonicalization e
  schema canônico, falhando somente em `sections[*].pageIds: missingPageBackReference` antes do Unit
  Plan;
- comprova que `page.sectionIds` e `section.pageIds` são duas projeções do mesmo membership e forma a
  união determinística somente dos pares declarados em ao menos um dos lados;
- reprojeta ambos os lados após canonicalizar referências, eliminando duplicatas e preservando
  dangling refs como falhas `unknown_reference`;
- mantém schema, invariant, transport schema, prompt, planner e etapas posteriores inalterados;
- adiciona regressões do caso causal, sentido inverso, idempotência, deep-freeze, determinismo,
  duplicatas, dangling refs, fixtures sintéticas e runtime segmentado com smoke OFF.

## 2026-08-22 — Coverage determinístico na Unit Extraction

- comprova que `expectedUnitCount`, `completedUnitCount` e `extractedVehicleCount` são projeções
  determinísticas de `coverage.units` e `vehicleIdentities`, embora antes fossem copiados do provider;
- reconstrói os três contadores no canonicalizer sem hardcode unitário e preserva artifacts agregados;
- sobe o prompt segmentado para v4, limita `coverage.units` à unit corrente e usa `0` apenas como
  sentinel de wire para os contadores required que o servidor substitui;
- preserva status complete/partial/ambiguous, gaps e unresolved, incluindo rejeição de completeness
  semanticamente inconsistente; schema, Unit Plan e etapas posteriores permanecem inalterados;
- adiciona regressões de contadores errados, unit-scoped/multi-unit, partial/unresolved, deep-freeze,
  determinismo e runtime segmentado sem chamadas externas.

## 2026-08-22 — Prevenção de placeholders vazios em composition

- confirma no contrato `CommercialDocumentExtraction/1` que `composition.groups` e
  `composition.relationships` podem ser coleções vazias, mas cada group exige ao menos dois
  `memberFactIds` e cada relationship exige ao menos um `factId`;
- sobe somente o prompt da Unit Extraction para v3 e proíbe objetos-placeholder: composição ausente
  usa `groups: []`/`relationships: []`, enquanto objetos reais precisam de facts, scope e evidence
  documentais conforme o contrato;
- adiciona regressões transport/canônicas para coleções vazias, elementos vazios, grupo de um membro,
  composições reais e composição hierárquica cumulative/alternative;
- preserva schema, `minItems`, transport projection/validator, canonicalizer, timeout, Document Map,
  Unit Plan, reconciliation, Domain Mapping e matching; não executa retry/OpenAI nem toca ambientes.

## 2026-08-22 — Alinhamento do Document Map transport validator

- comprova que provider request e AJV local já derivavam da mesma constante de transport schema,
  mas a projection reconhecia somente parte dos prefixos de IDs locais e deixava 20 ocorrências de
  `pattern` para `page`, `section`, `note`, `hint` e `edge` no Document Map wire;
- generaliza a remoção somente para o formato exato de ID server-owned, preservando patterns de
  negócio, `minItems`, `maxItems`, `minimum`, `maximum`, tipos e required no transport;
- faz Unit Extraction validar o response wire bruto antes da reconstruction e remove a reprojeção
  intermediária que podia mascarar propriedades wire ausentes com sentinelas `null`;
- adiciona guards de identidade entre o schema compilado pelo AJV e o enviado ao provider, cobertura
  de IDs model-local, canonicalização posterior, `minItems`, type e required;
- mantém schemas e validators canônicos, canonicalizers, prompt v2 e planner inalterados; não executa
  retry/OpenAI, não escreve em Staging, não cria migration e não toca `Legacy`.

## 2026-08-22 — Defesa de minItems no Document Map transport

- prova localmente que `tables[].headerBlockIds` é required/non-nullable com `minItems: 1`,
  `maxItems: 500` e items string/block tanto no schema canônico quanto na projeção OpenAI;
- refuta a hipótese de null sentinel: a projection não torna array items nullable e a reconstruction
  preserva `['block-x']`, `[null]`, `['block-x', null]` e `[]` sem filtrar ou alterar cardinalidade;
- adiciona validação AJV do raw Document Map transport antes de reconstruction/canonicalization, com
  o mesmo diagnóstico estrutural sanitizado e sem persistir output inválido;
- sobe o prompt do Document Map para v2 e exige header block documental real em toda table; conteúdo
  sem header identificável deve permanecer em content blocks/sections, enquanto continuações usam o
  header original via `inheritedHeaderBlockIds`;
- mantém `minItems: 1`, schemas, canonicalizer e planner inalterados; não executa retry/OpenAI, não
  escreve em Staging, não cria migration e não toca `Legacy`.

## 2026-08-22 — Provenance de evidence e causalidade da Unit Extraction

- reconcilia read-only o Job 45/attempt 8 do batch 117: Document Map e Unit Plan succeeded, zero
  Unit Extraction artifact/row e zero job ativo; a unit 2 falhou com dois `unknownRef` em
  `documents[0].candidates[*].evidence.blockIds`, enquanto a unit 1 foi `ABORTED_SIBLING`;
- comprova que `evidence.blockIds` pertence ao namespace extraction-local e deve resolver contra
  `CommercialDocumentExtraction.blocks[].blockId`, não diretamente contra `Document Map.contentBlocks`;
- inclui os content blocks canônicos primários/context-only no Unit Context e sobe o prompt de Unit
  Extraction para v2: source block usado deve materializar um bloco documental real, reutilizando
  temporariamente o ID canônico do mapa para que definição e refs sejam remapeadas juntas; referências
  soltas, duplicadas e placeholders continuam rejeitados;
- substitui a escolha posicional da primeira falha por prioridade determinística: falhas causais
  vencem `ABORTED_SIBLING`, inclusive com a lista de resultados invertida;
- mantém a dívida existente: resposta que falha na validação canônica não publica artifact nem agrega
  usage/providerRunId; não há reuso cross-job, migration, retry, OpenAI ou alteração de `Legacy`.

## 2026-08-22 — Diagnóstico e boundary de IDs da primeira Unit Extraction real

- reconcilia read-only o Job 44/attempt 7 do batch 117: Document Map e Unit Plan succeeded, plano de
  18 units, zero Unit Extraction artifact/row e zero job ativo, sem recovery ou escrita remota;
- corrige a classificação de abortos concorrentes para que uma chamada interrompida após fatal de
  sibling seja `ABORTED_SIBLING`, mesmo quando o provider converte `AbortSignal` em
  `PROVIDER_TIMEOUT`; unit timer, total deadline e timeout espontâneo continuam distintos;
- mantém todos os patterns canônicos e transfere IDs locais model-owned para o canonicalizer antes da
  validação canônica final; somente a projeção transport deixa de exigir IDs server-owned;
- adiciona diagnóstico opt-in por unit e fase, limitado a `{ path, keyword, category }`, contagens e
  truncation, sem output, valores comerciais, evidence, raw IDs, PDF ou provider body;
- registra que artifacts bem-sucedidos e usage/providerRunId ainda são publicados/agregados somente
  após o orchestrator inteiro retornar sem falha; retry granular dessa perda permanece futuro;
- não altera o timeout de 120 s, não executa OpenAI/retry, não cria migration e não toca `Legacy`.

## 2026-08-22 — Canonicalização server-owned de IDs do Document Map

- registra que o retry diagnóstico revelou 358/358 violações AJV `pattern`, sem falhas estruturais,
  referenciais, semânticas, de invariantes ou de unicidade;
- adiciona canonicalizer puro que substitui IDs locais do modelo por IDs ordinais server-owned nos
  namespaces document/page/block/section/table/note/hint/edge e remapeia todas as referências;
- deriva document identity do ordinal da source fornecido pelo runtime, rejeita duplicidade same-kind,
  definição ausente, referência desconhecida e source mismatch com erro seguro sem raw IDs;
- integra exclusivamente entre reconstruction e validação canônica do Document Map; schemas,
  patterns, prompt, Unit Extraction, Merge e stages posteriores permanecem inalterados;
- cobre failure shape com IDs fora do pattern, integridade referencial, cross-kind, deep freeze,
  determinismo, idempotência e fixtures Geely/GWM/Fiat/VW, sem retry ou chamada externa.

## 2026-08-22 — Diagnóstico seguro da validação canônica do Document Map

- adiciona erro estruturado `COMMERCIAL_DOCUMENT_MAP_INVALID` com total real, amostra limitada a 30,
  paths, keywords e categorias, sem values, params AJV, body ou output bruto;
- corrige a reconstrução transport→canonical para usar o schema e preservar `null` canônico em campo
  required/nullable, removendo somente sentinelas `null` de opcionais não-nullable;
- adiciona observabilidade local opt-in `SEGMENTED_DOCUMENT_MAP_VALIDATION`, sem persistência, com
  contagens completas por keyword/categoria e amostra estrutural sanitizada;
- prova round-trip local Geely/GWM/Fiat/VW, arrays/objetos aninhados, oneOf→anyOf, duplicidade wire,
  IDs, referências, page range e additional properties, sem OpenAI, Staging ou migration;
- esclarece que as “100 violações” do attempt 5 eram o teto de amostragem do validator anterior e não
  evidência de exatamente 100 falhas.

## 2026-08-21 — Checkpoint da Sprint 10C.4D

- registra os cinco attempts reais do batch 117, preservados como histórico sem recovery;
- confirma que o attempt 5 passou por upload, `response_create`, Structured Output e reconstrução,
  falhando na validação canônica do Document Map com 100 violações;
- classifica o smoke como `SEGMENTED SMOKE TECHNICAL FAIL` em
  `DOCUMENT_MAP_CANONICAL_VALIDATION`, antes do Unit Plan;
- confirma zero rows, artifacts, dependencies, promotion, providerRunId e usage persistidos;
- adia explicitamente a investigação para `DIAGNOSE DOCUMENT MAP CANONICAL VALIDATION FAILURE`.

## 2026-08-21 — Projeção OpenAI dos schemas segmentados

- passa Document Map e Unit Extraction pela primitive compartilhada de projeção Structured Outputs;
- reconstrói opcionais nullable do wire antes dos validadores canônicos originais;
- remove do transporte keywords incompatíveis, incluindo `uniqueItems`, sem alterar os schemas core;
- cobre scan recursivo, strict objects, determinismo, imutabilidade e rejeição canônica de duplicatas.

## 2026-08-21 — Observabilidade segura do structured provider

- reutiliza no provider segmentado a classificação e sanitização de erros do provider one-shot;
- distingue auth, rate limit, timeout, request inválido, upload, recusa, output inválido, cleanup e
  falha desconhecida, com stages `file_upload`, `response_create`, `response_parse` e `cleanup`;
- adiciona diagnostics opt-in com contexto seguro de `document_map`/`unit_extraction`, sem body,
  headers, URLs, file IDs ou conteúdo comercial;
- preserva request, schema, prompt e modelo; o Job 40/attempt 3 permanece falha histórica sem retry.

## 2026-08-21 — Fail-safe do structured provider segmentado

- remove a seleção implícita de fake no structured provider e exige configuração explícita no modo
  segmentado;
- resolve o provider antes de autorização, acesso a repositório ou criação de job;
- restringe fake à injeção explícita fora de produção e exige `openai` no smoke segmentado real;
- preserva o one-shot e o Job 39/attempt 2 como falha histórica, sem retry ou chamada OpenAI.

## 2026-08-21 — Correção de resolução do período segmentado

- remove a exigência antecipada de `batch.competence` da entrada do runtime segmentado;
- preserva candidatos documentais de competência e validade por merge e semantic reconciliation;
- resolve deterministicamente o período explícito imediatamente antes do Domain Mapping, recusando
  ausência, ambiguidade e incompatibilidade batch/documento sem fabricar datas;
- aceita estaticamente o lifecycle `failed/failed` do batch/documento para retry oficial do harness;
- mantém o Job 38 como tentativa histórica falha, com zero chamadas OpenAI e sem novo smoke.

## 2026-08-21 — Sprint 10C.4C Runtime Orchestration

- integrou o pipeline segmentado ao `processAdminImportBatch` por opt-in explícito, preservando
  `one_shot` como default;
- conectou Document Map, Unit Plan, unit extraction, artifacts, merge, semantic reconciliation e
  domain mapping ao boundary canônico e ao matching/finalização existentes;
- adicionou source-session reuse, replay por artifact, usage agregado e factory server-only de
  structured provider com fake proibido em produção;
- validou localmente um E2E fake unit-aware com quatro MMVs e zero promotion;
- nenhuma chamada OpenAI, migration ou acesso remoto foi realizado.

## 2026-08-20 — Artifact Persistence & Security da Sprint 10C.4B

- Adicionada migration incremental local com manifest Postgres, junction DAG, bucket JSON privado,
  lifecycle imutável, retry/supersession, idempotência e audit snapshots sem body.
- Adicionados RPCs reserve/start/succeed/fail e attach-dependencies hardened por claim, lock,
  `SECURITY DEFINER`, `search_path = ''`, RLS sem policies e grants exclusivos de `service_role`.
- Adicionados adapters server-only de manifest/Storage com canonical bytes, read-back, SHA-256/tamanho
  e resultado de orphan observável; não há cleanup ou deletion automática.
- Runtime segmentado, one-shot, matching, Policies/Offers, promotion, remotos, Legacy e lockfile
  permanecem inalterados. Próximo marco planejado: 10C.4C, ainda não ativo.
- Gates locais concluídos com reset integral, pgTAP 023 em 43/43 e catálogo/RLS/grants/bucket
  auditados. A suíte completa passou 691/693; as duas falhas restantes são baseline comprovado do
  teste histórico 016 por SHA-256 de fixture duplicado antes da 10C.4B.

## 2026-08-20 — Lifecycle & Artifacts da Sprint 10C.4A

- Adicionado `SegmentedImportArtifactManifest/1` com stages/status centralizados, versões separadas,
  correlation, lineage, dependências e metadata de provider allow-listed.
- Implementados canonical JSON + SHA-256, idempotency/artifact IDs determinísticos, path Storage
  server-owned, lifecycle terminal imutável, DAG validator e resolução de latest succeeded.
- Adicionados ports de manifest/Storage/audit e protocolo puro de publicação com verificação do body,
  compensação failed e orphan observável; 41 testes dirigidos cobrem lifecycle, replay, segurança e
  falhas DB/Storage.
- Aprovado Storage privado + manifest DB como alvo, sem migration nesta etapa. Runtime one-shot,
  registry, Prompt v4, matching, persistência/promotion, remotos, Legacy e lockfile não mudaram.

## 2026-08-20 — Domain Mapping da Sprint 10C.3E

- Adicionado `CommercialDocumentDomainMappingResult/1` e mapper puro para materializar rows
  `commercial-letter/mmv-payload/1` a partir da Semantic Reconciliation.
- Implementados mapping Fact→MSRP/Policy/applicability, Policy dedupe/IDs locais, composition
  cumulativa/alternativa aninhada, integrity Offer→Policy, issues e coverage bidirecional.
- Enriquecidos o resultado semântico e provenance somente com snapshots/localizadores documentais já
  existentes, sem nova interpretação; adicionadas fixtures 4/13/20/100 e validação canônica.
- Mantidas zero integração runtime, migration, matching, persistência, provider/OpenAI, chamada
  externa, promoção ou alteração de Legacy/lockfile.

## 2026-08-20 — Semantic Reconciliation da Sprint 10C.3D

- Adicionado `SemanticallyReconciledCommercialDocument/1` com documentary rules, recipients,
  aplicabilidade bidirecional, coverage, conflicts resolvidos/não resolvidos e semantic issues.
- Implementadas propagation e exclusions determinísticas para DOCUMENT, BRAND_LINE, MODEL,
  VERSION_SET, VEHICLE, CHANNEL e GROUP usando indexes exatos, sem fuzzy matching ou IA.
- Adicionadas directives documentais explícitas para aliases, notes/context e precedência
  `REPLACES|CORRECTS|SUPPLEMENTS`; validity disjunta não produz conflito.
- Cobertos 29 cenários sintéticos, incluindo general rules para 4/20/100 identities, channels,
  alternatives/cumulative, errata, determinismo, imutabilidade e ausência de domínio final.
- Mantidas zero integração runtime, migration, persistência, chamada externa ou alteração de Legacy.

## 2026-08-20 — Merge/Reconciliation Foundation da Sprint 10C.3D-A

- Adicionados contrato TypeScript versionado e primitive pura para reconciliar DocumentMap,
  UnitPlan e N `CommercialDocumentExtraction/1` sem integração runtime.
- Implementados dedupe exato com provenance completa, conflitos explícitos de identity/fact/scope,
  remapeamento estrutural de scopes/composition, issues seguros e coverage de units/partitions.
- Garantidos IDs/ordem determinísticos, serialização byte-equivalente e imutabilidade; adicionadas
  fixtures dirigidas de 1/4/20/100 identities, multi-channel, composition, partitions e falhas.
- Documentada a separação entre 10C.3D-A determinística e 10C.3D-B semântica. Nenhuma migration,
  chamada externa, Product/Policy/Offer, persistência ou ativação runtime foi adicionada.

## 2026-08-16 — Segmented Extraction da Sprint 10C.3C

- Adicionados provider/source session genéricos para Structured Outputs, com upload único por
  documento, reuse entre units, `store:false`, usage por response e cleanup após convergência.
- Implementados contexto/prompt brand-agnostic por unit, projeção strict com round-trip,
  canonicalização determinística server-owned e validação canônica de cada artifact.
- Adicionado scheduler com concorrência limitada, deadline por unit/total, ordem lógica, stop
  scheduling, abort de siblings, erros sanitizados e resultado operacional retryable em memória.
- Cobertas fixtures sintéticas 4/13/100/20, partitions, contexto, relações, falhas, determinismo,
  source reuse e cleanup. Runtime one-shot, Supabase, migrations, remotos e Legacy não mudaram;
  nenhuma chamada de modelo foi executada.

## 2026-08-16 — Document Map da Sprint 10C.3B

- Implementados `CommercialDocumentMap/1` e `CommercialExtractionUnitPlan/1`, com types estruturais,
  JSON Schemas Draft 2020-12 strict e validators puros de limites, ownership, referências,
  continuações e coverage.
- Adicionado planner determinístico server-owned com prioridade por tabela/seção/família/canal,
  fallback limitado, partitions de tabela lógica, headers/notas como context-only e overlap
  rastreável.
- Adicionadas fixtures sintéticas Geely/GWM/Fiat/Volvo/VW-like e testes de tabela multipágina,
  13/13 rows estimadas, regra geral posterior, 12 famílias/100 combinações, canais, volume,
  determinismo e zero órfãos.
- Schema, validator e planner ficaram fora do barrel raiz/Edge; somente types puros foram exportados.
  Runtime, providers, Supabase, RPCs, migrations, remotos e Legacy não mudaram; nenhum batch ou
  chamada de modelo foi executado.

## 2026-08-16 — Contrato intermediário da Sprint 10C.3A

- Implementado no core o contrato provider-agnostic `CommercialDocumentExtraction/1`, com types e
  JSON Schema Draft 2020-12 strict para documents, blocks, tables, identities, facts, scopes,
  composição e coverage.
- Adicionado validator puro para limites de payload, páginas/anos/valores, IDs locais, referências,
  continuação de tabelas, scopes, grupos/relações e consistência de coverage.
- Adicionadas fixtures sintéticas Geely-like, GWM-like 13/13, Fiat-like de doze famílias/cem
  identities e Volvo-like por canal, além de testes positivos, negativos e de boundary.
- Documentadas invariantes, limites, autoridade server-owned de IDs e separação do payload canônico.
  Runtime, providers, adapter Supabase, jobs, RPCs, migrations, Staging, Production e Legacy não foram
  alterados; nenhuma OpenAI, batch ou chamada externa foi executada.
- Marcada 10C.3A como implementada; a próxima etapa permanece 10C.3B — Document Map.

## 2026-08-14 — Spike de extração intermediária da Sprint 10C.3

- Consolidado o A/B Geely v4: precision, MMVs/MSRP, período, E/OU e integridade preservados, mas a
  broad-rule propagation ainda não fechou e confidence continuou alta; tuning one-shot foi pausado.
- Documentada a decisão por pipeline segmentado em duas camadas: document map/extraction units,
  intermediate facts, merge/reconciliation e somente então domain mapping para o contrato canônico.
- Proposto `CommercialDocumentExtraction/1` conceitual, com blocos, tabelas, identities, fatos,
  relações, scope, coverage e evidence, sem autoridade de Product/Policy/Offer/promoção.
- Definidos provider genérico, orchestration/plugin boundaries, artifacts JSON privados, retry por
  stage/unit, human review e rollout 10C.3A–F. Runtime, schemas, migrations e remotos não mudaram.

## 2026-08-14 — Prompt v4 estático da Sprint 10C.2

- Consolidado o A/B real Geely v3: 4/4 MMVs e MSRP, período e E/OU corretos, zero false positive
  material, recuperação substancial de Policies, Offers e evidence, mas permanência de
  underpropagation de uma regra documental ampla para duas rows abrangidas.
- Preservados Prompts v1/v2/v3 e ativado o v4 com `RULE INVENTORY / SCOPE LEDGER`, reconciliação
  bidirecional row-centric/rule-centric, exceptions first, propagação independente de proximidade,
  cobertura cumulativa de alternativas e gate de confidence por completude de regras.
- Provider atualizado para `openai/4`; schemas `CommercialLetterExtraction/1` e
  `commercial-letter/mmv-payload/1`, matching e ownership server-side permanecem inalterados.
- Fixtures sintéticas cobrem escopos DOCUMENT/MODEL, exceção explícita, Policy compartilhada,
  alternativas, coverage issue e a fronteira do gate HIGH. Nenhuma OpenAI ou escrita remota ocorreu;
  v4 ainda aguarda A/B autorizado.

## 2026-08-14 — Prompt v3 estático da Sprint 10C.2

- Preservados Prompts v1/v2 e ativado o v3 com inventários documental/MMV, enumeração exaustiva de
  tabelas, PY/MY separados, Policy-first, integridade Offer→Policy, coverage quantitativa/familiar,
  canais, contexto multipágina, preços, E/OU e confidence orientada a completeness.
- Provider semântico atualizado de `openai/2` para `openai/3`; schemas transport/canônico continuam
  v1 e toda autoridade de matching/promoção permanece server-side.
- Testes estáticos cobrem as regras do prompt e fixtures provam 20/100 MMVs, Policies compartilhadas,
  canais, anos separados, referências válidas e REVIEW existente. Limite >100 e pressão de output
  foram registrados como arquitetura futura; nenhuma chamada OpenAI ou escrita remota foi feita.

## 2026-08-14 — Integridade referencial Policy/Offer da Sprint 10C.2

- Auditado localmente o `unknownPolicy` do Volvo batch 113/Job 35: transport, parsing,
  reconstrução e sanitização preservam literalmente os client IDs e não removem nem deduplicam
  Policies. A inconsistência, portanto, já estava no output do provider e foi corretamente recusada
  antes do matching.
- Mantida a rejeição canônica para Offers parcial ou totalmente órfãs, sem placeholder, associação
  fuzzy ou descarte silencioso. Diagnóstico seguro agora expõe somente contagens, paths afetados e
  remappings (zero enquanto não existir transformação determinística de Policies).
- Adicionados 15 cenários sintéticos de integridade referencial. Prompt v2, schemas e provider não
  mudaram; nenhum retry, chamada OpenAI/Supabase, migration ou efeito comercial foi realizado.

## 2026-08-14 — Hardening do matching em volume da Sprint 10C.2

- Corrigido o fan-out sem limite do matching pós-provider: até 100 rows agora têm chaves MMV
  normalizadas e deduplicadas, processadas em chunks dirigidos de 10, sem full catalogue scan nem
  expressão textual `.or()`.
- Chaves com ano ausente ou não canônico não enviam valores inválidos às colunas `smallint` e não
  são elegíveis a confirmação por business key; fallback por tokens continua somente `suggested`.
- Adicionado diagnóstico local/test sanitizado para operação, volume, chunk, filtro, status e code
  PostgREST, mantendo genérico o erro persistido. Fixtures cobrem 100 MMVs, dedupe, caracteres
  especiais, anos opcionais e falha atômica de chunk. Nenhum provider ou remoto foi executado.

## 2026-08-14 — Lifecycle de timeout da Sprint 10C.2

- Substituído o timeout de negócio implícito do Vitest por deadline server-side configurável no
  OpenAIExtractionProvider, com AbortSignal, erro seguro `PROVIDER_TIMEOUT`, cleanup em `finally` e
  fail RPC atômica; lease e harness agora têm margem superior ao timeout funcional.
- Registrado o benchmark congelado: GWM/Job 31 sucedeu com 1/13 MMVs nominais; Fiat/Job 32 excedeu
  180 s; Volvo/VW não foram executados. O Job 32 foi recuperado pelo reclaim oficial e finalizado
  pela fail RPC como `PROVIDER_TIMEOUT`, com batch/documento `failed`, zero rows e hashes comerciais
  inalterados. Prompt v2, schemas, matching e FakeProvider foram preservados.
- Consolidado o resultado Geely v2: o retry oficial Job 30 sucedeu com 46.290 tokens e quatro rows,
  apresentou melhora parcial de cobertura e confidence 92–94, mas permaneceu todo `unmatched` e não
  encerrou a validação semântica. Prompt v3 não foi criado.

## 2026-08-13 — Sprint 10C.2 OpenAI extraction provider

- Corrigido localmente o blocker do Job 29 sem nova chamada OpenAI: toda confidence fornecida pelo
  provider conserva somente o score; o servidor deriva `high` (90–100), `medium` (70–89) ou `low`
  (0–69) antes da validação canônica. Band do provider deixou de ser autoritativa tanto no overall
  quanto nos metadados de campo; score inválido continua recusado.
- Prompt/provider permanecem v2 e os schemas canônico/transport não mudaram. A preservação de
  provider run/usage em falha pós-provider foi documentada para migration/RPC separada, sem update
  direto não atômico.
- Corrigido o reenvio confirmado de PDF já usado em outro dossiê: após a Server Action, o input
  oculto agora é reidratado com o `File` mantido no estado e preserva o role pareado pelo ID estável.
  A detecção por SHA-256, a confirmação explícita e a idempotência por submissão permanecem ativas;
  nenhuma migration ou chamada OpenAI foi realizada.
- Preparado localmente o Prompt/provider v2, sem chamada OpenAI: escopo documental explícito,
  coverage matrix por MMV, segunda passagem de reconciliação, herança de benefícios gerais em
  alternativas, contexto de tabelas, completeness em confidence/REVIEW e evidence de escopo.
- Preservado o Prompt v1 como baseline reproduzível e versionado o provider ativo como `2`, sem
  alterar `CommercialLetterExtraction/1`, transport schema, matching ou autoridade server-owned.
- Documentado o baseline real Geely v1: 43.804 tokens, ~US$ 0,285, quatro rows, 4/4 MMVs/MSRP,
  precision observada alta e nenhum false positive observado; recall incompleto em condições do
  EX2 MAX e EX5 PRO/MAX e confidence 96–98 sem penalização. A Sprint continua não validada.
- O segundo probe opt-in, ainda sem PDF, Files API ou Supabase, confirmou que a Responses API aceita
  o transport schema após a tipagem explícita de `enum`/`const`. O batch real não foi executado.
- Um probe opt-in sem PDF nem Supabase isolou a rejeição remanescente em
  `properties.timezone`: schemas `enum`/`const` sem `type` explícito. A derivação agora declara
  `type: string` para esses casos comprovadamente textuais e o auditor cobre os limites globais
  oficiais e cada branch de `anyOf`; nenhuma segunda chamada foi feita.
- Corrigida definitivamente a derivação Structured Outputs: `$defs` alcançáveis ficam na raiz,
  todos os `$ref` são validados, opcionais usam nullable no wire e keywords fora da allowlist são
  removidas apenas do transporte. Um auditor fail-fast e testes negativos impedem regressão antes
  de qualquer chamada externa.
- Diagnóstico opt-in de `invalid_json_schema` inclui somente `param` e mensagem curta sanitizada,
  sem body, headers, request, credenciais, URLs ou payloads.
- Diagnosticado o primeiro smoke real: o schema de transporte strict continha `oneOf` e
  propriedades opcionais incompatíveis com o subconjunto da Responses API. O schema canônico não
  mudou; a derivação para Structured Outputs agora usa `anyOf` e requer todas as propriedades.
- O provider passou a classificar 403 como auth e 400/422 como `PROVIDER_REQUEST_INVALID`, com
  diagnóstico local opt-in por etapa sem bodies, headers, credenciais ou payloads.

- Adicionado provider OpenAI server-only opt-in sobre Responses API, PDF nativo temporário,
  Structured Outputs strict, validação local, reconstrução server-owned, cleanup e erros seguros.
- Adicionados testes sem custo e smoke real separado com gates de Staging; nenhuma migration,
  promoção ou mudança em `Legacy` foi realizada.
- Adicionados `openai@6.49.0` (fixado e compatível com Node 20) e Ajv ao pacote web.

## 2026-08-12 — Sprint 10C: fundação do processamento

- Adicionado lifecycle auditável de jobs, claim concorrente, retry seguro e finalização atômica das rows.
- Adicionados contrato/registry de provider, provider fake determinístico, plugin de cartas comerciais e matching conservador de Product.
- Adicionada ação administrativa mínima de processamento e documentação operacional/de segurança.
- Hardening pré-Staging: JSON Schema executado com invariantes complementares, campos server-owned reconstruídos, lease/reclaim, locks de batch, auditoria ponta a ponta, limites de payload, matching direcionado, filename invariance e 34 assertions pgTAP.
- Staging validado funcionalmente em `shfsjyjxmgwnlexmdkcs` com o application flow, adapters, Storage, RPCs e FakeProvider reais: happy path, replay, retry, reclaim, concorrência, matching exact/suggested/unmatched, invariância de filename, campos server-owned, rejeição canônica e limites passaram sem efeito comercial. A ausência de pgTAP remoto foi compensada por 648/648 assertions locais e smokes remotos explícitos.
- Provider real permanece PENDENTE; a Sprint 10C não promove preços, Policies ou Offers automaticamente.

## 2026-08-11 — Sprint 10B: correção final do fluxo manual

- Removidos `encType` explícitos dos formulários ligados a Server Actions, deixando React/Next
  definirem método e codificação do `FormData`.
- A seleção de PDFs passou a ser cumulativa para seletor e drag-and-drop, preservando ordem e papel
  por documento, sincronizando `input.files` e informando duplicatas locais e excesso do limite.
- O operador não informa mais título: o servidor gera um identificador operacional neutro no fuso
  `America/Sao_Paulo`, sem inferir dados comerciais ou usar filename como fonte semântica.
- `competence` virou hint opcional do plugin `commercial_letters`. A coluna e o constraint existentes
  já aceitavam `NULL`; uma migration altera somente a validação da RPC, preservando batches
  históricos e evitando competência artificial.
- A migration foi aplicada exclusivamente ao Staging `shfsjyjxmgwnlexmdkcs` (versão remota
  `20260811232647`). O pgTAP relevante passou com 36/36 assertions e rollback sem batches/objetos
  residuais. Produção e `Legacy` permaneceram intocados.
- Corrigido o blocker de transporte dos uploads: Server Actions e middleware do Next.js usam teto
  centralizado de 64 MiB, enquanto UI e application layer limitam os arquivos de uma submissão a
  60 MiB para reservar overhead multipart. O limite de 32 MiB por PDF permanece inalterado.
- Corrigida a persistência do papel documental: arquivo e `documentRole` agora compartilham um
  identificador estável no `FormData`, eliminando o pareamento frágil entre dois arrays por índice.
  Pares ausentes ou duplicados falham explicitamente, sem fallback silencioso de papel.
- Sprint 10C não foi iniciada. A Sprint 10B continua pendente do teste manual final com dois PDFs.
## 2026-08-11 — validação de retomada da Sprint 10B

- Protegido o corpus local de pesquisa com `/data/research/` no `.gitignore`; 167 PDFs reais foram
  inventariados localmente sem alteração de nomes ou bytes e sem envio em massa.
- Executados no Compra Car Staging (`shfsjyjxmgwnlexmdkcs`) os smokes controlados de upload,
  duplicidade no mesmo dossiê e entre dossiês, signed URL, ausência de acesso público, expiração,
  compensação de Storage e reconciliação de órfãos.
- O estado final do Staging contém seis documentos de smoke reconciliados com seis objetos, sem
  órfãos, documentos ausentes ou resíduo da compensação.
- O pgTAP local do Import Engine passou com 34/34 assertions; a suíte SQL completa executou 611
  assertions e teve uma única falha textual preexistente sensível ao checkout CRLF, fora da 10B.
- Lint, typecheck, build e testes focados do Import Engine passaram. A falha web e o format check
  global foram classificados como baseline preexistente e não bloqueante.
- Corrigido mojibake localizado nas mensagens runtime do fluxo 10B de adicionar documentos, sem
  alterar contratos ou comportamento.

## 2026-08-02 — Sprint 10B: fundação do Import Engine

- Formalizado o Import Engine no ADR-013, com core independente, plugin `commercial_letters`, batch
  como dossiê, documentos físicos próprios e payload normalizado como boundary futura.
- Criada `pricing_import_documents` e campos explícitos de plugin/dossiê no batch, preservando
  colunas e registros históricos sem backfill artificial.
- Adicionado bucket privado `import-engine-documents`, upload administrativo de múltiplos PDFs,
  SHA-256 dos bytes, limites de 20 arquivos/32 MiB, detecção de duplicidade, idempotência e
  compensação de objetos em falha.
- Criadas RPCs server-only para criar dossiê, adicionar documentos, alterar papel, rejeitar e
  arquivar, com ator, correlation ID, CAS, lifecycle e auditoria append-only.
- Adicionadas listagem, criação, detalhe e inclusão posterior em `/admin/imports`, com signed URLs de
  curta duração e sem progresso/processamento artificial.
- Nenhum provider externo, extração, row por MMV, review ou promoção foi implementado. Produção e
  `Legacy` permaneceram intocados.
- Uma migration separada restaurou os ramos históricos financeiro e de Offer em
  `prevent_terminal_pricing_migration_rule_change`, isolando acessos a colunas por tabela. A suíte
  pgTAP local passou com 611 testes.
- As três migrations novas foram aplicadas somente ao Staging. A validação remota ficou pendente
  porque o conector administrativo atingiu o limite de uso antes do primeiro teste/smoke; nenhum
  artefato temporário chegou a ser criado.

## 2026-08-01 — Sprint 9H.5: encerramento do workspace comercial

- Preços persistidos como `published` passam a exibir o badge visual “Expirado” somente quando
  `ends_on` é anterior à data operacional de `America/Sao_Paulo`; lifecycle e status armazenado não
  mudaram.
- O falso erro após publicação foi corrigido no adapter: a RPC retorna a linha física sem o join de
  Product, portanto a relação agora é carregada e validada antes da mutação e reutilizada no
  mapeamento do retorno. Sucesso de publicação também fica separado de falha posterior de refresh.
- O modal de MSRP reutiliza `formatPtBrMoneyInput` e `ptBrMoneyCaretPosition`, preservando máscara
  pt-BR na digitação e decimal canônico no servidor. Formulários administrativos em escopo
  desativam autofill nos campos monetários, numéricos e de descrição.
- O cabeçalho mantém os três cards com altura/padding comuns; Competência, modo especial e descrição
  do período ocupam linhas independentes, sem deslocar o seletor.
- Auditoria somente leitura no Staging confirmou que o VW Taos (Product 617) possui apenas o preço
  #29, publicado desde 01/08/2026, aberto, `lock_version=2`, sem duplicidade ou sobreposição e com
  evento de publicação preservado. Haval #19/#24 confirmou a fronteira Expirado/Publicado.
- Nenhuma migration, RPC, enum, trigger, RLS ou regra temporal foi alterada. Produção e `Legacy`
  permaneceram intocados.

## 2026-08-01 — Sprint 9H.4: polish final do workspace comercial

- O período especial mantém Policies inalteradas atravessando o intervalo e cria linhas somente para
  substituições/adições. A sucessora referencia a predecessora e as Offers trocam o membership pelo
  `policyClientRowId`; a RPC 9H.2 encerra a predecessora em D−1 antes de criar a sucessora em D.
- A matriz de Offers publica suas seleções locais para o workspace. Checkboxes de Offers existentes
  ou novas recalculam imediatamente total, uso e disponibilidade das Policies, sem save ou refresh.
- O modal oficial de MSRP ganhou “Publicar agora”: cria o draft, reutiliza o ID/lock retornado e chama
  a publicação individual existente. Após sucesso, o refresh local atualiza cabeçalho e workspace.
- O cabeçalho passou à proporção aproximada 55/25/20; a coluna redundante de veículo saiu do grid
  fixado pelo workspace; ações foram alinhadas e a matriz de Offers foi compactada para desktop.
- Nenhuma migration, RPC, trigger, regra de lifecycle, RLS, auditoria ou contrato público foi
  alterado. Produção e `Legacy` permaneceram intocados.

## 2026-08-01 — Sprint 9H.3: operação mensal definitiva de Policies e Offers

- Corrigida a cópia Agosto→Setembro: cada linha local preserva o ID da Policy de origem e as Offers
  resolvem memberships por `policyClientRowId`. Um vínculo expirado sem sucessora bloqueia o save;
  não existe mais fallback silencioso para `policyId` do mês anterior.
- O loader completa Policies referenciadas por Offers mesmo quando o limite de histórico não as
  trouxe, eliminando joins parciais entre consultas paginadas independentes.
- O grid ganhou Rebate monetário opcional, persistido em `dealer_rebate_amount` com proveniência
  `manual`, limitado ao benefício do cliente e excluído do total/preço transacional.
- Adicionado `invoice_discount`/Desconto NF como Policy de valor fixo, combinável e publicável.
- Valores copiados entram no estado em pt-BR; descrição virou modal compacto; remoção usa botão
  circular acessível; o cabeçalho desktop usa proporção 50/30/20.
- Quando falta MSRP aplicável, “Adicionar preço” abre o formulário oficial de preço público em
  modal e cria somente draft pelo fluxo existente, sem INSERT direto.
- Migration canônica `20260801202216` aplicada somente ao Staging. O cenário real do Product 616 foi
  validado de forma reversível: três Policies e duas Offers de setembro foram criadas com
  memberships exclusivamente de setembro; Rebate não alterou os totais.
- Produção e `Legacy` não foram tocados. Nenhum commit ou push foi realizado.

## 2026-08-01 — Sprint 9H.2: período comercial e rollover atômico de Policies/Offers

- O workspace agora deriva um período mensal completo ou um intervalo especial interno à
  competência, com cabeçalho compacto em três colunas e sem vigência editável por linha.
- Na ausência de dados do período, Policies e Offers vigentes em D−1 são copiadas somente para o
  estado local. O salvamento cria exclusivamente novos drafts com o intervalo exato.
- Criada a RPC `create_commercial_period_draft`, exclusiva de `service_role`, que fecha
  predecessoras esperadas e cria sucessoras de Policy/Offer numa transação com advisory lock,
  optimistic locking, ator, correlation ID e auditoria append-only.
- A exceção terminal de Offer `published` permite somente `valid_to = period_start - 1` dentro da
  nova RPC. Status, memberships e identidade econômica permanecem imutáveis; Offer `archived` e
  fechamento mensal retroativo de publicada são rejeitados.
- Publicação continua individual. Não foi criado comando de publicar período nem entidade/tabela de
  competência.
- A migration `20260801190935` foi aplicada apenas ao Staging. A validação SQL reversível confirmou
  D−1, intervalo exato, status/memberships, snapshots, concorrência e rollback sem deixar resíduo.
- A limpeza aprovada foi executada por script transacional Staging-only, sem migration e sem
  `TRUNCATE CASCADE`: 25 Policies, 14 Offers, 25 memberships, 6 batches/16 rows/16 outputs de Policy
  e 37 auditorias correspondentes foram removidos. Permaneceram 10 Products, 17 preços, 1 parameter
  set, 4 batches/8 rows/8 outputs de preço e suas 23 auditorias protegidas; triggers retornaram a
  `origin`.
- Produção e `Legacy` não foram tocados. Nenhum commit ou push foi realizado.

## 2026-08-01 — Sprint 9H.1: diagnóstico do rollover e refinamento da operação mensal

- Reproduzido no Staging, em transação revertida, o rollover da Taxa do Product 616 em setembro:
  o SQLSTATE `55000` protege as Offers não arquivadas #26 e #28 que usam a Policy #66.
- A falha de dependência agora preserva o lote editado, destaca a linha e informa Offers relacionadas
  e correlation ID, sem arquivar, encerrar ou substituir Offers automaticamente.
- A prévia instantânea voltou a usar o Product fixado pelo workspace e o mesmo domínio da
  submissão para Taxa, IPVA, Seguro, Emplacamento e valores fixos, sem persistência.
- O cabeçalho passou a uma grade 2×2 com Product, competência N−6/N+6, data-base e MSRP; Offers
  existentes e novas compartilham uma única matriz, com memberships persistidos, edição de drafts,
  detalhes acessíveis, archive explícito e estados published/archived somente leitura.
- Nenhuma migration ou RPC nova foi criada nesta etapa; Produção e `Legacy` não foram tocados.

## 2026-08-01 — Sprint 9H: operação mensal e rollover temporal de Policies

- Adicionada competência mensal persistida na URL, data-base única do lote e leitura por interseção
  temporal com histórico anterior recolhido e limitado.
- A matriz de Offers passa a receber somente Policies vigentes na data-base; preço público aplicável
  aparece como referência somente leitura.
- Criada RPC transacional de lote com rollover por Product + tipo, controle otimista, rejeição de
  futuro/ambiguidade, proteção de Offers não arquivadas e auditoria correlacionada.
- A imutabilidade de Policy publicada ganhou exceção mínima e autenticada apenas para `ends_on`
  durante o rollover. Archive, memberships e Offers históricas permanecem inalterados.
- Adicionados testes de contexto mensal e pgTAP 019 para timeline, rollback, auditoria, Offers e
  imutabilidade. A migration foi aplicada exclusivamente ao Staging; Produção permaneceu intacta.

## 2026-07-31 — Sprint 9G.1: estabilização da UX e dataset de Staging

- Corrigido o update do dirty state durante render: `onDirty` agora ocorre no evento antes do
  updater funcional local, sem atualizar o workspace durante a renderização do grid.
- Linhas auxiliares completamente vazias são removidas do payload; linhas parciais continuam
  validadas. Após sucesso, Policies e Offers são relidos via `router.refresh()` e os formulários
  transitórios são reconstruídos para o Product selecionado.
- Labels administrativos usam Taxa e Voucher sem alterar identifiers nem títulos persistidos.
- Topbar, header contextual e headers de tabela usam tokens compartilhados e offsets sticky
  acumulados, com wrappers desktop sem ancestral de overflow vertical concorrente.
- O script idempotente `scripts/staging/07-expand-admin-dataset.sql` ampliou exclusivamente o
  Staging `shfsjyjxmgwnlexmdkcs` de 2 para 10 Products, reutilizando oito veículos reais de
  `Legacy/products.csv`; 608/609 e todos os dados existentes foram preservados.

## 2026-07-31 — Sprint 9G: workflow administrativo por veículo

- Consolidado o workspace “Criar políticas” com seletor único de veículo, Policies e combinações.
- Removido o CTA individual “Novo preço”; “Criar preços” passa a ser o fluxo oficial em lote.
- A tabela de preços publica drafts/needs-review pela RPC existente, com confirmação e refresh.
- Adicionada migration com quatro RPCs administrativas auditadas, controle otimista, archive sem
  DELETE e substituição atômica de memberships de Offer draft.
- Policies em uso por Offers ativas são protegidas; registros terminais permanecem imutáveis.
- Headers do Admin e das grades longas permanecem sticky com fundo opaco e z-index explícito.
- Adicionado pgTAP 016 para lifecycle, dependências, atomicidade, concorrência e auditoria.
- A migration foi aplicada exclusivamente ao Staging `shfsjyjxmgwnlexmdkcs` como versão remota
  `20260731172651`; as 16 asserções pgTAP passaram em transação revertida e a conferência posterior
  confirmou zero fixture e zero evento de auditoria residual. Produção e `Legacy` não foram tocados.
- Próxima etapa registrada: importação assistida por IA com staging e aprovação humana.

## 2026-07-30 — Sprint 9E: estabilização da homologação de Pricing

- Corrigida a fronteira Server Action/Client Component do lote de preços, removendo objetos com
  protótipo nulo e adicionando regressão explícita de serialização plain-object.
- Numeric do PostgREST passou a ser canonicalizado imediatamente como decimal string nos adapters
  de Pricing, inclusive referências financeiras e amounts, sem cálculo financeiro em floating point.
- Auth agora distingue sessão ausente de erro técnico, registra timings sanitizados apenas em DEV e
  evita consultas duplicadas na mesma renderização; loaders independentes permanecem paralelos.
- Criado combobox acessível e reutilizável de Product nas telas de preços em lote, policies e offers;
  o display segue `Marca Modelo Versão MY/PY`.
- Batch Policies passou a resolver exatamente um MSRP publicado e uma referência financeira pela
  data de início, sem depender de `endsOn`; prévia e envio agora compartilham a mesma regra temporal.
- A grade de Policies foi condensada em oito colunas, com títulos, taxas fixas e vigências derivados
  no servidor; a busca de Product usa tokens em AND e popup em portal para evitar clipping.
- Preços e valores fixos de policies agora mantêm máscara monetária pt-BR durante a edição, sem
  alterar o decimal canônico persistido; Taxa aceita vírgula decimal e continua usando cálculo exato.
- A máscara monetária normaliza estados transitórios de edição antes de reagrupar milhares, evitando
  corrupções como `1.0000,00`; parsing de persistência permanece estrito e separado do display. O
  payload de policies também canonicaliza `amount` antes da RPC.
- Labels administrativos foram reduzidos a `Taxa` e `Voucher`, preservando identifiers e títulos
  persistidos existentes. A grade de policies foi compactada para caber no desktop sem scroll.
- A migration `20260730223142_fix_manual_policy_batch_open_ended_msrp.sql` substitui somente a RPC
  atômica para aceitar, em policy aberta, MSRP finito válido em `startsOn`; incompatibilidades reais
  continuam rejeitando e revertendo o lote completo.
- A migration foi aplicada somente ao Staging. Testes SQL reversíveis validaram Bônus + IPVA,
  rejeição de MSRP expirado e Taxa 24/0,49/60, todos com zero resíduo após rollback.
- A segunda validação no Staging persistiu atomicamente Trade-in + Taxa + IPVA no batch 16, criando
  três policies `draft`; a Taxa 24/0,49/60 foi confirmada em R$ 6.893,41.
- Falhas da RPC agora são registradas no servidor com correlation ID e erro técnico, mantendo a
  mensagem segura no frontend. Produção e `Legacy` não foram acessados ou alterados.

## 2026-07-29 — Sprint 9D: Offer Builder

- Criada `/admin/prices/offers` com seleção explícita de Product, MSRP, vigência e Policies
  compatíveis, preview monetário exato e listagem de drafts recentes.
- Adicionados validação e caso de uso no core, contratos, adapter server-only e RPC atômica para
  Offer, memberships e auditoria; browser roles não recebem execução.
- A migration `20260729202538` foi aplicada somente em Staging. O teste remoto reversível validou
  duas Policies, reuso entre Offers e rejeição cross-product, preservando os counts após rollback.
- pgTAP 011/012/013 permanece pendente por indisponibilidade da stack local, não por falha da suíte.

## 2026-07-29 — Sprint 9C: Batch Policies

- Criada `/admin/prices/policies/input` para até 100 CommercialPolicies manuais em draft.
- O fluxo preserva as fronteiras UI → Server Action → core → repository → adapter → RPC e resolve
  MSRP e Financial Parameter Set no servidor; cálculos monetários usam `decimal.js`.
- As migrations `20260729190304` e `20260729192018` foram aplicadas somente no Staging. A segunda
  corrige a resolução de variáveis PL/pgSQL identificada pelo primeiro teste transacional.
- Teste remoto fixed/calculated/financing passou com rollback integral. Nenhuma Offer ou membership
  foi criada. pgTAP 011/012 permanece pendente por indisponibilidade da stack local.

## 2026-07-29 — Sprint 9C-0: Financial Reference Foundation

- Preparada migration forward-only para derivar taxas decimais de CDI/spread, impedir vigências
  publicadas sobrepostas e executar rollover transacional com optimistic locking e auditoria.
- Definido spread mensal do MVP em `0,3000%` e aprovado CDI mensal inicial de `1,1458%`, resultando
  em taxa mensal de referência de `1,4458%`; o dado não faz parte da migration.
- Preservadas `manual` e `api_import`, preparando futura ingestão por `source_snapshot` sem crawler,
  API ou fornecedor.
- A migration foi aplicada somente ao Staging `shfsjyjxmgwnlexmdkcs`; V1 foi criada como draft e
  publicada pela função oficial, e o teste de rollover foi revertido sem deixar fixture.
- Adicionado pgTAP para lifecycle, segurança, derivação, imutabilidade, rollover e não regressão.
  A execução local permanece pendente porque `supabase start` não criou a stack neste ambiente.

## 2026-07-28 — Sprint 9B: Batch Prices

- Criada a rota administrativa `/admin/prices/input`, com grade responsiva e pesquisável, linha
  vazia operacional, limite de 100 preços e seleção de todos os Products administrativos, inclusive
  inativos e não públicos.
- Adicionados contratos, validação pt-BR sem floating point, caso de uso, repository e adapter
  dedicado; erros preservam a linha por `clientRowId` e conflitos não sobrescrevem preços existentes.
- A RPC transacional `create_manual_price_batch` persiste batch, rows, outputs, auditoria e preços
  `draft` de forma atômica, com ator/correlation server-side, admin ativo e execução exclusiva por
  `service_role`.
- A proteção de `pricing_import_batches.source_type` permanece no enum físico
  `pricing_source_type`; não foi criada constraint redundante. Batch Policies, Offer Builder,
  publicação e importação por arquivo continuam fora do escopo.
- Adicionados testes de core, adapter, serviço/UI e pgTAP; a suíte SQL local completa passou com 428
  testes após reset integral do Supabase.
- A migration foi aplicada exclusivamente ao Staging `shfsjyjxmgwnlexmdkcs`. O teste funcional
  transacional foi revertido deliberadamente e as contagens antes/depois permaneceram idênticas,
  sem fixture artificial e sem migration pendente.

## 2026-07-28 — Sprint 9A: Pricing Domain V2

- Evoluído o modelo de `CommercialOffer 1:N CommercialPolicy` para Product 1:N Policy e
  Offer↔Policy N:N, com backfill transacional e remoção da FK direta antiga.
- Adicionados lifecycle independente, publicação e auditoria de Policy, composição imutável de Offer
  publicada, validações de Product/vigência e RPCs auditadas de link/unlink com optimistic locking.
- Todas as Policies publicáveis passaram a exigir benefício positivo; manutenção usa valor fixo,
  wallbox/other permanecem monetizados e registro gratuito usa exatamente 1% do MSRP-base.
- Adicionados contratos discriminados, cálculo monetário puro de benefício/preço transacional e
  adaptador Supabase para Policies, Offers e memberships.
- Batch persistente passou a aceitar origem manual e a imutabilidade terminal de
  ProductPublicPrice passou a abranger `ends_on`, `price_type`, `source_reference` e
  `legacy_source_id`.
- Criado ADR-012 e sincronizados domínio, contratos, roadmap e documentação de Pricing. As próximas
  etapas são 9B Batch Prices, 9C Batch Policies e 9D Offer Builder.
- A migration foi aplicada exclusivamente ao Staging `shfsjyjxmgwnlexmdkcs`: 1 Offer e 1 Policy
  legadas foram reconciliadas em 1 membership, sem alteração das contagens de Offers, Policies,
  applications, batches ou preços e sem acesso à Produção.

## 2026-07-27 — Criação e edição administrativa de ProductPublicPrice

- adicionados contratos e casos de uso de criação em `draft` e edição de status não terminais;
- implementada escrita server-side no adapter dedicado, com ator autenticado e concorrência
  otimista por `lock_version`, sem migration ou RPC nova;
- `/admin/prices` recebeu formulário acessível, feedback, refresh da lista e BRL sem centavos;
- publicação, revisão, rejeição, arquivamento, Offers, Policies e filtros permanecem pendentes.

## 2026-07-27 — ProductPublicPrice administrativo em leitura

- criada a rota `/admin/prices` dentro do Admin existente, com loading, sucesso, vazio, erro e
  paginação server-side;
- adicionados entidade, tipos monetários/status, DTOs, repository e caso de uso mínimos de leitura;
- adicionado `ProductPublicPriceSupabaseAdapter`, dedicado a Pricing e sem alteração do adapter
  legado;
- adicionados mapeamento defensivo, formatação pt-BR e testes de core, adapter, service e UI;
- documentada a divergência de `ends_on` resolvida pela migration versionada mais recente;
- mantidos fora do escopo escrita, publicação, CommercialOffer, CommercialPolicy e
  `commercial_policy_applications`.

## 2026-07-27 — Auditoria do Admin para evolução de Pricing

- documentado o inventário completo das rotas, camadas, componentes, autenticação, autorização,
  contratos, acessos a dados e testes da área administrativa Next.js existente;
- registrado o mapa de dependências por tela e a aderência ao domínio vigente em que
  `CommercialPolicy` pertence diretamente a `CommercialOffer`;
- classificados gaps, dependências legadas, riscos e componentes reutilizáveis, sem alteração de
  código funcional ou banco;
- definido roadmap incremental do MVP-A preservando o Admin atual e tratando
  `commercial_policy_applications` somente como compatibilidade histórica.

## 2026-07-26 — Fechamento da revisão técnica de pricing

- Adicionado o fluxo transacional `publish_commercial_offer`, independente do modelo legado de
  applications, com MSRP publicado obrigatório, validação completa das policies, auditoria,
  bloqueio de UPDATE direto e proteção de DELETE para offers terminais.
- Ausência de rebate passou a ser `NULL/NULL`; o rateio agregado usa maiores restos em centavos sem
  valores negativos. Voucher, maintenance e `other` legado receberam validações consistentes entre
  SQL e TypeScript.
- Tipos de pricing foram centralizados em contracts, valores deprecated documentados e relatórios
  passaram a separar ocorrências, offers, policies, prices, sources e entidades bloqueadas.
- Migration e pgTAP foram preparados, sem aplicação, backfill, escrita ou publicação.

## 2026-07-26 — Finalização da migration de pricing legado

- Oficializada a alocação auditável de `total_dealer_rebate`: componentes explícitos prevalecem e o
  total sem detalhamento é rateado por benefício positivo entre retail, trade-in e financiamento,
  com ordem determinística, resíduo controlado e bloqueio quando não alocável.
- Adicionados `free_registration`, `free_maintenance`, `fuel_or_recharge_voucher` e suporte final a
  `free_wallbox`, além de `non_monetized`, parâmetros específicos e validação de publicação por tipo.
- O dry-run passou a gerar `dealer-rebate-allocation-analysis.csv`; os falsos mismatches agregados
  foram removidos sem reclassificar `others_bonus` ou criar policy genérica.
- Migration e testes SQL foram ampliados sem aplicação, escrita, backfill ou publicação.

## 2026-07-26 — Pricing legacy dry-run 3.0.0

- Introduzidos candidatos de `commercial_offers` como agregado pai por linha legacy, com vínculo ao
  MSRP versionado, policies da mesma offer, accumulators OR somente para duas ou mais policies e
  relatórios específicos de offers, prices, policies e issues informativos.
- Corrigidos os 254 falsos financiamentos incompletos: `0/0/0` e `NULL/NULL/NULL` agora significam
  ausência de financiamento; os 459 casos reais usam CDI mensal composto + spread de 0,30 p.p. e
  diferença de valores presentes.
- Confirmados seguro em 3% do MSRP por ano e IPVA proporcional, com base de cálculo versionada;
  divergência do total histórico passou a `LEGACY_CALCULATION_METHOD_DIFFERENCE` informativa.
- Ampliada a migration futura, não aplicada, com `commercial_offers`, FKs, índices, constraints,
  imutabilidade terminal e validação de publicação independente por tipo de policy.

## 2026-07-26 — Pricing legacy dry-run 2.0.0

- Mapeados rebates de varejo, trade-in e taxa para `dealer_rebate_amount`, com reconciliação separada
  de `total_dealer_rebate`, preservando zero e excluindo rebate do benefício do cliente.
- Implementados IPVA proporcional pelo mês da oferta, grupos OR provisórios, CDI efetivo anual de
  14,78% convertido por capitalização composta e financiamento pelo método oficial de valor presente,
  com comparativo de total pago e rastreabilidade do parameter set.
- Ampliados reconciliação, análise de termos financeiros e samples determinísticos; criada migration
  estrutural idempotente, sem execução, backfill ou publicação.

## 2026-07-26 — Pós-validação do restore local de pricing

- Corrigido o falso sucesso do restore: o fallback agora executa `pg_restore` em `postgres:17` com o
  snapshot montado como somente leitura, `--dbname` obrigatório e sem `--file`; `RESTORED_LOCALLY`
  só é emitido após validar as sete contagens explícitas esperadas no banco local.

## 2026-07-26 — Correção de bindings Docker do restore de pricing

- A detecção da porta PostgreSQL agora normaliza publicações IPv4 e IPv6 equivalentes para o mesmo
  mapeamento lógico `54322 -> 5432/tcp`, preservando a rejeição de portas, protocolos, endereços e
  mapeamentos conflitantes.
- O preflight local também aceita o IP privado interno exato do container PostgreSQL inspecionado,
  com normalização IPv4/IPv6 e CIDR, sem aceitar correspondência apenas por sub-rede ou endereço
  remoto.

## 2026-07-26 — Exportação oficial do snapshot legado de pricing

- Criado `export-pricing-legacy-snapshot.ps1` para validar origem remota autorizada e somente leitura,
  gerar dump custom data-only das sete tabelas permitidas e publicar somente após TOC, SHA-256 e
  validação pelo script existente.
- Adicionados `psql`/`pg_dump` locais com fallback `docker run postgres:17`, credenciais via ambiente
  temporário, exclusão e rejeição de `SEQUENCE SET`, arquivos temporários e manifesto sanitizado.
- Registrado o snapshot manual validado em 2026-07-26 (262858 bytes, SHA-256
  `ad982044e1c93dc98e47f180a128d6d7d088fa4ecb0a8c05d88ddd6c6cc0648c`), sem afirmar restore ou
  dry-run real.
- Ampliada a suíte PowerShell com exportação integral simulada, allowlist remota, confirmação,
  prioridade local/Docker, segurança de argumentos, hash/manifesto e preservação em falha, sem rede.

## 2026-07-26 — Fallback Docker para snapshots de pricing

- Centralizada em `PricingSnapshot.Common.psm1` a resolução e execução de `psql` e `pg_restore`,
  preservando prioridade para executáveis locais e adicionando fallback automático via `docker exec`.
- O container PostgreSQL possui default configurável, é inspecionado quanto a existência, estado
  `running`, health `healthy` e mapeamento da porta local para a porta interna; dumps seguem por
  `stdin`, sem cópia, instalação ou mudança de imagem.
- Mantidos argumentos seguros, validações, allowlist, fluxo, relatórios e contrato do manifesto; a
  senha continua somente em `PGPASSWORD` temporário e não aparece em argumentos ou mensagens.
- Ampliada a suíte PowerShell com cenários de prioridade local, fallback, Docker ausente, container
  inexistente/unhealthy e estabilidade do manifesto, sem conexão ou alteração de banco.

## 2026-07-25 — Preparação de fotografia local do legado de pricing

- Criados três scripts PowerShell e um módulo comum para validar dump autorizado, restringir o alvo
  à stack local, restaurar somente as sete tabelas legadas necessárias e encadear automaticamente o
  pricing dry-run.
- Implementadas validações fail-closed de caminho, tamanho, extensão, SHA-256, formato/TOC,
  allowlist, owner, comandos destrutivos e argumentos perigosos, sem flag de bypass remoto.
- A restauração exige confirmação explícita, destino local vazio, transação única e opções data-only;
  credenciais ficam fora de argumentos, saídas e manifesto.
- Adicionado manifesto sanitizado com identidade local, contagens, resultado, hash comparável e
  status, além de regras de `.gitignore` para dumps, snapshots, SQL restaurado e relatórios locais.
- Criada suíte PowerShell com 11 cenários, incluindo execução do dry-run sobre fixture e validação do
  manifesto, sem conexão de banco. Nenhuma migration, acesso remoto, backfill ou gravação no domínio
  de pricing foi realizada nesta etapa.

## 2026-07-25 — Dry-run local do legado de pricing

- Criado `@compra-car/pricing-dry-run`, com leitura PostgreSQL em transação `REPEATABLE READ READ
  ONLY`, bloqueio de host remoto e identidade sanitizada, sem DML, DDL, RPC ou migration.
- Separados módulos de leitura, decimal exato, canonicalização, classificação, fingerprints,
  reconciliação, cobertura de views e geração de relatórios determinísticos.
- Implementadas as classificações de preço, oito componentes/evidências comerciais, conflitos,
  rebates não convertidos, totais somente conciliados e sugestões de combinação nunca publicáveis,
  com os 16 issue codes mínimos.
- Adicionados dez relatórios JSON/CSV/README, baseline comparativa, cutoff, versão do algoritmo,
  hash sem `executedAt` e opção de falha quando a fotografia muda.
- A fixture gerou 5 candidatos de preço, 1 conflito, 9 candidatos de política, 1 sugestão de
  acumulador e 11 itens de revisão. A stack local sem seed gerou relatórios vazios e divergência
  integral da baseline, sem qualquer gravação de banco ou acesso remoto.
- Adicionados 9 testes unitários cobrindo dinheiro decimal, preços, componentes, AND/OR,
  fingerprints, CSV, hash, reconciliação e bloqueio de banco remoto.

## 2026-07-25 — Views de leitura da Sprint 9

- Criada `20260725191747_create_pricing_read_views.sql` com cinco views `security_invoker` para
  períodos de preço publicados, preço vigente, aplicações de políticas, acumuladores materializados
  e compatibilidade paralela v2.
- A leitura corrente exclui preços futuros e estados não publicados, deriva o fim pelo próximo
  `starts_on` e representa ausência sem fallback zero.
- As views comerciais expõem somente contratos sanitizados; acumuladores retornam valores já
  materializados e IDs de membros em ordem determinística, sem somar políticas isoladas.
- `vw_product_value_current_v2` preserva as oito colunas, ordem e tipos da view legada, troca apenas
  a origem do preço e mantém explicitamente o cálculo legado de valor percebido, que não possui
  equivalente seguro no novo modelo. `vw_product_value_current` não foi alterada.
- Default ACLs foram neutralizadas; `public`, `anon` e `authenticated` não têm acesso e
  `service_role` possui somente SELECT. Foram adicionados 33 testes pgTAP; reset limpo e os 326
  testes SQL passaram exclusivamente na stack local, sem backfill ou acesso remoto.

## 2026-07-25 — Validação e publicação transacional da Sprint 9

- Criada `20260725184656_create_pricing_validation_and_publication_functions.sql` com quatro funções
  públicas para publicar preço, parâmetros financeiros, política e acumulador, seis helpers internos
  e sete triggers de proteção.
- As RPCs validam admin ativo pelo `profiles`, estado, lock otimista, correlation ID, domínio e
  auditoria atômica; somente `service_role` possui `EXECUTE`, sem acesso de browser ou helper público.
- Implementadas validações dos oito tipos, `scope_snapshot.productIds` exato, MSRP/parameter set
  publicados, snapshots v1, fórmulas `numeric`, HALF_UP e intermediários do financiamento com
  tolerância decimal máxima de `1e-10`.
- Acumuladores calculam fingerprint canônico por IDs ordenados, materializam somente produtos na
  interseção dos membros e somam `monetary_value` já congelado antes da publicação.
- Publicação direta pelo `service_role` foi bloqueada sem variável de sessão; rows de batches
  promovidos/arquivados, outputs promovidos e reviews históricas ficaram imutáveis, inclusive contra
  nova review depois da promoção.
- Adicionadas 74 asserções pgTAP e ajustadas fixtures/contagem estrutural afetadas; reset limpo e os
  293 testes SQL passaram exclusivamente na stack local. Nenhum banco remoto foi acessado ou
  alterado.

## 2026-07-25 — Lifecycle e proteção de auditoria da Sprint 9

- Criada `20260725182545_create_pricing_lifecycle_and_audit_triggers.sql` com quatro funções
  `SECURITY INVOKER` e 23 triggers, sem funções completas de publicação ou writer genérico de
  auditoria.
- Automatizados `updated_at` e `lock_version` nas sete tabelas aplicáveis; o incremento ignora valor
  informado pelo caller e é sempre exatamente `OLD.lock_version + 1`.
- Tornada `pricing_audit_events` append-only também contra UPDATE/DELETE do owner e bloqueados
  regressão de estado terminal, delete e alterações materiais em preços, parâmetros, políticas,
  aplicações, acumuladores e imports em estado terminal.
- Funções com `search_path = ''` e `EXECUTE` revogado de `public`, `anon`, `authenticated` e
  `service_role`; RLS, grants mínimos e default privileges globais permaneceram inalterados.
- Adicionadas 43 asserções pgTAP e ajustado o teste estrutural para o estado pós-lifecycle; reset
  limpo e os 219 testes SQL passaram exclusivamente na stack local. Nenhum banco remoto foi
  acessado ou alterado.

## 2026-07-25 — Importação, revisão e auditoria da Sprint 9

- Criada `20260725180750_create_pricing_import_and_audit_tables.sql` com quatro enums e cinco
  tabelas para batches, linhas, outputs, revisões humanas e eventos de auditoria.
- Adicionadas as três FKs RESTRICT de `source_import_row_id` das tabelas core para
  `pricing_import_rows`, após confirmar localmente que não havia referências preenchidas.
- Implementados 16 checks, 16 FKs nas tabelas novas, sete mecanismos de unicidade e 19 índices
  explícitos, incluindo exactly-one-output, allowlists, SHA-256, datas, notas e snapshots.
- RLS e ACLs mínimas foram aplicados no mesmo arquivo: sem acesso de browser; quatro tabelas
  operacionais com SELECT/INSERT/UPDATE para `service_role`; auditoria com somente SELECT/INSERT;
  sequences com USAGE/SELECT.
- Adicionadas 47 asserções pgTAP; os 176 testes SQL passaram exclusivamente na stack local. Nenhum
  banco remoto, objeto legado, default privilege global ou consumer foi alterado.

## 2026-07-25 — Segurança do schema core de preços da Sprint 9

- Criada `20260725175159_secure_pricing_core_schema.sql` para habilitar RLS nas sete tabelas core e
  neutralizar, somente nesses objetos, as ACLs amplas herdadas dos default privileges da baseline.
- `public`, `anon` e `authenticated` ficaram sem privilégios nas tabelas e nas seis sequences
  identity; nenhuma policy ou acesso direto de browser foi criado.
- `service_role` recebeu explicitamente SELECT/INSERT/UPDATE nas tabelas e USAGE/SELECT nas
  sequences, sem DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ou UPDATE de sequence.
- Adicionadas 17 asserções pgTAP de segurança e atualizado o teste estrutural para exigir RLS; os
  129 testes SQL passaram exclusivamente na stack local descartável.
- Default privileges globais, owners, objetos legados, migrations anteriores e `Legacy`
  permaneceram inalterados; nenhum banco remoto foi acessado ou alterado.

## 2026-07-25 — Primeira migration estrutural da Sprint 9

- Criada a migration forward-only `20260725172755_create_pricing_types_and_core_tables.sql` com os
  cinco enums e as sete tabelas centrais de preços públicos, parâmetros financeiros, políticas,
  aplicações e acumuladores, sem dados, backfill, views, RLS, comandos de grant/revoke ou funções.
- Implementadas apenas constraints locais e índices documentados; regras transacionais de
  publicação, cálculo, auditoria, segurança e importação permanecem nas migrations seguintes.
- Adicionada suíte pgTAP estrutural com 39 asserções; o reset e os 112 testes SQL do repositório
  passaram exclusivamente na stack Supabase local descartável.
- Nenhum banco remoto foi acessado ou alterado, e nenhuma migration anterior ou conteúdo de
  `Legacy` foi modificado.
- Confirmado localmente que default privileges da baseline concedem ACLs amplas aos novos objetos;
  por isso, a migration estrutural não deve ser aplicada isoladamente em ambiente compartilhado
  antes da migration de segurança com RLS e revokes explícitos.

## 2026-07-25 — Revisão final da arquitetura da Sprint 9 antes das migrations

- Separados `input_monetary_value`, input opcional por aplicação/produto, e `monetary_value`, valor
  econômico final obrigatório e congelado.
- Formalizadas as semânticas de fixed amount, percentual de MSRP, valor presente e estimativa
  manual, com campos/constraints de publicação específicos para os oito tipos enum do MVP.
- Consolidado que zero só existe em draft/needs_review, tipos dinâmicos ficam fora do MVP e
  benefícios novos usam `other + manual_amount`.
- CDI/spread continuam sem valor real definido: não bloqueiam tabelas ou drafts, mas bloqueiam
  publicação de financiamento sem parameter set manual versionado e publicado.
- Nenhuma migration, implementação funcional ou alteração de banco foi executada nesta revisão.

## 2026-07-25 — Arquitetura da Sprint 9: preços e políticas comerciais

- Aceito o ADR-011 como detalhamento definitivo do modelo alvo iniciado no ADR-009, separando preço
  público, política, aplicação monetária por produto, acumuladores e importações revisáveis.
- Documentados o schema alvo completo, o plano forward-only de migração/backfill e as regras
  versionadas de cálculo, incluindo valor presente do financiamento subsidiado e snapshots.
- A arquitetura preserva o legado, mantém `vw_product_value_current` temporariamente e envia zero,
  duplicidades e relações E/OU ambíguas para `needs_review`.
- Esta etapa não criou código funcional, migration ou objeto de banco e não alterou Appsmith,
  Next.js, schema ou dados.

## 2026-07-25 — Início da Sprint 9: investigação de preços e políticas comerciais

- Iniciada a inspeção somente leitura do modelo legado, dos dados remotos e dos consumidores de
  preço/política no MVP-a, MVP-u e Appsmith histórico.
- Criado `docs/data/PRICE_AND_COMMERCIAL_POLICY_INVENTORY.md` com inventário estrutural e de código,
  perfil atualizado, fluxo atual, lacunas de CRUD, opções de modelagem, riscos, perguntas de negócio
  e proposta de subtarefas.
- A investigação recomenda avaliar uma migration incremental alinhada ao ADR-009, mas nenhuma
  implementação, migration ou alteração de banco foi executada ou declarada concluída.

## 2026-07-24 — Restauração de Auth Profiles após a baseline

- Identificada a ausência, na baseline legada, do trigger de `auth.users` que cria exatamente um
  `public.profiles`; a omissão fazia os 18 testes seguintes falharem em cascata sobre perfis
  inexistentes.
- Adicionada migration incremental e idempotente para reconciliar funções, triggers, constraints,
  foreign keys, RLS, policies e privilégios da fundação Auth sem modificar a baseline ou dados
  válidos.
- A migration usa `CREATE OR REPLACE FUNCTION`, recria triggers e policies nominalmente e só
  adiciona ou substitui constraints e foreign keys quando ausentes ou divergentes.

## 2026-07-24 — Integridade do domínio de Specs

- Adicionada suíte pgTAP read-only em `supabase/tests/spec_integrity.sql` para validar seleção única
  de scale, modelagem binary, codes, referências, duplicidades, tipos, numeric, catálogo e coerência
  de `spec_set`.
- Cada violação inclui diagnóstico contextual e o relatório final agrega o total de inconsistências.
- Removido `SET TRANSACTION READ ONLY` porque `plan()` pode depender de objetos temporários internos
  do pgTAP. O arquivo permanece sem DML/DDL explícito sobre tabelas permanentes e depende da
  transação revertida por `supabase test db`, além do `ROLLBACK` final.

## 2026-07-24 — Sprint 8: administração de equipamentos e especificações

- Criada `/admin/products/[id]/specs` com ficha contínua, hierarquia real, busca client-side,
  grupos recolhíveis, contadores e edição inline de numeric, binary e scale.
- Adicionados modelo, porta e casos de uso no core para merge do catálogo, validação numeric,
  exclusividade scale, conversões e lote de persistência.
- Numeric aceita vírgula/ponto e duas casas; vazio remove a associação. Binary marcado/desmarcado é
  válido e scale usa dropdown único com `-`.
- Corrigido o merge de binary para preservar ausência de associação como `null`, sem confundi-la
  com `is_present = false`; contadores agora ignoram somente o estado não informado, e a UI usa um
  controle compacto de três estados que mantém `false` explícito no salvamento e no reload.
- Torque aceita entrada Nm/kgfm e persiste apenas Nm usando os fatores lidos de
  `unit_conversions`; `PW_0036` permanece `kg/Nm`.
- O adapter passou a ler specs/valores/conversões e executar upsert/delete coletivos sem acesso
  Supabase na UI, migration ou alteração remota.
- Adicionados acessos pela lista, edição e modal pós-criação, testes de domínio/adapter/UI e
  documentação da limitação transacional e do MVP-u.

## 2026-07-24 — Sprint 7: duplicação administrativa de veículos

- Corrigida a duplicação para copiar `product_specs` de forma independente, preservando
  `equipment_id`, numeric, binary `true`/`false`, scale e `input_unit`, sem copiar IDs ou timestamps.
- Adicionado `DuplicateAdministrativeVehicle`, Server Action específica e compensação segura do
  novo produto quando a cópia da ficha falha; falha de compensação sinaliza o ID incompleto.
- O diálogo pós-sucesso agora oferece revisão direta da ficha copiada no novo ID.
- Implementada `/admin/products/[id]/duplicate` como um novo Create preenchido, com leitura
  server-side da origem, `notFound()` e sem transportar o ID original.
- Reutilizados formulário, normalização, validação e criação; persistência de specs permanece
  isolada no adapter.
- Adicionada ação Duplicar na listagem e modo visual com título e botão “Criar veículo”.
- Mantidos o conflito normal de duplicidade, as regras Public/Active e o modal de criação apontando
  para o novo veículo.
- Confirmado por desenho e testes que preços, imagens, documentos e histórico não são copiados.
- Adicionada cobertura da rota, origem, valores iniciais, ausência do ID, conflito, criação,
  normalização, status, navegação e limites de dados relacionados.
- Nenhuma migration, alteração de schema, escrita remota, commit, push ou deploy foi realizada.

## 2026-07-23 — Sprint 6: edição administrativa de veículos

- Implementada `/admin/products/[id]/edit` com carregamento server-side, `notFound()` para produto
  inexistente, valores iniciais e permanência na página após salvar.
- Generalizado `admin-product-form.tsx` para Create/Edit sem duplicar campos ou regras; a edição
  exibe confirmação inline, valores normalizados e bloqueio durante submissão.
- Adicionados caso de uso de atualização no core, Server Action exclusiva e métodos mínimos de
  leitura/atualização na porta administrativa e no adapter Supabase.
- A duplicidade normalizada exclui o próprio ID e continua protegida pelo tratamento de conflito
  exato do índice único.
- Confirmada em inspeções versionadas a ausência de trigger de aplicação; `updated_at` passou a ser
  definido explicitamente pelo adapter, sem migration.
- Adicionados links Editar na listagem e no modal pós-criação.
- Ampliados testes de carregamento, inexistência, preenchimento, normalização, validação,
  duplicidade, atualização, `updated_at` e navegação.
- Duplicação, specs, preços, imagens, exclusão, auditoria histórica e mudanças de schema permanecem
  fora do escopo.

## 2026-07-23 — Sprint 5: criação administrativa de veículos

- Implementada `/admin/products/new` com os sete campos aprovados, layout responsivo e defaults
  privados/inativos.
- Adicionados normalização, validação, porta e caso de uso reutilizáveis para criação, edição e
  duplicação futuras.
- Ampliado o adapter server-only com busca normalizada de duplicidade e insert explícito somente em
  `products`, retornando o ID gerado e traduzindo conflito único sem expor erro bruto.
- Preservada autorização `admin` antes da construção do adapter privilegiado; a listagem é
  revalidada após sucesso.
- Adicionado diálogo acessível de sucesso; edição e equipamentos permanecem visíveis, desabilitados
  e sem links para rotas futuras.
- Adicionados testes de regras, segurança, persistência e estrutura da interface.
- Adicionados consulta SQL e script versionável para auditoria somente leitura de specs. A execução
  remota inspecionou 59 `numeric`, 171 `binary` e 26 grupos `scale`; encontrou três divergências de
  `detail = spec_set`, sem duplicidade de opção `scale` ou identidade ausente.
- Nenhuma migration, escrita remota de teste, edição/duplicação/exclusão, spec, preço ou imagem foi
  incluída.
- Refinamento final: anos convertidos em selects dependentes e dinâmicos, controles Ativo/Público
  simplificados, filtros administrativos por search params e consulta server-side com AND.
- Cabeçalhos administrativo, da página/filtros e da tabela mantidos visíveis no desktop por offsets
  sticky acumulados; no mobile, o conteúdo adicional permanece no fluxo normal.

## 2026-07-23 — Auth, áreas autenticadas e listagem administrativa

- Consolidada a autenticação SSR com Supabase Auth, cookies, Middleware, login e logout server-side.
- Protegidas as áreas `seller` e `admin` por profile, status e role, com `admin` herdando acesso seller.
- Adicionada navegação autenticada reutilizável para seller e shell administrativo persistente e responsivo.
- Implementadas a visão geral `/admin` e a listagem somente leitura `/admin/products`, sem Create, edição, duplicação ou exclusão.
- Adicionados DTO, serviço server-side, estados de dados/vazio/erro e consulta administrativa estreita pelo adapter legado.
- Aplicada e validada a migration `20260721222256_create_auth_profiles.sql`; o teste pgTAP passou sem persistir fixtures.
- Validações do marco: lint, typecheck, 135 testes e build de produção aprovados antes do commit `75edb4b`.

## 2026-07-23 — Correções bloqueantes de Auth

- Corrigida a preservação dos cookies emitidos pelo Supabase SSR em respostas normais e redirects do Middleware.
- Separados explicitamente os clients Auth server-side read-only e mutável; falhas de escrita deixam de ser ignoradas em Server Actions.
- Corrigido o logout para validar `signOut`, falhar sem falso redirect de sucesso e registrar apenas mensagem segura.
- Fortalecidos testes de cookies, Middleware, logout, redirects internos e filtros comportamentais de `getVehiclesByIds`.
- Registrado o congelamento operacional da migration de profiles, a necessidade de migration forward-only se `vendedor` já existir e a pendência de usuários Auth preexistentes; nenhum SQL foi alterado ou executado nesta rodada.
- Mantida como pendência funcional a decisão futura de exigir specs ativas em `getVehiclesByIds`.

## 2026-07-23 — Fundação mínima de Auth

- Adicionado `@supabase/ssr` com clients Auth browser e server separados do client legado.
- Implementados sessão SSR em cookies, renovação por `middleware.ts`, `/login`, logout server-side e redirect interno seguro por role.
- Implementada autorização server-only por `public.profiles`, com falha fechada para profile ausente, `pending`, `disabled` ou role inválida.
- Protegidos `/`, `/comparar`, `/admin` e as Server Actions do catálogo; `admin` também acessa a área `seller`.
- Criado somente o esqueleto de `/admin`, sem CRUD administrativo.
- Corrigida a consulta direta de veículos por IDs para exigir `is_active = true` e `is_public = true`.
- Corrigidos migration, trigger e testes SQL não aplicados de `vendedor` para `seller`.
- Adicionados contratos Auth mínimos e testes de capabilities, route policy, redirects, validação de usuário/profile e elegibilidade do catálogo.
- Nenhuma migration foi executada, nenhum banco remoto foi alterado e nenhum usuário real foi criado.

## 2026-07-23 — Aplicação Next.js única

- Registrado no ADR-010 que o Compra Car terá uma única aplicação Next.js, com áreas `seller` e `admin` sobre o mesmo Supabase.
- Definido que `admin` também acessa a área `seller` e que a interface pode apresentar as roles como “Administrador” e “Vendedor”.
- Appsmith descontinuado como arquitetura-alvo; exports, inventários, roteiros e integrações existentes permanecem preservados somente como referência histórica, sem novas implementações.
- ADR-007 mantido como registro da decisão anterior e marcado como parcialmente substituído.
- Corrigido o título interno do ADR de separação entre MSRP e políticas comerciais de ADR-008 para ADR-009, alinhando-o ao nome do arquivo e eliminando a colisão com o ADR de autenticação.
- Registrada a inconsistência entre a role `seller` agora aprovada e o valor `vendedor` ainda presente na migration e nos testes SQL não aplicados; a reconciliação é obrigatória antes de qualquer aplicação.
- Autenticação, `/admin`, clients SSR e autorização permanecem planejados e não foram declarados como implementados.
- Nenhum código funcional, banco, migration ou export histórico foi alterado.

## 2026-07-22 — Planejamento da Sprint 1 do MVP-a

- Inventariado o repositório em busca do export atual do Appsmith; confirmada apenas infraestrutura histórica, sem páginas, queries, widgets ou JS Objects exportados.
- Documentados escopo, contrato de dados, mapeamento físico, análise das funções de duplicação, SQL proposto, plano de testes e configuração dos widgets para Gestão de Produtos.
- Recomendada, de forma condicionada à confirmação do export, a sobrecarga explícita `duplicate_product_simple(integer, smallint, smallint, boolean)`, sem cópia de preços ou políticas.
- Nenhuma tela, migration, query remota ou alteração no Supabase foi executada.
- Auditado o export nativo `appsmith/exports/Compra Car App MVP.json` sem alterar o original: três páginas, 27 widgets, 11 actions PostgreSQL, um datasource e nenhum JS Object.
- Confirmado que `Admin Modelos` lista produtos, altera apenas `is_active` e chama `duplicate_product_simple` sem casts; criação, edição geral e gestão de `product_specs` ainda não existem.
- A varredura não encontrou credenciais preenchidas; foi registrada apenas uma referência de hostname Supabase, sem segredo de autenticação.
- Corrigidas referências documentais obsoletas sobre a ausência do export e separadas as confirmações de export/estrutura das pendências de permissão, role e transações.
- Preparado o roteiro do primeiro lote de `Admin Modelos`: listagem com `is_public`/`spec_count`, pesquisa, filtros e duplicação tipada com validação e tratamento de erro, sem alterar o export ou o Supabase.

- 2026-07-21: Sprint 2.1 versiona a fundação de autenticação no Supabase com enums de role/status, `public.profiles`, criação transacional de profiles, manutenção de ciclo de vida, grants mínimos, RLS, policies de autosserviço e testes SQL; nenhum banco local ou remoto recebeu a migration nesta entrega. A numeração documental da decisão de autenticação foi corrigida para ADR-008.

Todas as mudanças relevantes deste projeto serão documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [Unreleased]

### Added

- 2026-07-19: definição documental histórica da arquitetura de autenticação e autorização com Supabase Auth, cookies SSR, convite fechado, roles então nomeadas `admin`/`vendedor`, profiles autorizáveis, RLS e plano das Sprints 2 a 4; o ciclo explícito de status e o nome `seller` foram refinados posteriormente.
- 2026-07-19: implementação do MVP do motor de comparação com o primeiro veículo como referência, resultados completos para `binary` e `numeric`, estados de empate/desconhecido e exclusão explícita de ranking `scale`.
- Adição do filtro “Ver destaques”, destaque exclusivo das vantagens da referência e suporte à seleção de dois ou mais veículos.
- Adição da migration de dados que define `specs.value_direction = 'Positive'` para o item numeric `Power windows`.
- Redesign da tabela de comparação com cabeçalho e primeira coluna fixos, superfície única de rolagem, cabeçalhos compactos de veículos, estados visuais e tratamento responsivo para grandes matrizes.
- Refinamento da tabela com duas colunas de veículos visíveis em 390 px, presença binary por indicador circular, checks alinhados em slot fixo e formatter brasileiro para torque, relações peso/potência, telas e cilindrada.
- Correção final da apresentação de presença, remoção do placeholder legado `unit` e regra temporária que equipara ausência a `false` somente na comparação `binary`.
- 2026-07-18: implementação do domínio puro em `packages/core`, com `Vehicle`, `ComparisonItem`, valores discriminados, resultado agrupado e erros tipados.
- Implementação dos casos de uso `ListAvailableBrands`, `ListAvailableModels`, `ListAvailableVehicles`, `GetVehiclesByIds` e `CompareVehicles`.
- Definição de `VehicleRepository` e `ComparisonRepository` como portas normalizadas, sem dependência do Supabase.
- Criação de DTOs e reexportações públicas em `packages/contracts`, sem duplicar os tipos do core.
- Adição de 14 testes unitários com Vitest e repositórios in-memory.
- Criação dos ADRs 001 a 005 para identidade por `code`, itens `scale`, isolamento do legado, distinção entre atividade e publicação e autenticação posterior.
- Transformação do repositório em monorepo pnpm 10 + Turborepo 2.
- Criação da infraestrutura de `apps/web` com Next.js 15, App Router, React 19, TypeScript, Tailwind CSS, ESLint e Prettier.
- Preparação de deploy no Railway por meio de `railway.json`.
- Configuração de PWA instalável com manifesto, ícones e modo `standalone`, sem service worker ou funcionalidades offline.
- Criação inicial do Engineering Hub e dos documentos de fundação.
- Preparação da inspeção mínima e somente leitura do Supabase atual e de seus scripts SQL.
- Implementação do `LegacySupabaseAdapter` somente leitura sobre `products`, `specs` e `product_specs`.
- Adição do cliente Supabase server-only, DTOs legados, mappers explícitos, erros seguros e consultas em lote sem N+1.
- Adição de 17 testes do adaptador e 3 testes de integração opt-in, sem credenciais obrigatórias em CI.
- Registro da ausência de FK física em `product_specs.product_id`, da preservação de encoding legado e do ADR-006.
- Conclusão da Fase 3 com o primeiro vertical slice funcional de seleção de veículos, conectando UI, Server Actions, cache do Next.js, casos de uso e `LegacySupabaseAdapter`.
- Adição do composition root de catálogo, DTOs públicos de apresentação e tratamento seguro de erros.
- Adição dos seletores progressivos `Marca → Modelo → Veículo`, seleção de até três veículos e navegação para a futura comparação.
- Conclusão da Fase 4 com comparação server-rendered de dois ou três veículos, agrupada por categoria e preservando a ordem da seleção.
- Adição de parsing seguro da URL `vehicles`, cache ordenado com tags, DTOs públicos de comparação e estados públicos de erro.
- Adição do filtro “Mostrar apenas diferenças”, tabela responsiva e 12 testes unitários da camada web.

### Changed

- 2026-07-20: registro histórico do refinamento documental da autenticação antes da Sprint 2: profiles usariam status `pending`/`active`/`disabled`; novos usuários eram então nomeados `vendedor`/`pending`; promoção a `admin` era explícita; fluxos de convite, aceite, desativação e reativação registrariam seus atores e timestamps; MFA de `admin` e `audit_log` permaneciam evoluções futuras, sem implementação.
- Consolidação do estado real do repositório, separando o comparador público implementado do comparador administrativo planejado.
- Atualização das pendências de dados para distinguir o mapeamento confirmado no repositório da validação ainda necessária no Supabase e no Appsmith atuais.
- Atualização do roadmap e do checklist para incorporar as Fases 1 e 2 do backoffice administrativo.
- Consolidação de `Vehicle` como combinação comercial de marca, modelo, versão, ano-modelo e ano de produção.
- Catálogo público condicionado a `isActive`, `isPublic` e existência de ao menos um item comparável com valor válido conforme a semântica confirmada de `product_specs`.
- Cada `ComparisonItem.code` passa a identificar uma linha independente; itens `scale` não possuem cardinalidade no MVP.
- Registro do backlog pós-MVP para cardinalidade, agrupamento visual, combinações, taxonomia, importador e prefixes legados.
- Atualização da documentação para refletir o monorepo, o domínio implementado e a separação entre core e infraestrutura.
- Refinamento da identidade comparável e separação entre diferença e vantagem.
- Correção da ordem de execução: Supabase atual, inspeção mínima, adaptador legado, validação dos contratos, UI, MVP e piloto.
- Remoção da nova carga do Excel e de alterações estruturais amplas do banco como pré-requisitos do MVP.
# 2026-07-31 — Sprint 9F: combinação de políticas

- Refatorado o Offer Builder para lote de até 100 combinações e 11 categorias determinísticas.
- Adicionados `loyalty_bonus` e a RPC atômica `create_commercial_offer_batch`.
- MSRP e vigência são derivados no servidor; tudo aberto é rejeitado antes da persistência.
- Adicionados logging com correlation ID, testes e documentação.
# 2026-07-31 — Sprint 9F.1: refinamento e proteção de status

- Compactados os labels `Emplac.` e `Manut.` e centralizado verticalmente o conteúdo da matriz.
- Corrigido o guard específico de rollover no trigger terminal compartilhado sem alterar suas regras.
- Arquivados de forma controlada no staging os drafts de teste 17/18/19 do Dolphin; 20/21/22
  permaneceram drafts e únicos nos respectivos tipos elegíveis.
- Registrada a Sprint 9G de gestão de Policies e combinações como próxima etapa.
## Sprint 9G.2 — rollover temporal de preços públicos

- A publicação de um novo MSRP passa a encerrar, de forma atômica e auditada, o preço publicado
  sobreposto em `starts_on - 1`, com lock otimista e serialização por produto.
- Adicionada a RPC administrativa `rollover_product_public_price` para reparar timelines já
  publicadas sem desabilitar a imutabilidade; publicações retroativas diante de preço posterior são
  rejeitadas e timelines com múltiplos predecessores exigem saneamento explícito.
- Corrigido o fixture Haval da Sprint 9G.1 para terminar em 2026-07-31.
## Sprint 9G.3 — estabilização final de UX e workflow

- A listagem de preços públicos ganhou ordenação server-side determinística, inicialmente por
  `updated_at DESC`, e headers alternáveis em ASC/DESC.
- O header contextual foi compactado e alinhado ao topbar desde o primeiro pixel de scroll.
- O retorno do batch manual de preços foi normalizado para JSON simples na Server Action, com
  correlação nos logs técnicos, e o CTA passou a “Salvar preços”.
- O workspace de Policies ganhou feedback após persistência, badges traduzidos de status/uso,
  ações alinhadas e matriz com exatamente uma linha vazia útil ao final.
- Publicação múltipla e DELETE físico de Policy foram mantidos pendentes por exigirem novas RPCs
  administrativas atômicas e auditáveis.
## Sprint 9G.4 — Offers draft com vigência aberta

- `commercial_offers.valid_to` passa a aceitar `NULL` para drafts; batch e substituição derivam o
  menor fim disponível ou mantêm a Offer aberta quando Policies e MSRP são abertos.
- Duplicidade de draft usa comparação NULL-safe e a aplicação identifica a linha quando uma Offer
  idêntica já existe.
- A publicação de Offer aberta permanece explicitamente bloqueada até definição do seu lifecycle.
- A UX exibe vigência aberta, usa “Salvar ofertas” e comunica sucesso ou erro com correlação.
- Checkpoint das Sprints 9G–9G.4 fechado após validação manual em Staging; Produção permaneceu sem as
  migrations desta rodada. Refinamentos da UX para a operação mensal ficam para a próxima etapa.
