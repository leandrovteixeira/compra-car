# Sprint 21.3 — Relatório do único smoke real

## Resultado e parada

**Gate parcial, não aprovado integralmente.** Manual Nivus 2026 descoberto, PDF lido localmente e 8 observações emitidas. Nenhum acessório consumiu GET. Contudo, não houve observação aceita da página do modelo/configurador, e parte das saídas tem defeitos.

As 8 saídas brutas não equivalem a 8 fatos aprovados: 4 são cilindrada/transmissão dos grupos 1.0 e 1.4; 2 designações foram truncadas; 1 é definição de sigla e repete transmissão; 1 aparenta ser entrada de índice. O resultado bruto foi preservado, sem correções funcionais, remoção de saídas ou nova pesquisa após o smoke.

JSON original: .local-reports/agents/spec-source/2026-09-16T20-33-46-203Z.json. SHA-256: DF6C5C6BB6BF3B64336CFCCC44DC6D57D7A93073EDB0B4D484071715F6784581.

## A. Implementação

[Design completo, dependência e limites](SPEC_SOURCE_TECHNICAL_21_3.md). Preservadas as Sprints 21.1 e 21.2.

Novos arquivos 21.3:

- scripts/agents/spec-source-prose.ts: extração de formas técnicas literais.
- scripts/agents/spec-source-html-sections.ts: prosa, títulos, listas, pares e cards DOM/JSON.
- scripts/agents/spec-source-pdf.ts e spec-source-pdf-worker.mjs: PDF por página, worker local e locators.
- scripts/agents/spec-source-technical.test.ts: 25 testes novos.
- scripts/agents/fixtures/spec-ranking-pool.html, spec-technical-sections.html e spec-technical-manual.pdf: fixtures sintéticas/autoria própria.
- SPEC_SOURCE_TECHNICAL_21_3.md, SPRINT_21_3_REAL_GATE.md e SPRINT_21_3_CANDIDATES.md.

Arquivos evoluídos na 21.3:

- packages/core/src/agents/spec-source-discovery.ts, spec-source-types.ts e spec-source.ts: ranking explicável, métodos, confiança e retenção de UNRESOLVED.
- packages/core/test/spec-source.test.ts e scripts/agents/spec-source.test.ts: regressões adaptadas ao contrato 21.3; isolamento Jeep T270 preservado.
- packages/adapter-openai/src/spec-source-provider.ts: confiança no schema e prosa limitada.
- scripts/agents/spec-source-discovery.ts, spec-source-documents.ts, spec-source-fetch.ts, spec-source-runtime.ts e run-spec-source.ts: manuais, adapters, PDF e ranking pré-fetch.
- scripts/agents/package.json e pnpm-lock.yaml: pdfjs-dist 6.3.289 fixado.
- AI_CONTEXT.md e CHANGELOG.md: estado do marco.

PDF.js é a dependência direta: o repositório tinha geração, mas não extração PDF. Versão 6.3.289, Apache-2.0, engines >=22.13.0 || >=24, verificada no registry. Sem wrapper/serviço externo. Optional canvas é transitivo do PDF.js; o adapter não renderiza nem faz OCR. [Projeto Mozilla](https://github.com/mozilla/pdf.js).

Ranking soma motivos explícitos; reduz prioridade de acessórios e de índices repetidos. HTML usa limites de parágrafo/card e hierarquia carline/trim/engine. Semantic fallback recebe somente identidade, metadados, seções limitadas e schema; não recebe Spec Master. PDF recebe bytes, não URL: 25 MB, 350 páginas, 2 milhões de caracteres, 60 segundos, heap 256 MB; até 20 páginas técnicas, 500 fatos e 80 seções. HTML mantém 2 MB, timeout 10s e até 2 redirects seguros.

## B. Validação offline

| Gate | Resultado |
|---|---|
| Dirigidos Sprint 21 | 144 casos: agents 86 (37+24+25), core 38, provider 10, contexto Supabase 10. Os 86 finais estão incluídos na suíte completa agents. |
| Pacote agents completo final | 148 testes / 7 arquivos passaram. |
| Pacote adapter-openai completo | 96 testes / 6 arquivos passaram. |
| Typecheck scoped | core, adapter-openai e agents passaram; agents repetido após última correção. |
| Lint scoped/global | Passaram. Global: 10 tarefas, 1m1.24s; agents repetido no estado final. |
| Formatação scoped | Passou nos TS/MJS/HTML Sprint 21, manifest e lockfile alterados. |
| Build | Passou: 31 páginas, 2m22.759s. Ajuste posterior apenas no runtime CLI/testes, fora do grafo de build web. |
| git diff --check | Passou antes do smoke e na auditoria final. |
| Typecheck global | 5 TS2554 preexistentes em apps/web/test/admin-product-public-prices.test.ts:101–105. |
| Test global | 1149 passaram; 5 timeouts 5000ms em 3 arquivos comerciais fora do escopo; pipeline interrompido. |
| Diagnóstico dos timeouts | 67 testes dos 3 arquivos passaram com --testTimeout 20000 --maxWorkers 1; sem alterar código/configuração comercial. |
| Format global | 609 avisos fora do conjunto scoped. Não corrigidos. |

Gates scoped passaram; o repositório global não está inteiramente verde. Logs: .local-reports/agents/spec-source/technical-21-3/validation/. Arquivos do diagnóstico: commercial-document-domain-mapping.test.ts, commercial-document-reconciliation.test.ts e commercial-document-semantic-reconciliation.test.ts.

## Comando e orçamento

Node portátil v22.23.2, pnpm 10.34.5. Branch sprint-21-spec-intelligence, HEAD dcd67340b69415068ba1ada749865497697ad120.

```powershell
pnpm.cmd agent:spec-source:dry-run -- --brand VW --model Nivus --version "Comfortline 200 TSI" --my 2026 --discovery-run 36c6d79b-45ca-49a6-abaa-66bd86d81d95 --provider hybrid --mode baseline --max-targets 1 --max-sources 5 --max-discovery-depth 2 --max-semantic-calls 1
```

Exit 0 significa término controlado. Um alvo exato, catálogo Comfortline 1.0 TGDI AT; connector ACTIVE ed158a52-caf4-4688-a17f-28edbabb5d75. Uma operação OpenAI de descoberta URL-only; zero chamadas de extração semântica. Nenhuma captura preparatória de veículos na 21.3. Documentação/registry e instalação da dependência foram acessados antes dos testes para viabilizar o adapter.

## C. Ranking registrado ANTES dos GETs

O primeiro seed é bootstrap na ordem do connector, não o maior score. Nas demais rodadas, score decrescente e desempate por URL. A CLI emitiu estas filas antes do fetch; o JSON preserva rankedBeforeFetch integral.

### Antes do GET 1

| Rank da fila | Score | Motivos | Kind | URL | Target | MY |
|---|---|---|---|---|---|---|
| 1 | -30 | -30 NO_TARGET_TECHNICAL_IDENTITY | OFFICIAL_HTML | https://www.vw.com.br/pt/carros.html |  |  |
| 2 | 90 | +90 CONFIGURATOR | OFFICIAL_CONFIGURATOR | https://www.vw.com.br/pt/configurador.html |  |  |
| 3 | 160 | +70 TECHNICAL_TERMS; +70 MANUAL_LITERATURE; +20 CONNECTOR_TECHNICAL_SEED | OFFICIAL_CATALOG | https://www.vw.com.br/pt/servicos-e-acessorios/servicos-e-produtos/manuais-e-garantia/manuais.html |  |  |

### Antes do GET 2

| Rank da fila | Score | Motivos | Kind | URL | Target | MY |
|---|---|---|---|---|---|---|
| 1 | 160 | +70 TECHNICAL_TERMS; +70 MANUAL_LITERATURE; +20 CONNECTOR_TECHNICAL_SEED | OFFICIAL_CATALOG | https://www.vw.com.br/pt/servicos-e-acessorios/servicos-e-produtos/manuais-e-garantia/manuais.html |  |  |
| 2 | 140 | +70 TECHNICAL_TERMS; +70 MANUAL_LITERATURE | OFFICIAL_CATALOG | https://www.vw.com.br/pt/servicos-e-acessorios/manuais-e-garantia/manuais-de-resgate.html |  |  |
| 3 | 140 | +70 TECHNICAL_TERMS; +70 MANUAL_LITERATURE | OFFICIAL_CATALOG | https://www.vw.com.br/pt/servicos-e-acessorios/servicos-e-produtos/manuais-e-garantia.html |  |  |
| 4 | 90 | +90 CONFIGURATOR | OFFICIAL_CONFIGURATOR | https://www.vw.com.br/pt/configurador.html |  |  |

### Antes do GET 3

| Rank da fila | Score | Motivos | Kind | URL | Target | MY |
|---|---|---|---|---|---|---|
| 1 | 370 | +80 EXACT_MODEL; +100 EXACT_MY; +70 TECHNICAL_TERMS; +70 MANUAL_LITERATURE; +50 OFFICIAL_PDF_CANDIDATE | OFFICIAL_MANUAL | https://www.vw.com.br/idhub/content/dam/onehub_pkw/importers/br/literatura-de-bordo/manual-nivus/my26/26A_5B1_CON_66_Conectado_BRA_Digital.pdf | MODEL_NAME | MY_CANDIDATE:2026 |
| 2 | 370 | +80 EXACT_MODEL; +100 EXACT_MY; +70 TECHNICAL_TERMS; +70 MANUAL_LITERATURE; +50 OFFICIAL_PDF_CANDIDATE | OFFICIAL_MANUAL | https://www.vw.com.br/idhub/content/dam/onehub_pkw/importers/br/literatura-de-bordo/manual-nivus/my26/26B_5B1_NIV_66_Manual_de_Instrucoes_LOW.pdf | MODEL_NAME | MY_CANDIDATE:2026 |
| 3 | 90 | +90 CONFIGURATOR | OFFICIAL_CONFIGURATOR | https://www.vw.com.br/pt/configurador.html |  |  |
| 4 | 20 | +70 TECHNICAL_TERMS; +70 MANUAL_LITERATURE; -120 LITERATURE_INDEX_ALREADY_VISITED | OFFICIAL_CATALOG | https://www.vw.com.br/pt/servicos-e-acessorios/manuais-e-garantia/manuais-de-resgate.html |  |  |
| 5 | 20 | +70 TECHNICAL_TERMS; +70 MANUAL_LITERATURE; -120 LITERATURE_INDEX_ALREADY_VISITED | OFFICIAL_CATALOG | https://www.vw.com.br/pt/servicos-e-acessorios/servicos-e-produtos/manuais-e-garantia.html |  |  |

### Antes do GET 4

| Rank da fila | Score | Motivos | Kind | URL | Target | MY |
|---|---|---|---|---|---|---|
| 1 | 370 | +80 EXACT_MODEL; +100 EXACT_MY; +70 TECHNICAL_TERMS; +70 MANUAL_LITERATURE; +50 OFFICIAL_PDF_CANDIDATE | OFFICIAL_MANUAL | https://www.vw.com.br/idhub/content/dam/onehub_pkw/importers/br/literatura-de-bordo/manual-nivus/my26/26B_5B1_NIV_66_Manual_de_Instrucoes_LOW.pdf | MODEL_NAME | MY_CANDIDATE:2026 |
| 2 | 90 | +90 CONFIGURATOR | OFFICIAL_CONFIGURATOR | https://www.vw.com.br/pt/configurador.html |  |  |
| 3 | 20 | +70 TECHNICAL_TERMS; +70 MANUAL_LITERATURE; -120 LITERATURE_INDEX_ALREADY_VISITED | OFFICIAL_CATALOG | https://www.vw.com.br/pt/servicos-e-acessorios/manuais-e-garantia/manuais-de-resgate.html |  |  |
| 4 | 20 | +70 TECHNICAL_TERMS; +70 MANUAL_LITERATURE; -120 LITERATURE_INDEX_ALREADY_VISITED | OFFICIAL_CATALOG | https://www.vw.com.br/pt/servicos-e-acessorios/servicos-e-produtos/manuais-e-garantia.html |  |  |

### Antes do GET 5

| Rank da fila | Score | Motivos | Kind | URL | Target | MY |
|---|---|---|---|---|---|---|
| 1 | 120 | +80 EXACT_MODEL; +40 EXACT_VERSION_LABEL | OFFICIAL_HTML | https://www.vw.com.br/pt/carros/nivus.html | MODEL_NAME, VERSION_LABEL |  |
| 2 | 90 | +90 CONFIGURATOR | OFFICIAL_CONFIGURATOR | https://www.vw.com.br/pt/configurador.html |  |  |
| 3 | 20 | +70 TECHNICAL_TERMS; +70 MANUAL_LITERATURE; -120 LITERATURE_INDEX_ALREADY_VISITED | OFFICIAL_CATALOG | https://www.vw.com.br/pt/servicos-e-acessorios/manuais-e-garantia/manuais-de-resgate.html |  |  |
| 4 | 20 | +70 TECHNICAL_TERMS; +70 MANUAL_LITERATURE; -120 LITERATURE_INDEX_ALREADY_VISITED | OFFICIAL_CATALOG | https://www.vw.com.br/pt/servicos-e-acessorios/servicos-e-produtos/manuais-e-garantia.html |  |  |

### Onde ficaram os acessórios

Nenhum acessório foi buscado. Links genéricos sem relevância foram rejeitados; produtos Nivus surgiram após o quinto GET, quando o orçamento já acabara. Assim, a precedência concorrente manual versus acessórios foi comprovada offline; a evidência real é a sequência técnica sem consumo de acessórios.

| URL acessório (amostra final) | Score | Motivos | Estado/motivo |
|---|---|---|---|
| http://acessorios.vw.com.br/veiculos/nivus/ | -420 | +80 EXACT_MODEL; -500 ACCESSORIES_LIFESTYLE | REJECTED/SOURCE_URL_NOT_ALLOWED |
| https://acessorios.vw.com.br/veiculos/nivus/produtos/soleira-em-vinil/2G5071310 | -420 | +80 EXACT_MODEL; -500 ACCESSORIES_LIFESTYLE | REJECTED/MAX_SOURCES |
| https://acessorios.vw.com.br/veiculos/nivus/produtos/antena-shark-2/V04010037F | -420 | +80 EXACT_MODEL; -500 ACCESSORIES_LIFESTYLE | REJECTED/MAX_SOURCES |
| https://acessorios.vw.com.br/veiculos/nivus/produtos/rodas-de-liga-17-diamantadapreto/2G5601025AFZZ | -420 | +80 EXACT_MODEL; -500 ACCESSORIES_LIFESTYLE | REJECTED/MAX_SOURCES |
| https://acessorios.vw.com.br/veiculos/nivus/produtos/jogo-de-tapetes/6EA061500 | -420 | +80 EXACT_MODEL; -500 ACCESSORIES_LIFESTYLE | REJECTED/MAX_SOURCES |

Guia Conectado e Manual de Instruções empataram em 370. O desempate por URL escolheu o guia primeiro, sem contribuição de fatos. Esse slot deixou o configurador sem cobertura. O configurador genérico (90) perdeu o último slot para a página Nivus (120, incluindo versão no label da busca). O configurador Nivus específico (170) só apareceu após o quinto GET: MAX_SOURCES.

[Todos os 427 candidatos, scores, métodos, grafo e rejeições](SPRINT_21_3_CANDIDATES.md).

| Estado/motivo | Candidatos |
|---|---|
| FETCHED | 5 |
| MAX_SOURCES | 13 |
| UNRELATED_MODEL_SEED | 2 |
| EXCLUDED_SOURCE_PURPOSE | 2 |
| NO_TARGET_RELEVANCE | 102 |
| SOURCE_URL_NOT_ALLOWED | 79 |
| OUT_OF_MY_SOURCE | 224 |

## D. Cada fonte buscada

Todos: HTTP 200, hostname final www.vw.com.br, URL final igual à inicial, zero redirects. Sem 403/429 ou bypass.

### Fonte 1

- URL: https://www.vw.com.br/pt/carros.html
- HTTP 200; content-type text/html; bytes 827560; redirects 0.
- Kind OFFICIAL_HTML; método CONNECTOR_SEED; depth 0.
- SHA-256: `43e0e286294fa09c07de28ee1e61269fe63f0145e33e3c1af298bde41645f3ac`.
- fetchedAt 2026-09-16T20:33:19.311Z.

### Fonte 2

- URL: https://www.vw.com.br/pt/servicos-e-acessorios/servicos-e-produtos/manuais-e-garantia/manuais.html
- HTTP 200; content-type text/html; bytes 1279895; redirects 0.
- Kind OFFICIAL_CATALOG; método CONNECTOR_SEED; depth 0.
- SHA-256: `0a9a3c225bcd554159ad11c90e21256c61cc65f71aaff27931f6975f65d151e1`.
- fetchedAt 2026-09-16T20:33:19.887Z.

### Fonte 3

- URL: https://www.vw.com.br/idhub/content/dam/onehub_pkw/importers/br/literatura-de-bordo/manual-nivus/my26/26A_5B1_CON_66_Conectado_BRA_Digital.pdf
- HTTP 200; content-type application/pdf; bytes 2954679; redirects 0.
- Kind OFFICIAL_MANUAL; método HTML_LINK; depth 1.
- SHA-256: `be789ba9e0507751626b15802ee4ec929ce3d80ea05d03de76f0d2ec629710f7`.
- fetchedAt 2026-09-16T20:33:23.553Z.

### Fonte 4

- URL: https://www.vw.com.br/idhub/content/dam/onehub_pkw/importers/br/literatura-de-bordo/manual-nivus/my26/26B_5B1_NIV_66_Manual_de_Instrucoes_LOW.pdf
- HTTP 200; content-type application/pdf; bytes 5717012; redirects 0.
- Kind OFFICIAL_MANUAL; método HTML_LINK; depth 1.
- SHA-256: `dc5fd9c9dbdd981055756a7040434cf68e09b06f85031636f73da44a192f32a7`.
- fetchedAt 2026-09-16T20:33:27.475Z.

### Fonte 5

- URL: https://www.vw.com.br/pt/carros/nivus.html
- HTTP 200; content-type text/html; bytes 1715803; redirects 0.
- Kind OFFICIAL_HTML; método OFFICIAL_SEARCH; depth 1.
- SHA-256: `9b0e88c787bd010f3abc25fecc866e6893a12679fcba36da7a71d9a3bd06b98d`.
- fetchedAt 2026-09-16T20:33:42.787Z.

## E. TODAS as observações reais

Alvo comum: VW / Nivus / Comfortline 200 TSI / MY2026; catálogo Comfortline 1.0 TGDI AT. Todas: POSITIVE, versionBinding UNRESOLVED, yearBinding EXACT_MY, confiança de aplicabilidade 0.4, método PDF_TEXT e confiança de extração 1 registrada. Essa confiança 1 é excessiva para saídas defeituosas e não significa aprovação editorial.

| # | observedLabel | rawValue | rawUnit | parsedValue | parsedUnit | Locator |
|---|---|---|---|---|---|---|
| 1 | Motor | 1.0 TOTA | null | 1.0 TOTA | null | pdf/page/258/line/14/section/Motor 1.0 TOTALFLEX 85/94 kW - TSI |
| 2 | Cilindrada | 999 | cm3 | 999 | cm3 | pdf/page/258/line/24/section/Motor 1.0 TOTALFLEX 85/94 kW - TSI |
| 3 | transmissão | Automático de 6 marchas | null | Automático de 6 marchas | null | pdf/page/258/line/28/section/Motor 1.0 TOTALFLEX 85/94 kW - TSI |
| 4 | Motor | 1.4 TOTA | null | 1.4 TOTA | null | pdf/page/259/line/4/section/Motor 1.4 TOTALFLEX 110/110 kW - TSI |
| 5 | Cilindrada | 1395 | cm3 | 1395 | cm3 | pdf/page/259/line/21/section/Motor 1.4 TOTALFLEX 110/110 kW - TSI |
| 6 | transmissão | Automático de 6 marchas | null | Automático de 6 marchas | null | pdf/page/259/line/26/section/Motor 1.4 TOTALFLEX 110/110 kW - TSI |
| 7 | Transmissão | automática de 6 marchas | null | automática de 6 marchas | null | pdf/page/260/line/13 |
| 8 | transmissão | automática | null | automática | null | pdf/page/265/line/83 |

### Observação 1

DEFEITO: designação truncada. A regex captura TOTA como prefixo de TOTALFLEX. Não considerar designação válida.

Objeto integral emitido: target, polarity, bindings, confiança, factEvidence, applicabilityEvidence, URLs, hashes e trecho/locator.

```json
{
  "target": {
    "mmvIdentity": "[\"catalog-mmv:v1\",\"vw\",\"nivus\",\"comfortline 1.0 tgdi at\"]",
    "brand": "VW",
    "model": "Nivus",
    "officialVersionLabel": "Comfortline 200 TSI",
    "modelYear": 2026
  },
  "observation": {
    "observedLabel": "Motor",
    "rawValue": "1.0 TOTA",
    "rawUnit": null,
    "parsedValue": "1.0 TOTA",
    "parsedUnit": null,
    "polarity": "POSITIVE"
  },
  "applicability": {
    "versionBinding": "UNRESOLVED",
    "yearBinding": "EXACT_MY",
    "confidence": 0.4
  },
  "evidence": {
    "sourceUrl": "https://www.vw.com.br/idhub/content/dam/onehub_pkw/importers/br/literatura-de-bordo/manual-nivus/my26/26B_5B1_NIV_66_Manual_de_Instrucoes_LOW.pdf",
    "sourceKind": "OFFICIAL_MANUAL",
    "evidenceText": "Motor 1.0 TOTALFLEX 85/94 kW - TSI",
    "locator": "pdf/page/258/line/14/section/Motor 1.0 TOTALFLEX 85/94 kW - TSI",
    "contentHash": "dc5fd9c9dbdd981055756a7040434cf68e09b06f85031636f73da44a192f32a7"
  },
  "extraction": {
    "method": "PDF_TEXT",
    "confidence": 1
  },
  "factEvidence": [
    {
      "sourceUrl": "https://www.vw.com.br/idhub/content/dam/onehub_pkw/importers/br/literatura-de-bordo/manual-nivus/my26/26B_5B1_NIV_66_Manual_de_Instrucoes_LOW.pdf",
      "sourceKind": "OFFICIAL_MANUAL",
      "evidenceText": "Motor 1.0 TOTALFLEX 85/94 kW - TSI",
      "locator": "pdf/page/258/line/14/section/Motor 1.0 TOTALFLEX 85/94 kW - TSI",
      "contentHash": "dc5fd9c9dbdd981055756a7040434cf68e09b06f85031636f73da44a192f32a7"
    }
  ],
  "applicabilityEvidence": [
    {
      "sourceUrl": "https://www.vw.com.br/idhub/content/dam/onehub_pkw/importers/br/literatura-de-bordo/manual-nivus/my26/26B_5B1_NIV_66_Manual_de_Instrucoes_LOW.pdf",
      "sourceKind": "OFFICIAL_MANUAL",
      "evidenceText": "Motor 1.0 TOTALFLEX 85/94 kW - TSI",
      "locator": "pdf/page/258/line/14/section/Motor 1.0 TOTALFLEX 85/94 kW - TSI",
      "contentHash": "dc5fd9c9dbdd981055756a7040434cf68e09b06f85031636f73da44a192f32a7"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/servicos-e-acessorios/servicos-e-produtos/manuais-e-garantia/manuais.html",
      "sourceKind": "OFFICIAL_CATALOG",
      "contentHash": "0a9a3c225bcd554159ad11c90e21256c61cc65f71aaff27931f6975f65d151e1",
      "locator": "discovered-link/https://www.vw.com.br/idhub/content/dam/onehub_pkw/importers/br/literatura-de-bordo/manual-nivus/my26/26B_5B1_NIV_66_Manual_de_Instrucoes_LOW.pdf",
      "evidenceText": "Manual Nivus 2026"
    }
  ]
}
```

### Observação 2

Fato técnico útil do grupo 1.0, sem prova de aplicabilidade à Comfortline.

Objeto integral emitido: target, polarity, bindings, confiança, factEvidence, applicabilityEvidence, URLs, hashes e trecho/locator.

```json
{
  "target": {
    "mmvIdentity": "[\"catalog-mmv:v1\",\"vw\",\"nivus\",\"comfortline 1.0 tgdi at\"]",
    "brand": "VW",
    "model": "Nivus",
    "officialVersionLabel": "Comfortline 200 TSI",
    "modelYear": 2026
  },
  "observation": {
    "observedLabel": "Cilindrada",
    "rawValue": "999",
    "rawUnit": "cm3",
    "parsedValue": 999,
    "parsedUnit": "cm3",
    "polarity": "POSITIVE"
  },
  "applicability": {
    "versionBinding": "UNRESOLVED",
    "yearBinding": "EXACT_MY",
    "confidence": 0.4
  },
  "evidence": {
    "sourceUrl": "https://www.vw.com.br/idhub/content/dam/onehub_pkw/importers/br/literatura-de-bordo/manual-nivus/my26/26B_5B1_NIV_66_Manual_de_Instrucoes_LOW.pdf",
    "sourceKind": "OFFICIAL_MANUAL",
    "evidenceText": "Cilindrada 999 cm3",
    "locator": "pdf/page/258/line/24/section/Motor 1.0 TOTALFLEX 85/94 kW - TSI",
    "contentHash": "dc5fd9c9dbdd981055756a7040434cf68e09b06f85031636f73da44a192f32a7"
  },
  "extraction": {
    "method": "PDF_TEXT",
    "confidence": 1
  },
  "factEvidence": [
    {
      "sourceUrl": "https://www.vw.com.br/idhub/content/dam/onehub_pkw/importers/br/literatura-de-bordo/manual-nivus/my26/26B_5B1_NIV_66_Manual_de_Instrucoes_LOW.pdf",
      "sourceKind": "OFFICIAL_MANUAL",
      "evidenceText": "Cilindrada 999 cm3",
      "locator": "pdf/page/258/line/24/section/Motor 1.0 TOTALFLEX 85/94 kW - TSI",
      "contentHash": "dc5fd9c9dbdd981055756a7040434cf68e09b06f85031636f73da44a192f32a7"
    }
  ],
  "applicabilityEvidence": [
    {
      "sourceUrl": "https://www.vw.com.br/idhub/content/dam/onehub_pkw/importers/br/literatura-de-bordo/manual-nivus/my26/26B_5B1_NIV_66_Manual_de_Instrucoes_LOW.pdf",
      "sourceKind": "OFFICIAL_MANUAL",
      "evidenceText": "Cilindrada 999 cm3",
      "locator": "pdf/page/258/line/24/section/Motor 1.0 TOTALFLEX 85/94 kW - TSI",
      "contentHash": "dc5fd9c9dbdd981055756a7040434cf68e09b06f85031636f73da44a192f32a7"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/servicos-e-acessorios/servicos-e-produtos/manuais-e-garantia/manuais.html",
      "sourceKind": "OFFICIAL_CATALOG",
      "contentHash": "0a9a3c225bcd554159ad11c90e21256c61cc65f71aaff27931f6975f65d151e1",
      "locator": "discovered-link/https://www.vw.com.br/idhub/content/dam/onehub_pkw/importers/br/literatura-de-bordo/manual-nivus/my26/26B_5B1_NIV_66_Manual_de_Instrucoes_LOW.pdf",
      "evidenceText": "Manual Nivus 2026"
    }
  ]
}
```

### Observação 3

Fato técnico útil do grupo 1.0; a sigla AQ250 permanece no trecho original.

Objeto integral emitido: target, polarity, bindings, confiança, factEvidence, applicabilityEvidence, URLs, hashes e trecho/locator.

```json
{
  "target": {
    "mmvIdentity": "[\"catalog-mmv:v1\",\"vw\",\"nivus\",\"comfortline 1.0 tgdi at\"]",
    "brand": "VW",
    "model": "Nivus",
    "officialVersionLabel": "Comfortline 200 TSI",
    "modelYear": 2026
  },
  "observation": {
    "observedLabel": "transmissão",
    "rawValue": "Automático de 6 marchas",
    "rawUnit": null,
    "parsedValue": "Automático de 6 marchas",
    "parsedUnit": null,
    "polarity": "POSITIVE"
  },
  "applicability": {
    "versionBinding": "UNRESOLVED",
    "yearBinding": "EXACT_MY",
    "confidence": 0.4
  },
  "evidence": {
    "sourceUrl": "https://www.vw.com.br/idhub/content/dam/onehub_pkw/importers/br/literatura-de-bordo/manual-nivus/my26/26B_5B1_NIV_66_Manual_de_Instrucoes_LOW.pdf",
    "sourceKind": "OFFICIAL_MANUAL",
    "evidenceText": "Tipo de transmissão Automático de 6 marchas (AQ250)",
    "locator": "pdf/page/258/line/28/section/Motor 1.0 TOTALFLEX 85/94 kW - TSI",
    "contentHash": "dc5fd9c9dbdd981055756a7040434cf68e09b06f85031636f73da44a192f32a7"
  },
  "extraction": {
    "method": "PDF_TEXT",
    "confidence": 1
  },
  "factEvidence": [
    {
      "sourceUrl": "https://www.vw.com.br/idhub/content/dam/onehub_pkw/importers/br/literatura-de-bordo/manual-nivus/my26/26B_5B1_NIV_66_Manual_de_Instrucoes_LOW.pdf",
      "sourceKind": "OFFICIAL_MANUAL",
      "evidenceText": "Tipo de transmissão Automático de 6 marchas (AQ250)",
      "locator": "pdf/page/258/line/28/section/Motor 1.0 TOTALFLEX 85/94 kW - TSI",
      "contentHash": "dc5fd9c9dbdd981055756a7040434cf68e09b06f85031636f73da44a192f32a7"
    }
  ],
  "applicabilityEvidence": [
    {
      "sourceUrl": "https://www.vw.com.br/idhub/content/dam/onehub_pkw/importers/br/literatura-de-bordo/manual-nivus/my26/26B_5B1_NIV_66_Manual_de_Instrucoes_LOW.pdf",
      "sourceKind": "OFFICIAL_MANUAL",
      "evidenceText": "Tipo de transmissão Automático de 6 marchas (AQ250)",
      "locator": "pdf/page/258/line/28/section/Motor 1.0 TOTALFLEX 85/94 kW - TSI",
      "contentHash": "dc5fd9c9dbdd981055756a7040434cf68e09b06f85031636f73da44a192f32a7"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/servicos-e-acessorios/servicos-e-produtos/manuais-e-garantia/manuais.html",
      "sourceKind": "OFFICIAL_CATALOG",
      "contentHash": "0a9a3c225bcd554159ad11c90e21256c61cc65f71aaff27931f6975f65d151e1",
      "locator": "discovered-link/https://www.vw.com.br/idhub/content/dam/onehub_pkw/importers/br/literatura-de-bordo/manual-nivus/my26/26B_5B1_NIV_66_Manual_de_Instrucoes_LOW.pdf",
      "evidenceText": "Manual Nivus 2026"
    }
  ]
}
```

### Observação 4

DEFEITO: designação truncada, mesma causa da observação 1.

Objeto integral emitido: target, polarity, bindings, confiança, factEvidence, applicabilityEvidence, URLs, hashes e trecho/locator.

```json
{
  "target": {
    "mmvIdentity": "[\"catalog-mmv:v1\",\"vw\",\"nivus\",\"comfortline 1.0 tgdi at\"]",
    "brand": "VW",
    "model": "Nivus",
    "officialVersionLabel": "Comfortline 200 TSI",
    "modelYear": 2026
  },
  "observation": {
    "observedLabel": "Motor",
    "rawValue": "1.4 TOTA",
    "rawUnit": null,
    "parsedValue": "1.4 TOTA",
    "parsedUnit": null,
    "polarity": "POSITIVE"
  },
  "applicability": {
    "versionBinding": "UNRESOLVED",
    "yearBinding": "EXACT_MY",
    "confidence": 0.4
  },
  "evidence": {
    "sourceUrl": "https://www.vw.com.br/idhub/content/dam/onehub_pkw/importers/br/literatura-de-bordo/manual-nivus/my26/26B_5B1_NIV_66_Manual_de_Instrucoes_LOW.pdf",
    "sourceKind": "OFFICIAL_MANUAL",
    "evidenceText": "Motor 1.4 TOTALFLEX 110/110 kW - TSI",
    "locator": "pdf/page/259/line/4/section/Motor 1.4 TOTALFLEX 110/110 kW - TSI",
    "contentHash": "dc5fd9c9dbdd981055756a7040434cf68e09b06f85031636f73da44a192f32a7"
  },
  "extraction": {
    "method": "PDF_TEXT",
    "confidence": 1
  },
  "factEvidence": [
    {
      "sourceUrl": "https://www.vw.com.br/idhub/content/dam/onehub_pkw/importers/br/literatura-de-bordo/manual-nivus/my26/26B_5B1_NIV_66_Manual_de_Instrucoes_LOW.pdf",
      "sourceKind": "OFFICIAL_MANUAL",
      "evidenceText": "Motor 1.4 TOTALFLEX 110/110 kW - TSI",
      "locator": "pdf/page/259/line/4/section/Motor 1.4 TOTALFLEX 110/110 kW - TSI",
      "contentHash": "dc5fd9c9dbdd981055756a7040434cf68e09b06f85031636f73da44a192f32a7"
    }
  ],
  "applicabilityEvidence": [
    {
      "sourceUrl": "https://www.vw.com.br/idhub/content/dam/onehub_pkw/importers/br/literatura-de-bordo/manual-nivus/my26/26B_5B1_NIV_66_Manual_de_Instrucoes_LOW.pdf",
      "sourceKind": "OFFICIAL_MANUAL",
      "evidenceText": "Motor 1.4 TOTALFLEX 110/110 kW - TSI",
      "locator": "pdf/page/259/line/4/section/Motor 1.4 TOTALFLEX 110/110 kW - TSI",
      "contentHash": "dc5fd9c9dbdd981055756a7040434cf68e09b06f85031636f73da44a192f32a7"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/servicos-e-acessorios/servicos-e-produtos/manuais-e-garantia/manuais.html",
      "sourceKind": "OFFICIAL_CATALOG",
      "contentHash": "0a9a3c225bcd554159ad11c90e21256c61cc65f71aaff27931f6975f65d151e1",
      "locator": "discovered-link/https://www.vw.com.br/idhub/content/dam/onehub_pkw/importers/br/literatura-de-bordo/manual-nivus/my26/26B_5B1_NIV_66_Manual_de_Instrucoes_LOW.pdf",
      "evidenceText": "Manual Nivus 2026"
    }
  ]
}
```

### Observação 5

Fato técnico útil do grupo 1.4, sem prova de aplicabilidade à Comfortline. Não atribuir essa cilindrada à versão alvo.

Objeto integral emitido: target, polarity, bindings, confiança, factEvidence, applicabilityEvidence, URLs, hashes e trecho/locator.

```json
{
  "target": {
    "mmvIdentity": "[\"catalog-mmv:v1\",\"vw\",\"nivus\",\"comfortline 1.0 tgdi at\"]",
    "brand": "VW",
    "model": "Nivus",
    "officialVersionLabel": "Comfortline 200 TSI",
    "modelYear": 2026
  },
  "observation": {
    "observedLabel": "Cilindrada",
    "rawValue": "1395",
    "rawUnit": "cm3",
    "parsedValue": 1395,
    "parsedUnit": "cm3",
    "polarity": "POSITIVE"
  },
  "applicability": {
    "versionBinding": "UNRESOLVED",
    "yearBinding": "EXACT_MY",
    "confidence": 0.4
  },
  "evidence": {
    "sourceUrl": "https://www.vw.com.br/idhub/content/dam/onehub_pkw/importers/br/literatura-de-bordo/manual-nivus/my26/26B_5B1_NIV_66_Manual_de_Instrucoes_LOW.pdf",
    "sourceKind": "OFFICIAL_MANUAL",
    "evidenceText": "Cilindrada 1395 cm3",
    "locator": "pdf/page/259/line/21/section/Motor 1.4 TOTALFLEX 110/110 kW - TSI",
    "contentHash": "dc5fd9c9dbdd981055756a7040434cf68e09b06f85031636f73da44a192f32a7"
  },
  "extraction": {
    "method": "PDF_TEXT",
    "confidence": 1
  },
  "factEvidence": [
    {
      "sourceUrl": "https://www.vw.com.br/idhub/content/dam/onehub_pkw/importers/br/literatura-de-bordo/manual-nivus/my26/26B_5B1_NIV_66_Manual_de_Instrucoes_LOW.pdf",
      "sourceKind": "OFFICIAL_MANUAL",
      "evidenceText": "Cilindrada 1395 cm3",
      "locator": "pdf/page/259/line/21/section/Motor 1.4 TOTALFLEX 110/110 kW - TSI",
      "contentHash": "dc5fd9c9dbdd981055756a7040434cf68e09b06f85031636f73da44a192f32a7"
    }
  ],
  "applicabilityEvidence": [
    {
      "sourceUrl": "https://www.vw.com.br/idhub/content/dam/onehub_pkw/importers/br/literatura-de-bordo/manual-nivus/my26/26B_5B1_NIV_66_Manual_de_Instrucoes_LOW.pdf",
      "sourceKind": "OFFICIAL_MANUAL",
      "evidenceText": "Cilindrada 1395 cm3",
      "locator": "pdf/page/259/line/21/section/Motor 1.4 TOTALFLEX 110/110 kW - TSI",
      "contentHash": "dc5fd9c9dbdd981055756a7040434cf68e09b06f85031636f73da44a192f32a7"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/servicos-e-acessorios/servicos-e-produtos/manuais-e-garantia/manuais.html",
      "sourceKind": "OFFICIAL_CATALOG",
      "contentHash": "0a9a3c225bcd554159ad11c90e21256c61cc65f71aaff27931f6975f65d151e1",
      "locator": "discovered-link/https://www.vw.com.br/idhub/content/dam/onehub_pkw/importers/br/literatura-de-bordo/manual-nivus/my26/26B_5B1_NIV_66_Manual_de_Instrucoes_LOW.pdf",
      "evidenceText": "Manual Nivus 2026"
    }
  ]
}
```

### Observação 6

Fato técnico útil do grupo 1.4, sem prova de aplicabilidade à Comfortline.

Objeto integral emitido: target, polarity, bindings, confiança, factEvidence, applicabilityEvidence, URLs, hashes e trecho/locator.

```json
{
  "target": {
    "mmvIdentity": "[\"catalog-mmv:v1\",\"vw\",\"nivus\",\"comfortline 1.0 tgdi at\"]",
    "brand": "VW",
    "model": "Nivus",
    "officialVersionLabel": "Comfortline 200 TSI",
    "modelYear": 2026
  },
  "observation": {
    "observedLabel": "transmissão",
    "rawValue": "Automático de 6 marchas",
    "rawUnit": null,
    "parsedValue": "Automático de 6 marchas",
    "parsedUnit": null,
    "polarity": "POSITIVE"
  },
  "applicability": {
    "versionBinding": "UNRESOLVED",
    "yearBinding": "EXACT_MY",
    "confidence": 0.4
  },
  "evidence": {
    "sourceUrl": "https://www.vw.com.br/idhub/content/dam/onehub_pkw/importers/br/literatura-de-bordo/manual-nivus/my26/26B_5B1_NIV_66_Manual_de_Instrucoes_LOW.pdf",
    "sourceKind": "OFFICIAL_MANUAL",
    "evidenceText": "Tipo de transmissão Automático de 6 marchas (AQ250)",
    "locator": "pdf/page/259/line/26/section/Motor 1.4 TOTALFLEX 110/110 kW - TSI",
    "contentHash": "dc5fd9c9dbdd981055756a7040434cf68e09b06f85031636f73da44a192f32a7"
  },
  "extraction": {
    "method": "PDF_TEXT",
    "confidence": 1
  },
  "factEvidence": [
    {
      "sourceUrl": "https://www.vw.com.br/idhub/content/dam/onehub_pkw/importers/br/literatura-de-bordo/manual-nivus/my26/26B_5B1_NIV_66_Manual_de_Instrucoes_LOW.pdf",
      "sourceKind": "OFFICIAL_MANUAL",
      "evidenceText": "Tipo de transmissão Automático de 6 marchas (AQ250)",
      "locator": "pdf/page/259/line/26/section/Motor 1.4 TOTALFLEX 110/110 kW - TSI",
      "contentHash": "dc5fd9c9dbdd981055756a7040434cf68e09b06f85031636f73da44a192f32a7"
    }
  ],
  "applicabilityEvidence": [
    {
      "sourceUrl": "https://www.vw.com.br/idhub/content/dam/onehub_pkw/importers/br/literatura-de-bordo/manual-nivus/my26/26B_5B1_NIV_66_Manual_de_Instrucoes_LOW.pdf",
      "sourceKind": "OFFICIAL_MANUAL",
      "evidenceText": "Tipo de transmissão Automático de 6 marchas (AQ250)",
      "locator": "pdf/page/259/line/26/section/Motor 1.4 TOTALFLEX 110/110 kW - TSI",
      "contentHash": "dc5fd9c9dbdd981055756a7040434cf68e09b06f85031636f73da44a192f32a7"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/servicos-e-acessorios/servicos-e-produtos/manuais-e-garantia/manuais.html",
      "sourceKind": "OFFICIAL_CATALOG",
      "contentHash": "0a9a3c225bcd554159ad11c90e21256c61cc65f71aaff27931f6975f65d151e1",
      "locator": "discovered-link/https://www.vw.com.br/idhub/content/dam/onehub_pkw/importers/br/literatura-de-bordo/manual-nivus/my26/26B_5B1_NIV_66_Manual_de_Instrucoes_LOW.pdf",
      "evidenceText": "Manual Nivus 2026"
    }
  ]
}
```

### Observação 7

Definição da sigla AQ250; não contar como novo equipamento instalado ou uma terceira transmissão.

Objeto integral emitido: target, polarity, bindings, confiança, factEvidence, applicabilityEvidence, URLs, hashes e trecho/locator.

```json
{
  "target": {
    "mmvIdentity": "[\"catalog-mmv:v1\",\"vw\",\"nivus\",\"comfortline 1.0 tgdi at\"]",
    "brand": "VW",
    "model": "Nivus",
    "officialVersionLabel": "Comfortline 200 TSI",
    "modelYear": 2026
  },
  "observation": {
    "observedLabel": "Transmissão",
    "rawValue": "automática de 6 marchas",
    "rawUnit": null,
    "parsedValue": "automática de 6 marchas",
    "parsedUnit": null,
    "polarity": "POSITIVE"
  },
  "applicability": {
    "versionBinding": "UNRESOLVED",
    "yearBinding": "EXACT_MY",
    "confidence": 0.4
  },
  "evidence": {
    "sourceUrl": "https://www.vw.com.br/idhub/content/dam/onehub_pkw/importers/br/literatura-de-bordo/manual-nivus/my26/26B_5B1_NIV_66_Manual_de_Instrucoes_LOW.pdf",
    "sourceKind": "OFFICIAL_MANUAL",
    "evidenceText": "AQ 250 Transmissão automática de 6 marchas motor TSI.",
    "locator": "pdf/page/260/line/13",
    "contentHash": "dc5fd9c9dbdd981055756a7040434cf68e09b06f85031636f73da44a192f32a7"
  },
  "extraction": {
    "method": "PDF_TEXT",
    "confidence": 1
  },
  "factEvidence": [
    {
      "sourceUrl": "https://www.vw.com.br/idhub/content/dam/onehub_pkw/importers/br/literatura-de-bordo/manual-nivus/my26/26B_5B1_NIV_66_Manual_de_Instrucoes_LOW.pdf",
      "sourceKind": "OFFICIAL_MANUAL",
      "evidenceText": "AQ 250 Transmissão automática de 6 marchas motor TSI.",
      "locator": "pdf/page/260/line/13",
      "contentHash": "dc5fd9c9dbdd981055756a7040434cf68e09b06f85031636f73da44a192f32a7"
    }
  ],
  "applicabilityEvidence": [
    {
      "sourceUrl": "https://www.vw.com.br/idhub/content/dam/onehub_pkw/importers/br/literatura-de-bordo/manual-nivus/my26/26B_5B1_NIV_66_Manual_de_Instrucoes_LOW.pdf",
      "sourceKind": "OFFICIAL_MANUAL",
      "evidenceText": "AQ 250 Transmissão automática de 6 marchas motor TSI.",
      "locator": "pdf/page/260/line/13",
      "contentHash": "dc5fd9c9dbdd981055756a7040434cf68e09b06f85031636f73da44a192f32a7"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/servicos-e-acessorios/servicos-e-produtos/manuais-e-garantia/manuais.html",
      "sourceKind": "OFFICIAL_CATALOG",
      "contentHash": "0a9a3c225bcd554159ad11c90e21256c61cc65f71aaff27931f6975f65d151e1",
      "locator": "discovered-link/https://www.vw.com.br/idhub/content/dam/onehub_pkw/importers/br/literatura-de-bordo/manual-nivus/my26/26B_5B1_NIV_66_Manual_de_Instrucoes_LOW.pdf",
      "evidenceText": "Manual Nivus 2026"
    }
  ]
}
```

### Observação 8

Trecho com aparência de índice/remissão (número 109), sem afirmação técnica suficiente. Falso positivo da seleção de seção.

Objeto integral emitido: target, polarity, bindings, confiança, factEvidence, applicabilityEvidence, URLs, hashes e trecho/locator.

```json
{
  "target": {
    "mmvIdentity": "[\"catalog-mmv:v1\",\"vw\",\"nivus\",\"comfortline 1.0 tgdi at\"]",
    "brand": "VW",
    "model": "Nivus",
    "officialVersionLabel": "Comfortline 200 TSI",
    "modelYear": 2026
  },
  "observation": {
    "observedLabel": "transmissão",
    "rawValue": "automática",
    "rawUnit": null,
    "parsedValue": "automática",
    "parsedUnit": null,
    "polarity": "POSITIVE"
  },
  "applicability": {
    "versionBinding": "UNRESOLVED",
    "yearBinding": "EXACT_MY",
    "confidence": 0.4
  },
  "evidence": {
    "sourceUrl": "https://www.vw.com.br/idhub/content/dam/onehub_pkw/importers/br/literatura-de-bordo/manual-nivus/my26/26B_5B1_NIV_66_Manual_de_Instrucoes_LOW.pdf",
    "sourceKind": "OFFICIAL_MANUAL",
    "evidenceText": "com transmissão automática 109",
    "locator": "pdf/page/265/line/83",
    "contentHash": "dc5fd9c9dbdd981055756a7040434cf68e09b06f85031636f73da44a192f32a7"
  },
  "extraction": {
    "method": "PDF_TEXT",
    "confidence": 1
  },
  "factEvidence": [
    {
      "sourceUrl": "https://www.vw.com.br/idhub/content/dam/onehub_pkw/importers/br/literatura-de-bordo/manual-nivus/my26/26B_5B1_NIV_66_Manual_de_Instrucoes_LOW.pdf",
      "sourceKind": "OFFICIAL_MANUAL",
      "evidenceText": "com transmissão automática 109",
      "locator": "pdf/page/265/line/83",
      "contentHash": "dc5fd9c9dbdd981055756a7040434cf68e09b06f85031636f73da44a192f32a7"
    }
  ],
  "applicabilityEvidence": [
    {
      "sourceUrl": "https://www.vw.com.br/idhub/content/dam/onehub_pkw/importers/br/literatura-de-bordo/manual-nivus/my26/26B_5B1_NIV_66_Manual_de_Instrucoes_LOW.pdf",
      "sourceKind": "OFFICIAL_MANUAL",
      "evidenceText": "com transmissão automática 109",
      "locator": "pdf/page/265/line/83",
      "contentHash": "dc5fd9c9dbdd981055756a7040434cf68e09b06f85031636f73da44a192f32a7"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/servicos-e-acessorios/servicos-e-produtos/manuais-e-garantia/manuais.html",
      "sourceKind": "OFFICIAL_CATALOG",
      "contentHash": "0a9a3c225bcd554159ad11c90e21256c61cc65f71aaff27931f6975f65d151e1",
      "locator": "discovered-link/https://www.vw.com.br/idhub/content/dam/onehub_pkw/importers/br/literatura-de-bordo/manual-nivus/my26/26B_5B1_NIV_66_Manual_de_Instrucoes_LOW.pdf",
      "evidenceText": "Manual Nivus 2026"
    }
  ]
}
```

## F. Cobertura real

| Pergunta | Resposta |
|---|---|
| 1. Prosa do modelo produziu observações? | Nenhuma aceita. Página buscada; 12 fatos internos, todos MODEL_NOT_BOUND. Falha na identidade reconhecida pelo parser, não prova de falta de dados VW. Fatos rejeitados completos não foram retidos para diagnosticar cada trecho sem nova captura. |
| 2. Cards de configurador produziram observações? | Não. Configurador não buscado: MAX_SOURCES. Adapter passou offline; cobertura real pendente. |
| 3. Manual Nivus 2026 descoberto? | Sim, label literal do índice oficial. |
| 4. PDF buscado? | Sim, 5.717.012 bytes, HTTP 200. |
| 5. Seção técnica lida? | Sim, fatos nas páginas PDF 258/259; também saídas nas páginas 260/265. |
| 6. PDF produziu fatos? | 8 saídas brutas; 4 observações técnicas úteis de dois grupos, com demais saídas auditadas acima. |
| 7. Acessórios consumiram GET? | Não. Guia de conectividade consumiu um slot sem fatos. |

## G. Aplicabilidade

| Binding | Contagem |
|---|---|
| EXACT_VERSION | 0 |
| VERSION_MATRIX | 0 |
| MODEL_SHARED | 0 |
| UNRESOLVED | 8 |
| EXACT_MY | 8 |
| CURRENT_LINEUP | 0 |
| UNRESOLVED_MY | 0 |

factEvidence aponta ao PDF; applicabilityEvidence conserva o trecho e adiciona o índice com label Manual Nivus 2026, URL/hash próprios. Isso prova somente modelo/MY. Não houve união com prova de versão de configurador. Grupos 1.0 e 1.4 permanecem distintos pelos locators, ambos UNRESOLVED quanto à Comfortline. Não se afirma que Comfortline usa 1.4 ou equipamentos de Highline/GTS/Sense.

Índice de linha atual: 66 fatos internos, 58 rejeitados por modelo, 8 por MY divergente. MY2027 não foi promovido para MY2026. PDF: 7 linhas ambíguas de motores rejeitadas; limite de 20 páginas técnicas atingido. Seleção por palavras-chave admitiu indevidamente uma remissão de índice.

## H. Segurança e Git

Sem Production Year como pesquisa, Spec Master, códigos canônicos, comparação product_specs ou alteração de specs/products/product_specs. Supabase somente leitura via transporte GET/HEAD existente; sem writes, migration ou persistência Agent Platform. Skill Supabase aplicada à fronteira existente, sem mudar Supabase.

Sem pesquisa real Webmotors, dealer, imprensa, Jeep ou Toyota; sem browser/login/cookies artificiais/proxy/OCR/bypass. Sem reset/clean/stash/merge/stage/commit/push. C:\Dev\compra-car não foi alterado. HEAD e índice preservados; working tree contém 21.1/21.2/21.3 sem commit. Git final: .local-reports/agents/spec-source/technical-21-3/validation/final-git.log.

## I. Avaliação

1. **Extrai fatos úteis? Sim, parcialmente:** cilindrada/transmissão nos grupos PDF; não considerar as oito saídas aprovadas.
2. **Caminho que contribuiu mais? PDF_TEXT**, único com observações aceitas neste smoke.
3. **Ranking corrigido? Acessórios sim; finalidade ainda incompleta:** empate dos dois manuais deixou configurador sem slot.
4. **PDF viável? Sim:** fetch, hash, texto e locators funcionaram ao vivo. Precisa excluir índice/remissões e preservar tokens completos.
5. **Aplicabilidade conservadora? Sim para versão/MY:** nenhuma promoção de grupo para Comfortline. Qualidade/confiança da extração ainda precisa de correção.
6. **Pronto para Jeep/Toyota? Não.**
7. **Bloqueios exatos:** truncamento de TOTALFLEX pela regex; remissões de índice virando fatos; identidade não reconhecida na estrutura real da página do modelo; empate guia/manual e falta de cobertura do configurador em cinco fontes. Corrigir e cobrir com fixtures reais sanitizadas em próxima etapa revisada.

**STOP: após este smoke, apenas documentação/relatório. Nenhuma correção funcional ou nova pesquisa. Aguardar revisão.**
