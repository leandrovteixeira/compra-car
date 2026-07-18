# Plano de Inspeção do Supabase Atual

## 1. Objetivo da inspeção

Identificar, com evidência do banco atual, a menor superfície de dados necessária para o MVP e para o futuro Legacy Supabase Adapter. A unidade selecionável é uma versão ativa de veículo.

A inspeção deve descobrir objetos físicos, relacionamentos, regras de atividade, qualidade, atualização e permissões sem presumir nomes de schemas, tabelas ou colunas.

## 2. Limites de segurança

- Não alterar dados, schema, políticas, permissões, funções ou configurações.
- Não criar migrations ou objetos temporários.
- Não executar funções de negócio desconhecidas.
- Não usar chave de `service role`, senha de banco, token, JWT ou string completa de conexão.
- Não registrar segredos nem dados pessoais nos resultados.
- Não executar consultas de perfil antes de identificar e revisar os objetos candidatos.
- Limitar amostras a 20 registros e selecionar somente colunas necessárias.
- Interromper a inspeção se uma consulta não puder ser comprovada como somente leitura.

## 3. Princípio de somente leitura

Os scripts `01`, `02` e `03` consultam apenas metadados por meio de `information_schema` e `pg_catalog`. O script `04` contém somente modelos comentados e não executa consultas por padrão.

Toda instrução executável deve ser uma consulta de leitura. Nenhuma inspeção autoriza mudanças no banco, ainda que uma inconsistência seja encontrada.

## 4. Conceitos de negócio a localizar

- marcas e nomes de apresentação;
- modelos;
- versões e nomes comerciais;
- regra de versão ativa ou inativa;
- ano de produção e ano-modelo;
- spec codes;
- especificações e respectivas unidades;
- equipamentos, categorias e estados comerciais;
- preços e datas de referência;
- políticas comerciais, se existirem e puderem ser expostas;
- traduções;
- imagens, se existirem;
- fontes, snapshots e datas de atualização;
- relacionamentos necessários para formar uma versão comparável.

Também devem ser identificados tabelas, views, materialized views, funções relevantes, enums, constraints, índices, foreign keys, políticas RLS e permissões de leitura.

## 5. Ordem de execução das consultas

1. Confirmar manualmente o ambiente correto no SQL Editor, sem copiar credenciais para o repositório.
2. Executar `01_schema_inventory.sql` para inventariar schemas, objetos, colunas, tipos e metadados.
3. Executar `02_relationship_inventory.sql` para levantar chaves e relacionamentos técnicos.
4. Executar `03_rls_inventory.sql` para revisar RLS, políticas e concessões de leitura.
5. Exportar e revisar os resultados dos três inventários antes de escolher candidatos.
6. Registrar objetos candidatos em `LEGACY_SUPABASE_MAP.md`, ainda como `PENDENTE` até validação.
7. Substituir os placeholders necessários de `04_candidate_data_profile.sql` somente pelos nomes confirmados.
8. Revisar cada consulta preparada no arquivo `04` e executar apenas os blocos aprovados.
9. Consolidar evidências em `SUPABASE_INSPECTION_RESULTS.md` e atualizar o mapa.

## 6. Como registrar resultados

- Registrar a data, o ambiente e o método sem incluir identificadores secretos.
- Salvar resultados exportados em local aprovado e revisar seu conteúdo antes de versionar qualquer material.
- Preferir resumos, contagens e metadados a amostras de registros.
- Referenciar a consulta e o resultado que sustentam cada conclusão.
- Marcar como `CONFIRMADO` apenas o que tiver evidência do banco.
- Manter `PENDENTE` quando a evidência for insuficiente.
- Registrar conteúdo encontrado apenas em `Legacy` como `HIPÓTESE HISTÓRICA`.
- Não copiar dados pessoais, segredos, valores confidenciais ou conteúdo comercial desnecessário.

## 7. Como evitar exposição de segredos ou dados sensíveis

- Usar o SQL Editor já autenticado, sem registrar credenciais.
- Não solicitar nem utilizar chave de `service role`.
- Não copiar cabeçalhos de autenticação, tokens, JWTs ou strings de conexão.
- Inspecionar nomes e metadados antes de consultar conteúdo.
- Escolher explicitamente as colunas de qualquer amostra e excluir campos pessoais ou secretos.
- Limitar amostras a 20 registros.
- Revisar exportações antes de compartilhá-las ou adicioná-las ao Git.
- Substituir valores sensíveis por descrição agregada quando a evidência permitir.

## 8. Critérios de suficiência para iniciar o adaptador

A inspeção é suficiente quando houver evidência para:

- identificar a versão de veículo e sua chave estável;
- determinar, ou declarar como bloqueio, a regra de atividade;
- relacionar versão a marca e modelo;
- localizar nomes comerciais, anos e spec code, quando disponíveis;
- localizar equipamentos, categorias, especificações e seus valores;
- localizar preços e datas de referência necessárias ao MVP;
- distinguir ausência, não aplicação, não informação e conflitos quando a fonte permitir;
- identificar origem e atualização dos dados, ou registrar a lacuna;
- entender as foreign keys e transformações mínimas do adaptador;
- confirmar a leitura permitida por RLS e grants para a superfície do MVP;
- mapear os campos necessários aos contratos normalizados sem levar nomes físicos à UI;
- classificar políticas comerciais e imagens como disponíveis, condicionais, ausentes ou bloqueadas.

Não é necessário concluir a auditoria ampla da base nem corrigir o banco para iniciar o adaptador.

## 9. Questões pendentes

- **PENDENTE:** qual ambiente será inspecionado.
- **PENDENTE:** quais roles representarão a leitura real do MVP.
- **PENDENTE:** quais objetos representam cada conceito de negócio.
- **PENDENTE:** como o banco define versão ativa.
- **PENDENTE:** se atividade do registro corresponde à disponibilidade comercial.
- **PENDENTE:** se existem views próprias para consumo do frontend.
- **PENDENTE:** se políticas comerciais podem ser apresentadas com segurança.
- **PENDENTE:** se existem imagens e quais permissões se aplicam.
- **PENDENTE:** como fontes e datas de atualização são armazenadas.
- **PENDENTE:** onde resultados sanitizados poderão ser armazenados.

## 10. Regra de evidência

Nenhuma hipótese será tratada como fato sem evidência do banco atual. Nomes encontrados em arquivos históricos, planilhas, scripts antigos ou documentação orientam a busca, mas não confirmam a estrutura ou o conteúdo vigente.
