# Sprint 24A.1 — Watcher Foundation Hardening

Status: implementação local; sem banco, rede, OpenAI, migrations, worker ou UX.
A Sprint 24 trata do Watcher; referências históricas à Sprint 24 como Spec Agent não
representam o escopo atual. A 24A.2 não foi iniciada.

## Fronteira e compatibilidade

A implementação permanece em `packages/core`, exportada por `@compra-car/core/agents`.
Nenhum contrato dos outros agentes ou tipo da Agent Platform foi alterado.
SHA-256 usa o módulo nativo `node:crypto`, já utilizado pelo Core, sem dependência nova.
As funções não consultam relógio, rede, banco ou provider; timestamps entram por parâmetro.

`WatcherArticle.market` mantém o significado editorial existente. O campo opcional
`brazilApplicability` distingue UNKNOWN, CONFIRMED e NOT_APPLICABLE. Ausência equivale a
UNKNOWN para comparação/fingerprint, nunca a confirmação. Fontes brasileiras podem
noticiar projetos internacionais, e notícias GLOBAL continuam elegíveis para News.
Similaridade textual não agrupa mercados editoriais/aplicabilidades diferentes. URL exata
continua identificando o mesmo recurso, mas não transfere aplicabilidade nem mescla evidências.

`prepareWatcherHint` prepara dados e exige `confirmedBrazil === true`; não despacha nada.
Esse booleano ainda é uma declaração do chamador. Provar confirmação por evidência e review
é responsabilidade do workflow futuro, não deste contrato puro.

## Regras e versões

- Canonicalização `watcher-url/1`: HTTP/HTTPS, host minúsculo, porta padrão normalizada,
  ponto final do host removido, fragmento removido, barras finais removidas fora da raiz,
  tracking conhecido removido e query ordenada por nome. Parâmetros repetidos preservam a
  ordem relativa. Caminho, protocolo e parâmetros de conteúdo continuam distinguindo URLs.
- Erros de URL retornam `WATCHER_INVALID_URL`, inclusive erros nativos. Limite de 2048
  caracteres antes e depois da serialização. Credenciais, controles, espaços, backslashes,
  portas não padrão, hosts locais/reservados conhecidos e todos os IPs literais são rejeitados.
- Essa checagem é estática: não resolve DNS e não prova que o domínio aponta para IP público.
  Allowlist, validação/pinning DNS e redirects pertencem ao transporte futuro.
- Similaridade continua Jaccard de conjuntos de shingles de cinco palavras, mesma
  marca/modelo normalizada, janela inclusiva de sete dias e limiar inicial inclusivo de 0,8.
  Sem cinco palavras, retorna INSUFFICIENT_TEXT; não usa título curto como substituto.
- Datas exigem ISO com timezone explícito, calendário válido e anos UTC de 0001 a 9999;
  são normalizadas para UTC com milissegundos. Datas de feed ausentes são null.
- sourceRank é inteiro seguro não negativo. Artigos e opções são validados antes de atalhos.
- Representante: menor rank, publicação mais antiga, ID e conteúdo em ordem de code units.
  Retorna cópia validada/normalizada, sem depender de locale, ordem dos argumentos ou ordem
  das propriedades. Campos desconhecidos não são transportados.
- Fingerprints são SHA-256 de arrays JSON com campos em ordem fixa e namespace versionado.
  Mudanças de regras exigem nova versão e novos vetores de teste; não reinterpretar hashes.

## Contratos incrementais

| Contrato | Responsabilidade |
| --- | --- |
| WatcherSource | ID, URL do feed, mercado editorial, idioma, rank e habilitação. |
| WatcherFeedItem | GUID opaco, URL, título, excerto e datas editoriais. Não é candidato de modelo. |
| WatcherArticleObservation | Item normalizado, identidade, fingerprint de evidência e instante observado. |
| WatcherIngestionBatch | Lote versionado de uma fonte, observações e falhas, sem commit/checkpoint automático. |
| WatcherSourceCheckpoint | Validadores HTTP opacos e última observação bem-sucedida proposta. |
| WatcherIngestionFailure | Etapa, código sanitizado permitido, item opcional, observação e possibilidade de retry. |

Identidade `watcher-item/1:sha256:<64 hex>`:
`[sourceId, GUID ou URL, guid ou canonicalUrl]`. GUID é case-sensitive e preserva Unicode
sem folding, inclusive quando a URL muda. GUID ausente deve ser explicitamente null;
GUID vazio é inválido. O fallback de URL também permanece no escopo da fonte.

Evidência `watcher-evidence/1:sha256:<64 hex>` de feed inclui versão da URL, identidade do item,
URL, título, excerto, publicação e atualização. Não inclui observedAt. Artigo classificado
usa função própria com URL, conteúdo permitido, publicação, mercado/aplicabilidade e
classificação; ID operacional e rank não entram. Esses dois fingerprints representam
estágios diferentes da evidência, não são intercambiáveis para deduplicar o mesmo payload.

Batch tem no máximo 100 observações e 100 falhas antes de deduplicar. Repetições com
mesma identidade/evidência retêm a observação mais antiga. Revisões diferentes permanecem
separadas. Ordenação e deduplicação são determinísticas; validar novamente é idempotente.
Fonte divergente, observação posterior ao lote e fingerprints adulterados são rejeitados.

Limites: título 500, excerto 1000, nomes/aliases de hint 100, ID de candidato 200,
até 20 aliases, GUID/URL 2048, ETag 1024 e Last-Modified 128 caracteres. Texto normalizado
é revalidado após NFC; excesso nunca é truncado silenciosamente. Nullable exige null,
não undefined. Falhas não retornam mensagens brutas. Campos desconhecidos são descartados.
Os contratos não carregam artigo completo, XML bruto, imagem ou candidato inferido.

## Validação local

Ambiente: pnpm 10.34.5 e Node 24.18.0; projeto declara Node 22.x. Compatibilidade com Node 22
permanece PENDENTE de execução nesse runtime.

- 109 testes direcionados passaram em três arquivos, incluindo os sete testes originais.
- Lint e typecheck do Core passaram; typecheck global passou; build global passou.
- `pnpm lint`: falha preexistente no Web por 51 warnings, zero erros de lint.
- `pnpm test`: seis falhas preexistentes no Core; Turbo interrompe o restante do monorepo.
- As mesmas seis falhas foram reproduzidas com o Core extraído do HEAD `f7238b7` em pasta
  local ignorada, reutilizando dependências instaladas, sem alterar a branch.
- `pnpm format:check`: 192 arquivos preexistentes com problemas de estilo na execução global.
  Arquivos desta entrega são verificados separadamente, sem reformatação de arquivos alheios.

Falhas reproduzidas no HEAD:
`administrative-product-specs.test.ts`, `engineering-brand-agent-replay.test.ts`,
`mmv-body-version-classification.test.ts`, `mmv-platform-mapper.test.ts`,
`mmv-product-reconciliation.test.ts`, `new-product-check-agent.test.ts`.

Logs locais ignorados: `.local-reports/watcher-24a1/`. Nenhuma falha nova conhecida no Watcher.
Nenhum write remoto, migration, deploy, commit ou push. Legacy e agentes existentes preservados.

## Pendências para etapas futuras

Parser RSS/Atom, transporte seguro, fontes aprovadas, persistência transacional, controle de
checkpoint/concorrência, evidência de confirmação BR e consumo de hints pelo Brand Connector.
Canonicalizar barras finais pode confluir recursos distintos em servidores específicos;
qualquer exceção futura exige política e versionamento explícitos. O hash garante identidade
reproduzível, não autenticidade ou confiança na fonte. Nenhuma dessas pendências inicia a 24A.2.
