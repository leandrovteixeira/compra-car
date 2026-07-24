# Sprint 6 — Edição administrativa de veículos

## Resultado

A Sprint 6 implementa a edição do registro principal de `products` em
`/admin/products/[id]/edit`. A página exige role `admin`, carrega o produto no servidor, preenche o
formulário compartilhado e usa `notFound()` quando o registro não existe.

Após salvar, o usuário permanece na rota de edição, recebe confirmação acessível e vê os valores
normalizados retornados pela aplicação. O botão fica indisponível durante a submissão para impedir
envios duplicados.

## Campos e regras

Os únicos campos editáveis são:

- `brand`;
- `model`;
- `version`;
- `model_year`;
- `production_year`;
- `is_active`;
- `is_public`.

O modo Edit reutiliza `admin-product-form.tsx`, a leitura comum de `FormData`, a validação e a
normalização do Create. Continuam vigentes:

- textos e anos obrigatórios;
- anos maiores que 2000;
- `production_year = model_year` ou `model_year - 1`;
- Public implica Active;
- desmarcar Active remove Public;
- trim, compactação de espaços internos e primeira letra maiúscula, preservando o restante.

## Arquitetura

O fluxo mantém as fronteiras do projeto:

```text
page/action Next.js
  → orchestration server/application
  → UpdateAdministrativeVehicle
  → AdministrativeVehicleRepository
  ← LegacySupabaseAdapter
  ← products
```

`UpdateAdministrativeVehicle` é um caso de uso específico no core. A porta administrativa ganhou
somente leitura por ID, atualização e exclusão opcional do próprio ID na busca de duplicidade. O
componente React não conhece Supabase, tabela ou coluna física.

Create e Edit compartilham todo o markup do formulário. As páginas fornecem a Server Action, o modo
e, na edição, os valores iniciais. A action de edição revalida a listagem e a própria rota sem
redirect.

## Duplicidade

A identidade permanece:

```text
brand + model + version + model_year + production_year
```

A consulta normalizada recebe o ID atual e aplica sua exclusão antes de comparar candidatos. Assim,
salvar o veículo sem alterar a chave não conflita consigo mesmo. Um produto diferente com a mesma
identidade continua gerando a mensagem de conflito usada no Create. O adapter também traduz
`23505`, cobrindo concorrência para valores exatamente iguais.

Permanece o risco já conhecido de duas escritas simultâneas que diferem apenas por caixa ou espaços,
pois o índice físico é exato e não normalizado.

## `updated_at`

Antes da implementação foram revisadas as evidências versionadas em
`docs/data/SUPABASE_INSPECTION_RESULTS.md` e
`docs/data/LEGACY_BASELINE_EXTRACTION_RESULTS.md`. Ambas registram ausência de trigger próprio/de
aplicação, enquanto `products.updated_at` existe como `timestamp without time zone`.

Por isso, `LegacySupabaseAdapter.updateAdministrativeVehicle()` inclui
`updated_at = new Date().toISOString()` no payload explícito de toda edição. O PostgreSQL converte o
valor ISO para a coluna existente. Nenhuma migration ou alteração de schema foi necessária.

## Navegação e feedback

- cada linha de `/admin/products` possui a ação `Editar`;
- o modal pós-criação habilita `Editar veículo` usando o ID retornado;
- o título é `Editar veículo`;
- o botão principal é `Salvar alterações`;
- sucesso e erro são exibidos na própria tela;
- produto inexistente é encaminhado para o 404 do App Router.

## Cobertura

Os testes cobrem:

- carregamento por ID, mapeamento e produto inexistente;
- valores iniciais e reutilização do formulário;
- atualização bem-sucedida e valores normalizados;
- salvamento sem alterar a própria identidade;
- conflito com outro produto e conflito `23505`;
- regras compartilhadas de texto, anos e Public/Active;
- exclusão do próprio ID;
- payload restrito e atualização explícita de `updated_at`;
- ação Editar na lista e Editar veículo no modal.

Os testes de integração real continuam opt-in pelas variáveis exclusivas já documentadas; não houve
escrita remota durante esta Sprint.

## Fora do escopo

Não foram incluídos duplicação, equipamentos, preços, imagens, exclusão, auditoria histórica, edição
inline ou mudanças de schema.
