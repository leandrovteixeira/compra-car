# Compra-Car --- Commercial Letter Interpretation Handbook v0.1

**Status:** baseline de calibração do MVP\
**Objetivo:** regras normativas para extração por IA, Policies, Offers,
valuation, confiança e melhoria do prompt.

## 1. Princípio do pipeline

Separar: (1) entendimento documental; (2) extração de fatos/Policies;
(3) composição de Offers; (4) Domain Mapping; (5) valuation
determinístico. A IA interpreta; o motor calcula quando já existe regra.

## 2. Escopo MVP

Processar **somente Varejo**. Ignorar integralmente VD, VD-CPF, PCD,
Táxi, CNPJ/Frotista, Governo, Agro/Produtor Rural, Diplomata, ZFM/ALC e
demais canais especiais. Informação não-varejo não deve completar
Varejo.

Allowlist automática: - `retail_bonus` - `invoice_discount` -
`trade_in_bonus` - `loyalty_bonus` - `subsidized_financing` -
`free_ipva` - `free_insurance` - `free_wallbox` - `free_registration` -
`fuel_or_recharge_voucher`

Não materializar no MVP: `free_maintenance`, `other`, garantia/garantia
estendida, acessórios/brindes, `registration` deprecated e tipos fora da
allowlist. Benefícios desconhecidos devem ser listados como
`UNSUPPORTED_COMMERCIAL_BENEFIT` com evidência para análise futura; não
usar `other` como escape.

## 3. Policy e Offer

**Policy** = benefício/condição atômica de um produto exato e
competência. PY/MY diferente = produto diferente = Policies distintas.
Policy nunca é compartilhada entre produtos.

**Offer** = combinação válida de uma ou mais Policies do mesmo
produto/competência. Uma Policy idêntica pode ser reutilizada em várias
Offers do mesmo produto/competência.

`OPÇÃO 1/2/3` da carta é agrupamento editorial, não necessariamente uma
Offer do banco.

## 4. Composição

-   `A + B` → `[A,B]`
-   `A OU B` → `[A]`, `[B]`
-   `A + (B OU C)` → `[A,B]`, `[A,C]`
-   `(A OU B) + (C OU D)` → quatro combinações.

Escolha real do cliente ramifica Offers.

Sem composição explícita: **não inferir cumulatividade**. Se A, B e C
são Policies claras, criar três Offers individuais.

`Entrada 60% + 24x` é parte de uma única Policy financeira; o `+` não
cria Policies.

## 5. Geometria é semântica

Preservar linhas, colunas, headers, merged cells/spans, colunas OPÇÃO,
posição de rebate e escopo de notas.

Merged cell aplica-se a todas as linhas/produtos cobertos, salvo exceção
explícita. O mapper replica a condição em Policies independentes para
cada produto.

Nota específica de PY/MY pode excluir um produto de uma condição merged.

## 6. `-` e vazio

`-` isolado normalmente significa ausência da contribuição da montadora
e, sem outro componente, nenhuma Policy.

Mas `-` + `Participação Rede R$X` **materializa a Policy**: -
manufacturer contribution = 0 - dealer rebate = X - customer benefit = X

Vazio nunca vira zero automaticamente; verificar herança de merged cell
e contexto.

## 7. Hierarquia de evidência

1.  tabela comercial estruturada;
2.  nota específica inequivocamente vinculada a produto/PY/MY;
3.  regra geral;
4.  texto promocional.

`SUGESTÃO DE OFERTA` / `Sugestão de anúncio` é comunicação, não fonte de
novas Policies/Offers. Em conflito, manter a tabela.

## 8. Competência

Carta de junho = snapshot de junho. Mesma condição em maio e junho gera
entidades distintas. MSRP usado no valuation deve ser o vigente naquela
competência.

Ignorar granularidade de idade de estoque/data de faturamento no
atacado. Se o mesmo produto tiver várias condições por estoque no mês,
preservar todas as Offers.

Carta explicitamente revisora/substitutiva deve futuramente poder tornar
a anterior superseded sem apagar histórico; auditar lifecycle existente
antes de implementar.

## 9. Reuso e deduplicação

Mesmo produto/competência: Policy semanticamente idêntica pode ser
reutilizada em várias Offers.

Produtos diferentes: nunca compartilhar Policy.

Valores/parâmetros diferentes: Policies distintas.

Se duas Policies do mesmo produto/competência/tipo entregam exatamente o
mesmo benefício e mesmas condições, diferindo apenas no funding, pode-se
manter a de **menor dealer rebate / maior funding da montadora**.

Nunca deduplicar Offers apenas porque o total é igual. Composições
diferentes permanecem.

## 10. Participação Rede / Dealer Rebate

Quando `Participação Rede`, `Part. Rede` ou rebate estiver dentro da
célula de uma Policy, pertence àquela Policy e: 1. aumenta o benefício
ao cliente; 2. registra custo da rede.

Ex.: Trade-In VW 10.000 + Rede 1.600: - customer benefit = 11.600 -
dealer rebate = 1.600

Não somar rebate novamente na Offer.

Se rebate é claro mas alocação é ambígua: não inventar; preservar
evidência, usar interpretação conservadora e marcar amarelo.

Valor monetário explícito prevalece sobre percentual:
`R$5.000,87 (2,513%)` → 5.000,87 autoritativo. Percentual é auxiliar. Se
só houver %, converter apenas com base inequívoca.

Sem menção a custo da rede → dealer cost zero no MVP.

## 11. Retail Bonus

`Bônus Varejo R$X` → `retail_bonus`. `Bônus R$X` em contexto Varejo →
Retail Bonus por default, salvo sinais fortes de outro tipo.

Retail Bonus pode estar incorporado ao `DE/POR`; não contar duas vezes.

Valores alternativos, ex. 10k e 25k, são Policies integrais distintas;
não decompor o maior em base + incremento.

## 12. Invoice Discount

Criar `invoice_discount` somente com semântica explícita:
`Desconto em N.F`, `Desconto NF` ou equivalente inequívoco. Nunca
inferir apenas de `DE/POR`.

Mesmo valor em `retail_bonus` e `invoice_discount` continua sendo
Policies semanticamente diferentes.

## 13. Trade-In

`trade_in_bonus` quando exige usado e não exige explicitamente mesma
marca. Sinais: Trade-In, usado na troca, seu usado, supervalorização,
bônus na troca.

`Supervalorização de até R$10.000` → benefício 10.000. Não estimar valor
real do usado. Elegibilidade não reduz benefício.

## 14. Loyalty

`loyalty_bonus` exige **Trade-In + usado da própria marca**
explicitamente. Sem troca, não há Loyalty. Não inferir pelo valor alto.

## 15. Financiamento

Extrair taxa ao cliente, entrada % e prazo. Ignorar parcela publicada
para valuation; o motor calcula.

Balão: pode preservar como evidência, mas não criar valuation especial
no MVP.

Derivadas financeiras da mesma composição podem ser representadas pela
menor taxa. Porém, se taxas diferentes pertencem a composições
diferentes, preservar todas.

Ex.: Trade-In 10k + 0,99% e Trade-In 8k + 0% são duas Offers/Policies
financeiras.

Alternativas explícitas na tabela principal (`0%/50%/30x OU 0%/60%/36x`)
são Policies distintas.

Ignorar nomes de plano como GO40 e SEMPRE NOVO.

## 16. Regras determinísticas de valuation

-   `free_insurance`, 12 meses → **3% × MSRP**
-   `free_wallbox` → **R\$4.000**
-   recarga com valor explícito → usar valor real
-   recarga por energia → **R\$2,00/kWh**
-   Geely 1.740 kWh → **R\$3.480**
-   `free_registration` = emplacamento/registration
-   `free_ipva` = IPVA, nunca confundir com emplacamento
-   IPVA grátis → valor econômico proporcional ao restante do ano
-   emplacamento calculado com `até R$X` → `min(custo calculado, cap)`
-   se custo de emplacamento exceder cap, diferença é do cliente; não
    presumir absorção pelo dealer.

## 17. Regra de "até"

Policies de valor diretamente informado (`retail_bonus`,
`invoice_discount`, `trade_in_bonus`, `loyalty_bonus`): usar o **máximo
anunciado**.

Policies calculadas pelo motor: `até R$X` funciona como **cap**.

## 18. Informação geral vs específica

Regra geral vale por default. Regra específica claramente vinculada a
produto/PY/MY prevalece naquele escopo. Conflito sem escopo claro →
preservar evidências e marcar review.

## 19. Inferência matemática

Permitida quando o valor faltante pode ser derivado **inequivocamente**
de valores explícitos.

Marcar como `derived`, preservar provenance e sinalizar amarelo. Com
múltiplas incógnitas/soluções, não inferir.

O `Total` informado pela montadora **não participa do valuation final**
e não é fonte de verdade do benefício. Pode ser usado apenas como
evidência auxiliar para uma derivação matemática inequívoca.

## 20. Offer, Best Offer e preço transacional

Benefício da Offer = soma do `customerBenefitAmount` das Policies
cumulativas.

Policies alternativas nunca são somadas.

Selecionar sempre a Offer de **maior benefício total**, mesmo se exigir
Trade-In/Loyalty. Elegibilidade não gera penalty.

**Preço transacional estimado = MSRP da competência − benefício total da
melhor Offer.**

Benefícios futuros como financiamento subsidiado são convertidos em
equivalente econômico e entram na soma.

Produto sem condição → zero Policies e zero Offers. Não criar baseline
artificial.

## 21. Confiança e revisão

Importar automaticamente inclusive itens amarelos e vermelhos.

-   🟢 Verde: alta confiança/coerência.
-   🟡 Amarelo: interpretação utilizável, mas há ambiguidade ou valor
    derivado.
-   🔴 Vermelho: baixa confiança/contradição importante; ainda importa,
    mas exige revisão prioritária.

Cada issue deve guardar, quando possível: - `reason_code` - explicação -
decisão tomada - evidência/página/bloco - prompt version - status de
confiança

**Confidence is not correctness.** Semáforo não substitui validações
determinísticas nem Golden Benchmark.

## 22. Feedback humano e melhoria do prompt

Correções do operador devem ser armazenadas como feedback: -
interpretação original - correção humana - reason code - evidência -
prompt version

A IA pode periodicamente analisar feedback e **propor** mudanças
incrementais no prompt. Não deve alterar o prompt de produção
autonomamente.

Fluxo desejado: feedback → proposta de prompt candidato → Golden
Dataset/Evals → comparação → promoção humana.

Reduzir amarelos/vermelhos não é suficiente;
recall/precision/composition/provenance não podem piorar.

## 23. Golden cases calibrados

### BYD Dolphin 25/26

Policies: - 0% / 60% / 24x - Loyalty 15k BYD - Trade-In Geral 8k

Todas alternativas → 3 Policies / 3 Offers.

### BYD Dolphin 26/27

-   Opção 1: 0% / 60% / 35x / balão
-   Opção 2: 0% / 60% / 24x
-   Opção 3: Loyalty 15k OU Trade-In 8k OU Retail 8k

→ 5 Policies / 5 Offers.

### BYD Song Plus Premium 25/26

Policies: - A = 0% / 50% / 36x - B = Loyalty BYD 40k - C = Trade-In
Geral 20k

Offers: `A+B`, `A+C`. "Sem custo pra rede" → dealer cost zero.

### GWM

A = financiamento; B = Trade-In 15k; C = seguro 1 ano.\
Offers: `A+B`, `C+B`, `A+C`. Reutilizar Policies idênticas.

### Geely EX5

Policies: - Retail 10k - taxa 0% - Retail 25k - emplacamento até 4k -
wallbox 4k - recarga 1.740 kWh = 3.480

Offers: - 25k + emplacamento + wallbox - 25k + emplacamento + recarga -
10k + taxa + emplacamento + wallbox - 10k + taxa + emplacamento +
recarga

### Jeep Renegade Varejo

Ignorar VD-CPF e "Sugestão de Oferta".

Altitude sem condição → nada.

Longitude: - Trade-In 6k - 0% / 50% / 30x - 0% / 60% / 36x → Offers
Trade-In+Taxa1 e Trade-In+Taxa2.

Sahara e Willys: - Trade-In próprio por produto - célula financeira
merged compartilhada → replicar as taxas para cada produto; Policies
independentes.

### VW --- Participação Rede

Se a célula Trade-In mostra 10k + Rede 1,6k: - Trade-In customer benefit
= 11,6k - dealer rebate = 1,6k

Se Bônus Varejo mostra `-` + Rede 2k: - Retail Bonus = 2k - dealer
rebate = 2k

### VW --- Nivus Comfortline

Policies comuns podem ser reutilizadas. Opções com Trade-In e taxas
diferentes permanecem distintas: - opção 1: Trade-In 10k + Rede 1,6k +
0,99% - opção 2: Trade-In 8k + Rede 1,6k + 0% - NF e Retail comuns podem
ser reutilizados.

### VW --- Saveiro

`Trade-In 4k + Retail 12k` e `Trade-In 4k + Invoice Discount 12k` são
Offers semanticamente diferentes apesar do mesmo total.

### VW --- T-Cross Comfortline 26/26

Múltiplas condições por estoque devem ser preservadas como Offers.
Policies iguais podem ser reutilizadas; descontos NF diferentes são
Policies distintas. Funding da rede dentro da célula compõe o benefício.

## 24. Anti-regras

Nunca: - usar VD para completar Varejo; - criar Policy a partir de texto
promocional quando a tabela diz outra coisa; - somar rebate duas
vezes; - tratar `-` como ausência se há rebate na célula; - somar
Policies alternativas; - inferir cumulatividade sem evidência; -
compartilhar Policy entre produtos; - transformar `DE/POR`
automaticamente em `invoice_discount`; - usar `other` como fallback
automático; - penalizar Trade-In/Loyalty por elegibilidade; - usar o
Total da montadora como total oficial do Compra-Car; - inventar MSRP ou
valuation faltante.

## 25. Próxima etapa recomendada

1.  Versionar este handbook.
2.  Traduzir as regras relevantes para uma nova versão mínima do prompt
    de extração.
3.  Não alterar todas as camadas simultaneamente: manter Document
    Map/Unit Extraction/Domain Mapping com responsabilidades claras.
4.  Montar/atualizar Golden cases de BYD, Jeep, GWM, Geely e VW.
5.  Rodar primeiro **sem escrita em staging**.
6.  Medir:
    -   criticalFactRecall
    -   overallFactRecall
    -   precision
    -   compositionAccuracy
    -   provenanceAccuracy
    -   amarelos/vermelhos por reason code
7.  Auditar erros.
8.  Ajustar o prompt apenas com base em falhas observadas.
9.  Só depois liberar uma rodada controlada de persistência.

------------------------------------------------------------------------

**Fim --- v0.1**
