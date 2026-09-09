# Sprint 15C.3 — Operator Product Matching

Status: COMPLETE (2026-09-09). O QA final de 41/41 associações cabe ao usuário.

## Audit e estratégia

A 15C.2 permanece como etapa exata e read-only. A tabela existente de resolução passa a
reutilizar `AdminProductCombobox`, já utilizado no Admin, e as primitives de botão existentes.
A busca textual do seletor apenas filtra opções por termos; não classifica similaridade nem
seleciona automaticamente. Nenhuma dependência adicionada.

O formulário mantém o workbook/preview em estado React. As decisões tipadas ficam no componente
de resolução enquanto esse preview está montado. Remover, substituir ou revalidar o arquivo
descarta o preview e as decisões; abrir outra linha, buscar, fechar ou avançar preserva as escolhas.
O upload continua limitado a 25 MiB e a server action a 64 MiB.

## Comportamento

- `MATCHED` continua automático e sem ação de associação.
- `NOT_FOUND` e `NEEDS_OPERATOR_DECISION` apresentam candidatos por marca, modelo, PY e MY,
  com a normalização administrativa existente; versão não participa desse filtro.
- `AMBIGUOUS` apresenta os candidatos originais da 15C.2.
- Sem anos completos, a lista inicial é vazia. O operador abre explicitamente o catálogo completo.
- O fallback reutiliza paginação do adapter: SELECT, páginas de 500, limite de 10.000,
  timeout de 15 segundos por requisição e verificação de completude; sem filtrar privado/inativo.
  É carregado sob demanda, com cache somente no preview, mensagem segura e opção de tentar novamente.
- A server action exige `requireRole('admin')` antes da leitura; não recebe decisões para persistir.
- Escolher um ID da lista confirma `OPERATOR_MATCHED`, com `previousResolutionStatus`,
  `productExternalKey`, source intacto, `resolvedProductId`, identidade resolvida,
  `resolutionMethod = OPERATOR` e `reasonCode = PRODUCT_MATCHED_BY_OPERATOR`.
- Fonte e catálogo permanecem lado a lado. Pack Tech, variantes comerciais, MVS e anos documentais
  não são substituídos. Dois Products documentais podem apontar para o mesmo ID.
- Resolver/Trocar associação, Desfazer e Próximo pendente operam na tabela, com foco no seletor.
  Contagens são imediatas: MATCHED, OPERATOR_MATCHED, demais estados e PENDING.
- PENDING zero produz `PRODUCTS_RESOLVED` e a mensagem de validação final. O preview documental
  mantém Estrutura, Commercial Issues, Policies e Offers. Não há READY_TO_APPLY ou botão Apply.

Não há fuzzy/AI matching, ranking, alias persistente, edição do XLSX/Product, migration, RPC,
alteração de RLS, escrita comercial ou novo eligibility. Nenhuma alteração em Legacy, Handbook ou Prompt.

## Acceptance Jeep local

Fonte externa: `C:\Temp\Jeep_Julho_2026_CommercialImportContract_v1.1_AUDITED.xlsx`.
SHA-256: `675d2bdba410f194a3f019a9e023bceb9802dc4bcaac5dbb4c03f60d900dab91`.
Arquivo lido sem alteração, cópia para o repositório ou versionamento.

Parser e validator reais: 0 structural diagnostics, 41 Products, 3 Issues, 93 Policies e 65 Offers.
Resolução contra o Staging real: 0 MATCHED, 41 NOT_FOUND, 0 AMBIGUOUS, 0 NEEDS_OPERATOR_DECISION.
Leitura batch retornou 226 identidades; fallback retornou 277 identidades.

O componente real foi montado em harness local e exercitado no Edge headless com foco habilitado,
usando o catálogo recém-lido do Staging. O carregamento do fallback no harness recebeu esse snapshot;
o serviço real de leitura e o guard foram verificados separadamente. Não foi um login/fluxo E2E
da aplicação Next completa. Scripts temporários removidos; nenhum novo framework de teste.

Todas as escolhas abaixo são escolhas explícitas de teste, não aprovação comercial nem aliases.

| Source Product Jeep | PY/MY | Candidatos (IDs) | Escolha de teste | Resultado / PENDING |
| --- | --- | --- | --- | --- |
| Renegade Longitude T270 MHEV | 2026/2027 | 1124, 1125, 1126, 1127 | 1125 — Longitude 1.3 TGDI AT MHEV | OPERATOR_MATCHED / 40 |
| Renegade Sport | 2025/2026 | 954, 955, 956, 957, 958, 959 | 954 — Sport 1.3 TGDI AT | OPERATOR_MATCHED / 39 |
| Renegade Sport + Pack Tech | 2025/2026 | 954, 955, 956, 957, 958, 959 | 954 — Sport 1.3 TGDI AT | OPERATOR_MATCHED / 38 |
| Compass Blackhawk Hurricane | 2025/2026 | 979, 980, 981, 982 | 982 — Blackhawk 2.0 TGDI AT | OPERATOR_MATCHED / 37 |
| Compass Blackhawk Flex | 2025/2026 | 979, 980, 981, 982 | 982 — Blackhawk 2.0 TGDI AT | OPERATOR_MATCHED / 36 |
| Commander Overland Diesel | 2026/2027 | 1128, 1129, 1130, 1131, 1132 | 1131 — Overland 2.2 TD AT 4x4 | OPERATOR_MATCHED / 35 |
| Commander Blackhawk Hurricane | 2026/2027 | 1128, 1129, 1130, 1131, 1132 | 1132 — Blackhawk Hurricane 2.0 TGDI AT 4x4 | OPERATOR_MATCHED / 34 |

Todos os candidatos têm a mesma marca/modelo/PY/MY da linha:

- Renegade 2026/2027: 1124 Altitude 1.3 TGDI AT; 1125 Longitude 1.3 TGDI AT MHEV;
  1126 Sahara 1.3 TGDI AT MHEV; 1127 Willys 1.3 TGDI AT 4x4.
- Renegade 2025/2026: 954 Sport, 955 Altitude, 956 Longitude, 957 Sahara (1.3 TGDI AT);
  958 Trailhawk e 959 Willys (1.3 TGDI AT 4x4).
- Compass 2025/2026: 979 Sport, 980 Longitude, 981 Serie S (1.3 TGDI AT);
  982 Blackhawk 2.0 TGDI AT.
- Commander 2026/2027: 1128 Longitude 1.3 TGDI AT; 1129 Limited 1.3 TGDI AT MHEV;
  1130 Overland 1.3 TGDI AT MHEV; 1131 Overland 2.2 TD AT 4x4;
  1132 Blackhawk Hurricane 2.0 TGDI AT 4x4.

As sete linhas preservaram source visível, exibiram a escolha e atualizaram o contador.
Resultado da amostra: 0 MATCHED, 7 OPERATOR_MATCHED, 34 PENDING.
Também passaram no navegador: Próximo pendente sem perda de decisões, novo preview com 41 pendentes,
fallback para source sintético sem PY/MY escolhendo 1125, preservação de source null e anos resolvidos
2026/2027, PRODUCTS_RESOLVED ao completar esse caso e Desfazer. Zero exceções de runtime.
O harness recebeu apenas requisições GET locais; decisões não foram enviadas ao servidor.

## Testes e gates

Testes adicionados: 9 Core (transições, candidatos, identidade separada, IDs inválidos/duplicados,
contadores e isolamento de preview), 1 adapter (fallback paginado somente SELECT) e 5 Web
(Admin guard, erro seguro, controles e resumo). Testes direcionados: 24 Core, 11 adapter e 26 Web passaram.

- `pnpm lint`: passou, 7 tarefas.
- `pnpm typecheck`: passou, 7 tarefas (repetição final via cache Turbo).
- `pnpm build`: passou, build Next de produção.
- `pnpm test`: Core 626, adapter 105 e pricing 71 passaram; Web 593 passaram e 1 falhou.
  A única falha é preexistente em `sprint-14g-mobile-pwa.test.ts:130`: comparação literal LF
  com `globals.css` CRLF. Ambos os arquivos permanecem inalterados nesta sprint. 19 testes ignorados.
- `pnpm format:check`: falha em 243 arquivos preexistentes fora desta alteração. Prettier
  direcionado passou em todos os 16 arquivos da sprint; `git diff --check` passou.
- Ambiente Node 24.15.0 diverge do Node 22.x declarado e emite warning preexistente.

Não foram alterados testes/timeouts ou arquivos fora do escopo para mascarar gates globais.
Estado Git revisado: somente código, testes e documentação da sprint; sem XLSX ou scripts
temporários. Sem commit, push, migration ou escrita no Supabase. Hash externo reconferido ao final.

## Próximos passos

QA do usuário: associar 41/41 Products conforme julgamento comercial.
15C.4: Final Commercial Preview / Validation. Depois, 15D: Transactional Commercial Apply.
Nenhuma dessas próximas etapas foi implementada nesta sprint.
