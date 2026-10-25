# Cross-brand benchmark — reconciliação MMV

## Unidade de avaliação na Sprint 19A.4

O benchmark agora distingue **MMV identity** de **Product/PY-MY occurrence**.
O denominador de reconciliação é o número de identidades conhecidas, nunca
o número de linhas físicas. Quatro anos da mesma versão são uma MMV.

O nome histórico New Product Check Agent permanece no CLI; a responsabilidade
atual é MMV Discovery. Blueprint: [AGENT_PLATFORM_ARCHITECTURE.md](AGENT_PLATFORM_ARCHITECTURE.md).

## Gabarito e métricas

O helper puro `benchmarkProductFixture` recebe resultado e expectativas
declaradas em fixture: candidato oficial + mmvIdentityId esperado. A chave
canônica é derivada do brand/model/version esperado, sem executar o matcher
para descobrir a resposta certa. Repetições do mesmo MMV no gabarito não
aumentam o denominador.

| Métrica | Definição |
| --- | --- |
| canonicalProductRows | Total de ocorrências canônicas disponíveis no catálogo da execução |
| knownMmvIdentities | MMVs únicas no gabarito, conferidas contra a projeção do resultado |
| officialCandidates | Quantidade pesquisada, antes de deduplicação |
| matchedMmvCandidates | Candidatos oficiais reconciliados, não rows |
| reconciledKnownMmvIdentities | MMVs esperadas com candidato e correspondência única ao id correto |
| falseNewMmv | MMVs conhecidas incorretamente classificadas NEW_VERSION ou cujo modelo conhecido recebeu NEW_MODEL |
| newModels / newVersions / ambiguous | Contagens após agregação/classificação |
| rejected / rejectedExternalSources | Rejeições de candidatos e de evidências |
| knownReconciliationRate | reconciledKnownMmvIdentities / knownMmvIdentities |
| falseNewRate | falseNewMmv / knownMmvIdentities |

Taxas são razões [0,1]; sem MMVs conhecidas, são null. Um match pode expor N
productRows e continua valendo uma identidade. POSSIBLE_YEAR_CHANGE não é
produzido nem contado como match operacional deste agente. Anos observados
não mudam a identidade.

Testes do benchmark injetam falso NEW_VERSION, falso NEW_MODEL, id MMV incorreto
e gabarito incompleto. Também exercitam a regressão com 16 rows/13 MMVs para
impedir que o denominador volte a ser row-level.

## Resultados offline executados

| Métrica | Toyota original | Jeep pequena | Jeep captura/reconstrução |
| --- | ---: | ---: | ---: |
| canonicalProductRows | 8 | 4 | 16 |
| knownMmvIdentities | 8 | 4 | 13 |
| officialCandidates | 21 | 8 | 18 |
| matchedMmvCandidates | 8 | 4 | 13 |
| reconciledKnownMmvIdentities | 8 | 4 | 13 |
| knownReconciliationRate | 100% | 100% | 100% |
| falseNewMmv / falseNewRate | 0 / 0% | 0 / 0% | 0 / 0% |
| newModels | 3 | 1 | 3 |
| newVersions | 2 | 1 | 0 |
| ambiguous | 1 | 1 | 0 |
| rejected / rejectedExternalSources | 0 / 0 | 0 / 0 | 0 / 0 |

Todos os matches são LEGACY_NAMING. As fixtures originais preservam seus dados
e resultados de classificação; as métricas e o report agora usam MMV.

Comandos originais, ambos exit 0:

```powershell
pnpm agent:new-products:dry-run -- --brand Toyota --provider fixture
pnpm agent:new-products:dry-run -- --brand Jeep --provider fixture
```

Runs:

- Toyota: `e2d77654-1e76-4f9b-a298-e99fadbbfaae`.
- Jeep pequena: `ead21b24-a542-4cf6-acc3-f9930ca86da3`.
- Jeep capturada, replay exclusivamente offline:
  `55872347-3ff3-4b31-b883-8acdd4bafed1`.

Relatórios: `.local-reports/agents/new-product-check/<run-id>.{json,md}`.
Métricas do replay:
`validation/19a4/captured-benchmark.json` no mesmo diretório.
O CLI imprime benchmark apenas em fixture, sem impor esses gates a runs reais.

## Proveniência da regressão capturada

A run OpenAI anterior `2506bcb5-7ff7-4529-bbd2-29b51efd5778`, informada
pelo operador, tinha 18 candidatos e 51 rows conhecidas. Seu JSON salvo foi
lido **localmente**, sem nova pesquisa nem consulta ao banco.

A fixture `jeep-captured-mmv-fixture.ts` preserva os 18 candidatos capturados,
incluindo nomes, atributos, anos, confidence e evidências. Cinco variantes de
Avenger/Gladiator/Wrangler continuam em três NEW_MODEL agregados.

O report antigo reteve somente seis rows canônicas: quatro Commander Longitude
(960, 996, 1064, 1128), uma Limited MHEV (1129) e uma Overland MHEV (1130).
As outras dez rows da fixture usam ids sintéticos e versões dadas pelo operador.
Logo, a regressão contém **16 rows / 13 MMVs**, não 51 rows ou uma suposta
contagem de 22 MMVs do catálogo completo.

Os treze casos conhecidos cobrem Renegade Altitude/Longitude MHEV/Sahara MHEV/
Willys; Compass Sport/Longitude/Serie S/Blackhawk; Commander Longitude/
Limited MHEV/Overland MHEV/Overland Diesel/Blackhawk.
Exercitam 1.332→1.3, 1.995→2.0, 2.184→2.2, AT no masculino, engine labels
informativos, tração ausente e múltiplos PY/MY.

## Generalização e limites

As mudanças de identidade são genéricas: projeção normalizada, precisão decimal,
rótulos textuais informativos e delimitação literal de powertrain fornecido
pelo candidato. Não há Jeep matcher nem mapa T270/Hurricane para motor.
Registry, domains, hints, prompt e provider permaneceram intactos na 19A.4.

100% e zero falso novo são gates das fixtures, não promessa para pesquisa real.
A fixture reconstruída não inclui todas as MMVs concorrentes do catálogo
original; **PENDENTE** replay com snapshot completo ou run real manual após revisão.
Nenhuma nova chamada OpenAI foi feita para obter esse snapshot.

O smoke Toyota real previamente validado é contexto fornecido pelo operador,
não execução desta Sprint. A regressão Toyota offline permanece 8/8.
Review humano continua necessário para propostas canônicas, e não se força
zero AMBIGUOUS em casos sem identidade suficiente.

**Zero chamadas OpenAI, zero escritas canônicas, zero migrations, zero renomeações.**
Gates e arquivos: [validação](SPRINT_19A_VALIDATION.md).
