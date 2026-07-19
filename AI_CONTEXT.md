# Contexto para agentes de IA

## Propósito

O Compra Car apoia vendedores de concessionárias em comparações claras entre veículos durante o atendimento e na geração futura de material compartilhável.

## Escopo do MVP

- experiência mobile-first e online;
- catálogo baseado nos dados existentes no Supabase atual;
- seleção de 2 ou 3 veículos;
- comparação por linhas normalizadas, diferenças e vantagens auditáveis;
- geração e compartilhamento futuro de PDF com aviso legal;
- identidade visual flexível por marca;
- nenhuma nova carga do Excel ou reestruturação ampla do banco como pré-requisito.

## Tecnologias vigentes

- monorepo com pnpm 10 e Turborepo 2;
- Next.js 15, App Router, React 19 e TypeScript 5;
- Tailwind CSS 4, ESLint 9 e Prettier 3;
- Vitest 4 para testes unitários do domínio;
- Railway com configuração em `railway.json`;
- PWA instalável em modo `standalone`, sem service worker ou offline;
- Supabase atual como fonte inicial de dados via adaptador somente leitura;
- Appsmith como backoffice temporário.

## Estrutura arquitetural

```text
apps/web                     apresentação futura
packages/contracts           DTOs e contratos públicos
packages/core                domínio, portas e casos de uso puros
packages/adapter-supabase    adaptador server-only e somente leitura do legado
packages/shared              utilitários genéricos
packages/ui                  primitivos visuais futuros
```

Direção de execução vigente:

```text
Next.js → contratos/casos de uso → portas do core ← Legacy Supabase Adapter ← Supabase atual
```

O frontend não pode conhecer tabelas, colunas, queries ou particularidades do Supabase legado. `LegacySupabaseAdapter` é a única fronteira autorizada e implementa as portas do core por DTOs e mappers explícitos.

## Domínio consolidado

### Vehicle

`Vehicle` é uma combinação comercial específica de `brand`, `model`, `version`, `modelYear` e `productionYear`. Também contém `id`, `displayName`, `isActive` e `isPublic`.

Um veículo integra o catálogo público somente quando:

1. `isActive = true` — vigência comercial;
2. `isPublic = true` — revisão e liberação editorial;
3. possui ao menos um item comparável.

Esses estados não podem ser confundidos.

### ComparisonItem

- `code` obrigatório e estável identifica uma linha independente;
- `binary`, `numeric` e `scale` são os tipos suportados;
- `scale` usa presença independente no MVP;
- dois codes do mesmo `specSet` continuam em duas linhas;
- não existe cardinalidade `single`/`multiple` nesta fase;
- categories e prefixes de origem não determinam a arquitetura.

### Valores

- `binary`/`scale`: `present: boolean`;
- `numeric`: `value: number | null` e `unit: string | null`;
- numeric ausente nunca vira zero;
- associação binary/scale ausente resulta em `false`;
- o domínio não formata `Sim`, `Não` ou travessão.

## Casos de uso implementados

- `ListAvailableBrands`;
- `ListAvailableModels`;
- `ListAvailableVehicles`;
- `GetVehiclesByIds`;
- `CompareVehicles`.

`CompareVehicles` aceita 2 ou 3 IDs distintos, preserva a ordem, usa `code` como identidade, agrupa por categoria, completa células tipadas e calcula `isDifferent`. Não calcula vantagem.

## Decisões registradas

- ADR-001: cada `ComparisonItem.code` representa uma linha.
- ADR-002: itens `scale` não têm cardinalidade no MVP.
- ADR-003: o frontend não acessa o banco legado diretamente.
- ADR-004: `isActive` e `isPublic` têm significados distintos.
- ADR-005: autenticação simples, sem RBAC, será implementada em fase posterior.
- ADR-006: o legado é traduzido por DTOs/mappers em um adaptador server-only e somente leitura.
- Diferença e vantagem são conceitos separados.
- Uma vantagem futura exige regra explícita, versionada e auditável.
- O MVP usa o Supabase atual sem depender de nova carga do Excel.
- O importador Excel será ajustado posteriormente à estrutura vigente.

## Restrições vigentes

- não alterar `Legacy` sem autorização e auditoria;
- manter a inspeção inicial do Supabase somente leitura;
- não implementar ou presumir schema físico sem evidência real;
- não expor chaves, tokens ou segredos;
- não acessar Supabase fora do adaptador legado;
- não colocar regras de negócio em `shared` ou na UI;
- não implementar vantagem sem regra documentada;
- não implementar autenticação, PDF ou offline nesta fase concluída.

## Estado atual — 2026-07-18

A infraestrutura do monorepo, o núcleo de domínio, o adaptador legado e os vertical slices de seleção e comparação estão implementados. `packages/core` contém entidades, value objects, erros, portas e os cinco casos de uso centrais. `packages/contracts` contém aliases, reexportações e DTOs públicos sem duplicação estrutural. `packages/adapter-supabase` implementa as duas portas sobre `products`, `specs` e `product_specs`, sem escrita. `apps/web` conecta seleção e comparação aos casos de uso por camada server-only, `unstable_cache` e composition root.

A URL de comparação é `/comparar?vehicles=id1,id2[,id3]`. A página valida IDs, preserva sua ordem, executa `CompareVehicles`, apresenta categorias e usa apenas `isDifferent` para o filtro visual. O domínio e o adapter não conhecem componentes ou parâmetros de URL.

Os testes do core usam repositórios in-memory. Os mappers do adaptador são testados sem rede e a integração real é opt-in por variáveis exclusivas. A UI de negócio e `Legacy` permanecem sem alteração nesta fase.

A superfície mínima e o mapeamento físico fornecidos para a fase estão registrados em `SUPABASE_INSPECTION_RESULTS.md` e `LEGACY_SUPABASE_MAP.md`. A validação online permanece pendente quando não houver credenciais opt-in e não bloqueia o código ou o MVP.

## Próximos passos

1. Executar o teste de integração opt-in no ambiente autorizado.
2. Validar cobertura e desempenho com 2 ou 3 veículos reais.
3. Conectar o Next.js ao adaptador apenas no runtime do servidor.
4. Implementar a UI de negócio sobre os casos de uso.
5. Concluir MVP e piloto.
8. Após o piloto, evoluir dados, importador e arquitetura gradualmente.

## Backlog pós-MVP

- cardinalidade explícita `single`/`multiple`;
- agrupamento visual opcional de itens `scale`;
- validação de combinações incompatíveis;
- evolução da taxonomia de categorias;
- substituição futura do importador Excel;
- revisão dos prefixes legados;
- regras de vantagem auditáveis;
- estados detalhados de equipamentos, qualidade e rastreabilidade.

## Pendências

- **PENDENTE:** validação online opt-in e cobertura quantitativa do Supabase atual.
- **PENDENTE:** regra exata de vantagem.
- **PENDENTE:** texto jurídico final.
- **PENDENTE:** marca e participantes do piloto.
- **PENDENTE:** identidade visual autorizada.
- **PENDENTE:** preço, políticas comerciais e referência temporal.
- **PENDENTE:** estratégia de autenticação posterior e revisão de RLS.
