# Cross-brand benchmark — New Product Check Agent

## Objetivo e escopo

Sprint 19A.3: verificar generalização Toyota/Jeep no Brasil com fixtures offline.
A classificação, o matcher, o parser de versões, a normalização de componentes,
a agregação, o catalog reader e o report writer são os mesmos da 19A.2, sem diff.

As diferenças por marca ficam no source registry, search hints e fixtures.
Não há JeepMatcher, branching Jeep na identidade, aliases novos ou conhecimento
hardcoded T270 → 1.3 / Hurricane → 2.0.

Toyota é um **smoke real previamente validado, segundo o operador**:
10 modelos, 30 variantes resolvidas, 32 candidatos, 8 conhecidos e reconciliados
em LEGACY_NAMING, 8 NEW_MODEL, 2 NEW_VERSION, zero ambiguidades/rejeições.
Esses números são contexto fornecido, não execução desta Sprint.

Jeep é **candidata à validação real cross-brand**. Nesta entrega, somente
fixture. A run real Jeep permanece PENDENTE de autorização posterior à revisão.

## Diferenças exercitadas

| Dimensão | Toyota fixture | Jeep fixture |
| --- | --- | --- |
| Powertrain oficial | Componentes e variantes ICE/HEV | T270, T270 MHEV, Hurricane, Hurricane Flex |
| Rótulo oficial / legado | XRE / XRE 2.0 CVT | Longitude T270 / Longitude 1.3 TGDI AT |
| Transmissão | Direct Shift (CVT), Multidrive, Hybrid Transaxle | Automática de 6 velocidades / AT |
| Propulsão | ICE versus HEV | ICE versus MHEV |
| Modelo ausente | Corolla, SW4, RAV4 agregados | Commander agregado com duas variantes |
| Nova variante | GRS, GRS Dualtone com warnings | Blackhawk Hurricane Flex, sem inferir cilindrada |
| Ambiguidade proposital | Corolla Cross sem variante | Compass sem variante |
| Fontes | Hosts Toyota explícitos | jeep.com.br e subdomínios DNS permitidos |

Ausência do nome comercial no legado não é conflito. Cilindrada explícita,
propulsão e transmissão podem resolver a identidade. Cilindrada ausente continua
null; T270 não desempata duas opções de motor. MHEV elimina ICE. O teste também
executa os mesmos dados sob uma marca sintética diretamente no matcher, sem
adicionar essa marca ao registry.

## Fonte de verdade e métricas

`productCheckFixture(scope)` seleciona candidatos, catálogo e
`knownExpectations`. As primeiras observações de cada fixture são pareadas com
os produtos conhecidos, em ordem declarada nos dados sintéticos; essas
associações não são produzidas pelo matcher.

`benchmarkProductFixture(result, expectations)` é um helper puro reutilizável:

- `knownProducts`: número de ids únicos no gabarito, validado contra o catálogo
  informado no resultado. Gabarito incompleto ou marca divergente é rejeitado.
- `reconciledKnownProducts`: ids únicos com candidato esperado e correspondência
  única ao id esperado. POSSIBLE_YEAR_CHANGE com matchMode também conta como
  identidade reconciliada, preservando a revisão de ano.
- `falseNewProducts`: ids conhecidos cujo candidato foi classificado NEW_VERSION
  ou cujo modelo conhecido recebeu NEW_MODEL. Produtos novos legítimos não
  entram nessa métrica. Conta ids únicos, não número de findings.
- `knownReconciliationRate = reconciledKnownProducts / knownProducts`.
- `falseNewRate = falseNewProducts / knownProducts`.
- `newModels`, `newVersions`, `ambiguous`, `rejected` e
  `rejectedExternalSources`: contagens do resultado, após agregação.

Taxas são razões entre 0 e 1; com zero conhecidos, ambas são null, sem declarar
100% por falta de amostra. Os testes injetam NEW_VERSION falso, NEW_MODEL falso,
id reconciliado errado e year change para verificar o próprio benchmark.

## Resultados executados

| Métrica | Toyota | Jeep |
| --- | ---: | ---: |
| knownProducts | 8 | 4 |
| reconciledKnownProducts | 8 | 4 |
| knownReconciliationRate | 100% | 100% |
| falseNewProducts | 0 | 0 |
| falseNewRate | 0% | 0% |
| newModels | 3 | 1 |
| newVersions | 2 | 1 |
| ambiguous | 1 | 1 |
| rejected | 0 | 0 |
| rejectedExternalSources | 0 | 0 |
| Models discovered | 5 | 3 |
| Variants resolved | 20 | 7 |
| Candidates researched | 21 | 8 |
| EXACT_OFFICIAL / LEGACY_NAMING | 0 / 8 | 0 / 4 |

Comandos executados, ambos exit 0:

```powershell
pnpm agent:new-products:dry-run -- --brand Toyota --provider fixture
pnpm agent:new-products:dry-run -- --brand Jeep --provider fixture
```

Runs finais:

- Toyota: `256a4faf-8569-4f44-a072-9543e23a4da5`.
- Jeep: `3d53b88b-d410-450c-bcf9-3ade7f361c5d`.

Cada run gerou JSON/Markdown em
`.local-reports/agents/new-product-check/<run-id>.{json,md}`.
O CLI imprime `Fixture benchmark: {...}` somente para provider fixture.
O report writer e o schemaVersion 19A.2 foram preservados; nenhum novo formato
de relatório por marca nem persistência em banco.

## Gate e limites da conclusão

Os testes exigem 100% de reconciliação e zero falsos novos para as duas fixtures.
Isso não se aplica automaticamente a pesquisas reais: cobertura incompleta,
identidades ambíguas ou dados contraditórios podem exigir revisão.

A fixture pequena prova reutilização nos casos exercitados; não prova cobertura
da linha Jeep atual, fidelidade da extração remota ou ausência universal de
falsos matches. Não foram feitas consultas de catálogo real nem pesquisas web.
Jeep pode ter ambiguidades legítimas; reduzi-las artificialmente não é objetivo.

O registry aceita somente jeep.com.br e subdomínios com fronteira DNS correta,
via opt-in `allowedSubdomainRoots`. Não é verificação independente de publicação,
redirecionamentos ou controle de cada página. Domínios externos Stellantis
permanecem fora da allowlist. Nenhuma fonte externa essencial foi investigada;
se aparecer na run futura, será candidata à revisão, sem inclusão automática.

Uma terceira marca deve exigir entrada no registry e fixture/gabarito, sem
tocar no matcher, finding model, report writer ou catalog reader. A exceção
encontrada nesta Sprint foi o prompt anterior fixando sites Toyota e o registry
anterior limitado a hosts exatos. Ambos agora recebem política declarativa.
Nenhuma terceira marca foi adicionada.

**Zero chamadas OpenAI nesta Sprint, zero escritas canônicas, zero renomeações.**
Sem UI, migrations, aliases table, scheduler, worker ou commit.
Gates e arquivos: [validação da Sprint](SPRINT_19A_VALIDATION.md).
