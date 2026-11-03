# Sprint 24A.2 — RSS/Atom Ingestion

Status: implementação local e opt-in, sem persistência remota, IA, UX, CLI agendado,
worker ou integração operacional com Brand Connector. A 24A.3 não foi iniciada.

## Arquitetura e decisões

- `scripts/agents/watcher-feed-parser.ts`: transformação RSS/Atom para os contratos da 24A.1.
- `scripts/agents/watcher-feed-transport.ts`: rede HTTPS específica para feeds, com I/O injetável.
- `packages/core/src/agents/watcher-incremental.ts`: projeção determinística em memória.
- `scripts/agents/watcher-feed-ingestion.ts`: serviço explicitamente invocado pelo consumidor.

Não há execução na importação, leitura de env/segredos, acesso a Supabase ou provider.
Não foi copiado nem alterado o Source Monitor. Os agentes anteriores e seus contratos
permanecem preservados. O barrel do Core apenas acrescenta o novo módulo puro.

Dependências necessárias, fixadas no pacote de scripts e no lockfile pnpm:
`sax` 1.6.1, `ipaddr.js` 2.5.0 e `@types/sax` 1.2.7 (desenvolvimento).
SAX evita parser XML artesanal e árvore DOM; ipaddr.js evita manter uma lista parcial
artesanal de IPs especiais. Referências dos projetos:
[SAX](https://github.com/isaacs/sax-js) e [ipaddr.js](https://github.com/whitequark/ipaddr.js).

## Parser

Suporta RSS 2.0 sem namespace e Atom com namespace oficial, inclusive prefixos,
GUID/ID opaco por fonte, títulos, links alternate, descrição/summary, pubDate RFC 822/2822
com GMT/UTC/UT/Z, abreviaturas padronizadas dos EUA ou offset numérico, datas ISO e `dc:date`. Datas editoriais são distintas de
observedAt. Datas ausentes viram null e geram MISSING_DATE; datas inválidas rejeitam o item.
Não se infere publicação a partir de atualização ou observação.

URLs relativas exigem `allowRelativeUrls: true`. `xml:base` é validado e preserva a
semântica de diretório. Hosts de artigos são exatos e explicitamente permitidos, usando
por padrão apenas o host do feed. Links de outros hosts precisam de configuração própria.
Credenciais, HTTP, IPs literais, esquemas perigosos e controles internos são rejeitados.

CDATA e entidades XML básicas/numéricas são decodificadas pelo SAX. Namespaces externos
não podem substituir campos nativos. DTD e declarações SGML são proibidos; entidades
externas não são carregadas. A checagem adicional de atributos duplicados complementa
as limitações do parser. XML inválido invalida o documento inteiro, sem checkpoint novo.

Apenas texto de título e pequeno excerto é retornado. `content:encoded`, Atom `content`,
imagens, atributos HTML e conteúdo de script/style não são retidos. SAX também extrai
texto dos fragmentos HTML; o resultado não é HTML para renderização. Não existe sanitizador
que autorize usar o retorno como HTML. O XML fica apenas temporariamente em memória.

Limites: 2 MiB de entrada, profundidade padrão 32 (máximo 64), 20.000 elementos e até
100 itens por lote. Campos capturados têm buffer próprio limitado; título/GUID/URL excessivos
são rejeitados. Excerto acima de 1000 caracteres é truncado com diagnóstico. Itens excedentes
são ignorados com ITEMS_TRUNCATED; o restante do XML ainda é validado. Qualquer truncamento
congela o checkpoint. Diagnósticos têm tamanho limitado, além dos contadores rejected/truncated.

## Transporte

O consumidor constrói uma instância de `createWatcherFeedTransport` compartilhada por suas
coletas e injeta `nodeWatcherFeedNetwork()` somente quando quiser rede real. Nesta entrega,
nenhum feed real foi consultado: testes usam exclusivamente DNS/HTTP mockados.

- HTTPS na porta padrão e allowlist de hosts exatos, sem wildcard ou subdomínio implícito.
- Todos os endereços retornados pelo DNS devem ser públicos; respostas mistas são bloqueadas.
- Apenas unicast comum é aceito; IPv6 deve estar no espaço global 2000::/3. IPs especiais,
  mapeados/traduzidos, documentação, loopback e redes privadas/reservadas são rejeitados.
- A conexão usa o IP validado no callback lookup. O hostname original permanece em TLS/SNI
  com verificação de certificado habilitada. A família é fixada para evitar seleção DNS adicional.
- Redirects são recusados, sem requisição ao destino de Location.
- Timeout padrão 15 segundos (até 30), incluindo fila, DNS, conexão e leitura. O caller recebe
  timeout mesmo se uma implementação injetada ignorar AbortSignal; o adapter Node cancela I/O.
- Concorrência padrão de uma requisição por host, configurável até quatro, fila limitada a 100.
  O limite é por instância/processo; múltiplas instâncias não compartilham semáforo.
- gzip, deflate e Brotli são descomprimidos em stream; corpo descomprimido máximo de 2 MiB.
  O corpo recebido comprimido também tem teto de 2 MiB, independentemente de Content-Length.
- Apenas tipos XML/RSS/Atom e UTF-8/US-ASCII são aceitos; UTF-8 inválido é rejeitado.
- ETag e Last-Modified são opacos, limitados e validados antes de usar em headers.
- 304 exige checkpoint condicional previamente bem-sucedido, não lê/parsa o corpo e conserva
  validadores omitidos. 429 e 5xx retornam RETRY e Retry-After limitado a 24 horas.
- Não há retry, sleep ou polling automático. Erros públicos são códigos estáticos sem payloads
  ou mensagens de rede. Streams são destruídos e o slot é liberado ao terminar/falhar.

URLs usadas na requisição conservam caminho/query do feed, mesmo quando a canonicalização
para identidade removeria tracking ou barras finais. Fragmentos não são enviados.

## Estado incremental e consumo

O caller fornece `source`, `observedAt`, `checkpoint`, `history` e `current`. Na primeira
execução, history/current são arrays vazios. Nas seguintes, deve conservar ambos do resultado:

- history: primeira observação de cada identidade + fingerprint, incluindo revisões anteriores;
- current: última revisão aceita em memória de cada identidade, sem alterar observedAt quando
  o conteúdo é idêntico. Separá-la do histórico permite detectar reversões A → B → A.

A identidade e o fingerprint são os da 24A.1: GUID no escopo da fonte, fallback de URL
canônica e evidência independente de observedAt. Itens antigos inseridos tardiamente são
processados; não existe cursor exclusivo de publishedAt. Replay de conteúdo idêntico não
acrescenta histórico nem muda a revisão corrente. Revisões diferentes do mesmo GUID dentro
do mesmo lote geram conflictingItemKeys e bloqueiam checkpoint, preservando as evidências.

O resultado distingue newItems, updatedItems e unchangedItems. `related` contém relações
novas/reavaliadas para itens alterados, não um armazenamento cumulativo de relações.
Representantes não apagam outras origens; não há fusão transitiva de identidades/modelos.

Classificações determinísticas podem ser fornecidas por itemKey. Sem classificação, usa-se
MARKET/UNKNOWN, sem inventar marca, modelo ou confirmação BR. Filtros de patrocinado e
irrelevante preservam a evidência. Sem publicação, o item é preservado, mas não participa da
similaridade. Com metadados das fontes históricas, aplica-se a fundação: sete dias, mesma
marca/modelo, shingles de cinco palavras e limiar de 80%, mantendo isolamento editorial.

O histórico é limitado a 5000 evidências; excesso é erro explícito, sem descarte automático.
As comparações usam índices por URL e marca/modelo/escopo e pré-filtro temporal, apenas para itens alterados.
Saída de relações tem teto de 1000, com relationsTruncated e checkpoint bloqueado.

Checkpoint é uma proposta em memória: só avança sem failures, conflitos ou truncamentos.
Falhas de HTTP, XML, item e limites preservam o checkpoint anterior, inclusive seus validadores,
para não perder retry por um 304 indevido. Evidências válidas parciais podem ser devolvidas.
O serviço retorna OK, NOT_MODIFIED, RETRY, PARTIAL ou FAILED; usar checkpointAdvanced e
batch.failures/diagnostics para decidir o próximo passo. Nenhuma proposta é persistida.

## Arquivos desta etapa

Criados:

- `packages/core/src/agents/watcher-incremental.ts`
- `packages/core/test/watcher-incremental.test.ts`
- `scripts/agents/watcher-feed-parser.ts`
- `scripts/agents/watcher-feed-transport.ts`
- `scripts/agents/watcher-feed-ingestion.ts`
- `scripts/agents/test/watcher-feed-parser.test.ts`
- `scripts/agents/test/watcher-feed-transport.test.ts`
- `scripts/agents/test/watcher-feed-node-network.test.ts`
- `scripts/agents/test/watcher-feed-ingestion.test.ts`
- `scripts/agents/test/fixtures/watcher/rss.xml`
- `scripts/agents/test/fixtures/watcher/atom.xml`
- `docs/agents/WATCHER_INGESTION_24A_2.md`

Alterados: `packages/core/src/agents/index.ts`, `scripts/agents/package.json`,
`pnpm-lock.yaml`, `AI_CONTEXT.md`, `CHANGELOG.md` e `ROADMAP_MASTER.md`.
Os demais arquivos pendentes da 24A.1 foram preservados; nenhum commit foi criado.

## Validação e baseline

Ambiente: pnpm 10.34.5, Node 24.18.0; o repositório declara Node 22.x. Execução em Node 22
permanece PENDENTE. As fixtures RSS/Atom são sintéticas e pequenas.

- Direcionados: 119 testes do Core (incluindo os 109 da 24A.1) e 107 dos scripts passaram.
- Lint e typecheck de Core/scripts passaram; typecheck e build globais passaram.
- `pnpm test`: 1217 testes passaram, seis falhas preexistentes do Core; Turbo interrompe os
  demais pacotes. Mesmos arquivos e falhas da 24A.1, com baseline preservado em logs locais.
- Suíte completa dos scripts: 184 passaram e seis falharam. As seis falhas também foram
  reproduzidas em scripts/Core extraídos do HEAD f7238b7, sem editar a branch:
  quatro em brand-connector-cli, uma em engineering-sandbox (separadores Windows), uma em
  new-product-check-cli. Os novos testes do Watcher passaram.
- `pnpm lint`: mesmos 51 warnings preexistentes no Web, zero erros de lint.
- `pnpm format:check`: mesmos 192 arquivos preexistentes; arquivos TypeScript desta entrega
  são verificados separadamente. Markdown segue a exclusão de formatação do repositório.
- `git diff --check` e revisão de escopo: sem alteração em Legacy, agentes antigos ou migrations.

Logs e reprodução de baseline: `.local-reports/watcher-24a2/`, ignorados pelo Git.

## Limitações e próximas etapas

Sem teste de feeds reais ou conectividade TLS real nesta etapa: o teste do adapter Node usa
mocks dos módulos de DNS/HTTPS e verifica os parâmetros efetivos de conexão. Hosts de feeds
não vêm pré-habilitados. Encodings legados, redirects, feeds maiores e DTD permanecem recusados.
A classificação depende de regras explícitas do consumidor; não há inferência editorial/modelos
por IA. Semáforo, histórico e checkpoint não sobrevivem ao processo e não coordenam workers.
O caller deve descartar validadores quando mudar a configuração/URL de uma fonte.

Reprocessar conteúdo antigo atualizado pode exigir que o consumidor reavalie relações anteriores;
a saída related é incremental, não uma projeção persistente de clusters. Retenção e recuperação
de feeds truncados precisam de política posterior. Congelar checkpoint evita perda silenciosa,
mas uma fonte permanentemente truncada exige revisão de configuração pelo operador.

Zero writes remotos, zero chamadas OpenAI, zero migrations/deploy/commits/push.
A Sprint 24A.3 continua fora do escopo.

O lookup DNS nativo pode terminar após o timeout; o sinal é verificado antes de abrir conexão.
