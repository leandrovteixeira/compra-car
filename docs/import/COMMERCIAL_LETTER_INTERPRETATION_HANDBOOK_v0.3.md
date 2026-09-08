# Compra-Car --- Commercial Letter Interpretation Handbook v0.3

**Status:** baseline de calibração do MVP após auditoria Jeep + BYD +
Geely + Volkswagen\
**Objetivo:** regras normativas para interpretação documental, Policies,
Offers, valuation, revisão humana e melhoria do prompt.

## 1. Princípio do pipeline

Separar: (1) entendimento documental; (2) extração de fatos/Policies;
(3) composição de Offers; (4) resolução de produto e decisões do
operador; (5) Domain Mapping; (6) valuation determinístico; (7) Preview
e Apply.

**A IA interpreta; o operador resolve ambiguidades explícitas; o motor
valida, calcula e persiste.**

A extração não precisa eliminar toda ambiguidade. Ela precisa ser
completa, conservadora, auditável e identificar explicitamente o que
exige decisão humana.

## 2. Escopo MVP

Processar **somente Varejo**. Ignorar VD, VD-CPF, PCD, Táxi,
CNPJ/Frotista, Governo, Agro/Produtor Rural, Diplomata, ZFM/ALC e demais
canais especiais. Informação não-varejo não completa fatos comerciais de
Varejo.

Allowlist: `retail_bonus`, `invoice_discount`, `trade_in_bonus`,
`loyalty_bonus`, `subsidized_financing`, `free_ipva`, `free_insurance`,
`free_wallbox`, `free_registration`, `fuel_or_recharge_voucher`.

Não materializar: `free_maintenance`, `other`, garantia/garantia
estendida, acessórios/brindes fora da allowlist, `registration`
deprecated e tipos fora da allowlist. Benefício desconhecido →
`UNSUPPORTED_COMMERCIAL_BENEFIT`; nunca usar `other` como escape.

## 3. Escopo geográfico

No MVP, Commercial Policies são tratadas como **nacionais**.

Carta regional/estadual/por cluster não deve ser bloqueada só por
isso: - normalizar a condição para nacional; - preservar escopo original
em provenance/Evidence; - quando regra/cálculo depender de estado, usar
**São Paulo (SP)** como referência canônica nacional do MVP.

Ex.: `Regiões 1,2,3 e 4 (MG)` → Policy nacional, com origem regional
preservada.

## 4. Produto e PY/MY

PY/MY diferente = produto diferente = Policies distintas. Par explícito
é atômico: `25/26 e 26/26` → dois produtos.

Ausência de PY/MY **não invalida a extração**. Se modelo/versão forem
identificáveis: - extrair produto; - deixar PY/MY não resolvido; - criar
`MISSING_YEAR_PAIR` / operator decision; - não inventar ano; - não usar
outro canal para completar silenciosamente Varejo; - operador pode
atribuir PY/MY antes do Apply.

## 5. Policy e Offer

**Policy** = benefício/condição atômica de produto e competência. Nunca
compartilhar entre produtos diferentes.

**Offer** = combinação válida de uma ou mais Policies do mesmo
produto/competência. Policy idêntica pode ser reutilizada entre Offers
do mesmo produto.

`OPÇÃO 1/2/3` é agrupamento editorial e **não prova OR sozinho**.
Composição depende de operadores, geometria, colunas, benefícios e
incompatibilidades reais.

## 6. AND / OR

-   `A + B` → `[A,B]`
-   `A OU B` → `[A]`, `[B]`
-   `A + (B OU C)` → `[A,B]`, `[A,C]`
-   `(A OU B) + (C OU D)` → quatro combinações

Sem composição explícita, não inferir cumulatividade.
`Entrada 60% + 24x` é uma única Policy financeira.

## 7. Geometria é semântica

Preservar linhas, colunas, headers, merged cells/spans, colunas OPÇÃO,
posição de rebate, footnotes e escopo de notas.

Merged cell aplica-se a todas as linhas cobertas salvo exceção
explícita. Replicar a condição em Policies independentes por produto.

## 8. `-` e vazio

`-` isolado normalmente = ausência da contribuição da montadora e, sem
outro componente, nenhuma Policy.

`-` + `Participação Rede R$X` **materializa Policy**: - manufacturer
contribution = 0 - dealer rebate = X - customer benefit = X

Vazio nunca vira zero automaticamente.

## 9. Evidência

Hierarquia: 1. tabela comercial estruturada; 2. nota específica
vinculada a produto/PY/MY; 3. regra geral; 4. texto promocional.

`Sugestão de Oferta`, `Sugestão de anúncio`, headline e marketing não
criam Policies quando tabela/regra define outra mecânica.

## 10. Competência e lifecycle

Carta mensal = snapshot da competência. MSRP de valuation deve ser o
vigente na competência.

Ignorar idade de estoque/data de faturamento como dimensão canônica do
MVP; se houver condições distintas por estoque, preservar todas as
Offers e a condição em provenance.

Carta revisora/substitutiva: preservar supersession em Issue/Evidence
até existir lifecycle estruturado.

## 11. Reuso e deduplicação

Policy idêntica pode ser reutilizada apenas no mesmo
produto/competência. Valores/parâmetros diferentes → Policies distintas.

Nunca deduplicar Offers só porque o total é igual. Composições
semanticamente diferentes permanecem.

## 12. Participação Rede / Dealer Rebate

Quando `Participação Rede`/`Part. Rede` estiver dentro de uma Policy: -
`amount` = contribuição da montadora, quando separável; -
`dealer_rebate_amount` = participação/custo da rede; -
`customer_benefit_amount` = montadora + rede.

Ex.: Trade-In 10.000 + Rede 1.600 → customer benefit 11.600; dealer
rebate 1.600.

Não somar rebate novamente na Offer. `-` + rebate positivo ainda é
Policy. Alocação ambígua → Evidence + review, sem invenção.

## 13. Classificação pela mecânica econômica

**Nome de marketing não determina sozinho `policy_type`. Classificar
pela mecânica econômica/operacional.**

Exemplos: - bônus pago como bônus → `retail_bonus`; - desconto/redução
obrigatória em NF → `invoice_discount`; - `pagamos sua 1ª parcela`,
quando a regra determina quitação da parcela e desconto equivalente na
NF no pagamento à vista → `invoice_discount`; - supervalorização
condicionada à troca → `trade_in_bonus` ou `loyalty_bonus`; -
`Super Bônus` → consultar regra/tabela.

Se a execução variar pela forma de pagamento, preservar a mecânica em
description/restriction/Evidence sem inventar novo tipo.

## 14. Retail Bonus

`Bônus Varejo R$X` → `retail_bonus`. `Bônus R$X` em Varejo → Retail por
default, salvo mecânica específica.

Pode estar incorporado ao `DE/POR`; não contar duas vezes. Valores
alternativos são Policies integrais distintas.

## 15. Invoice Discount

Criar `invoice_discount` quando a mecânica determinar desconto/redução
na Nota Fiscal. Sinais: `Desconto em N.F`, `Desconto NF`, desconto
obrigatório no valor do veículo na NF.

Nunca inferir apenas de `DE/POR`.

**Golden rule:** benefício `pagamos sua 1ª parcela` com quitação quando
financiado e desconto equivalente na NF quando à vista →
`invoice_discount`; preservar a mecânica da parcela em
Evidence/description.

## 16. Trade-In e Loyalty

`trade_in_bonus`: exige usado, sem exigir mesma marca. Sinais: Trade-In,
usado na troca, supervalorização, bônus na troca.

`loyalty_bonus`: exige explicitamente Trade-In + usado da própria marca,
ex. `seminovo BYD`, `Jeep para Jeep`.

Elegibilidade não reduz benefício. Não estimar valor do usado.

## 17. Financiamento

Extrair taxa, entrada %, prazo e parâmetros explícitos relevantes.
Parcela publicada não é fonte de valuation quando o motor recalcula.

Alternativas reais → Policies financeiras distintas. Taxas ligadas a
composições diferentes devem ser preservadas.

GO40/SEMPRE NOVO são nomes de plano, não tipos de Policy; podem ficar em
Evidence.

## 18. Balloon / residual

Se houver parcela balão/residual: - preservar existência e valor em
Evidence; - marcar `BALLOON_UNSTRUCTURED` enquanto o contrato não tiver
campos próprios; - não inventar principal/residual; - não valorar como
financiamento amortizante comum se isso distorcer o benefício.

Extração pode prosseguir; valuation incapaz de considerar o balão deve
ir para review/decision.

## 19. Valuation determinístico

-   `free_insurance`, 12 meses → **3% × MSRP**
-   `free_wallbox` → **R\$4.000**
-   recarga com valor explícito → valor real
-   recarga por energia → **R\$2,00/kWh**
-   `free_registration` = emplacamento
-   `free_ipva` = IPVA
-   IPVA grátis → proporcional ao restante do ano
-   emplacamento `até R$X` → `min(custo calculado, cap)`

Quando necessária referência estadual: **SP**.

## 20. Regra de `até`

Para `retail_bonus`, `invoice_discount`, `trade_in_bonus`,
`loyalty_bonus`: usar máximo anunciado.

Para Policies calculadas: `até R$X` é cap.

## 21. Informação geral vs específica

Regra geral vale por default. Regra específica claramente vinculada a
produto/PY/MY prevalece. Conflito sem escopo claro → Evidence +
review/decision.

## 22. Inferência matemática e Total

Inferência só quando inequívoca. Marcar `derived`, preservar provenance
e usar amarelo.

`Total` da montadora não é fonte oficial do valuation; serve apenas como
evidência auxiliar de derivação inequívoca.

## 23. MSRP / PPS

`MSRP`, `PPS`, `Preço Público Sugerido` inequívoco → preço público
documental; pode preencher `public_price_amount`. `public_price_id` é
resolvido pelo validator.

Nunca tratar automaticamente `DE/POR`, `Preço Cliente`, headline ou
sugestão de anúncio como MSRP.

## 24. Pacotes/opcionais

Pack Tech, PSB/PS2/PS3, códigos de opcionais/equipamento obrigatório: -
preservar em `eligibility_or_restriction` e Evidence; - se não houver
resolução automática, criar **operator decision** antes do Apply; - não
remover Offer; - não aplicar silenciosamente a veículos sem o pacote.

## 25. Best Offer e preço transacional

Benefício da Offer = soma dos `customerBenefitAmount` cumulativos.
Alternativas nunca são somadas.

Best Offer = maior benefício total, inclusive Trade-In/Loyalty;
elegibilidade não gera penalty.

Preço transacional estimado = MSRP da competência − benefício total da
melhor Offer.

Financiamento subsidiado só vira equivalente econômico pelo motor
determinístico.

Produto sem condição → zero Policies/Offers.

## 26. Confidence, Issue e Decision

**Confidence is not correctness.**

-   🟢 alta confiança
-   🟡 utilizável com ambiguidade/derivação
-   🔴 baixa confiança/contradição

**Issue** = inconsistência, conflito, limitação ou risco de integridade.

**Decision** = extração potencialmente correta que ainda precisa de
escolha humana para Apply.

Exemplos: PY/MY ausente, produto ambíguo, pacote não resolvido,
benefício novo, conflito entre fontes equivalentes.

Enquanto não houver sheet `Decisions`, representar em `Issues` com
reason code e `operator decision required`.

## 27. Operator Review

Operador pode: - atribuir PY/MY; - resolver produto
`NOT_FOUND`/`AMBIGUOUS`; - associar pacote/opcional; -
confirmar/rejeitar baixa confiança; - classificar benefício novo; -
resolver conflito; - aceitar/rejeitar Offer.

Guardar interpretação original, decisão, operador, timestamp, reason
code, Evidence, prompt version e handbook version.

## 28. Feedback e evolução

Feedback humano deve preservar interpretação original, correção, reason
code, Evidence e versões.

IA pode propor mudanças; nunca alterar prompt/handbook de produção
autonomamente.

Fluxo: feedback → candidato → Golden Dataset/Evals → comparação →
promoção humana.

## 29. Golden cases calibrados

### Jeep

-   Varejo-only; ignorar VD e sugestão de oferta.
-   PY/MY atômico.
-   Trade-In outras marcas ≠ Loyalty marca→marca.
-   condições por estoque permanecem Offers.
-   total impresso não é valuation oficial.

### BYD

-   Dolphin GS: opções não cumulativas permanecem separadas.
-   seminovo BYD → Loyalty; outras marcas → Trade-In.
-   Song Plus Premium: financiamento + Loyalty ou financiamento +
    Trade-In.
-   balloon preservado e marcado `BALLOON_UNSTRUCTURED`.

### Geely

-   EX2: financiamento + voucher/wallbox/recarga conforme composição.
-   EX5: `Bônus 1ª Parcela R$4.000` → `invoice_discount` pela mecânica
    de quitação/desconto em NF.
-   EX5 EM-i sem PY/MY explícito → operator decision; não completar
    silenciosamente via VD.
-   wallbox OU recarga → Offers alternativas quando a carta assim
    definir.

### Volkswagen

-   carta regional → normalização nacional no MVP; origem regional
    preservada.
-   `Participação Rede` compõe customer benefit e dealer rebate.
-   `-` + Participação Rede positiva ainda materializa Policy.
-   Nivus: opções com Trade-In/taxas diferentes permanecem distintas.
-   Saveiro: Retail 12k ≠ Invoice Discount 12k.
-   pacote PSB/PS2/PS3 → operator decision se não resolvido
    automaticamente.

### GAC

-   Geometria define a condição de cada versão; Varejo e Venda Direta
    podem coexistir na mesma página sem mistura.
-   `17K + 3K Rede` preserva contribuição da montadora, dealer rebate e
    customer benefit.
-   Wallbox solicitado separadamente **ou** descrito como
    `já acompanha o veículo` em contexto de benefício → `free_wallbox`.

### GWM

-   `Financiamento + Trade-In OU Seguro + Trade-In OU Financiamento + Seguro`
    → três Policies reutilizáveis / três Offers.
-   Participação Rede pode ser seletiva à composição; não propagar para
    Policies inelegíveis.
-   `Bônus de R$15K na NF` / `R$20K na NF` → `invoice_discount`.
-   Condição prorrogada de março/maio sem valores repetidos →
    `EXTERNAL_DOCUMENT_DEPENDENCY`.

## 30. Anti-regras

Nunca: - usar VD para completar silenciosamente fatos comerciais de
Varejo; - inventar PY/MY; - bloquear carta apenas por escopo regional; -
criar Policy de headline quando regra/tabela define outra mecânica; -
classificar pelo nome de marketing ignorando a mecânica econômica; -
somar rebate duas vezes; - tratar `-` como ausência quando há rebate; -
somar alternativas; - inferir cumulatividade sem evidência; -
compartilhar Policy entre produtos; - transformar `DE/POR`
automaticamente em `invoice_discount`; - usar `other` como fallback; -
penalizar Trade-In/Loyalty por elegibilidade; - usar Total da montadora
como valuation oficial; - inventar MSRP ou valuation; - aplicar
restrição de pacote a produto não elegível sem decisão; - tratar balloon
como financiamento comum quando isso distorce valuation.

## 31. Próxima etapa

1.  Versionar Handbook v0.3.
2.  Alinhar Prompt v0.1.2 ao Handbook.
3.  Testar duas cartas adicionais de marcas/formatos diferentes.
4.  Rerodar regressão Jeep/BYD/Geely/VW.
5.  Medir recall, precision, composition e provenance.
6.  Auditar erros.
7.  Congelar baseline somente após zero regressão material.
8.  Seguir para XLSX → Validator → Operator Review → Preview → Apply.

------------------------------------------------------------------------

**Fim --- v0.2**
