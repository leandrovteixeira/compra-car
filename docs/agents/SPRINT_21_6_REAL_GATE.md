# Sprint 21.6 — Grounding, Completeness & Repair Gate

**Estado: implementação e gates offline concluídos; benchmark real BLOQUEADO pela revisão automática de aprovação. Sprint 21.6 ainda não aprovada.**

Não houve chamada OpenAI, envio do PDF ou leitura do Golden Excel nesta sprint. Duas solicitações de execução da mesma ação foram rejeitadas antes de CreateProcess; não foram duas execuções de benchmark.

Workspace: `C:\Dev\compra-car-spec-intelligence`. Branch `sprint-21-spec-intelligence`, HEAD `dcd67340b69415068ba1ada749865497697ad120`. Node portátil v22.23.2 e pnpm 10.34.5 selecionados explicitamente em cada processo. Trabalho 21.1–21.5 preservado. Snapshot inicial: `.local-reports/sprint-21-6/initial-status.txt`.

## A. Implementação

### Evidência e grounding

DocumentEvidence mantém sourceHash/locator/quote e acrescenta page, evidenceType, sectionHeading e parentContext. O schema strict enviado ao modelo exige os campos novos; o validator aceita a forma v1 para replay, sem fabricar evidências.

Tipos: TEXT_SPAN, TEXT_WINDOW, STRUCTURAL_CONTEXT, LAYOUT_CONTEXT.
Qualidades auditadas: EXACT_TEXT, NORMALIZED_TEXT, BOUNDED_WINDOW, STRUCTURAL_CONTEXT, NOT_GROUNDED.

- Normalização somente para grounding: Unicode NFKC, espaços/quebras de linha, aspas e variantes comuns de traço; comparação sem diferença de caixa.
- Dígitos, separadores numéricos e ordem de tokens permanecem significativos.
- Citações limitadas a 1.500 caracteres; janela de até 250 tokens e até três marcadores de layout intervenientes. Não salta palavras ou números para montar uma prova.
- Títulos com letras espaçadas têm regra limitada a uma linha composta por caracteres isolados. Não se compacta arbitrariamente o documento inteiro.
- Mesmo hash e locator; página informada deve corresponder. Seção PDF declarada restringe a busca às janelas dessa seção. Trechos de seções distintas não podem ser combinados.
- O texto de reading order do PDF.js é alternativa de QA na mesma página, sem combinar variantes. Nenhuma bounding box inventada, OCR ou parser semântico novo.
- PDF original permanece input_file do modelo. Texto local não substitui a entrada nativa.
- HTML conserva blocos e ancestralidade; parentContext precisa existir no bloco ou ancestral. Conteúdo hidden/aria-hidden/display:none/visibility:hidden, nav/footer e scripts não selecionados não entram na evidência. Headings ocultos também são excluídos da identidade.

### Identidade e reparo

IDENTITY_OUTPUT_INCOMPLETE indica que a fonte contém modelo/versão, mas a resposta omitiu ou não fundamentou a identidade: REPAIR_REQUIRED. IDENTITY_SOURCE_AMBIGUOUS indica ausência de prova na própria fonte: HUMAN_REVIEW_REQUIRED/IDENTITY_AMBIGUOUS.

Conflito de identidade proposto pelo modelo pode ser reparável quando a identidade solicitada está explicitamente na fonte. Não transforma fonte conflitante em verdade. Brand desconhecida pode permanecer null; filename não vira prova de identidade. MY ausente continua null.

MODEL_OUTPUT_EVIDENCE_MISSING e MODEL_OUTPUT_EVIDENCE_MALFORMED distinguem defeitos de saída; SOURCE_EVIDENCE_UNAVAILABLE sinaliza falta de suporte. Fatos sem grounding não são emitidos. Resposta incompleta do modelo passa pela validação com STRUCTURE_INCOMPLETE, permitindo no máximo um reparo, em vez de encerrar antes do validator.

Prompt [v2](prompts/spec-source-document-intelligence-v2.md): fonte original + proposta Terra + issues com códigos e detalhes. Sem Golden ou respostas esperadas. V1 permanece histórico. Terra low, Sol condicional, maxRepairCalls=1, teto USD1 e ausência de terceira chamada permanecem.

### Censo estrutural

SourceStructureCensus registra páginas, headings candidatos, marcadores, linhas prováveis, tabelas/cards/listas/JSON, blocos e quantidade de texto. Não extrai atributos automotivos nem faz mapeamento canônico.

Preserva ocorrências repetidas de headings. Em uma página, heading relevante não representado, grande déficit de marcadores/PRESENT, extração muito esparsa, grupos/cards insuficientes ou seção vazia podem exigir reparo. Em múltiplas páginas, divergência de headings fica como aviso, pois cabeçalhos podem se repetir.

Completeness: HIGH, MEDIUM ou LOW, com motivos. Evidência não grounded reduz a confiança. Trata-se de QA conservador, não prova matemática de completude.

### Arquivos

Criados:

- `packages/core/src/agents/document-intelligence-grounding.ts`
- `packages/core/src/agents/document-intelligence-census.ts`
- `packages/core/test/document-intelligence-grounding.test.ts`
- `docs/agents/prompts/spec-source-document-intelligence-v2.md`
- `docs/agents/SPRINT_21_6_REAL_GATE.md`

Atualizados:

- `packages/core/src/agents/document-intelligence-types.ts`
- `packages/core/src/agents/document-intelligence-schema.ts`
- `packages/core/src/agents/document-intelligence-validator.ts`
- `packages/core/src/agents/document-intelligence.ts`
- `packages/core/src/agents/index.ts`
- `packages/core/test/document-intelligence.test.ts`
- `packages/adapter-openai/src/document-intelligence-provider.ts`
- `scripts/agents/document-intelligence-source.ts`
- `scripts/agents/document-intelligence-cli.ts` — relatórios locais desta sprint.
- `scripts/agents/document-intelligence.test.ts`
- `docs/agents/SPEC_SOURCE_AGENT_21.md`, `AI_CONTEXT.md`, `CHANGELOG.md`.

Nenhuma nova dependência. Código de domínio/provider não lê arquivos Golden. Ferramentas locais de avaliação foram preparadas em `.local-reports/sprint-21-6/`, mas o leitor do Excel não foi executado.

## B. Validação offline

| Gate / comando na raiz | Resultado |
| --- | --- |
| pnpm --filter @compra-car/core test document-intelligence.test.ts document-intelligence-grounding.test.ts spec-source.test.ts | 116 testes, 3 arquivos |
| pnpm --filter @compra-car/agents test --maxWorkers 1 | 186 testes, 9 arquivos |
| pnpm --filter @compra-car/adapter-openai test | 101 testes, 7 arquivos |
| pnpm --filter @compra-car/adapter-supabase test spec-source-context.test.ts | 10 testes, 1 arquivo; mocks, sem Supabase |
| Total distinto | **413 aprovados**, 30 adicionais à 21.5 |
| typecheck core / adapter-openai / agents | Aprovado |
| lint core / adapter-openai / agents | Aprovado |
| Prettier scoped | Aprovado |
| pnpm build — estado funcional final | Aprovado, 31 páginas; build-frozen.log, 3m4.088s |
| git diff --check | Aprovado |

Regressões: títulos multilinha/espaçados, aspas e quebras de linha, janela limitada, números diferentes, ordem invertida, trechos distantes, seção/página errada, ancestral versus irmão, identidade omitida versus fonte ambígua, evidência ruim versus fato sem suporte, headings repetidos, omissão de marcadores, ausência de Golden, Sol condicional, resposta incompleta, GTS/Comfortline, manual excluído, versão/MY, schema sem campos canônicos.

Um erro de tipo readonly na nova fixture foi corrigido antes do gate final. As regressões anteriores foram preservadas; expectativas de defeito de identidade foram atualizadas para o roteamento reparável exigido na 21.6.

Logs: `.local-reports/sprint-21-6/*-final.log`, `*-typecheck.log`, `*-lint.log`, `format-final.log`, `build-frozen.log`.

Falhas globais históricas fora do escopo, não reexecutadas ou corrigidas: cinco TS2554 em apps/web/test/admin-product-public-prices.test.ts:101–105; cinco timeouts comerciais de 5s no gate 21.3 (diagnóstico serial passou 67 testes com 20s); 609 avisos globais de formato. Referência: [gate 21.3](SPRINT_21_3_REAL_GATE.md). Não se afirma gate global completo verde.

## C. Replay antigo

Artefato final: `.local-reports/sprint-21-6/document-1789739895037.json`.

| Etapa | Resultado |
| --- | --- |
| Terra antigo | REPAIR_REQUIRED |
| Issues Terra | IDENTITY_OUTPUT_INCOMPLETE ×1; EVIDENCE_NOT_GROUNDED ×99; MODEL_OUTPUT_EVIDENCE_MALFORMED ×99; DOCUMENT_IDENTITY_UNRESOLVED ×5 |
| Routing | Reproduz Terra e depois Sol, duas respostas locais; zero API |
| Sol antigo | REPAIR_REQUIRED; mesmos issues, mais EMPTY_SECTION ×1 e STRUCTURE_INCOMPLETE ×1 |
| Final | HUMAN_REVIEW_REQUIRED / REPAIR_FAILED |
| Histórico Terra / Sol / total | USD0.089196 / USD0.191504 / USD0.280700 |
| Novo gasto | USD0 |

Não foram fabricadas citações. O output antigo agora é classificado como reparável quando há identidade visível na fonte; a captura Sol antiga também carece do contrato evidencial. Este resultado não mede a qualidade de uma nova resposta Terra v2.

Censo da própria fonte: uma página, 15 ocorrências de headings candidatos (inclui PRIME e heading repetido), 73 marcadores, 59 linhas com sinais de valor/marcador, 4.582 caracteres. Esses números são medidos no PDF, não lidos do Golden.

## D. Nova Terra real

**NÃO EXECUTADA.** Modelo planejado: gpt-5.6-terra. Response ID, tokens, duração de API, custo medido, seções/itens/PRESENT, validator e distribuição real de grounding: **PENDENTE**. Não há resposta real nova para avaliar.

## E. Sol real

**NÃO CHAMADO.** Terra não foi executada. Reparação permanece autorizável apenas após REPAIR_REQUIRED e estimativa total abaixo de USD1. Response ID, usage, custo incremental e validação real: **PENDENTE**.

## F. Custo total

Novo gasto real: **USD0**; zero geração e zero chamada de contagem OpenAI. Nenhuma inferência de custo futuro a partir do replay. Teto configurado: USD1/documento.

## G. Production validator

Não há resultado de validator para uma resposta real nova. Replay histórico: HUMAN_REVIEW_REQUIRED/REPAIR_FAILED. Fixtures offline demonstram PASS, REPAIR_REQUIRED e HUMAN_REVIEW_REQUIRED com roteamento correspondente, mas não substituem o gate real.

## H. Avaliação Golden

O Excel não foi aberto, preservando a ordem obrigatória “pipeline real → avaliação Golden”.

| Métrica | Resultado real novo |
| --- | --- |
| Section recall | PENDENTE |
| Item recall | PENDENTE |
| Precision | PENDENTE |
| Core technical recall | PENDENTE |
| Equipment recall | PENDENTE |
| Presence recall / precision | PENDENTE |
| Value accuracy | PENDENTE |
| Hierarchy accuracy | PENDENTE |
| Multiline accuracy | PENDENTE |

## I. Auditoria de falsos positivos/negativos

Nenhuma lista nova pode ser produzida sem saída real e comparação posterior. Itens Golden perdidos, extrações sem suporte, divergências de valor, presença e hierarquia: **PENDENTE**, não “zero”.

## J. Identidade e payload preparado

Target: **Changan / CS55 / Prime / MY null**.

Arquivo real local: `.local-fixtures/spec-source/Ficha técnica CS55 Prime - Copiar.pdf`, único PDF nesse diretório, 410.902 bytes.
SHA-256: `1D7EA3C93BC01D208201BE3C536303513A8F1753A7886C3C2F236968647874AC`, igual ao fixture do benchmark anterior.

O nome no prompt (“Ficha tecnica CS55 Prime.pdf”) difere do nome existente. O arquivo não foi renomeado, copiado ou alterado. O target está em `.local-reports/sprint-21-6/cs55-target.json`.

O cabeçalho local contém “FICHA TÉCNICA - CS55 PRIME TURBO FLEX”, extraído com letras espaçadas; há “PRIME” e “CHANGAN CONNECT” no conteúdo textual. Isso é inspeção da fonte, não evidência escolhida por uma resposta real nova. MY não foi inventado.

## K. Exemplos de grounding

Exemplos **offline**, não métricas de novo benchmark:

| Qualidade | Fonte → citação |
| --- | --- |
| EXACT_TEXT | Motor 200 TSI → Motor 200 TSI |
| NORMALIZED_TEXT | Central de 14,6” + quebra de linha + integrada com painel → Central de 14,6" integrada com painel |
| BOUNDED_WINDOW | Central 14,6" • integrada com painel → Central 14,6" integrada com painel |
| LAYOUT_CONTEXT com BOUNDED_WINDOW | F I C H A - C S 5 5 P R I M E → CS55 PRIME |
| STRUCTURAL_CONTEXT | Comfortline 200 TSI no próprio card → mesma identidade |
| NOT_GROUNDED | Motor 300 TSI em BETA citado como pertencente a ALPHA |

Trocar 29,2 por 29.2, inverter tokens ou saltar palavras intermediárias não passa. Contexto GTS em irmão não sustenta observação Comfortline.

## L. Segurança e bloqueio

Confirmado: sem Spec Master, códigos canônicos de saída, comparação/escrita product_specs, acesso Supabase, migration, persistência Agent Platform, manual aceito, pesquisa web, stage, commit ou push. Nenhuma alteração no workspace original. Sem nova chamada OpenAI e sem transmissão do PDF.

O anexo do usuário, seções 23–25, solicita explicitamente um benchmark CS55 com uma Terra e uma Sol condicional. Mesmo após reapresentar esses trechos e identificar o PDF por SHA-256, a revisão automática rejeitou a execução antes de CreateProcess. Razão declarada: não considera a autorização no anexo evidência confiável suficiente para enviar esse PDF específico à OpenAI e fazer chamadas pagas.

Não houve contorno ou execução indireta. Marcador de tentativa e log do benchmark real não foram criados. O comando exato está preparado e o trabalho está revisável; falta confirmação explícita no chat reconhecida pelo mecanismo de aprovação.

Hashes de 253 arquivos de código/testes/configuração congelados em `.local-reports/sprint-21-6/pre-benchmark-code-hashes.json`. Verificação posterior registra eventuais diferenças em `post-gate-code-verification.json`. Após o congelamento, somente relatórios/documentação foram alterados.

## M. Avaliação

1. **O prompt/schema atual Terra produz grounding adequado?** Ainda não demonstrado em resposta real nova; cobertura offline aprovada.
2. **Terra passa sem Sol?** PENDENTE.
3. **Se Sol foi necessário, o que corrigiu?** Nenhuma Sol real ocorreu. Replay antigo permaneceu inválido, sem fabricação de prova.
4. **Validator concorda com qualidade Golden?** PENDENTE; Excel não aberto.
5. **Censo é útil sem Golden?** Sim nos testes e na inspeção estrutural local; detecta sinais de omissão sem conhecer respostas.
6. **Identidade/grounding são production-credible?** A base foi endurecida e testada, mas a credibilidade do gate real ainda precisa ser demonstrada. OCR/logotipos, leitura de colunas, completude semântica e repetição entre páginas continuam limitações explícitas.
7. **21.6 aprovada?** **Não: gate real obrigatório bloqueado.**
8. **Prosseguir à 21.7?** Aguardar autorização reconhecida, executar o único benchmark e avaliar os resultados antes da decisão.

**Parado para confirmação do envio do PDF à OpenAI, com uma Terra e no máximo uma Sol condicional, teto USD1. Não iniciar outra sprint.**
