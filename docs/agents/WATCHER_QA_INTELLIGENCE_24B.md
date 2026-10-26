# Watcher 24B — cobertura local e plano controlado QA

## Atualização 24B.4A

Persistência atômica implementada e testada localmente após aprovação arquitetural:
[relatório 24B.4A](WATCHER_ATOMIC_INTELLIGENCE_24B4A.md). Os resultados abaixo são
históricos da fundação, não do novo protocolo. O próximo gate é o preflight 24B.4B
separadamente autorizado; nenhum acesso remoto ou processamento real foi executado.

## Situação

**PASS local das fundações determinísticas; 24B completa PENDENTE.**
Base: `8f31a447ed4ad0716a5af3bc0d5d10a4aeb53fc2`.
Arquitetura e limites: [WATCHER_INTELLIGENCE_24B.md](WATCHER_INTELLIGENCE_24B.md).

O piloto histórico 24A persiste 20 artigos, 20 feed items e 20 revisões iniciais no QA
`shfsjyjxmgwnlexmdkcs`, batch `9579c635-4397-44f2-8050-a3ce12bcdbc0`, COMMITTED.
Isso é baseline documentado; **não é resultado de inteligência 24B**. Nenhuma consulta
remota ou novo RSS foi executado nesta entrega. Os arquivos sanitizados históricos
do piloto têm amostras/resumos; não substituem as vinte revisões e o catálogo canônico.

## Relatório de execução local com fixtures

O teste de cobertura executa seis notícias artificiais: duas menções ao mesmo evento,
um artigo irrelevante, um lançamento estrangeiro, um rumor e um preço literal BR.
Os valores abaixo são afirmados pelo teste, não extrapolados dos artigos Motor1:

| Métrica                                | Fixture local           | Dataset real QA                         |
| -------------------------------------- | ----------------------- | --------------------------------------- |
| Artigos examinados                     | 6                       | PENDENTE                                |
| Revisões examinadas                    | 6                       | PENDENTE                                |
| Artigos relevantes / irrelevantes      | 5 / 1                   | PENDENTE                                |
| Sinais extraídos / atuais              | 5 / 5 (incluem ABSTAIN) | PENDENTE                                |
| Candidatos únicos                      | 4                       | PENDENTE; não assumir 20                |
| Candidatos insuficientes / descartados | 2 / 0                   | PENDENTE                                |
| Evidências por candidato               | 2, 1, 1, 1              | PENDENTE                                |
| Duplicações de candidato evitadas      | 1                       | PENDENTE                                |
| Chamadas IA / custo efetivo            | 0 / US$ 0               | Nenhuma chamada autorizada ou executada |

Casos adicionais testam descarte por review, corroboração por fontes revisadas,
histórico de alterações e replay. UNRESOLVED sem nome não vira candidato e aparece
nos sinais/abstenções. Counts de abstenção são diagnósticos/decisões, não número de
notícias distintas. Relevância é classificação por regra, não ground truth editorial.

## Cobertura automatizada

`packages/core/test/watcher-intelligence.test.ts`: 51 testes novos, sem rede.

- Artigos irrelevantes, contexto editorial BR sem confirmação de mercado, lançamentos
  estrangeiros e mistos, homônimos/aliases colidentes, versões semelhantes.
- Negação, pergunta, especulação, rumor, anúncio atribuído, fonte oficial e host forjado.
- Sete categorias, ano explícito, valores literais, preço/motor ausentes, nome desconhecido
  simples e abstenção em nome composto que poderia ser truncado.
- Trechos em título/resumo/conteúdo, offsets, evidência adulterada e ressalva no corpo.
- Duas fontes do mesmo evento, origem desconhecida, republicação, múltiplas origens
  revisadas, modelos/versões/preços/janelas distintos.
- Replay, ordenação estável, revisão nova negando a anterior, cronologia empatada,
  ID reescrito, journal incremental, preservação de histórico e inputs imutados.
- Payload inválido, hash inconsistente, fonte ausente, limites de título/conteúdo,
  total de revisões e densidade de trechos.
- Review CAS obsoleto, replay do comando, nova evidência após review, falha atômica
  da projeção em memória sem retornar estado parcial.
- IA desligada, não autorizada, sem necessidade, orçamento/campos inválidos,
  limites de chamadas/tokens/reserva/custo e ambiguidade antiga superada.

Os testes de segurança QA, adapter/RPC e lease/fencing da 24A continuam necessários.
Não há operação de produção no motor: suas dependências são internas ao Core,
e não há env loader, HTTP, provider ou writer. Os testes de transação da 24A não
demonstram atomicidade de um writer 24B inexistente; esse gate permanece bloqueado.

## Plano para examinar os vinte artigos sem nova coleta

1. Obter autorização da etapa remota somente leitura. Usar o loader seguro e o
   executor QA existentes; conferir novamente projeto e batch exatos. Não invocar
   `watcher:qa:pilot`, transporte RSS ou páginas de notícias.
2. Ler fontes, batch, estado, feed items e revisões por RPC HTTPS existente, com
   paginação completa e limites. Conferir fonte Motor1, batch COMMITTED, vínculos e
   fingerprints. Verificar lease ausente; não adquirir/reutilizar lease de ingestão
   para simular processamento remoto de inteligência.
3. Ler snapshots de identidades/aliases e `catalog_mmvs` por repositórios existentes
   de Brand Connector/MMV no mesmo QA verificado, em ponte somente leitura revisada.
   Não abrir acesso Supabase fora de adapter-supabase nem presumir registro canônico
   a partir dos títulos. Contexto inclui versões/hashes e fonte Motor1 SECONDARY.
4. Usar somente títulos/resumos já persistidos. Conteúdo não disponível permanece
   ausente; não buscar corpos de artigos. `originGroup=null` salvo proveniência
   documental revisada. Não assumir independência entre vinte artigos de um veículo.
5. Executar a projeção pura localmente sobre as revisões exportadas; registrar hashes
   de contexto/regras/entradas, resultados completos e métricas. Replay e ordem invertida
   devem preservar candidatos/evidências/fingerprints. Não enviar resultados a RPCs de
   escrita, hints ou serviços MMV/Price/Model Year. IA permanece DISABLED.
6. Gerar relatório real separado de fixtures: artigos/revisões, relevância, sinais,
   candidatos/identidades/abstenções, evidências e regras por candidato, duplicações,
   custo zero e limitações. Se contagens mudarem, documentar snapshot sem improvisar
   vinte linhas nem presumir vinte candidatos.
7. Gate posterior de persistência: revisar e autorizar desenho transacional antes de
   qualquer migration local/remota ou writer. Testar CAS/lease expirada, fencing,
   receipt duplicado, falha entre candidato/evidência e readback de resposta perdida
   em ambiente descartável. Não habilitar escrita enquanto isso estiver pendente.

## Recomendação

GO para revisão da fundação e autorização de análise QA somente leitura.
NO-GO para persistir inteligência, aplicar catálogo/preços, ativar IA ou declarar a
Sprint 24B concluída. Pendências: execução real dos vinte artigos, snapshots canônicos,
decisão de persistência/ledger, testes transacionais específicos e baseline global.
Sem migrations, reconciliação SQL, produção, Legacy, scheduler, handoff, commit,
push ou deploy nesta entrega.

## Gates finais executados

| Validação                                                         | Resultado efetivo                                                            |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Core Watcher completo, seis arquivos                              | PASS: 186 testes, incluindo os 51 novos                                      |
| Agents Watcher, sete arquivos                                     | PASS: 148 testes                                                             |
| Adapter segurança/Management/RPC/runtime, quatro arquivos         | PASS: 66 testes                                                              |
| Total Watcher sem duplicar repetições                             | PASS: 400 testes                                                             |
| `pnpm --filter @compra-car/core lint` e ESLint dos arquivos novos | PASS                                                                         |
| `pnpm typecheck` e repetição final após os ajustes                | PASS: nove tarefas                                                           |
| `pnpm build`                                                      | PASS                                                                         |
| Prettier dos nove arquivos alterados/novos                        | PASS                                                                         |
| `git diff --check`                                                | PASS                                                                         |
| `pnpm lint`                                                       | FAIL conhecido: 51 warnings Web, zero erros ESLint                           |
| `pnpm test` concorrente                                           | FAIL: seis falhas Core conhecidas + um timeout comercial; 1283 passes / 1290 |
| Core completo `--maxWorkers=1`                                    | 1284 passes / 1290; somente as seis falhas conhecidas, sem timeout           |
| `pnpm format:check` global                                        | FAIL: 779 arquivos reportados, versus 780 no baseline final 24A              |

As seis falhas Core reproduzidas: administrative-product-specs,
engineering-brand-agent-replay, mmv-body-version-classification, mmv-platform-mapper,
mmv-product-reconciliation, new-product-check-agent. O timeout concorrente foi em
commercial-document-domain-mapping, já registrado na 24A. Não foi identificada nova
regressão funcional. Gates globais continuam vermelhos; isso não equivale a suíte
global aprovada. Nenhum arquivo alheio foi formatado para alterar esse resultado.

Auditoria final: nove arquivos no working tree, sem padrões de credenciais encontrados
na varredura e sem dados reais de artigos exportados nesta etapa. HEAD permanece
`8f31a447ed4ad0716a5af3bc0d5d10a4aeb53fc2`; nenhuma alteração staged, commit ou push.
Ambos os hashes SQL aprovados permanecem exatos; manifesto, Supabase, adapter,
scripts operacionais, produção, dependências/lockfile e Legacy não foram alterados.

Arquivos desta entrega:

- `packages/core/src/agents/watcher-intelligence.ts`.
- `packages/core/src/agents/watcher-candidate-discovery.ts`.
- `packages/core/src/agents/watcher-intelligence-ai-gate.ts`.
- `packages/core/src/agents/index.ts` (exports aditivos).
- `packages/core/test/watcher-intelligence.test.ts`.
- `docs/agents/WATCHER_INTELLIGENCE_24B.md`.
- `docs/agents/WATCHER_QA_INTELLIGENCE_24B.md`.
- `AI_CONTEXT.md` e `CHANGELOG.md`.
