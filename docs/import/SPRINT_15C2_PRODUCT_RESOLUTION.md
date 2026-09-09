# Sprint 15C.2 — Product Resolution

## Audit e decisão

O Product do catálogo é exposto por `Vehicle` (`core/entities/vehicle.ts`) e
`AdministrativeVehicle` (`core/admin/administrative-vehicle.ts`). A tela Veículos usa
`LegacySupabaseAdapter.listAdministrativeVehicles`; Criar políticas e Criar preços usam
`ManualPolicyBatchSupabaseAdapter.listProductOptions` e
`ManualPriceBatchSupabaseAdapter.listProductOptions`. Preços públicos usa
`ProductPublicPriceSupabaseAdapter`. Essas consultas existentes continuam inalteradas.

A duplicidade administrativa usa `administrativeVehicleIdentity`. Esse helper foi reutilizado,
com assinatura restrita aos cinco campos que já compunham a identidade; flags de visibilidade
nunca participaram da comparação. `vehicleTextComparisonKey` aplica trim, colapso de whitespace
e lowercase pt-BR. Acentos, hífens, pontuação e todas as palavras continuam significativos.
Anos são números comparados exatamente. Não há aliases, fuzzy matching, AI, MVS ou ID documental
como fallback. Nenhuma nova regra de normalização foi criada.

As listagens administrativas existentes não garantem paginação completa para detectar todos os
candidatos. Foi acrescentado um método ao adapter existente por uma porta read-only no Core,
sem acoplar componentes a nomes de tabelas. Nenhum segundo modelo semântico de Product foi criado:
os candidatos retornados são `AdministrativeVehicle`.

## Pipeline e leitura batch

`/admin/imports/structured-policies` → action com `requireRole('admin')` → parser Core → validator
Core → escopo de anos → `listCommercialResolutionProducts` → `resolveCommercialProducts` → preview.
Parser/validator inválidos encerram o fluxo antes de construir o adapter ou consultar o catálogo.
Ambos os anos ausentes dispensam leitura para aquele Product; se todos estão sem anos, zero consultas.

O método usa somente SELECT de identidades e flags de Products, sem consultar preços, políticas,
ofertas ou evidências persistidas. Filtra conjuntos de production_year e model_year em batch
(um superset dos pares), sem filtros textuais que poderiam divergir da normalização Core. Não filtra
is_active/is_public: a identidade de um Product existente é o critério desta etapa, e flags são
preservadas no candidato. Regras comerciais de elegibilidade não fazem parte da resolução.

Paginação por ID ascendente, até 500 linhas por request, com contagem exata do conjunto restante.
Páginas menores impostas pelo servidor não encerram silenciosamente a leitura. Lacunas, contagem
inconsistente, IDs repetidos, identidades inválidas, erro/timeout ou limites excedidos falham fechados.
Limites: 100 pares de anos, 10.000 candidatos e 15 segundos por request. Não há query por Product.
O resultado não é armazenado em cache entre requests.

As páginas são leituras separadas: mudanças de contagem durante a paginação são detectadas, mas
não há snapshot transacional entre páginas. Edições concorrentes que preservam a contagem podem
não ser detectadas. O preview é uma observação read-only; qualquer futura publicação deverá
revalidar suas referências. A seleção e ordenação por ID seguem a infraestrutura existente.

## Estados e reason codes

| Estado | Critério | Reason code |
| --- | --- | --- |
| MATCHED | Identidade completa, exatamente um Product | PRODUCT_MATCHED_EXACT |
| NOT_FOUND | Identidade completa, zero candidatos | PRODUCT_NOT_FOUND |
| AMBIGUOUS | Identidade completa, mais de um Product | PRODUCT_MATCH_AMBIGUOUS |
| NEEDS_OPERATOR_DECISION | Ambos os anos ausentes | PRODUCT_YEAR_PAIR_MISSING |

O resolver preserva `productExternalKey`, `source` (Product documental completo, incluindo identidade,
MVS e campos de extração), `matchedProduct`/`resolvedProductId` no match ou todos os `candidates` na
ambiguidade. Os candidatos têm ordem determinística por ID; Products seguem a ordem do workbook.
IDs de resolução declarados no workbook não têm autoridade para matching.

Gap corrigido: o validator 15C.1 aceitava um único ano preenchido. Agora isso produz `INVALID_VALUE`
na coluna do ano ausente, antes de ler o catálogo. Ambos vazios continuam válidos. Por defesa, se
chamado diretamente com entradas incompletas, o resolver retorna NEEDS_OPERATOR_DECISION com
`PRODUCT_YEAR_PAIR_INCOMPLETE` ou `PRODUCT_IDENTITY_INCOMPLETE`, sem reparar valores.

`PRODUCT_RESOLUTION_COMPLETE` exige todos os Products MATCHED (incluindo contrato sem Products).
Qualquer outro estado resulta em `PRODUCT_REVIEW_REQUIRED`. Contagens são derivadas dos resultados.
Falha técnica do catálogo é `PRODUCT_RESOLUTION_FAILED`, separada dos quatro estados por Product:
nunca gera NOT_FOUND artificial nem um resultado parcial. A estrutura válida e os Issues continuam
visíveis, com orientação para repetir a validação e evento seguro no log.

## UI e limites de escopo

A tabela mantém Marca, Modelo, Versão, PY/MY e Confidence, acrescentando MVS/código, Resolução e
Product Compra-Car lado a lado. Mostra reason code, chave documental, nome/ID correspondente e
candidatos expansíveis. O campo canônico XLSX é `source_mvs`, apresentado apenas como contexto.
Metadados de versão não quebram no meio do label. O loading abrange validação e resolução.

Structural Diagnostics, Product Resolution e Commercial Issues permanecem separados. Nenhum
Apply/READY_TO_APPLY, editor, criação de Product, associação humana ou valuation foi implementado.
Nada é persistido: arquivo, sessão, decisões, resolved_product_id, Policies ou Offers. Nenhuma
migration, RPC, RLS, Handbook, Prompt ou conteúdo de Legacy foi alterado.

## Jeep Golden

Aceitação executada em 2026-09-09T19:21:24.904Z contra o Staging real `shfsjyjxmgwnlexmdkcs`.
Arquivo lido diretamente de `C:\Temp\Jeep_Julho_2026_CommercialImportContract_v1.1_AUDITED.xlsx`, sem cópia para o repositório.
SHA-256 antes/depois: `675d2bdba410f194a3f019a9e023bceb9802dc4bcaac5dbb4c03f60d900dab91` (idênticos).

Pipeline real: parser Core → structural validator Core → leitura batch do adapter → resolver Core.
O escopo de anos do workbook retornou 226 identidades de catálogo. Não houve escrita no Supabase.

| Medida | Resultado |
| --- | --- |
| Structural diagnostics | 0 |
| Total Products | 41 |
| MATCHED | 0 |
| NOT_FOUND | 41 |
| AMBIGUOUS | 0 |
| NEEDS_OPERATOR_DECISION | 0 |

Resultado geral: `PRODUCT_REVIEW_REQUIRED`. Policies 93, Offers 65, Issues 3, Evidence 7.
MATCHED, AMBIGUOUS e NEEDS_OPERATOR_DECISION: nenhuma ocorrência.

### NOT_FOUND — lista completa

| # | brand | model | version | PY/MY | MVS/code | product_external_key |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Jeep | Renegade | Altitude T270 | 2026/2027 | 611-1CH-2 | jeep-renegade-altitude-t270-26-27 |
| 2 | Jeep | Renegade | Longitude T270 MHEV | 2026/2027 | 611-1D0-2 | jeep-renegade-longitude-t270-mhev-26-27 |
| 3 | Jeep | Renegade | Sahara T270 MHEV | 2026/2027 | 611-1F0-2 | jeep-renegade-sahara-t270-mhev-26-27 |
| 4 | Jeep | Renegade | Willys T270 4X4 | 2026/2027 | 611-1TA-2 | jeep-renegade-willys-t270-4x4-26-27 |
| 5 | Jeep | Renegade | Sport | 2025/2026 | 611.1UH.1 | jeep-renegade-sport-25-26 |
| 6 | Jeep | Renegade | Sport | 2026/2026 | 611.1UH.1 | jeep-renegade-sport-26-26 |
| 7 | Jeep | Renegade | Sport + Pack Tech | 2025/2026 | 611.1ZH.1 | jeep-renegade-sport-pack-tech-25-26 |
| 8 | Jeep | Renegade | Sport + Pack Tech | 2026/2026 | 611.1ZH.1 | jeep-renegade-sport-pack-tech-26-26 |
| 9 | Jeep | Renegade | Altitude | 2025/2026 | 611.1HH.1 | jeep-renegade-altitude-25-26 |
| 10 | Jeep | Renegade | Altitude | 2026/2026 | 611.1HH.1 | jeep-renegade-altitude-26-26 |
| 11 | Jeep | Renegade | Longitude | 2025/2026 | 611.1LH.1 | jeep-renegade-longitude-25-26 |
| 12 | Jeep | Renegade | Longitude | 2026/2026 | 611.1LH.1 | jeep-renegade-longitude-26-26 |
| 13 | Jeep | Renegade | Sahara | 2025/2026 | 611.1XH.1 | jeep-renegade-sahara-25-26 |
| 14 | Jeep | Renegade | Sahara | 2026/2026 | 611.1XH.1 | jeep-renegade-sahara-26-26 |
| 15 | Jeep | Renegade | Willys | 2025/2026 | 611.1WA.1 | jeep-renegade-willys-25-26 |
| 16 | Jeep | Renegade | Willys | 2026/2026 | 611.1WA.1 | jeep-renegade-willys-26-26 |
| 17 | Jeep | Compass | Sport | 2025/2026 | 675.CA2.1 | jeep-compass-sport-25-26 |
| 18 | Jeep | Compass | Sport | 2026/2026 | 675.CA2.1 | jeep-compass-sport-26-26 |
| 19 | Jeep | Compass | Longitude | 2025/2026 | 675.CD2.1 | jeep-compass-longitude-25-26 |
| 20 | Jeep | Compass | Longitude | 2026/2026 | 675.CD2.1 | jeep-compass-longitude-26-26 |
| 21 | Jeep | Compass | Serie S | 2025/2026 | 675.CJ2.1 | jeep-compass-serie-s-25-26 |
| 22 | Jeep | Compass | Serie S | 2026/2026 | 675.CJ2.1 | jeep-compass-serie-s-26-26 |
| 23 | Jeep | Compass | Blackhawk Hurricane | 2025/2026 | 675.1L3.1 | jeep-compass-blackhawk-hurricane-25-26 |
| 24 | Jeep | Compass | Blackhawk Hurricane | 2026/2026 | 675.1L3.1 | jeep-compass-blackhawk-hurricane-26-26 |
| 25 | Jeep | Compass | Blackhawk Flex | 2025/2026 | 675.1LZ.1 | jeep-compass-blackhawk-flex-25-26 |
| 26 | Jeep | Compass | Blackhawk Flex | 2026/2026 | 675.1LZ.1 | jeep-compass-blackhawk-flex-26-26 |
| 27 | Jeep | Commander | Longitude 7L T270 | 2026/2027 | 671.1AJ.1 | jeep-commander-longitude-7l-t270-26-27 |
| 28 | Jeep | Commander | Overland Diesel | 2026/2027 | 671.1CL.1 | jeep-commander-overland-diesel-26-27 |
| 29 | Jeep | Commander | Overland T270 MHEV | 2026/2027 | 671.1C0.1 | jeep-commander-overland-t270-mhev-26-27 |
| 30 | Jeep | Commander | Blackhawk Hurricane | 2026/2027 | 671.1DV.1 | jeep-commander-blackhawk-hurricane-26-27 |
| 31 | Jeep | Commander | Limited T270 MHEV | 2026/2027 | 671.1B0.1 | jeep-commander-limited-t270-mhev-26-27 |
| 32 | Jeep | Commander | Longitude 7L T270 | 2025/2026 | 671.1AJ.1 | jeep-commander-longitude-7l-t270-25-26 |
| 33 | Jeep | Commander | Longitude 7L T270 | 2026/2026 | 671.1AJ.1 | jeep-commander-longitude-7l-t270-26-26 |
| 34 | Jeep | Commander | Overland Diesel | 2025/2026 | 671.1CL.1 | jeep-commander-overland-diesel-25-26 |
| 35 | Jeep | Commander | Overland Diesel | 2026/2026 | 671.1CL.1 | jeep-commander-overland-diesel-26-26 |
| 36 | Jeep | Commander | Overland T270 | 2025/2026 | 671.1CJ.1 | jeep-commander-overland-t270-25-26 |
| 37 | Jeep | Commander | Overland T270 | 2026/2026 | 671.1CJ.1 | jeep-commander-overland-t270-26-26 |
| 38 | Jeep | Commander | Limited T270 | 2025/2026 | 671.1BJ.1 | jeep-commander-limited-t270-25-26 |
| 39 | Jeep | Commander | Limited T270 | 2026/2026 | 671.1BJ.1 | jeep-commander-limited-t270-26-26 |
| 40 | Jeep | Commander | Blackhawk Hurricane | 2025/2026 | 671.1DK.1 | jeep-commander-blackhawk-hurricane-25-26 |
| 41 | Jeep | Commander | Blackhawk Hurricane | 2026/2026 | 671.1DK.1 | jeep-commander-blackhawk-hurricane-26-26 |

### Catalog observations — inspeção humana

Os números remetem à lista NOT_FOUND. Todos os Products abaixo são apenas potencialmente relacionados,
nos mesmos PY/MY documentais. Não são MATCHED, aliases, decisões aprovadas ou equivalências técnicas.
Nenhuma observação alimentou ou alterou o resolver. A inspeção se limita ao catálogo do escopo de anos lido.

| NOT_FOUND # | Product potencialmente relacionado | ID | Observação |
| --- | --- | --- | --- |
| 1 | Jeep Renegade Altitude 1.3 TGDI AT 2026/2027 | 1124 | T270 no documento; 1.3 TGDI AT no catálogo. |
| 2 | Jeep Renegade Longitude 1.3 TGDI AT MHEV 2026/2027 | 1125 | T270 MHEV no documento; 1.3 TGDI AT MHEV no catálogo. |
| 3 | Jeep Renegade Sahara 1.3 TGDI AT MHEV 2026/2027 | 1126 | T270 MHEV no documento; 1.3 TGDI AT MHEV no catálogo. |
| 4 | Jeep Renegade Willys 1.3 TGDI AT 4x4 2026/2027 | 1127 | T270 4X4 no documento; 1.3 TGDI AT 4x4 no catálogo. |
| 5 | Jeep Renegade Sport 1.3 TGDI AT 2025/2026 | 954 | Catálogo acrescenta 1.3 TGDI AT. |
| 6 | Jeep Renegade Sport 1.3 TGDI AT 2026/2026 | 1054 | Catálogo acrescenta 1.3 TGDI AT. |
| 7 | Jeep Renegade Sport 1.3 TGDI AT 2025/2026 | 954 | Apenas Sport relacionado; Pack Tech não está identificado no nome do catálogo. |
| 8 | Jeep Renegade Sport 1.3 TGDI AT 2026/2026 | 1054 | Apenas Sport relacionado; Pack Tech não está identificado no nome do catálogo. |
| 9 | Jeep Renegade Altitude 1.3 TGDI AT 2025/2026 | 955 | Catálogo acrescenta 1.3 TGDI AT. |
| 10 | Jeep Renegade Altitude 1.3 TGDI AT 2026/2026 | 1055 | Catálogo acrescenta 1.3 TGDI AT. |
| 11 | Jeep Renegade Longitude 1.3 TGDI AT 2025/2026 | 956 | Catálogo acrescenta 1.3 TGDI AT. |
| 12 | Jeep Renegade Longitude 1.3 TGDI AT 2026/2026 | 1056 | Catálogo acrescenta 1.3 TGDI AT. |
| 13 | Jeep Renegade Sahara 1.3 TGDI AT 2025/2026 | 957 | Catálogo acrescenta 1.3 TGDI AT. |
| 14 | Jeep Renegade Sahara 1.3 TGDI AT 2026/2026 | 1057 | Catálogo acrescenta 1.3 TGDI AT. |
| 15 | Jeep Renegade Willys 1.3 TGDI AT 4x4 2025/2026 | 959 | Catálogo acrescenta 1.3 TGDI AT 4x4. |
| 16 | Jeep Renegade Willys 1.3 TGDI AT 4x4 2026/2026 | 1059 | Catálogo acrescenta 1.3 TGDI AT 4x4. |
| 17 | Jeep Compass Sport 1.3 TGDI AT 2025/2026 | 979 | Catálogo acrescenta 1.3 TGDI AT. |
| 18 | Jeep Compass Sport 1.3 TGDI AT 2026/2026 | 1060 | Catálogo acrescenta 1.3 TGDI AT. |
| 19 | Jeep Compass Longitude 1.3 TGDI AT 2025/2026 | 980 | Catálogo acrescenta 1.3 TGDI AT. |
| 20 | Jeep Compass Longitude 1.3 TGDI AT 2026/2026 | 1061 | Catálogo acrescenta 1.3 TGDI AT. |
| 21 | Jeep Compass Serie S 1.3 TGDI AT 2025/2026 | 981 | Catálogo acrescenta 1.3 TGDI AT. |
| 22 | Jeep Compass Serie S 1.3 TGDI AT 2026/2026 | 1062 | Catálogo acrescenta 1.3 TGDI AT. |
| 23 | Jeep Compass Blackhawk 2.0 TGDI AT 2025/2026 | 982 | Blackhawk relacionado; Hurricane não está explícito no nome do catálogo. |
| 24 | Jeep Compass Blackhawk 2.0 TGDI AT 2026/2026 | 1063 | Blackhawk relacionado; Hurricane não está explícito no nome do catálogo. |
| 25 | Jeep Compass Blackhawk 2.0 TGDI AT 2025/2026 | 982 | Blackhawk relacionado; Flex não está explícito no nome do catálogo. Não confirma equivalência. |
| 26 | Jeep Compass Blackhawk 2.0 TGDI AT 2026/2026 | 1063 | Blackhawk relacionado; Flex não está explícito no nome do catálogo. Não confirma equivalência. |
| 27 | Jeep Commander Longitude 1.3 TGDI AT 2026/2027 | 1128 | 7L T270 no documento; 1.3 TGDI AT no catálogo; 7L não está explícito. |
| 28 | Jeep Commander Overland 2.2 TD AT 4x4 2026/2027 | 1131 | Diesel no documento; 2.2 TD AT 4x4 no catálogo. |
| 29 | Jeep Commander Overland 1.3 TGDI AT MHEV 2026/2027 | 1130 | T270 MHEV no documento; 1.3 TGDI AT MHEV no catálogo. |
| 30 | Jeep Commander Blackhawk Hurricane 2.0 TGDI AT 4x4 2026/2027 | 1132 | Catálogo acrescenta 2.0 TGDI AT 4x4. |
| 31 | Jeep Commander Limited 1.3 TGDI AT MHEV 2026/2027 | 1129 | T270 MHEV no documento; 1.3 TGDI AT MHEV no catálogo. |
| 32 | Jeep Commander Longitude 1.3 TGDI AT 2025/2026 | 996 | 7L T270 no documento; 1.3 TGDI AT no catálogo; 7L não está explícito. |
| 33 | Jeep Commander Longitude 1.3 TGDI AT 2026/2026 | 1064 | 7L T270 no documento; 1.3 TGDI AT no catálogo; 7L não está explícito. |
| 34 | Jeep Commander Overland 2.2 TD AT 4x4 2025/2026 | 999 | Diesel no documento; 2.2 TD AT 4x4 no catálogo. |
| 35 | Jeep Commander Overland 2.2 TD AT 4x4 2026/2026 | 1067 | Diesel no documento; 2.2 TD AT 4x4 no catálogo. |
| 36 | Jeep Commander Overland 1.3 TGDI AT 2025/2026 | 998 | T270 no documento; 1.3 TGDI AT no catálogo. |
| 37 | Jeep Commander Overland 1.3 TGDI AT 2026/2026 | 1066 | T270 no documento; 1.3 TGDI AT no catálogo. |
| 38 | Jeep Commander Limited 1.3 TGDI AT 2025/2026 | 997 | T270 no documento; 1.3 TGDI AT no catálogo. |
| 39 | Jeep Commander Limited 1.3 TGDI AT 2026/2026 | 1065 | T270 no documento; 1.3 TGDI AT no catálogo. |
| 40 | Jeep Commander Blackhawk Hurricane 2.0 TGDI AT 4x4 2025/2026 | 1000 | Catálogo acrescenta 2.0 TGDI AT 4x4. |
| 41 | Jeep Commander Blackhawk Hurricane 2.0 TGDI AT 4x4 2026/2026 | 1068 | Catálogo acrescenta 2.0 TGDI AT 4x4. |

Aceitação concluída sem corrigir o workbook ou matching. Os 41 NOT_FOUND são entrada para a 15C.3.
O status da sprint é COMPLETE por conclusão da aceitação; não significa que os Products estejam resolvidos.
Não foram repetidos os gates de código, pois esta execução alterou somente documentação.

## Cobertura

- Core: 15 testes de resolução exata, normalização, ausência de aproximação, ambiguidade estável,
  anos ausentes/parciais, identidade incompleta, escopo batch e catálogo inválido; mais 48 testes
  existentes do parser/validator.
- Adapter: 10 testes de SELECT batch, paginação por ID inclusive com limite menor do servidor,
  duplicidades, flags privadas/inativas, scope vazio e falhas de completude/limite/consulta.
- Web: 21 testes de upload/validação/resolução, erro estrutural sem leitura, todos matched,
  estados mistos, contagens, identidade lado a lado, Issues separados, falha de catálogo e ausência
  de publicação/escrita. O guard continua testado antes da leitura do request.

Testes direcionados executados: Core 63/63, adapter 10/10 e Web 21/21 passaram.

## Gates e estado final (2026-09-09)

| Verificação | Resultado |
| --- | --- |
| `pnpm lint` | Passou, 7 tarefas |
| `pnpm typecheck` | Passou, 7 tarefas |
| `pnpm build` | Passou, rota integrada ao build |
| `pnpm test` | Falhou no timeout de 5s do teste Fiat de Domain Mapping já observado na 15C.1c |
| Core com `--maxWorkers=1` | 617 passaram, mantendo o timeout original |
| Adapter, suíte completa | 104 passaram, 3 ignorados |
| Pricing dry-run, suíte completa | 71 passaram |
| Web, suíte completa | 588 passaram, 16 ignorados, 1 falha preexistente |
| `pnpm format:check` | 244 arquivos preexistentes; nenhum arquivo alterado nesta sprint |
| Prettier direcionado e `git diff --check` | Passaram |

A falha Web é `sprint-14g-mobile-pwa.test.ts:130`: comparação literal LF contra `globals.css`
em CRLF. CSS, esse teste e o código/teste de Domain Mapping permanecem sem diff. Nenhum timeout
ou teste antigo foi relaxado. A tentativa de encaminhar `--maxWorkers=1` pelo script raiz foi
rejeitada pelo CLI do Turbo; a execução direta do Vitest no pacote Core foi usada em seguida.
O ambiente disponível é Node 24.15.0; o projeto declara Node 22.x. Build também emitiu avisos de
performance de serialização do cache webpack, sem falha de compilação.

Git revisado, sem staging/commit/push. `Legacy`, template, Handbook, Prompt e schema preservados.
Não foi executado teste de interação em browser nesta sessão.

**15C.2 COMPLETE:** aceitação executada com o XLSX real e catálogo Staging; 41 NOT_FOUND
reportados integralmente para a 15C.3. Falhas preexistentes dos gates continuam registradas acima.

## Arquivos

Criados:

- `packages/core/src/import/commercial-product-resolution.ts`: resultados e porta read-only.
- `packages/core/test/commercial-product-resolution.test.ts`: regressões de identidade.
- `packages/adapter-supabase/test/commercial-product-catalog.test.ts`: regressões da leitura batch.
- `apps/web/src/components/admin/commercial-product-resolution-preview.tsx`: tabela/summary.
- Este documento.

Alterados:

- `packages/core/src/admin/administrative-vehicle.ts`: assinatura do helper de identidade.
- `packages/core/src/import/commercial-import-structural-validator.ts`: par de anos parcial.
- `packages/core/src/index.ts`: exports.
- `packages/adapter-supabase/src/legacy-supabase-adapter.ts`: leitura batch e chamada do helper.
- `apps/web/src/server/structured-policies-preview.ts`: orquestração após validação.
- `apps/web/src/application/admin/structured-policies.ts`: resultado tipado do preview.
- `apps/web/src/components/admin/structured-policies-preview.tsx`: integração da seção de resolução.
- `apps/web/src/components/admin/structured-policies-form.tsx`: texto de loading.
- `apps/web/test/structured-policies.test.tsx`: resolução e isolamento das etapas.
- `AI_CONTEXT.md` e `CHANGELOG.md`: marco e pendência da aceitação.
