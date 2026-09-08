# Vehicle Specs Data Refresh Runbook

## Escopo e estado

Este runbook descreve o refresh determinístico de `products` e `product_specs`. A etapa atual é
somente dry-run: não executa `POST`, `PATCH`, `PUT`, `DELETE`, RPC, migration ou alteração de RLS. O
Import Engine 10R e os arquivos em `Legacy` não participam da implementação.

## Fontes e precedência

1. O Compra Car App (`public.specs`) é autoritativo para código, tipo e metadados estruturais. A
   leitura auditada em 2026-09-01 contém 320 registros.
2. A auditoria vigente do Excel/master é complementar. Ela pode explicitar lacunas e decisões
   aprovadas, mas não substitui tipo ou metadado do App por semelhança textual.
3. `Legacy/staging.csv` é a fonte histórica dos valores de 276 veículos. É lido sem modificação.
4. O Staging fornece somente os Products existentes para o matching e um snapshot comparativo de
   specs. Seus 190 specs não são o catálogo mestre.

Todo de-para usa código exato. Não há fuzzy matching, associação por nome, dependência da ordem das
colunas ou criação automática de spec.

## Estrutura da matriz e identidade

O CSV usa `;`, possui 276 linhas de veículos e 299 colunas: seis campos de identidade e 293 specs.

- `SC_0001`: nome completo/de exibição; não é fonte primária de ano.
- `SC_0002`: marca.
- `SC_0003`: modelo.
- `SC_0004`: versão.
- `SC_0005`: ano de produção autoral.
- `SC_0006`: ano-modelo autoral.

O matching normaliza `brand + model + version + productionYear + modelYear` pelo contrato do domínio
e classifica `EXISTING_EXACT`, `NEW_PRODUCT`, `AMBIGUOUS` ou `INVALID`. Formas compactas como `2526`
em `SC_0001` permanecem apenas no display name. Se `SC_0005`/`SC_0006` forem inválidos ou
conflitantes, o registro exige revisão; o processo nunca inventa ano.

## Modelo e parsing

O tipo mestre da spec controla o parser:

- `numeric`: usa o parser numérico canônico, aceita decimal pt-BR quando inequívoco e preserva zero
  como valor real. Em `EX_0004`, somente o padrão inequívoco `WIDTH/RATIO RDIAMETER`, com whitespace
  variável, permite extrair o `RATIO`; `EX_0003` e `EX_0002` nunca são derivados ou sobrescritos. Em
  specs cuja unidade canônica é `inch`, e somente nelas, `"` é removido como decoração da unidade;
- `binary`: `S`/`s`, `true` e `1` representam `true`; `0` representa `false`; vazio permanece
  ausência. Texto não previsto, como `Alert&Can be closed` ou `USB`, fica em review com o raw value;
- `scale`: é resolvida pelo `spec_set`, nunca pela aparência isolada da célula.

`TBD` e `TBC` são pendentes/review, nunca zero. Valores qualificados que os contenham, como
`108(NEDC) INMETRO TBC`, não são parcialmente convertidos. Lixo sintático sem conteúdo semântico,
como `,`, é `MALFORMED_SOURCE_VALUE`. Célula vazia não gera `product_specs`. O transpose percorre as
linhas na ordem da fonte e resolve cada spec exclusivamente pelo código, produzindo saída estável para
a mesma entrada.

## Scales, baselines e códigos adicionados

Cada opção de scale conserva `spec_set`, `detail`, unidade e demais metadados do App. As opções-base
(`None` e equivalentes aprovados) não são removidas: o catálogo candidato contém 26 baselines. As
famílias já adotadas permanecem válidas, inclusive complementos `*_1000+` e `PW_FUEL_001` a
`PW_FUEL_006`. Nenhum valor é promovido entre grupos de scale por texto semelhante.

A identidade estável de uma scale é `group_name + equipment_group + spec_set`. `spec_set` isolado não
é suficiente porque nomes iguais podem existir em equipamentos distintos. A resolução agrupa todos
os membros por essa chave estrutural e identifica exatamente um baseline no catálogo:

1. um único membro não-baseline marcado por `S`/`s`, `true` ou `1` vence os sinais de zero e é
   `explicit`;
2. sem membro superior explícito, qualquer representação histórica `0` resolve o baseline uma única
   vez para o grupo;
3. baseline e membro superior nunca são emitidos simultaneamente;
4. dois ou mais membros não-baseline selecionados geram `SCALE_CONFLICT`; nenhum deles é escolhido;
5. ausência ou multiplicidade de baseline no catálogo gera review estrutural.

Exemplos de baseline preservados incluem ICE em `Engine tech`, MT em `Transmission type` e FWD em
`Traction`. A mesma regra é aplicada às demais scales do catálogo reconciliado.

### Fog lamps, Tilt Down e Parking Camera

Front e Rear Fog Lamps são scales independentes mesmo quando compartilham `spec_set`:

- Front: `EX_0017 = Bulb`, `EX_0018 = LED`;
- Rear: `EX_0023 = Bulb`, `EX_0024 = LED`.

Assim, combinações Front + Rear podem coexistir e nunca são `SCALE_CONFLICT`. Mirror Tilt Down é uma
única scale: `EX_1012 = None`, `EX_1006 = Left`, `EX_0030 = Right`, `EX_0031 = Both`. Parking Camera
também é uma única scale: `SF_1017 = None`, `SF_0034 = RVM`, `SF_0035 = 360°`, `SF_0036 = 540°`.
Seleções simultâneas de membros superiores continuam em review, exceto os dois pares históricos
exatos aprovados e documentados abaixo.

### Normalizações específicas de `Legacy/staging.csv`

As regras abaixo pertencem exclusivamente ao perfil `legacy-staging-csv`. Não são regras universais
do domínio, não se aplicam ao caminho remoto da staging e preservam `rawValue` e o identificador da
normalização no artifact:

- `EX_0030=S + EX_0031=S` seleciona somente `EX_0031 = Both`;
- `SF_0034=S + SF_0035=S` seleciona somente `SF_0035 = 360°`;
- `CO_0033 = Alert&Can be closed` produz binary `true`;
- `SF_0041 = USB` produz binary `false`, nunca presença.

Essas quatro regras resultam de auditoria dos mesmos veículos contra o App. Nenhuma lógica genérica
de “maior membro”, texto binary ou limpeza textual foi introduzida.

### `PW_0045`, REEV e AT

No App atual, `PW_0045` representa AT em `Transmission type`, mas possui zero usos em
`product_specs`. A decisão aprovada redefine `PW_0045` como REEV em `Engine tech`. Para preservar o
valor histórico AT da matriz sem ambiguidade, o plano reserva `PW_1045` em `Transmission type`: o
código segue a convenção `*_1000+`, é determinístico em relação ao código deslocado e estava livre
no App, Staging, Excel auditado e matriz.

No dry-run, somente a origem histórica é mapeada `PW_0045 -> PW_1045`; o catálogo candidato conserva
`PW_0045 = REEV`. Nenhuma dessas decisões foi persistida.

### Torque

Torque é armazenado canonicamente em Nm. Conversão para kgfm é apenas de apresentação e nunca altera
o valor armazenado. Os aliases redundantes `PW_0013`, `PW_0024`, `PW_0027` e `PW_0034` são marcados
`EXCLUDED_REDUNDANT_UNIT`; não são criados nem promovidos e não provocam conversão destrutiva.

## Reconciliação auditada

O catálogo candidato contém 321 códigos: 59 numeric, 172 binary e 90 scale. O de-para registra 313
cópias 1:1, uma redefinição deliberada (`PW_0045`), uma adição deliberada (`PW_1045`), seis códigos
somente no App (`PW_FUEL_001` a `006`) e quatro aliases de torque excluídos.

Seis divergências de metadados permanecem explícitas e **PENDENTES** de decisão humana:

- `CO_0032`: `detail` e `type`;
- `CO_0033`: `spec_set` e `type`;
- `CO_0043`: `type`;
- `CO_0044` e `CO_0045`: `spec_set` e `detail`;
- `PW_0042`: `type`.

O App continua autoritativo nesses conflitos; o dry-run não tenta conciliá-los por aparência. A
estrutura confirmada é `CO_0032`/`CO_0033` binary, `CO_0043`/`CO_0044`/`CO_0045` numeric e `PW_0042`
scale.

## Execução do dry-run

Na raiz do monorepo:

```text
pnpm specs:reconcile
```

O runner valida os project refs, faz somente GETs, lê `Legacy/staging.csv` e grava apenas o arquivo
ignorado `temp/vehicle-specs-reconciled-dry-run.json`. SHA-256 da fonte auditada:
`3A50FD77989C187ED465C202FB168B61E2EE846A8DAC16D1EDA4999E7F67E0B6`.

Resultado de referência em 2026-09-01:

- 276/276 veículos processados; 9 existing exact, 267 new, 0 ambiguous e 0 invalid;
- 80.868 células de spec observadas; 38.019 reconhecidas, 38.006 promovíveis e 37.949 associações
  parseadas após consolidação das scales;
- 42.849 vazias, 13 células em review e 2 malformed;
- 293 códigos únicos reconhecidos e zero unknown spec code;
- 13 eventos de issue: 6 `TBC`, 3 `TBD`, 2 valores qualificados pendentes e 2 malformed;
- scales resolvidas: 4.427 por membro explícito, 1.015 por baseline e zero `SCALE_CONFLICT`.

A correção da identidade estrutural eliminou os 29 falsos conflitos Front/Rear Fog Lamps. As decisões
de negócio posteriores converteram as evidências auditadas de Tilt Down, Parking Camera e dois raws
binary nas quatro normalizações históricas explícitas acima. `TBD`, `TBC`, valores qualificados e
malformed continuam sem promoção e não bloqueiam os demais valores.

Os 282 falsos positivos numeric anteriores foram eliminados apenas pelas regras confirmadas para
`EX_0004` e unidade `inch`. Nenhum pending/malformed é reduzido por inferência adicional. O artifact
mantém a lista completa agregada por `spec code + raw value + category`.

## Plano de apply futuro — não executado

1. Aprovar formalmente o artifact final, as seis divergências estruturais já mantidas sob autoridade
   do App e a política de omissão dos 13 valores pending/malformed.
2. Confirmar o project ref do Staging e capturar checkpoint exportável de `specs`, `products` e
   `product_specs`, incluindo IDs, sequences e contagens, antes da primeira escrita.
3. Ensaiar uma transação/RPC administrativa única e auditada; não fazer apply por múltiplos requests
   REST sem atomicidade.
4. Reconciliar `specs` primeiro: preservar os 320 registros autoritativos do App, aplicar somente o
   plano aprovado `PW_0045=REEV`/`PW_1045=AT`, manter metadata e validar 321 códigos únicos. Confirmar
   novamente zero usos do antigo `PW_0045` antes da realocação.
5. Reconsultar Products por identidade completa e criar exatamente os 267 ainda ausentes. Reusar os
   nove matches exatos e abortar em qualquer ambiguous, invalid ou mudança de contagem.
6. Resolver os IDs finais de specs/products e inserir/upsert somente as 37.949 associações parseadas,
   com unicidade `(product_id,equipment_id)`. Binary false é explícito; scale contém no máximo um
   membro por identidade estrutural.
7. Omitir os 13 valores pending/malformed de `product_specs`, mantendo-os no artifact/checkpoint de
   revisão. Eles não viram zero, false, baseline ou associação vazia e não bloqueiam os demais.
8. Validar pós-carga: contagens, 276 identidades, 293 códigos cobertos, zero órfãos/unknown,
   unicidade, tipos/unidades, exclusividade das scales, amostras das quatro normalizações históricas e
   ausência dos 13 valores omitidos.
9. Fazer `COMMIT` somente se todas as invariantes passarem dentro da mesma operação. Em falha, usar
   `ROLLBACK`; se houver mecanismo externo não transacional aprovado, restaurar os três snapshots e
   sequences e repetir a validação completa.

Não se deve relaxar RLS, criar policy temporária, usar service role no cliente, autocriar código,
fazer fuzzy matching ou ignorar conflito. O estado de RLS das tabelas relevantes e o desenho da RPC
de apply são **PENDENTES** de auditoria específica; não serão alterados nesta branch.

Critérios de abort imediato: SHA-256 inesperado, quantidade diferente de 276 linhas/299 colunas/293
specs, ano autoral inválido, unknown spec code, duplicidade de baseline, baseline junto com membro
superior, `PW_0045` histórico não remapeado para `PW_1045`, ambiente/project ref inesperado ou qualquer
tentativa de escrita durante o dry-run.

## Apply controlado no Staging — 2026-09-01

O apply foi executado exclusivamente no project `shfsjyjxmgwnlexmdkcs` em uma única chamada SQL com
`BEGIN`, advisory lock, carga em tabelas temporárias, validações bloqueantes e `COMMIT`. Antes disso, o
mesmo SQL completo passou por ensaio com `ROLLBACK`, retornando integralmente ao estado inicial.

- fonte: `Legacy/staging.csv`;
- SHA-256: `3A50FD77989C187ED465C202FB168B61E2EE846A8DAC16D1EDA4999E7F67E0B6`;
- checkpoint: `temp/vehicle-specs-checkpoints/staging-before-apply-2026-09-01T18-01-04-017Z.json`;
- SHA-256 dos dados do checkpoint: `1468E494DFC452D70FB9134882D1EFB260BCC4BCB8A652590FD8FA07396123BE`;
- antes: 190 specs, 10 products e 306 product_specs;
- depois: 321 specs, 277 products e 37.949 product_specs;
- delta: +131 specs, +267 products e +37.643 product_specs líquidos;
- sequences antes: specs 313, products 617, product_specs 30.462;
- sequences depois: specs 955, products 1.151, product_specs 106.360.

As validações transacionais passaram para contagens, tipos, 26 baselines, aliases kgfm ausentes, 276
identidades únicas, 267 Products criados, 37.949 associações, zero órfãos, zero conflito de scale e as
quatro normalizações históricas. O catálogo persistido corresponde integralmente ao candidato.

### Precisão numeric e validação pós-apply

`product_specs.value` usa `numeric(14,4)`: scale 4 é a precisão canônica persistente. Cálculos
derivados podem conservar precisão maior durante suas etapas intermediárias, mas a associação final é
arredondada — nunca truncada — com a semântica do PostgreSQL na fronteira de persistência. O artifact
golden deve refletir essa representação persistível. Quando há redução de precisão, ele também conserva
o valor calculado anterior e o marcador `numericCanonicalization: "numeric(14,4)"`; isso é audit trail,
não issue/review.

A primeira comparação pós-commit encontrou 478 pares divergentes de `PW_0035`/`PW_0036` porque o
artifact ainda continha a precisão intermediária, enquanto a coluna havia arredondado corretamente para
quatro casas. Não existia divergência de código, Product, unidade, tipo ou quantidade. A arquitetura
confirmou o banco como autoridade da precisão persistente, portanto rollback, migration e nova escrita
não eram necessários.

Após canonicalizar o dry-run e regenerar o artifact com o mesmo SHA-256 da fonte, a validação read-only
de 2026-09-01 comparou o valor canonicalizado e retornou `artifact_match = true`: zero associações
esperadas ausentes, zero persistidas inesperadas e zero diferenças numeric. Permaneceram confirmados
321 specs (59 numeric, 172 binary e 90 scale), 277 products, 37.949 product_specs, 276 identidades da
matriz, 26 baselines, zero órfãos, zero unknown e zero conflito de scale. As 478 canonicalizações são
esperadas (231 em `PW_0035` e 247 em `PW_0036`). Nenhum dos 13 valores pending/malformed foi promovido.

### Rollback disponível — não executado

O rollback deve ser uma única transação no mesmo project: bloquear a carga, validar que as contagens e
sequences ainda são as registradas acima, apagar o conjunto atual de `product_specs`, `products` e
`specs` na ordem compatível com FKs, restaurar todos os registros e IDs do checkpoint e executar
`setval` para 30.462, 617 e 313 com `is_called=true`. Antes do `COMMIT`, comparar integralmente as três
tabelas e suas contagens/hash com o checkpoint. Qualquer mudança concorrente após este registro exige
novo diagnóstico; não se deve aplicar esse rollback cegamente.

Risco de segurança preexistente: RLS permanece desabilitado em `specs`, `products` e `product_specs`.
Isso não foi alterado nesta carga, pois habilitar RLS sem policies aprovadas poderia interromper o
aplicativo e estava fora do escopo.
