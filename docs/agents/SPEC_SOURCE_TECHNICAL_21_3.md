# Sprint 21.3 — Technical Extraction + Source Ranking Hardening

## Design implementado

Descoberta e extração permanecem separadas. Ranking soma scoreReasons explícitos: modelo +80, MY +100, versão +40, termos técnicos +70, manual/literatura +70, PDF +50, configurador +90, seed técnico +20. Acessórios/lifestyle recebem -500; serviços genéricos -80, documentos institucionais -500, falta de identidade técnica -30. Índices genéricos repetidos recebem -120 após leitura de literatura; acessórios com score negativo não bloqueiam descoberta. O primeiro seed é bootstrap; os seguintes são ordenados pelo score, com auditoria antes de cada GET. Sem URLs ou branches VW/Nivus no código de produção.

HTML: parágrafos, listas, títulos com texto próximo, definition lists, pares de atributos e cards. Valores e labels ficam no vocabulário da fonte, sem mapa de specs. Cards são limites de versão; estados JSON inertes carline/trim/engine preservam a hierarquia. MY explícito conflitante é rejeitado; ausência de MY não vira o ano solicitado. Prosa/modelo e motores de manual podem gerar observações UNRESOLVED, sem promoção para EXACT_VERSION.

Semantic fallback continua limitado ao orçamento compartilhado com discovery. Recebe somente projeção de identidade, metadados, até oito seções de 2000 caracteres e schema. Exige trecho literal, relação local label/value, unidade e confiança; aplicabilidade é calculada localmente. Não recebe Spec Master.

## PDF

Dependência direta pdfjs-dist 6.3.289, Apache-2.0, engines >=22.13.0 || >=24, verificada no registry. Repositório tinha geração PDF, não extração. PDF.js foi escolhido diretamente, sem wrapper ou serviço externo; documentação oficial: https://github.com/mozilla/pdf.js e https://mozilla.github.io/pdf.js/getting_started/. Instalação via pnpm com scripts desativados; optional canvas é dependência transitiva do PDF.js, sem uso de render/OCR pelo adapter.

Worker local recebe apenas bytes e extrai texto por página: 25 MB, 350 páginas, 2 milhões de caracteres, 60 segundos, heap 256 MB. Nenhuma execução de JavaScript do PDF, imagem/OCR ou serviço remoto. Seleciona até 20 páginas técnicas; até 500 fatos e 80 seções. Não envia manual completo ao modelo. Linhas ambíguas de motores são rejeitadas; grupos preservam locator de página/linha/seção. Manual genérico não afirma equipamento exato. A identidade MY de link explícito no índice tem evidência separada do valor PDF; resultados de busca isolados não são prova de MY do documento.

Fetch HTML permanece 2 MB e timeout total 10 segundos, redirects até 2, HTTPS e allowlist existentes. Apenas MIME application/pdf recebe limite separado de 25 MB. Hash é calculado sobre bytes originais. Parser não enfraquece políticas de URL.

## Fixtures e limites

Fixtures novas são sintéticas/autoria própria, incluindo PDF textual válido de três páginas e pool que reproduz a falha de orçamento da 21.2. A fixture real sanitizada de estado do fabricante da 21.2 permanece preservada. Não houve captura preparatória de novas páginas de veículos antes dos gates. Consultas de documentação/registry e download da dependência PDF foram necessários para implementar e testar o adapter.

Único smoke encerrado: 5 HTTP 200, 8 saídas PDF, zero acessórios; nenhuma observação HTML/configurador aceita. Gate parcial: tokens de motor truncados e remissão de índice exigem correção. [Relatório integral](SPRINT_21_3_REAL_GATE.md). Nenhum stage/commit/push.
