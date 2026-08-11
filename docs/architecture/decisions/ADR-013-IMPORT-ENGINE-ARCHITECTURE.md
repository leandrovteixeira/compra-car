# ADR-013 — Arquitetura do Import Engine

- Status: aceita
- Data: 2026-08-02
- Origem: Sprint 10B

## Contexto

A Sprint 10 precisa receber cartas comerciais e, depois, fichas técnicas, listas de preços, APIs,
crawlers, CSV e Excel. Uma carta pode ser um dossiê com documento principal, errata, complemento e
anexos. A revisão humana é obrigatória e Products, preços, Policies e Offers continuam soberanos em
seus módulos.

Ligar uma Server Action diretamente a um fornecedor de IA misturaria armazenamento, interpretação e
decisão de domínio. Também tornaria prompts, modelos, OCR e SDKs externos parte implícita do contrato
do Compra Car, dificultando troca de fornecedor, testes, proveniência, compensação e auditoria.

## Decisão

O Import Engine é um módulo oficial e independente. Sua fundação é organizada em:

- Core: batches/dossiês, documentos, Storage, lifecycle, proveniência e auditoria; review e promoção
  entram em etapas posteriores.
- Providers: implementam um contrato de extração futuro. Nenhum SDK ou fornecedor específico faz
  parte do core.
- Plugins: concentram todo conhecimento do tipo de importação. O primeiro descritor registrado é
  `commercial_letters`, versão `1`, aceitando PDF.
- Boundary: providers e plugins produzirão payloads normalizados e versionados. O contrato preservado
  para cartas é `commercial-letter/mmv-payload/1`.

O batch representa o processo e o dossiê; não representa obrigatoriamente um arquivo. Cada arquivo
físico é um `pricing_import_document` pertencente a exatamente um batch. Uma futura row é a unidade
de extração e revisão; em `commercial_letters`, uma row representa um MMV, um período aplicável e o
contexto comercial definido no contrato canônico.

Matching é responsabilidade do servidor e do domínio. Promoção só poderá chamar workflows oficiais
de Product, preço público, Policy e Offer, com confirmação humana. O provider nunca escreve nas
tabelas finais.

Nesta etapa, o contrato `ExtractionProvider` foi deliberadamente adiado para a Sprint 10C. Indexação,
extração e normalização ainda não têm requisitos operacionais maduros; publicar métodos agora criaria
uma abstração especulativa. Nenhum provider real ou falso foi conectado ao upload.

## Princípios normativos

> A IA interpreta. O domínio decide.

Todo conhecimento específico pertence ao plugin, nunca ao provider.

Nenhum fornecedor externo é parte do contrato do domínio.

O nome original do arquivo é metadata de proveniência, nunca fonte de verdade semântica. O corpus
real contém PDFs byte a byte idênticos, confirmados por SHA-256, com filenames diferentes e até com
nomes que sugerem marcas distintas. Portanto, marca, competência, vigência, MMV e natureza comercial
devem ser determinados prioritariamente pelo conteúdo do documento. O filename pode ser fornecido ao
provider apenas como contexto auxiliar e não pode decidir esses campos.

A Sprint 10C deverá incluir um teste obrigatório de `filename invariance`: processar o mesmo PDF com
o nome original e com um nome opaco, e exigir payloads normalizados semanticamente equivalentes,
desconsiderando somente metadata de proveniência ligada ao filename.

## Consequências positivas

- providers podem ser substituídos e testados por contrato;
- a infraestrutura pode ser reutilizada por fichas técnicas e outras fontes;
- batch, documento, hash e evidências dão idempotência e rastreabilidade;
- Storage privado, backend administrativo e promoção oficial reduzem a superfície de segurança;
- falhas entre Storage e banco admitem compensação e retries idempotentes.

## Consequências negativas

- existem mais contratos e estados intermediários;
- o pipeline exige observabilidade, filas e recuperação em etapas futuras;
- Storage e persistência precisam de compensação transacional explícita;
- review e promoção aumentam a quantidade de gates antes da conclusão.

## Alternativas rejeitadas

- chamar OpenAI diretamente em uma Server Action;
- permitir que IA grave ou publique diretamente nas tabelas finais;
- modelar obrigatoriamente um batch por PDF;
- colocar regras de cartas comerciais dentro do provider;
- guardar apenas JSON sem proveniência relacional por documento;
- produzir uma row com múltiplos Products.

## Compatibilidade

As colunas históricas de arquivo em `pricing_import_batches` foram preservadas. Os 12 batches
auditados no Staging não possuem arquivo associado nessas colunas, portanto não houve backfill. Os
batches históricos usam `plugin_key = pricing_workflow`; a UI inicial filtra e cria somente
`commercial_letters`. Não houve alteração em `Legacy` nem no lifecycle comercial.
