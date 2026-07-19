# Resultados da Inspeção do Supabase Atual

## Estado em 2026-07-18

A superfície mínima foi definida e mapeada a partir das evidências fornecidas para esta fase. Nenhuma credencial, URL privada ou conteúdo de linha é registrado neste documento. A validação online continua opt-in e não bloqueia testes unitários ou compilação.

## Objetos usados pelo MVP

- `public.products`: veículo comercial e flags de atividade/publicação;
- `public.specs`: metadados normalizados do item comparável;
- `public.product_specs`: associação e valor do item por produto.

Nenhuma outra tabela, view, função ou storage integra o adaptador.

## Relacionamentos confirmados

- `product_specs.equipment_id → specs.id`: foreign key física;
- `product_specs.product_id → products.id`: vínculo lógico sem foreign key física.

A ausência da segunda FK é dívida técnica documentada, não pré-requisito para o MVP e não autoriza mudança no legado.

## Regras confirmadas

- veículo disponível: produto ativo, público e com ao menos uma associação válida a spec ativa;
- `binary` e `scale`: existência da associação significa `true`; ausência significa `false`;
- `numeric`: `value` é convertido em número finito, `null` é preservado e valor inválido falha explicitamente;
- unidade numérica: `input_unit ?? specs.unit ?? null`, considerando texto vazio como ausente;
- tipo desconhecido falha explicitamente;
- dois `code` distintos no mesmo `spec_set` continuam linhas distintas;
- lista pública vazia é válida.

## Segurança e permissões

O cliente é criado somente no servidor com `SUPABASE_URL` e `SUPABASE_SERVER_KEY`. Persistência de sessão, refresh automático e detecção de sessão por URL ficam desativados. A chave não usa prefixo `NEXT_PUBLIC_` e não pode ser enviada ao navegador ou registrada em logs.

RLS, grants e políticas do ambiente real ainda devem ser revisados antes da publicação do piloto. O adaptador não escreve no banco.

## Cobertura e inconsistências conhecidas

A cobertura quantitativa de marcas, modelos, versões e specs depende do teste opt-in no ambiente autorizado. Textos legados com problemas de encoding são preservados sem normalização silenciosa. O adaptador não corrige dados na leitura.

## Validação executável

Os testes unitários validam os mapeadores sem rede. `test/integration.test.ts` só executa selects quando `SUPABASE_INTEGRATION_URL` e `SUPABASE_INTEGRATION_SERVER_KEY` existem; IDs opcionais podem ser informados em `SUPABASE_INTEGRATION_VEHICLE_IDS`. Sem essas variáveis, a suíte é ignorada de forma explícita.

## Bloqueios

Não há bloqueio estrutural conhecido para implementar o adaptador. A validação online do ambiente continua pendente quando não houver credenciais opt-in, sem transformar Excel, migração ou reestruturação do banco em pré-requisito.
