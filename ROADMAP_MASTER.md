# Compra Car — Cronograma Mestre do Projeto

## Objetivo
Criar rapidamente um MVP mobile-first para vendedores de concessionárias, permitindo comparar 2 ou 3 veículos, destacar diferenças e vantagens e gerar um PDF completo com aviso legal.

## Estado atual da Fase 1

- **CONCLUÍDO:** fundação arquitetural do produto
- **INICIADO:** preparação da inspeção mínima e somente leitura do Supabase atual; execução e resultados ainda pendentes
- **NÃO INICIADO:** Legacy Supabase Adapter
- **NÃO INICIADO:** frontend Next.js

## Semana 1 — MVP
- Criar Engineering Hub do projeto
- Criar repositório GitHub privado
- Criar PRODUCT_SPEC.md, DOMAIN_MODEL.md, CONTRACTS.md e UI_FLOW.md como fundação anterior ao Next.js
- Usar o Supabase atual como está, sem exigir nova carga do Excel ou reestruturação ampla do banco
- Inspecionar minimamente o schema e os dados existentes na superfície usada pelo MVP
- Mapear o Legacy Supabase Adapter
- Validar os contratos normalizados com dados reais existentes
- Criar aplicação Next.js conectada ao Supabase atual
- Implementar a UI sobre contratos estáveis e o Adaptador Legacy
- Garantir que o MVP disponibilize todas as versões ativas encontradas no Supabase atual
- Manter Appsmith como backoffice provisório
- Criar tela mobile de seleção de 2 ou 3 veículos
- Mostrar apenas diferenças
- Criar filtro “mostrar só vantagens”
- Criar identidade visual flexível por marca, sem aparentar aplicação oficial
- Gerar PDF completo com comparação e aviso legal
- Permitir compartilhamento do PDF
- Publicar aplicação no Railway
- Validar com primeiros vendedores

## Semana 2 — Exportação e auditoria
- Exportar Supabase
- Exportar Appsmith
- Reunir scripts, planilhas, relatórios e documentos
- Criar inventário técnico
- Mapear dependências
- Criar AI_CONTEXT.md
- Criar START.md
- Criar ADRs
- Documentar arquitetura atual e arquitetura-alvo
- Classificar objetos: KEEP, REFACTOR, MIGRATE, MERGE, ARCHIVE, DELETE, UNKNOWN
- Normalizar a base de equipamentos
- Aplicar correções de dados e normalizações gradualmente, com base no aprendizado do piloto
- Ajustar o importador Excel para respeitar a estrutura vigente do Supabase atual
- Planejar cargas futuras controladas sem bloquear o MVP ou o piloto
- Preparar plano de migração

## Semana 3 — Nova arquitetura
- Criar Supabase Staging V2
- Criar schema canônico
- Criar ou evoluir importadores para a estrutura V2
- Migrar dados de forma controlada
- Criar autenticação
- Iniciar novo backoffice
- Criar adaptador V2
- Preservar o frontend Next.js por meio de contratos estáveis
- Preparar ambiente de produção

## Princípios do projeto
- GitHub é a fonte autoritativa do código e da documentação técnica
- OneDrive é usado para mobilidade e sincronização entre computadores
- Alterações estruturais devem ser versionadas
- O frontend não deve depender diretamente dos nomes das tabelas legadas
- Nenhuma nova carga do Excel ou alteração estrutural ampla do banco é pré-requisito para o MVP
- O Excel deve ser adaptado posteriormente à estrutura vigente do Supabase atual
- Appsmith permanece temporariamente como backoffice
- O MVP deve validar uso real antes da reconstrução completa
- O aviso legal deve aparecer na aplicação e no PDF
- O sistema não deve sugerir vínculo oficial com montadoras sem autorização

## Arquitetura transitória
Supabase atual → Adaptador Legacy → Next.js MVP  
Supabase atual → Appsmith para operação interna

## Arquitetura futura
Supabase V2 → Adaptador V2 → Next.js  
Supabase V2 → Novo backoffice
