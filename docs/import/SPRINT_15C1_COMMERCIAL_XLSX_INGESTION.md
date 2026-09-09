# Sprint 15C.1 — Commercial XLSX ingestion

## Escopo

Esta sprint introduz somente o boundary em memória:

`CommercialImportContract/1 XLSX → parser → contrato TypeScript → structural validator`

Não há UI, Product Resolution, valuation, Apply, persistência, Supabase ou migration.

## Decisão arquitetural

O boundary vive em `packages/core/src/import` e converge para o domínio comercial existente. Os
vocabulários `CommercialPolicyType` e `PricingVoucherType` são reutilizados de
`entities/commercial-pricing`; nenhuma entidade comercial paralela ou nome de tabela foi criado.

O parser lê diretamente o subconjunto OpenXML necessário e usa `fflate` apenas para o contêiner ZIP.
Isso evita incorporar uma suíte de edição de planilhas a um boundary estritamente de leitura. Limites
de 25 MiB comprimidos, 100 MiB descomprimidos e 50.000 linhas por sheet reduzem o risco de entradas
hostis.

## Contrato estrutural

São obrigatórias, exatamente uma vez, as sheets `Metadata`, `Products`, `Policies`, `Offers`,
`OfferPolicies`, `Issues` e `Evidence`. `README` é opcional e ignorada. Outra sheet é rejeitada.

Todos os headers versionados no template são obrigatórios. Headers ausentes, duplicados ou extras são
diagnostics estruturados; o parser não sintetiza colunas. Linhas apenas formatadas e sem conteúdo são
ignoradas, e células vazias são representadas por `null`.

`Metadata` deve conter exatamente uma linha material. O validator verifica a versão exata, datas e
competências canônicas, tipos correntes de Policy, voucher, confidence, chaves únicas e integridade de
Products → Policies/Offers → OfferPolicies. Campos reservados para resolução posterior podem continuar
vazios.

## API

- `parseCommercialImportContractV1(Uint8Array | ArrayBuffer)` retorna
  `CommercialImportContractV1` ou lança `CommercialImportContractParseError` com diagnostics.
- `validateCommercialImportContractV1(contract)` retorna `{ ok, diagnostics }` e não muta o contrato.

Diagnostics incluem `code`, `message` e, quando aplicável, `sheet`, `row` e `column`.

## Limitação deliberada

Esta etapa não transforma o contrato em inputs persistíveis de Policy/Offer. Regras que dependem de
Product, MSRP, parameter sets, cálculo de benefício ou confirmação humana permanecem **PENDENTES** para
sprints posteriores.
