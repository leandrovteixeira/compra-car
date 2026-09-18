# Sprint 21 — Document Intelligence: benchmark CS55 Prime

## Resultado e decisão

**B — HYBRID_VIABLE.** A leitura nativa do PDF recuperou todos os 104 itens e seus valores/presenças por US$ 0.280700 incluindo a única reparação. O custo é inferior ao alvo US$0,30. O gate quantitativo normalizado contra o Golden passou após Sol; porém não recomendo importação integral sem revisão: existe divergência Golden/fonte no título das cores, 13 diferenças de classificação kind e campos estruturados vazios com informação preservada em outro campo. Um único documento/uma amostra por modelo não demonstra confiabilidade geral. Isso favorece automação com revisão de documentos ambíguos, não abandono em favor de digitação manual.

Benchmark somente; implementação do Spec Source Agent não alterada. Exatamente duas gerações Responses (Terra + Sol), cada uma precedida por contagem de tokens; zero terceira chamada. Nenhum modelo avaliou a própria saída.

## A. PDF

- Arquivo efetivamente disponível: Ficha técnica CS55 Prime - Copiar.pdf. É o único PDF da pasta; difere do nome indicado no prompt. Usado sem renomear/modificar.
- Tamanho: 410902 bytes.
- Páginas: 1, comprida, com tabelas e cabeçalho gráfico; contagem por PDF.js local somente depois da geração Terra.
- SHA-256: 1D7EA3C93BC01D208201BE3C536303513A8F1753A7886C3C2F236968647874AC.
- Identidade impressa conferida visualmente: CAOA Changan, CS55, PRIME TURBO FLEX. Ambas as respostas mantiveram modelYear/modelYearEvidence=null. Nenhum MY explícito identificado.
- Enviado como input_file com o PDF ORIGINAL em data:application/pdf;base64. Sem OCR, texto local, recorte, linhas pré-extraídas ou Golden no payload. Sem upload persistente Files API, portanto nenhum arquivo remoto temporário a excluir. store=false.
- Render/texto local usados apenas para auditoria posterior; nunca enviados a Terra/Sol. Ajustes de cleanup/resolução pnpm no script local de auditoria foram corrigidos; última execução exit0.

## B. Golden independente

Arquivo CS55_Prime_Golden_Extraction.xlsx, 13.752 bytes. SHA-256: 668856101D1007FDF65C1FF0CE81DD5ED418FA46DB8D03BD8142EB86BD3BED99.

Lido via ZIP/XML somente DEPOIS de Terra responder; nenhuma leitura do Golden foi incorporada ao input da primeira geração. Sol recebeu a proposta Terra e apenas contagens: zero itens ausentes, zero não suportados, uma seção ausente, quatro divergências de hierarquia, zero presença incorreta, zero multiline incompleto. Nenhum label/valor esperado do Golden foi fornecido a Sol.

Contagem conferida na aba Golden_Items: **104 itens totais; 100 técnicos/equipamentos; 73 PRESENT; 14 seções**. Segmentação: 27 técnicos (inclui garantia), 73 equipamentos, 4 opções de cor. 13 itens pertencem aos subgrupos chave/aplicativo. Oito itens têm intervalo de linhas no Golden: quatro cores e quatro linhas técnicas/equipamentos quebradas.

## C. Terra

| Campo | Valor |
|---|---|
| Modelo exato retornado | gpt-5.6-terra |
| Response ID | resp_0f24bf51bede74f2016aac202fabac87d295a336f7b61846b3 |
| Reasoning | low |
| Contagem antes da geração | 5.346 |
| Input efetivo | 5346 |
| Cached input | 0 |
| Cache write (campo adicional exposto) | 5343 |
| Output efetivo | 6542 |
| Reasoning tokens (já contidos no output) | 71 |
| Total tokens | 11888 |
| Duração geração | 49.176 s |
| Custo pelas constantes fornecidas | US$ 0.089196 |
| Resultado | Falhou sectionRecall: 13/14 |

Responses API pelo SDK instalado openai6.49.0; responses.inputTokens.count suportado. Count recebeu exatamente model/input_file/instructions/input_text/reasoning/schema/tools da geração. Structured output json_schema strict=true, additionalProperties=false, todos os campos required com null permitido quando apropriado. tools=[], maxRetries=0, timeout240s, max_output_tokens=18.000, store=false. Payloads e schema identificados por hash/configuração local; nenhum custo inferido de bytes.

## D. Sol — única reparação

Chamado porque Terra falhou o gate de seção. PDF original + JSON Terra + contagens agregadas de falhas. Mesmo schema, reasoning low, sem ferramentas, sem respostas esperadas do Golden.

| Campo | Valor |
|---|---|
| Modelo exato retornado | gpt-5.6-sol |
| Response ID | resp_08f1bec317484ef5016aac2113a54487d29b1a582b9318167d |
| Contagem antes da geração / input efetivo | 11891 |
| Cached input | 0 |
| Cache write exposto | 11888 |
| Output efetivo | 7197 |
| Reasoning tokens (incluídos no output) | 470 |
| Total tokens | 19088 |
| Duração geração | 71.925 s |
| Custo incremental | US$ 0.191504 |
| Gate quantitativo normalizado | PASS |

Pré-estimativa Sol: input Terra + output Terra + margem1024 =12.912 tokens; teto output18.000. Após count exato, teto incremental US$0,407564; cumulativo US$0,496760, inferior a US$1,00. Custo real ficou abaixo disso. Sem retry automático e sem terceira geração.

## E. Qualidade programática

### Método reproduzível

Matching um-para-um com seção/subgrupo/label; cores comparadas por texto da opção. Normalização tolera acentos, espaços, aspas tipográficas, hífen inicial de lista, dois-pontos final de cabeçalho, unidades repetidas no label e números brasileiros (29,2=29.2; 1.415=1415). Não usa fuzzy matching ou conhecimento automotivo. Subgrupo chave jamais é equivalente a aplicativo. Valores brutos originais permanecem intactos.

Para texto autônomo sem coluna valor (cores/garantia), aceita-se a frase exata em sourceLabel quando rawValue=null; na garantia exige também sourceEvidence igual ao valor Golden. Para polegadas, 19” preserva semanticamente a unidade mesmo com rawUnit=null. Essas tolerâncias medem recuperação de conteúdo, NÃO preenchimento perfeito dos campos. Nenhuma saída foi reescrita para fazê-la passar.

Avaliação literal inicial preservada em *-evaluation-literal-v1.json. Ela marcava indevidamente 14 misses Sol por dois-pontos/hífen e garantia como label. Avaliação final aplica as mesmas regras a Terra e Sol e conserva essas diferenças estruturais abaixo. Não houve nova chamada API após esse ajuste de comparação.

| Métrica | Terra | Sol |
|---|---:|---:|
| goldenTotalItems | 104 | 104 |
| extractedTotalItems | 104 | 104 |
| matchedGoldenItems | 104 | 104 |
| missedGoldenItems | 0 | 0 |
| unsupportedItems | 0 | 0 |
| recall | 100.00% | 100.00% |
| precision | 100.00% | 100.00% |
| coreTechnicalRecall | 100.00% | 100.00% |
| equipmentRecall | 100.00% | 100.00% |
| colorRecall | 100.00% | 100.00% |
| presencePrecision | 100.00% | 100.00% |
| presenceRecall | 100.00% | 100.00% |
| sectionRecall | 92.86% | 100.00% |
| valueAccuracy | 100.00% | 100.00% |
| coreValueAccuracy | 100.00% | 100.00% |
| multilineAccuracy | 100.00% | 100.00% |
| hierarchyAccuracy | 96.15% | 100.00% |
| nestedGroupAccuracy | 100.00% | 100.00% |

Denominadores: recall104; precisão104; core27; equipamentos73; cores4; presence73; seções14; valor104 itens correspondidos; multiline8; hierarquia104; subgrupos13. Nas quatro linhas técnicas/equipamentos realmente quebradas (freios, central multimídia, volante, retrovisores), acurácia4/4 em ambos. Identidade CS55/Prime correta, MY não inventado, sem outra versão.

### Todas as divergências

- Itens Golden ausentes: **nenhum** em Terra ou Sol após normalização documentada.
- Itens extraídos não suportados/inventados: **nenhum item** em ambos; ressalva de título inferido Sol abaixo.
- Valores/unidades semanticamente incorretos: **nenhum**. Presença incorreta: **nenhuma**. Linhas quebradas truncadas: **nenhuma**.
- Terra: quatro divergências de seção/hierarquia — Preto Metálico, Cinza Metálico, Hyper Blue, Branco Perolizado aparecem em ITENS DE SEGURANÇA; Golden espera CORES. Chave/aplicativo:13/13 corretos.
- Sol: essas quatro cores foram colocadas em CORES, mas ficou também uma seção ITENS DE SEGURANÇA vazia. São15 objetos de seção,14 headings distintos; o bloco vazio não conta como item.
- **Conflito fonte/Golden:** a própria página imprime ITENS DE SEGURANÇA acima das cores. CORES é organização semântica do Golden, não heading literal. Terra seguiu esse título impresso; Sol criou CORES e preservou o heading duplicado vazio. Aprovação contra o Golden não prova fidelidade literal do sourceHeading. Não ocultar isso como mero erro de leitura Terra ou como correção perfeita Sol.
- Campos vazios em ambos: rodas de liga leve rawUnit=null, embora19” preserve polegadas em rawValue; cores rawValue=null, embora o nome completo esteja em sourceLabel/evidence. Em Sol, garantia também tem rawValue=null, com a frase integral em sourceLabel/evidence. Isso requer normalização/revisão antes de importação.
- Classificação kind:13 divergências idênticas em ambos, sem perda do conteúdo. Acurácia exata de kind91/104=87,50%, métrica adicional não integrante dos thresholds numéricos fornecidos.

| ID Golden | Label | Golden kind | Terra/Sol kind |
|---|---|---|---|
| 10 | Injeção eletrônica | TEXT | VALUE |
| 11 | Tipo de ignição | TEXT | VALUE |
| 12 | Combustível | TEXT | VALUE |
| 13 | Tipo | TEXT | VALUE |
| 14 | Tração | TEXT | VALUE |
| 23 | Direção | TEXT | VALUE |
| 24 | Dianteira | TEXT | VALUE |
| 25 | Traseira | TEXT | VALUE |
| 26 | Tipo | TEXT | VALUE |
| 27 | Dianteiro | TEXT | VALUE |
| 28 | Traseiro | TEXT | VALUE |
| 30 | Pneus | COMPOSITE | VALUE |
| 31 | Garantia | COMPOSITE | TEXT |

Conclusão do gate: Terra FAIL (sectionRecall92,86%); Sol PASS nos thresholds de recuperação normalizada, com 100% em todos os seis thresholds e nenhuma alucinação de valor/MY/versão. Persistem ressalvas de fidelidade de heading e preenchimento/classificação de campos: aprovação não autoriza importação cega.

## F. Custo e projeção

Constantes fornecidas, isoladas em pricing.json e no script: Terra inputUS$2/M/outputUS$12/M; Sol inputUS$4/M/outputUS$20/M. Custo=input_tokens×tarifa_input/1M + output_tokens×tarifa_output/1M. Reasoning já está incluído em output, não somado novamente. cached_tokens=0. Cache-write é subconjunto do input e não foi cobrado novamente; nenhuma tarifa de cache adicional foi fornecida. São custos calculados do usage real pelas constantes do benchmark, não uma conciliação de fatura.

Terra US$0,089196; Sol incremental US$0,191504; **total US$0,280700**. Abaixo de TARGET0,30, ACCEPTABLE0,50 e HARD STOP1,00. Count não retornou usage faturável; nenhuma ferramenta, Files API, OCR ou outro serviço pago foi usado.

| Fichas/mês | Terra somente | +Sol10% | +Sol25% | +Sol50% | +Sol100% |
|---:|---:|---:|---:|---:|---:|
| 10 | 0.891960 | 1.083464 | 1.370720 | 1.849480 | 2.807000 |
| 25 | 2.229900 | 2.708660 | 3.426800 | 4.623700 | 7.017500 |
| 50 | 4.459800 | 5.417320 | 6.853600 | 9.247400 | 14.035000 |
| 100 | 8.919600 | 10.834640 | 13.707200 | 18.494800 | 28.070000 |

Valores USD, sem trabalho humano. Terra-only tem o defeito de seção descrito; a tabela não presume aprovação automática. Projeção assume documentos com mesmo perfil de tokens e preços constantes; um único PDF não estima variância futura.

## G. Decisão de fontes

**OWNER MANUAL = EXCLUDED.** Manuais do proprietário e literatura genérica ficam fora do Spec Source daqui em diante.

Elegíveis: TECHNICAL_SHEET/SPECIFICATION_SHEET oficial; dados técnicos em página oficial do modelo; configurador/matriz oficial; dados estruturados oficiais (JSON/tabelas); dados técnicos não estruturados em página oficial. Brochura de marketing só é elegível quando contém especificação técnica explícita; ser PDF não basta.

Excluídos: OWNER_MANUAL, literatura genérica do proprietário, dealer, imprensa/media, Webmotors, fóruns/agregadores. Esta decisão documental substitui a preferência anterior por manuais; **o código existente não foi alterado neste benchmark**. Implementar essa política no agente é trabalho futuro, fora da autorização atual.

## H. Recomendação

B — HYBRID_VIABLE. O custo mensurado e a recuperação104/104 sustentam extração automática assistida: mesmo com reparação em100% dos10 documentos/mês, projeçãoUS$2,807. Não há justificativa de custo de API para preferir digitação integral. Entretanto, schema válido não garantiu classificação/posição perfeita, e a divergência Golden/PDF demonstra necessidade de revisão de casos ambíguos. Não afirmar FULL_AUTOMATION_VIABLE para catálogo sem validação em outros documentos e sem contrato explícito para títulos literais versus seções inferidas. Nenhuma mudança arquitetural funcional foi feita.

## I. Segurança, artefatos e validação

Sem Spec Master/códigos canônicos; sem acesso ou escrita Supabase; sem migration; sem Agent Platform; sem tocar specs/product_specs/products; sem alteração de código de produção; sem web search; sem manual do proprietário; sem stage/commit/push. Nenhuma mudança no Node24 global, instalação ou PATH permanente. Node22.23.2/pnpm10.34.5 selecionados por processo. Branch sprint-21-spec-intelligence.

Todos os JSONs, respostas originais, usage, hashes, scripts de execução/avaliação, schema e auditoria PDF ficaram apenas no diretório ignorado .local-reports/benchmarks/cs55-prime/. Nenhum segredo está no relatório. Golden/PDF locais não foram adicionados ao Git; .local-fixtures já aparecia untracked antes do benchmark e foi preservado.

Validações: ambos os JSONs passam AJV contra schema estrito; cinco testes do avaliador passaram (omissão, valor divergente, subgrupo errado, MY inventado, decimal equivalente). Scripts com maxRetries0 e marcadores de tentativa impedem repetição de geração. Hashes de todos os arquivos Spec Source tocáveis foram comparados antes/depois; implementação preservada. Format do relatório e git diff --check executados no fechamento. Sem lint/typecheck/build globais novos: nenhuma mudança de domínio/infra/aplicação, apenas scripts locais isolados e documentação; os gates prévios21.4 não são apresentados como testes deste benchmark.

Arquivos documentais deste benchmark: este relatório, AI_CONTEXT.md e CHANGELOG.md. Demais alterações de Sprints21.1–21.4 no working tree foram preservadas. Resultados locais imutáveis permitem reavaliar sem novas gerações.

**Benchmark encerrado. Sem terceira chamada.**
