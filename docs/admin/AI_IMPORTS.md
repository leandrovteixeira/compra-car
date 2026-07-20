# Importações Administrativas Assistidas por IA

## Escopo

As importações por IA pertencem à Fase 2 administrativa. Não integram a Fase 1 e não autorizam alteração antecipada de schema.

## Princípio de segurança

```text
arquivo → extração estruturada → staging → revisão humana → promoção controlada
```

A IA nunca grava diretamente em tabelas definitivas. Toda promoção exige validação humana, rastreabilidade da origem e regras determinísticas de integridade.

## Cartas comerciais

Fluxo previsto:

1. upload do arquivo da montadora;
2. processamento por backend ou worker;
3. uso da OpenAI API com saída estruturada;
4. preservação do texto e arquivo de origem conforme política aprovada;
5. gravação do resultado em staging;
6. validação de veículos, campos, valores, moeda e vigência;
7. revisão e correção humana;
8. promoção explícita para os objetos definitivos.

## Fichas técnicas

Fluxo previsto:

1. upload da ficha técnica;
2. extração estruturada;
3. preservação da nomenclatura original;
4. normalização proposta dos termos da montadora;
5. associação proposta aos spec codes existentes;
6. staging e indicação de confiança ou ambiguidade;
7. revisão humana;
8. promoção controlada.

Novos conceitos ou specs não devem ser criados automaticamente. Lacunas seguem para decisão de domínio e eventual evolução de schema em fase própria.

## Aprendizado incremental

O sistema deve registrar:

- termo original e contexto;
- conceito e spec code aprovados;
- proposta automática;
- correção humana;
- versão da regra, dicionário, prompt ou modelo aplicável;
- origem e data da aprovação.

Diferentes nomenclaturas podem apontar para o mesmo conceito e spec code. A abordagem inicial combina regras, dicionários, similaridade, exemplos aprovados e OpenAI. Fine-tuning não é pressuposto e só deve ser avaliado após evidência mensurável de necessidade.

## Pendências arquiteturais

- modelo e localização do staging;
- retenção, privacidade e descarte de arquivos;
- contrato de saída estruturada;
- mecanismo de promoção e rollback;
- auditoria e papéis de aprovação;
- tratamento de duplicidade e reprocessamento;
- métricas de qualidade e limiares de confiança;
- política de uso de dados com provedores externos.
