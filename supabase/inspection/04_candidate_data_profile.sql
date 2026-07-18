-- Compra Car — modelos de perfil de dados candidatos.
-- NÃO HÁ CONSULTAS EXECUTÁVEIS NESTE ARQUIVO POR PADRÃO.
-- Todos os blocos estão comentados e contêm placeholders deliberadamente inválidos.
-- Substitua somente objetos confirmados pelos inventários 01–03.
-- Revise nomes, custo, sensibilidade e permissão antes de remover o comentário de um bloco.
-- Execute um bloco por vez. Não use funções de negócio desconhecidas.

/* TEMPLATE 1 — contagem total.
   Avalie primeiro a estimativa de pg_class; a contagem exata pode fazer varredura pesada.

SELECT count(*) AS total_rows
FROM {{schema_confirmado}}.{{objeto_confirmado}};
*/

/* TEMPLATE 2 — contagem de ativos e inativos.
   Substitua a expressão somente após confirmar a regra de atividade.

SELECT
  {{expressao_de_atividade_confirmada}} AS active_status,
  count(*) AS row_count
FROM {{schema_confirmado}}.{{objeto_confirmado}}
GROUP BY {{expressao_de_atividade_confirmada}}
ORDER BY row_count DESC
LIMIT 20;
*/

/* TEMPLATE 3 — valores distintos de uma coluna revisada.

SELECT
  {{coluna_confirmada}} AS inspected_value,
  count(*) AS occurrence_count
FROM {{schema_confirmado}}.{{objeto_confirmado}}
GROUP BY {{coluna_confirmada}}
ORDER BY occurrence_count DESC, inspected_value
LIMIT 20;
*/

/* TEMPLATE 4 — quantidade de nulos em colunas selecionadas.

SELECT
  count(*) AS total_rows,
  count(*) FILTER (WHERE {{coluna_confirmada_1}} IS NULL) AS null_count_1,
  count(*) FILTER (WHERE {{coluna_confirmada_2}} IS NULL) AS null_count_2
FROM {{schema_confirmado}}.{{objeto_confirmado}};
*/

/* TEMPLATE 5 — duplicidades de uma chave candidata.
   O limite evita retornar uma lista extensa; a consulta ainda pode exigir varredura.

SELECT
  {{chave_candidata_1}},
  {{chave_candidata_2}},
  count(*) AS duplicate_count
FROM {{schema_confirmado}}.{{objeto_confirmado}}
GROUP BY {{chave_candidata_1}}, {{chave_candidata_2}}
HAVING count(*) > 1
ORDER BY duplicate_count DESC
LIMIT 20;
*/

/* TEMPLATE 6 — intervalo de datas e cobertura temporal.

SELECT
  min({{coluna_de_data_confirmada}}) AS minimum_date,
  max({{coluna_de_data_confirmada}}) AS maximum_date,
  count(*) FILTER (WHERE {{coluna_de_data_confirmada}} IS NULL) AS missing_date_count
FROM {{schema_confirmado}}.{{objeto_confirmado}};
*/

/* TEMPLATE 7 — distribuição de anos.

SELECT
  {{coluna_de_ano_confirmada}} AS year_value,
  count(*) AS row_count
FROM {{schema_confirmado}}.{{objeto_confirmado}}
GROUP BY {{coluna_de_ano_confirmada}}
ORDER BY year_value DESC
LIMIT 20;
*/

/* TEMPLATE 8 — presença e cobertura de spec codes.

SELECT
  count(*) AS total_rows,
  count({{coluna_spec_code_confirmada}}) AS rows_with_spec_code,
  count(DISTINCT {{coluna_spec_code_confirmada}}) AS distinct_spec_codes
FROM {{schema_confirmado}}.{{objeto_confirmado}};
*/

/* TEMPLATE 9 — cobertura de preços por versão.
   Confirme os relacionamentos e a data de referência antes de preparar este bloco.

SELECT
  count(DISTINCT v.{{id_versao_confirmado}}) AS version_count,
  count(DISTINCT p.{{fk_versao_confirmada}}) AS versions_with_price,
  min(p.{{data_referencia_confirmada}}) AS oldest_reference_date,
  max(p.{{data_referencia_confirmada}}) AS newest_reference_date
FROM {{schema_confirmado}}.{{objeto_versao_confirmado}} AS v
LEFT JOIN {{schema_confirmado}}.{{objeto_preco_confirmado}} AS p
  ON p.{{fk_versao_confirmada}} = v.{{id_versao_confirmado}};
*/

/* TEMPLATE 10 — cobertura de equipamentos por versão.

SELECT
  count(DISTINCT v.{{id_versao_confirmado}}) AS version_count,
  count(DISTINCT ev.{{fk_versao_confirmada}}) AS versions_with_equipment,
  count(DISTINCT ev.{{fk_equipamento_confirmada}}) AS distinct_equipment_count
FROM {{schema_confirmado}}.{{objeto_versao_confirmado}} AS v
LEFT JOIN {{schema_confirmado}}.{{objeto_valor_equipamento_confirmado}} AS ev
  ON ev.{{fk_versao_confirmada}} = v.{{id_versao_confirmado}};
*/

/* TEMPLATE 11 — cobertura de especificações por versão.

SELECT
  count(DISTINCT v.{{id_versao_confirmado}}) AS version_count,
  count(DISTINCT sv.{{fk_versao_confirmada}}) AS versions_with_specifications,
  count(DISTINCT sv.{{fk_especificacao_confirmada}}) AS distinct_specification_count
FROM {{schema_confirmado}}.{{objeto_versao_confirmado}} AS v
LEFT JOIN {{schema_confirmado}}.{{objeto_valor_especificacao_confirmado}} AS sv
  ON sv.{{fk_versao_confirmada}} = v.{{id_versao_confirmado}};
*/

/* TEMPLATE 12 — amostra sanitizada de no máximo 20 registros.
   Liste somente colunas necessárias e comprovadamente não sensíveis. Não use SELECT *.

SELECT
  {{coluna_revisada_1}},
  {{coluna_revisada_2}},
  {{coluna_revisada_3}}
FROM {{schema_confirmado}}.{{objeto_confirmado}}
ORDER BY {{coluna_de_ordenacao_confirmada}}
LIMIT 20;
*/
