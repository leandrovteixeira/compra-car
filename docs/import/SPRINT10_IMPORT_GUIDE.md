# Guia canônico de interpretação de cartas comerciais

## Escopo e princípio de leitura

Este documento consolida exclusivamente as regras de negócio observadas nas 19 cartas presentes em
`data/research/commercial_letters`, totalizando 469 páginas. Ele descreve como um operador do Compra
Car deve interpretar uma carta comercial. Não descreve captura de arquivo, leitura técnica do documento,
fornecedor de IA ou implementação.

Regra central: a carta é evidência, não autorização para completar lacunas. Um dado só pode seguir para o
domínio quando estiver explícito, aplicável ao MMV correto, dentro da vigência e do canal corretos e sem
contradição não resolvida. Em qualquer outro caso o resultado é `REVIEW`.

Neste guia:

- **MMV** significa marca, modelo, versão, ano-modelo e ano de fabricação quando este último for
  necessário para distinguir Products;
- **Preço Público** é o preço de referência/MSRP, não o preço líquido de campanha;
- **Policy** é um benefício ou condição comercial atômica;
- **Offer** é uma combinação permitida de Policies para um Product e período;
- **E** indica cumulatividade obrigatória ou permitida no mesmo Offer;
- **OU** indica alternativas que devem gerar Offers diferentes;
- **REVIEW** significa que a interpretação humana é obrigatória antes de qualquer promoção;
- **Ignorar** significa não transformar o conteúdo em entidade comercial, sem apagar sua evidência de
  origem.

# 1. Inventário

Foram encontradas 19 cartas, todas em PDF. Não havia imagens ou outros formatos avulsos na pasta.

| # | Fabricante/marca | Arquivo | Páginas | Tipo | Observações relevantes |
|---:|---|---|---:|---|---|
| 1 | Volkswagen | `1. Ações de Vendas Julho 2026 - Regiões 1,2,3 e 4 (MG).pdf` | 49 | Varejo regional | Tabelas densas por MMV; bônus varejo, Trade-In, desconto em NF e taxas; regras e calendário de comprovação nas páginas finais. |
| 2 | GAC | `2026.06.11 - Política Comercial Varejo Junho.pdf` | 19 | Varejo e vendas diretas | Vigência aberta até a carta seguinte; Wallbox, seguro, bônus, Trade-In, taxa e programas PCD/Táxi. |
| 3 | Geely | `43.26 - Carta Comercial - Junho 2026.pdf` | 10 | Varejo | Combinações com taxa, bônus, Wallbox/recarga e bônus de primeira parcela; contém marca Renault em textos operacionais, mas a carta comercial é Geely. |
| 4 | Geely | `49.26 - Carta Comercial - Julho 2026.pdf` | 18 | Varejo e vendas diretas | Mantém a estrutura de junho e acrescenta condições e documentação de venda direta. |
| 5 | Volkswagen | `Ações de Vendas Agosto 2026 - Região 1-1.pdf` | 49 | Varejo regional | Atualização mensal da carta Volkswagen; mantém regras de Trade-In e altera valores/validade. |
| 6 | GAC | `Comunicado 044_2026 - Política Comercial - Agosto_2026.pdf` | 20 | Varejo e vendas diretas | Taxas derivadas, bônus, Trade-In, Wallbox, regras de elegibilidade e portal de incentivos. |
| 7 | BYD | `Comunicado de Vendas BYD 086-2026 - Política Comercial BYD Julho 2026.pdf` | 33 | Varejo e vendas diretas | Resumo explícito de cumulatividade; taxa, Trade-In por marca do usado, bônus varejo, balão e canais CPF/Small/Big Business. |
| 8 | Volvo | `CV5426 - Política Comercial Junho 2026.pdf` | 9 | Varejo e venda direta | Documento digitalizado; lido visualmente. Inclui preço público, preço promocional, CRM, F&I, Trade-In, taxas, revisões e canal Iron Man. |
| 9 | Volvo | `CV5526 - Canais de Venda Corporativa e Parcerias_Junho.pdf` | 10 | Corporativo e parcerias | Documento digitalizado; lido visualmente. Descontos por níveis N1/N2, volume e canal; veda incentivos de varejo nesses canais. |
| 10 | GWM | `DR_155_26_Campanha Comercial - Julho 2026 - Ed1.pdf` | 5 | Varejo | Muitas combinações `E/OU`; seguro, Trade-In, taxa e Pacote Tranquilidade, além de participação da rede. |
| 11 | Fiat | `DVE_0062_2026_CARTA COMPLEMENTAR_VAREJO_JULHO_2026.pdf` | 5 | Carta complementar de varejo | Corrige Trade-In da Strada e condições Fastback; a precedência sobre a carta principal é parcial, não global. |
| 12 | Leapmotor | `LPC_0009_2026_Carta Comercial_Março 2026.pdf` | 15 | Varejo e vendas diretas | MSRP, Trade-In, taxas, Wallbox, voucher de instalação e regras fiscais. |
| 13 | Leapmotor | `LPC_0026_2026__Errata_Carta Comercial_Julho 2026.pdf` | 24 | Errata de varejo e vendas diretas | Substitui/corrige condições; inclui carência para primeira parcela, Trade-In especial por cor e Categoria 17. |
| 14 | Nissan | `MKT 034_26 - Política Comercial Mensal - Junho'26.pdf` | 61 | Varejo, vendas diretas, CRM e assinatura | Taxas, incentivo varejo, Trade-In Conquista/Fidelidade, vouchers CRM, Nissan Replay e Nissan Move. |
| 15 | Nissan | `MKT 039_26 - Política Comercial Mensal - Julho'26.pdf` | 57 | Varejo, vendas diretas, CRM e assinatura | Atualiza a política Nissan; bônus em NF, loyalty, Move Brasil e assinatura. |
| 16 | Jeep | `MKT_0021_2026_JEEP_CARTA DO MES DE ABRIL_VAREJO E VENDAS DIRETAS.pdf` | 27 | Varejo e vendas diretas | Preço promocional, desconto por canal, Trade-In, taxa, consórcio e condições por MVS/MY. |
| 17 | Jeep | `MKT_0042_2026_JEEP_CARTA DO MES DE JULHO_VAREJO E VENDAS DIRETAS.pdf` | 33 | Varejo e vendas diretas | Cumulatividade varia por versão; inclui uso de Tabela FIPE, condições especiais e desdobramentos de taxas. |
| 18 | GAC | `Política Comercial GAC Julho-2026.pdf` | 20 | Varejo e vendas diretas | Bônus, Trade-In e taxa por versão/estoque; regras de Wallbox e programas de vendas diretas. |
| 19 | OMODA & JAECOO | `VEN043-2026 - Carta Comercial de Julho.pdf` | 5 | Varejo | Tabelas compactas de bônus varejo, Trade-In, taxa, participação/rebate da rede e preços de lançamento. |

### Cobertura por fabricante

Os 19 documentos representam 11 grupos: Volkswagen, GAC, Geely, BYD, Volvo, GWM, Fiat,
Leapmotor, Nissan, Jeep e OMODA & JAECOO. OMODA e JAECOO são marcas distintas na mesma carta e
devem permanecer distintas no matching de Product.

# 2. Anatomia das cartas

## 2.1 Estrutura recorrente

Uma carta costuma combinar, nem sempre nesta ordem:

1. capa, número do comunicado, competência e confidencialidade;
2. vigência geral;
3. carta introdutória e destaques de marketing;
4. índice ou menu;
5. blocos por canal: varejo, venda direta, corporativo, PCD, Táxi, produtor rural etc.;
6. blocos por modelo/versão/MY;
7. preço público e, às vezes, preço promocional;
8. Policies isoladas e suas relações `E/OU`;
9. tabela-resumo que pode esclarecer ou contradizer páginas anteriores;
10. regras de elegibilidade, documentação, prazos e comprovação;
11. anexos financeiros, fiscais, CRM, Floor Plan ou assinatura;
12. rodapé jurídico, contatos, assinaturas e marketing.

O operador não deve assumir que a primeira oferta destacada é a regra completa. Chamadas grandes são
resumos publicitários; tabelas e notas de elegibilidade determinam a composição válida.

## 2.2 Diferenças por fabricante

| Fabricante | Organização observada | Consequência de interpretação |
|---|---|---|
| Volkswagen | Uma ou mais páginas por versão, seguidas de regras centralizadas de Trade-In e calendário. | A relação entre taxa e valor de Trade-In pode estar apenas nas regras finais. Não concluir a Offer antes de ler as páginas 43–49. |
| GAC | Apresentação institucional, páginas de campanha por modelo e página-resumo; vigência às vezes termina na publicação seguinte. | A página-resumo ajuda a resolver `E/OU`, mas campos visuais ausentes exigem comparação com a página específica. |
| Geely | Uma página por família, depois regras de bônus e benefícios. | “De/por” pode ser uma chamada, enquanto o MSRP permanece outro valor. Wallbox ou recarga são alternativas físicas. |
| BYD | Uma página por modelo e um resumo tabular explícito, seguido de regras de cumulatividade. | O resumo e a regra “campanha cumulativa/não cumulativa” têm alto valor semântico. Marca do seminovo altera o Trade-In. |
| Volvo | Texto normativo longo e anexos tabulares; canais separados em cartas próprias. | Preço promocional, CRM, F&I e Trade-In são colunas distintas. Carta corporativa proíbe herdar incentivos do varejo. |
| GWM | Tabelas densas com três Offers por modelo e pacote geral adicional. | Cada `OU` gera uma Offer; o Pacote Tranquilidade é cumulativo com todas, mas contém vários benefícios. |
| Fiat | Carta complementar curta, referenciando documento anterior. | Somente os itens declarados como correção/novo destaque substituem a carta-base. O restante fica `REVIEW` se a base não estiver no corpus. |
| Leapmotor | Condições por modelo, tabelas de taxas, fluxos e regras fiscais; errata explicitamente identificada. | A errata tem precedência na interseção de MMV/período/campo. Cor pode alterar Trade-In. |
| Nissan | Documento extenso com varejo, venda direta, CRM, assinatura e anexos. | Nem todo “bônus” é universal: vouchers CRM são pessoais, segmentados e podem ser adicionais. Nissan Move é assinatura, não compra. |
| Jeep | Blocos por canal/MMV e páginas financeiras separadas. | A mesma versão pode ter `E` em um mês e `OU` em outro. “Tabela FIPE” é regra do Trade-In, não preço do carro novo. |
| OMODA & JAECOO | Tabelas compactas por modelo e condições gerais no final. | Rebate da rede não é benefício adicional do cliente. Financiamento e Trade-In podem ser alternativos ou cumulativos conforme a linha. |

## 2.3 Ordem de precedência

Quando duas evidências tratam do mesmo Product, campo e período, aplicar esta ordem:

1. errata ou carta complementar mais recente, somente no escopo que ela afirma corrigir;
2. regra explícita de cumulatividade/elegibilidade;
3. tabela detalhada do MMV;
4. tabela-resumo da mesma carta;
5. chamada publicitária;
6. introdução ou exemplo narrativo.

Se duas fontes do mesmo nível divergirem, não escolher silenciosamente: `REVIEW` com ambas as páginas.

# 3. Taxonomia completa

A taxonomia abaixo reúne todos os tipos de informação encontrados. “Campanha” é reservada a uma
condição econômica ou benefício elegível; dados estruturais, regras e itens internos também aparecem
porque precisam ser reconhecidos e classificados.

## 3.1 Identidade, tempo e escopo

| Tipo observado | Significado de negócio | Exemplos no corpus |
|---|---|---|
| Fabricante/marca | Marca comercial aplicável. | Volkswagen, GAC, Geely, BYD, Volvo, GWM, Fiat, Leapmotor, Nissan, Jeep, OMODA, JAECOO. |
| Modelo | Família comercial do veículo. | Polo, EX5, Dolphin, XC60, Haval H6, Fastback, C10, Kicks, Compass, OMODA 5. |
| Versão | Derivação comercial. | Highline, PRO, GS, Ultra, Sport, Longitude. |
| Ano fabricação/modelo | Recorte de elegibilidade. | 25/26, 26/26, 26/27. |
| Código de produto | Identificador do fabricante. | MVS Jeep/Fiat/Leapmotor, códigos Volkswagen e grupos de mercadoria Geely. |
| Cor/pacote/opcional | Restrição adicional do veículo. | C10 REEV preto/branco; Pack Tech; Pack Smart Drive. |
| Canal | Público/processo de venda. | Varejo, VD-CPF, CNPJ, PCD, Táxi, frotista, locadora, produtor rural, parceria N1/N2. |
| Região | Limite geográfico. | Regiões Volkswagen, ZFM/ALC, área operacional da concessionária. |
| Competência | Mês comercial. | Junho, julho, agosto de 2026. |
| Vigência | Intervalo da campanha. | Datas fechadas ou “até a publicação da próxima política”. |
| Janela operacional | Datas de pedido, NF, baixa, emplacamento, pagamento ou comprovação. | Input até 31/07, pagamento até 07/08, documentos até 10/08. |
| Quantidade/estoque | Limite de unidades ou estoque elegível. | 100 Sealion; “enquanto durarem os estoques”; unidades faturadas antes de uma data. |

## 3.2 Preço e benefícios ao cliente

| Tipo observado | Definição canônica |
|---|---|
| Preço Público/MSRP/PPS | Referência pública do Product; não é automaticamente o preço final. |
| Preço promocional/de-por | Preço final anunciado durante campanha; deve coexistir com o MSRP quando ambos aparecem. |
| Desconto em NF/incondicional | Redução expressa na nota/preço do veículo. |
| Bônus varejo/incentivo varejo | Valor fixo de benefício sem requisito de usado ou relacionamento. |
| Trade-In/supervalorização | Benefício condicionado à entrega/aquisição documentada de usado. |
| Trade-In fidelidade | Trade-In restrito a usado da própria marca. |
| Trade-In conquista | Trade-In restrito a usado de outra marca ou a conjunto definido. |
| Loyalty/CRM/recompra | Bônus por relacionamento, voucher, score ou histórico com a marca. |
| Indicação/presenteável | Bônus emitido a cliente anterior para terceiro elegível. |
| Financiamento subsidiado | Taxa, entrada e prazo promocionais; parcela e principal podem completar a condição. |
| Financiamento com balão | Plano com parcelas e parcela final explícita. |
| Carência/primeira parcela futura | Início do pagamento postergado, distinto da taxa. |
| Bônus de primeira parcela | Montadora/concessionária paga ou desconta valor da primeira parcela. |
| Seguro grátis | Cobertura de seguro por período, normalmente um ano. |
| IPVA grátis | Benefício tributário sobre o veículo, não confundir com isenção legal de PCD/Táxi. |
| Emplacamento/licenciamento grátis | Pagamento do processo de registro inicial. |
| Wallbox | Equipamento de recarga fornecido ao cliente. |
| Carregador portátil | Equipamento diferente de Wallbox. |
| Recarga elétrica grátis | Crédito/consumo de recarga por valor, energia ou período. |
| Voucher de instalação | Crédito para instalar Wallbox. |
| Voucher de combustível | Crédito de combustível. |
| Voucher de acessórios | Crédito restrito a acessórios. |
| Manutenção/revisões grátis | Quantidade ou período de serviços incluídos. |
| Assistência/oficina remota/carro cortesia | Serviço de suporte incluído. |
| Proteção adicional de bateria/garantia | Cobertura adicional à garantia ordinária. |
| Recompra garantida | Compromisso futuro de recompra, com regras próprias. |
| Acessório/cortesia/brinde | Item físico não classificado acima. |
| Pacote composto | Nome comercial que reúne vários benefícios, como Pacote Tranquilidade. |

## 3.3 Condições econômicas e internas

| Tipo observado | Definição canônica |
|---|---|
| Rebate/participação da rede | Parcela do custo suportada pela concessionária; não somar ao benefício do cliente. |
| Participação da montadora | Parcela suportada pela montadora. |
| Bônus atacado | Incentivo entre montadora e rede, não benefício final por si só. |
| Floor Plan/carência de estoque | Financiamento do estoque da concessionária, não do cliente. |
| Comissão/remuneração | Receita da concessionária ou vendedor. |
| Incentivo de vendedor/gerente | Premiação interna por performance. |
| Margem variável/fundão | Mecânica interna da rede. |
| Taxas derivadas/desdobramentos | Alternativas financeiras autorizadas da mesma campanha. |
| Consórcio | Modalidade distinta de aquisição; só vira campanha se houver benefício explícito ao cliente. |
| Assinatura | Serviço Nissan Move; não representa compra do veículo. |
| Desconto corporativo por nível/volume | Preço de canal N1/N2, frota ou parceria. |
| Isenção fiscal legal | Tratamento PCD/Táxi/ZFM/ALC; não é benefício discricionário da montadora. |
| Disponibilidade/prazo de entrega | Informação operacional, não Policy. |
| Regra de comprovação | Documentos, parentesco, prazo, portal e eventos que condicionam elegibilidade. |
| Comunicação sugerida | Texto publicitário permitido; não substitui a regra detalhada. |
| Evento/test-drive/mídia | Atividade comercial; só é benefício se houver vantagem individual explícita e elegível. |

# 4. Mapeamento para Compra Car

## 4.1 Tabela canônica de destino

| Tipo encontrado | Destino | Decisão e justificativa |
|---|---|---|
| Marca, modelo, versão, MY e fabricação | Product | Identificam o MMV. Servem primeiro para matching; nunca criar Product automaticamente só por menção. |
| MVS/código/grupo de mercadoria | Product | Alias/identificador externo do Product. Se o domínio não possuir o alias, manter como evidência e `REVIEW`. |
| Cor, combustível, motorização, tração, pacote e equipamento permanente | Product Spec | Só quando descrevem característica do veículo, não elegibilidade temporária. Requer Spec existente e Product confirmado. |
| Preço Público/MSRP/PPS | Preço Público | É o preço de referência do Product e período. Valor promocional não o substitui. |
| Preço promocional ou desconto em NF | Policy (`invoice_discount`) | Representa redução temporária. Se a carta só mostra “por” sem MSRP inequívoco, `REVIEW`; não calcular diferença implicitamente. |
| Bônus varejo/incentivo varejo | Policy (`retail_bonus`) | Benefício monetário atômico sem requisito de usado/loyalty. |
| Trade-In genérico | Policy (`trade_in_bonus`) | Benefício condicionado à troca. Regras do usado permanecem como restrições/evidência. |
| Trade-In fidelidade/conquista/FIPE/faixa de valor | Policy (`trade_in_bonus`) | Mesmo tipo atual, mas a qualificação não cabe integralmente no modelo atual; manter detalhes e exigir `REVIEW` antes de publicar. |
| Loyalty, CRM, recompra e indicação | Policy (`loyalty_bonus`) | Benefício monetário condicionado a vínculo. Voucher pessoal e transferibilidade são restrições. |
| Taxa subsidiada | Policy (`subsidized_financing`) | Exige taxa, entrada e prazo aplicáveis. Principal/base dependem do preço confirmado. |
| Plano com balão | Policy (`subsidized_financing`) com `REVIEW` | O domínio atual não representa parcela final explicitamente; não perder esse dado nem publicar como plano simples. |
| Carência/primeira parcela futura | Policy nova necessária | Não equivale a taxa nem bônus. O tipo atual não representa dias de carência. |
| Bônus da primeira parcela | Policy nova necessária | É benefício monetário condicionado à forma de pagamento; não deve ser misturado silenciosamente a `retail_bonus`. |
| Seguro grátis | Policy (`free_insurance`) | Cobertura e anos devem estar explícitos ou ficar em `REVIEW`. |
| IPVA grátis | Policy (`free_ipva`) | Somente quando a montadora oferece o benefício. Isenção legal de PCD/Táxi não entra. |
| Emplacamento/licenciamento grátis | Policy (`free_registration`) | Benefício ao cliente. “Emplacamento obrigatório até data X” é apenas regra de elegibilidade. |
| Wallbox grátis | Policy (`free_wallbox`) | Equipamento fornecido como benefício. Wallbox que acompanha o Product de série exige `REVIEW` entre Policy e Product Spec. |
| Manutenção/revisões grátis | Policy (`free_maintenance`) | Informar contagem, meses ou km quando presentes. Revisão pertencente a assinatura não vira Policy de compra. |
| Recarga elétrica ou combustível | Policy (`fuel_or_recharge_voucher`) | Usar tipo de voucher correspondente; valor ausente ou limite só em kWh exige `REVIEW`. |
| Voucher de instalação | Policy nova ou extensão de voucher | O enum atual não cobre instalação. Não classificar como recarga. |
| Voucher de acessórios | Policy nova ou extensão de voucher | Não usar `fuel_or_recharge_voucher`. |
| Carregador portátil | Policy nova ou `other` temporário com `REVIEW` | Benefício físico distinto de Wallbox. Criar tipo específico antes de automação confiável. |
| Assistência, oficina remota e carro cortesia | Policy nova necessária | Serviços de suporte não cabem nos tipos atuais. |
| Proteção adicional de bateria/garantia | Policy nova necessária | Benefício de cobertura; não confundir com seguro. |
| Recompra garantida | Policy nova necessária | Compromisso econômico futuro com regras próprias. |
| Acessório/brinde individual | Policy (`other`) somente com aprovação | `other` exige descrição e valor; sem valor ou sem catálogo, `REVIEW`. |
| Pacote composto | Offer | Decompor em Policies atômicas. O nome do pacote pode ser título/observação da Offer, nunca uma Policy que duplique os componentes. |
| Relação `E` | Offer | Policies cumulativas pertencem à mesma Offer. |
| Relação `OU` | Offer | Cada alternativa gera Offer distinta; nunca somar benefícios mutuamente exclusivos. |
| Rebate/participação da rede | Atributo econômico da Policy | Usar `dealer_rebate_amount` quando o vínculo com uma Policy elegível for explícito. Não criar Policy separada nem aumentar benefício. |
| Bônus atacado, Floor Plan, comissão, incentivo de equipe e fundão | Ignorar | São relações internas montadora/rede e não benefício público ao comprador. |
| Desconto de venda direta/corporativo | `REVIEW` | É condição por canal. O modelo atual não expressa elegibilidade de canal de forma suficiente; não publicar como oferta geral. |
| Isenção fiscal legal | Ignorar | Decorre da lei/categoria e não da campanha da montadora. Pode ser restrição de canal, não Policy. |
| Prazo de entrega, estoque, portal e documentação | Ignorar como entidade | Preservar como evidência/restrição de review, mas não criar Price/Policy/Offer/Product/Spec. |
| Logo, foto, slogan, assinatura e contato | Ignorar | Não carregam regra comercial. |

## 4.2 Regras de decomposição

- “R$ 25.000 de bônus ou taxa zero, ambos com Wallbox” gera duas Offers: `[retail_bonus,
  free_wallbox]` e `[subsidized_financing, free_wallbox]`.
- “Taxa zero + R$ 15.000 de Trade-In ou seguro + R$ 15.000 de Trade-In” gera duas Offers:
  `[subsidized_financing, trade_in_bonus]` e `[free_insurance, trade_in_bonus]`.
- “Taxa zero ou seguro ou Trade-In” gera três Offers, não uma.
- “Bônus de R$ 15 mil, sendo R$ 12 mil montadora + R$ 3 mil rede” é uma Policy de R$ 15 mil com
  rebate de R$ 3 mil; não são duas Policies.
- “Preço de R$ 205.800 por R$ 195.800” mantém `205800` como MSRP e cria desconto de NF de `10000`
  apenas se a diferença for inequivocamente a campanha daquele Product/período.
- Condições de canais diferentes nunca compõem a mesma Offer.

# 5. Catálogo de Policies

## 5.1 Tipos existentes no domínio atual

| Tipo atual | Rótulo humano | Evidência no corpus | Situação |
|---|---|---|---|
| `retail_bonus` | Bônus Varejo | Todos os grandes grupos, com destaque para Volkswagen, GAC, BYD e Jeep. | Existente e adequado. |
| `invoice_discount` | Desconto NF | GWM ORA, Fiat Fastback, Nissan bônus incorporado e preços “de/por”. | Existente; exige distinguir MSRP de preço promocional. |
| `trade_in_bonus` | Trade-In | Recorrente em praticamente todas as cartas. | Existente; restrições de marca/FIPE/canal ainda precisam de representação. |
| `loyalty_bonus` | Loyalty/CRM/Recompra | Nissan CRM/Loyalty e Trade-In fidelidade; bônus de indicação. | Existente; não misturar Trade-In fidelidade com loyalty monetário sem revisar. |
| `subsidized_financing` | Taxa subsidiada | Taxa zero e taxas reduzidas em todos os fabricantes. | Existente; plano com balão e carência excedem o contrato atual. |
| `free_ipva` | IPVA grátis | Geely oferece uso de bônus em IPVA; cartas citam IPVA como composição de benefício. | Existente; só criar se a gratuidade for explícita, não por mera possibilidade de uso do bônus. |
| `free_insurance` | Seguro grátis | GAC, GWM e Geely. | Existente e adequado quando cobertura/período estão claros. |
| `free_wallbox` | Wallbox grátis | GAC, Geely, GWM e Leapmotor. | Existente; separar equipamento de voucher de instalação. |
| `free_registration` | Emplacamento grátis | Geely cita uso de benefício em emplacamento; outras cartas usam o termo operacionalmente. | Existente; evidência deve dizer “grátis/incluso”. |
| `free_maintenance` | Manutenção/revisões grátis | Volvo CRM oferece duas revisões; Pacote Tranquilidade agrega serviços. | Existente; assinatura Nissan Move não é Policy de compra. |
| `fuel_or_recharge_voucher` | Voucher combustível/recarga | Geely EX2 e recarga anual; GAC/eletrificados. | Existente; não cobre instalação/acessórios. |
| `other` | Outro benefício monetizado | Cortesias isoladas sem tipo próprio. | Existente, mas não deve virar depósito genérico; sempre `REVIEW`. |
| `registration` | Registro (legado) | Não deve ser escolhido para novos dados. | Depreciado; usar `free_registration`. |

## 5.2 Tipos que precisam de decisão ou criação

| Policy candidata | Evidência real | Por que não cabe corretamente hoje | Decisão antes da Sprint 10B |
|---|---|---|---|
| `first_installment_bonus` | Geely EX5: bônus de primeira parcela de R$ 4.000. | Tem condição de pagamento e semântica diferente de bônus varejo. | Criar tipo ou aprovar mapeamento explícito. |
| `deferred_first_payment` | Leapmotor: primeira parcela somente em 2027/carências de 30 ou 180 dias. | Não é taxa, prazo nem valor fixo. | Criar parâmetros de carência. |
| `installation_voucher` | Leapmotor: voucher de R$ 1.300 para instalação. | Voucher atual só admite combustível/recarga. | Ampliar catálogo de voucher ou criar tipo. |
| `accessories_voucher` | Nissan informa voucher de acessórios em campanha anterior e sua retirada em julho. | Não cabe no voucher atual. | Definir tipo e regra de retirada/substituição. |
| `portable_charger` | GWM Pacote Tranquilidade. | Equipamento diferente de Wallbox. | Criar tipo ou catálogo de equipamentos-benefício. |
| `roadside_assistance` | GWM Tomorrow Assistance/oficina remota/carro cortesia. | Serviço não representado. | Definir tipo, cobertura e período. |
| `battery_protection` | GWM: proteção total da bateria por dois anos. | Não é seguro nem manutenção. | Definir cobertura adicional. |
| `guaranteed_buyback` | GWM: recompra garantida. | Compromisso futuro com condições não modeladas. | Definir tipo e parâmetros mínimos. |
| `generic_accessory` | Acessórios/cortesias de cartas diversas. | `other` exige valor, mas muitos itens não têm valor. | Aprovar catálogo ou manter `REVIEW`. |

## 5.3 O que não é Policy

- participação/rebate da rede é financiamento da Policy, não benefício adicional;
- desconto corporativo/frota sem modelo de canal não deve ser generalizado;
- isenção PCD/Táxi/ZFM não é benefício da montadora;
- Floor Plan, comissão, margem variável e premiações internas não chegam ao cliente;
- preço público é Price;
- pacote é Offer de Policies;
- prazo de entrega, documentação e portal são regras operacionais;
- característica permanente do veículo é Product Spec.

# 6. Catálogo de Offers

Cada linha abaixo é uma combinação observada. Offers do mesmo Product separadas por `OU` devem
permanecer independentes.

| # | Fonte real | Product/recorte | Policies da Offer | Relação/observação |
|---:|---|---|---|---|
| 1 | Geely jun., p. 3 | EX2 PRO | `subsidized_financing` + `fuel_or_recharge_voucher` | Taxa zero com voucher de R$ 100. |
| 2 | Geely jun., p. 3 | EX2 MAX | `subsidized_financing` + `free_wallbox` | A carta também oferece “1 ano recarga” como alternativa ao Wallbox; gerar Offer distinta se for `OU`. |
| 3 | Geely jun., p. 4 | EX5 PRO | `retail_bonus` + `free_wallbox` + `first_installment_bonus` | Opção 1. |
| 4 | Geely jun., p. 4 | EX5 PRO | `retail_bonus` + `subsidized_financing` + `free_wallbox` + `first_installment_bonus` | Opção 2 tem bônus menor e taxa zero. |
| 5 | Geely jun., p. 5 | EX5 EM-i Ultra | `subsidized_financing` + `free_wallbox` | Opção 1. |
| 6 | Geely jun., p. 5 | EX5 EM-i Ultra | `subsidized_financing` + `trade_in_bonus` | Opção 2. |
| 7 | BYD jul., p. 11 | Dolphin GS | `subsidized_financing` com balão | Opção 1; exige `REVIEW` pelo balão. |
| 8 | BYD jul., p. 11 | Dolphin GS | `subsidized_financing` simples | Opção 2. |
| 9 | BYD jul., p. 11 | Dolphin GS | `trade_in_bonus` próprio BYD | Alternativa exclusiva. |
| 10 | BYD jul., p. 11 | Dolphin GS | `trade_in_bonus` outras marcas | Mesmo tipo, valor/restrição diferentes. |
| 11 | BYD jul., p. 11 | Dolphin GS | `retail_bonus` | Alternativa sem custo para rede. |
| 12 | BYD jul., p. 12 | Sealion 7 | `subsidized_financing` + `trade_in_bonus` | Cumulativa; Trade-In somente usado Seal. |
| 13 | BYD jul., p. 16 | Song Plus Premium | `subsidized_financing` + `trade_in_bonus` BYD | R$ 30 mil. |
| 14 | BYD jul., p. 16 | Song Plus Premium | `subsidized_financing` + `trade_in_bonus` qualquer marca | R$ 15 mil. |
| 15 | GWM jul., p. 2 | Haval H6 HEV2 | `subsidized_financing` + `trade_in_bonus` + componentes do Pacote Tranquilidade | Opção 1. |
| 16 | GWM jul., p. 2 | Haval H6 HEV2 | `free_insurance` + `trade_in_bonus` + componentes do Pacote Tranquilidade | Opção 2. |
| 17 | GWM jul., p. 2 | Haval H6 HEV2 | `subsidized_financing` + `free_insurance` + componentes do Pacote Tranquilidade | Opção 3. |
| 18 | GWM jul., p. 4 | Poer P30 | `subsidized_financing` + pacote | Alternativa 1. |
| 19 | GWM jul., p. 4 | Poer P30 | `trade_in_bonus` + pacote | Alternativa 2. |
| 20 | GWM jul., p. 4 | Poer P30 | `free_insurance` + pacote | Alternativa 3. |
| 21 | Jeep abr., p. 6 | Compass Sport VD-CPF | `trade_in_bonus` | Alternativa ao financiamento. |
| 22 | Jeep abr., p. 6 | Compass Sport VD-CPF | `subsidized_financing` | A carta diz que taxa e Trade-In não acumulam nesse recorte. |
| 23 | Jeep jul., p. 6 | Compass Sport VD-CPF | `trade_in_bonus` + `subsidized_financing` | Em julho a carta torna a combinação cumulativa. |
| 24 | Jeep jul., p. 7 | Compass Sport VD-CPF | `trade_in_bonus` | Condição maior, sem taxa zero, apesar da chamada geral. |
| 25 | Fiat jul., p. 3 | Fastback T200 Pack Smart | `invoice_discount` | R$ 124.990; não cumulativo com taxa. |
| 26 | Fiat jul., p. 3 | Fastback T200 Pack Smart | `subsidized_financing` | Taxa 0,99%; sem o bônus adicional do preço. |
| 27 | Leapmotor jul., p. 4 | C10 REEV | `trade_in_bonus` + `subsidized_financing` | Trade-In menor com taxa. |
| 28 | Leapmotor jul., p. 4 | C10 REEV | `trade_in_bonus` | Trade-In maior sem taxa. |
| 29 | Leapmotor jul., p. 5 | B10 BEV | `trade_in_bonus` + `subsidized_financing` + `free_wallbox` | A carência é alternativa adicional e requer tipo novo. |
| 30 | GAC jun., p. 8 | Aion UT Premium | `retail_bonus` + `free_insurance` | Alternativa 1. |
| 31 | GAC jun., p. 8 | Aion UT Premium | `subsidized_financing` + `free_insurance` | Alternativa 2. |
| 32 | GAC jun., p. 9 | GS4 Elite 25/26 | `retail_bonus` + `subsidized_financing` | Bônus inclui participação da rede. |
| 33 | OMODA/JAECOO jul., p. 3 | OMODA 5 Luxury | `retail_bonus` + `subsidized_financing` | Financiamento é alternativa ao Trade-In na tabela. |
| 34 | OMODA/JAECOO jul., p. 4 | JAECOO 7 Luxury MY26/27 | `invoice_discount` + uma das condições comerciais | Preço de lançamento não autoriza acumular todas as colunas. |
| 35 | Nissan jul., p. 34–45 | MMV segmentado por CRM | `loyalty_bonus` + Policies vigentes | O voucher diz “adicional”; Product/score e validade precisam ser confirmados. |
| 36 | Volvo jun., anexo 1 | XC60/variante elegível | `loyalty_bonus` + `free_maintenance` | CRM com bônus e duas revisões; não herdar para canal corporativo. |

Esses 36 padrões não significam 36 tipos de Policy: são composições. O corpus contém 27 categorias
distintas de campanha/benefício ao cliente quando variantes de valor, modelo e canal são agrupadas:
preço promocional, desconto NF, bônus varejo, Trade-In genérico, Trade-In fidelidade, Trade-In conquista,
loyalty/CRM, indicação, taxa subsidiada, balão, carência, primeira parcela paga, seguro, IPVA,
emplacamento, Wallbox, carregador portátil, recarga, voucher de instalação, voucher de combustível,
voucher de acessórios, manutenção/revisões, assistência/carro cortesia, proteção de bateria, recompra
garantida, acessório/cortesia e pacote composto.

# 7. Catálogo do que deve ser ignorado

## 7.1 Conteúdo visual e editorial

- logos, marcas d'água, fotos de veículos e imagens ilustrativas;
- fundos, ícones, setas, cores e elementos decorativos;
- slogans, hashtags, chamadas aspiracionais e textos de celebração;
- resultados de vendas, ranking de emplacamentos e metas agregadas;
- mensagens de abertura, agradecimentos e “boas vendas”;
- assinatura eletrônica, nome/cargo de executivos e rodapé corporativo;
- avisos de confidencialidade e código de conduta;
- QR Codes, hyperlinks, botões “clique aqui” e endereços de portais como conteúdo comercial.

## 7.2 Conteúdo interno da montadora/rede

- estrutura da equipe, nomes, telefones e e-mails;
- distribuição de concessionárias por regional;
- comissão, remuneração, fundão, margem variável e premiação de vendedor/gerente;
- rebate/participação da rede quando não vinculado de modo inequívoco a uma Policy;
- bônus atacado e financiamento Floor Plan;
- calendário de pagamento à rede e auditoria de documentos;
- processo de faturamento, baixa, B2B, Vitrine, NBS, CRM, GDMC, SPN e DevPartner;
- materiais de mídia cooperada, eventos, treinamento e geração de leads;
- prazos de produção, transporte e entrega;
- disponibilidade por cor e estoque, salvo como alerta de elegibilidade, nunca como entidade;
- regras de cancelamento/refaturamento e penalidades contratuais;
- documentos pessoais exigidos e contatos de suporte.

## 7.3 Jurídico e fiscal

- texto da Lei Ferrari e liberdade de preço;
- aviso de que oferta depende de análise de crédito;
- tabelas gerais de impostos e NCM;
- isenções legais PCD, Táxi, ZFM e ALC;
- lista de documentos fiscais e societários;
- proibição de fraude, estorno e sanções;
- condições legais genéricas que não alterem Product, Price, Policy ou Offer.

“Ignorar” não significa descartar a página. A evidência continua necessária para explicar por que um item
não entrou ou para sustentar uma restrição em `REVIEW`.

# 8. Ambiguidades

| Situação | Exemplo observado | Regra canônica |
|---|---|---|
| Marca errada em template | Carta Geely traz “Concessionário Renault” e e-mails Renault em páginas operacionais. | Marca é inferida do título, produtos e contexto comercial convergentes; a inconsistência deve gerar warning, não rematch automático. |
| MSRP versus preço final | Geely “De R$ 205.800 por R$ 195.800”; BYD usa PPS explícito. | Preservar MSRP; criar desconto apenas quando a diferença for inequívoca. |
| Bônus versus desconto NF | GWM diz “bônus de R$ 15K na NF”. | Se reduz diretamente a NF, preferir `invoice_discount`; se pago/reembolsado como incentivo, `retail_bonus`. Se a mecânica não estiver clara, `REVIEW`. |
| Mesmo nome, elegibilidade diferente | Trade-In BYD varia entre usado BYD, outras marcas ou Seal. | Policies distintas, ainda que do mesmo tipo. Não fundir por título. |
| Fidelidade versus Trade-In | Nissan “Trade-In Fidelidade” exige usado Nissan. | Continua Trade-In com restrição; não virar `loyalty_bonus` automaticamente. |
| `E` e `OU` misturados | GWM apresenta três colunas e Pacote Tranquilidade adicional. | Resolver cada coluna como Offer e acrescentar apenas os componentes declarados como adicionais. |
| Chamada contradiz detalhe | Jeep chama “supervalorização + taxa”, mas uma página específica diz que naquela condição não há taxa. | Página detalhada/observação específica prevalece. |
| Regra muda entre meses | Jeep abril: Trade-In `OU` taxa; julho: Trade-In `E` taxa para alguns MMVs. | Nunca transportar composição do mês anterior. |
| Campanha dividida em páginas | Nissan apresenta ofertas e deixa critérios/documentação em anexo distante. | A Offer só fica pronta após ler todo o bloco e anexos referenciados. |
| Errata parcial | Fiat e Leapmotor corrigem itens específicos. | Substituir apenas Product/campo/período declarado; não invalidar silenciosamente toda carta anterior. |
| Vigência aberta | GAC: até publicação da política seguinte. | `valid_to` só pode ser fechado com a data efetiva da sucessora; antes disso `REVIEW`. |
| Datas múltiplas | Data de pedido, NF, emplacamento, pagamento e comprovação diferem. | Vigência da Policy é a janela de elegibilidade comercial; outras datas são restrições, não início/fim automático. |
| Ano abreviado | 25/26 pode significar fabricação/modelo. | Normalizar somente quando cabeçalhos confirmarem a ordem. |
| Código sem versão textual | Tabelas Volkswagen/Fiat usam código/MVS em linhas densas. | Código é evidência de matching; não substituir versão ausente por suposição. |
| Cor altera campanha | Leapmotor C10 REEV tem Trade-In adicional para duas cores. | Não criar Product novo por cor sem decisão; marcar restrição e `REVIEW`. |
| Item de série versus benefício | GAC diz que alguns Wallboxes “já acompanham o veículo”. | Pode ser Product Spec, não Policy temporária; depende de confirmação do caráter permanente. |
| Uso livre de bônus | Geely permite usar bônus em IPVA, emplacamento ou seguro. | Não criar três Policies. O benefício é o bônus; os usos são exemplos. |
| Valor total versus funding | OMODA/GAC mostram valor ao cliente e rebate da rede. | Benefício é o total ao cliente; rebate é funding, nunca soma. |
| Taxa derivada | Cartas permitem usar tabela de desdobramentos. | Só criar as variantes explicitamente autorizadas para o MMV; não expandir tabela genérica sem vínculo. |
| Parcela sem principal claro | Chamada informa entrada/parcela, mas não preço/base inequívoca. | Não inferir principal nem custo do subsídio; `REVIEW`. |
| Balão | BYD Sempre Novo/Nissan Replay. | Não reduzir a plano comum; preservar parcela final e exigir suporte de domínio. |
| Canal incompatível | Volvo corporativo proíbe bônus, Trade-In, taxa e Wallbox do varejo. | Nunca herdar Offer entre canais. |
| Benefício pessoal | Voucher Nissan pode ser pessoal, intransferível ou transferível a primeiro grau. | Preservar restrição e não generalizar a todos os compradores. |
| Quantidade limitada | Oferta limitada a 100 unidades ou estoque. | `REVIEW`; o domínio precisa decidir como representar consumo de cota. |
| Ausência de carta-base | Fiat complementar referencia DVE anterior ausente do corpus. | Interpretar somente as correções presentes; qualquer dependência externa fica pendente. |
| Texto de marketing parece campanha | “Pagamos sua primeira parcela” é chamada; página de regras fixa R$ 4.000. | Usar a regra detalhada, não valor implícito da parcela anunciada. |

# 9. Golden Examples

Escala de confidence:

- **HIGH**: Product, valor, relação e vigência explícitos e não contraditos;
- **MEDIUM**: interpretação provável, mas depende de restrição, decomposição ou campo não suportado;
- **LOW/REVIEW**: evidência incompleta, contraditória ou dependente de decisão de negócio.

## 9.1 Preço e desconto

### GE-01 — MSRP explícito

**Trecho encontrado:** “PPS R$ 149.990” — BYD, julho, p. 11.

**Interpretação humana:** preço público do Dolphin GS, não valor líquido de uma das opções.

**Destino Compra Car:** Preço Público do Product correspondente.

**Confidence:** HIGH.

**Observações:** as Policies da mesma página não alteram a identidade do MSRP.

### GE-02 — De/por

**Trecho encontrado:** “Geely EX5 — De: R$ 205.800 — Por: R$ 195.800” — Geely, junho, p. 4.

**Interpretação humana:** MSRP de R$ 205.800 e chamada promocional R$ 195.800.

**Destino Compra Car:** Preço Público `205800`; candidato a `invoice_discount` de `10000`.

**Confidence:** MEDIUM.

**Observações:** confirmar que o “por” é desconto e não preço público revisado para aquela versão.

### GE-03 — Bônus na nota

**Trecho encontrado:** “R$ 169.000 (Bônus de R$ 15K na NF)” — GWM, julho, p. 2.

**Interpretação humana:** desconto aplicado na nota, não pagamento separado.

**Destino Compra Car:** Policy `invoice_discount` de R$ 15.000.

**Confidence:** HIGH.

**Observações:** não criar também `retail_bonus` para o mesmo valor.

### GE-04 — Preço promocional de venda direta

**Trecho encontrado:** “PPS R$ 118.990; Desconto de R$ 9.000; Preço de venda R$ 109.990” — BYD,
julho, p. 20.

**Interpretação humana:** desconto específico do canal VD-CPF.

**Destino Compra Car:** Preço Público + candidato a `invoice_discount`, em `REVIEW` por canal.

**Confidence:** MEDIUM.

**Observações:** nunca publicar como desconto geral de varejo.

## 9.2 Bônus e Trade-In

### GE-05 — Bônus varejo simples

**Trecho encontrado:** “Bônus Varejo R$ 10.000” — BYD Song Pro GS, julho, p. 14.

**Interpretação humana:** benefício monetário sem usado.

**Destino Compra Car:** Policy `retail_bonus` de R$ 10.000.

**Confidence:** HIGH.

**Observações:** a página declara `OU` taxa zero, portanto gera Offer separada.

### GE-06 — Trade-In por marca do usado

**Trecho encontrado:** “Trade-in de R$ 15.000 (seminovo BYD) OU ... R$ 8.000 (outras marcas)” —
BYD, julho, p. 11.

**Interpretação humana:** duas Policies alternativas do mesmo tipo, com elegibilidades e valores
diferentes.

**Destino Compra Car:** duas `trade_in_bonus`; duas Offers.

**Confidence:** HIGH.

**Observações:** não usar uma Policy de R$ 15.000 para qualquer usado.

### GE-07 — Trade-In restrito a um modelo

**Trecho encontrado:** “Trade-in de R$ 25.000 (Somente seminovo Seal)” — BYD, julho, p. 12.

**Interpretação humana:** bônus de troca exige que o usado seja Seal.

**Destino Compra Car:** `trade_in_bonus` com restrição preservada e `REVIEW` antes da publicação.

**Confidence:** HIGH para tipo/valor; MEDIUM para publicação.

**Observações:** o domínio atual não garante essa restrição.

### GE-08 — Funding da rede

**Trecho encontrado:** “Bônus Varejo R$ 15.000 (12K + R$ 3K Rede)” — GAC, junho, p. 12.

**Interpretação humana:** cliente recebe R$ 15.000; rede financia R$ 3.000.

**Destino Compra Car:** `retail_bonus.customer_benefit_amount=15000` e
`dealer_rebate_amount=3000`.

**Confidence:** HIGH.

**Observações:** nunca somar para R$ 18.000.

### GE-09 — Trade-In dependente da taxa

**Trecho encontrado:** “Nivus Comfortline Taxa 0,99%: Trade-In 10K; Taxa 0%: Trade-In 8K” —
Volkswagen, julho, p. 46.

**Interpretação humana:** duas composições econômicas; o valor da troca depende da taxa escolhida.

**Destino Compra Car:** duas `trade_in_bonus`, duas `subsidized_financing` e duas Offers pareadas.

**Confidence:** HIGH.

**Observações:** não combinar Trade-In 10K com taxa zero.

### GE-10 — Trade-In especial por cor

**Trecho encontrado:** “C10 REEV ... Preto Eclipse e Branco Alvorada ... Trade-In adicional” —
Leapmotor, julho, p. 6.

**Interpretação humana:** a cor é condição de elegibilidade do bônus adicional.

**Destino Compra Car:** `trade_in_bonus` em `REVIEW` com restrição de cor.

**Confidence:** MEDIUM.

**Observações:** não criar um novo Product por cor sem decisão explícita.

### GE-11 — Loyalty/CRM

**Trecho encontrado:** “Clientes em Recompra (CRM) ... Bônus CRM ... por modelo/score” — Nissan,
julho, p. 34.

**Interpretação humana:** bônus segmentado por relacionamento e score.

**Destino Compra Car:** `loyalty_bonus` por Product/segmento.

**Confidence:** MEDIUM.

**Observações:** valor e universo elegível precisam estar na evidência individual.

### GE-12 — Indicação

**Trecho encontrado:** “Clientes que compraram um Nissan 0Km ... ganham um bônus para presentear
alguém” — Nissan, junho, p. 45.

**Interpretação humana:** bônus de indicação transferível sob regra específica.

**Destino Compra Car:** candidato a `loyalty_bonus`, `REVIEW`.

**Confidence:** MEDIUM.

**Observações:** não tratar como bônus varejo universal.

## 9.3 Financiamento

### GE-13 — Taxa simples

**Trecho encontrado:** “Taxa 0% — Ent. 60% — 24x de R$ 2.669” — BYD, julho, p. 11.

**Interpretação humana:** financiamento subsidiado com entrada e prazo explícitos.

**Destino Compra Car:** `subsidized_financing`.

**Confidence:** HIGH.

**Observações:** vincular ao MSRP/Product correto da página.

### GE-14 — Plano com balão

**Trecho encontrado:** “35x de R$ 960 + parcela balão R$ 29.998” — BYD, julho, p. 11.

**Interpretação humana:** plano com parcela final, economicamente diferente do plano linear.

**Destino Compra Car:** `subsidized_financing` em `REVIEW`.

**Confidence:** HIGH para leitura; LOW para promoção no contrato atual.

**Observações:** nunca omitir o balão.

### GE-15 — Carência

**Trecho encontrado:** “1ª parcela só em 2027” — Leapmotor, julho, p. 3–5.

**Interpretação humana:** carência de pagamento, não taxa zero.

**Destino Compra Car:** Policy nova `deferred_first_payment`.

**Confidence:** MEDIUM.

**Observações:** as páginas 9–10 detalham carências; sem data exata aplicável, `REVIEW`.

### GE-16 — Desdobramento autorizado

**Trecho encontrado:** “Poderá ser utilizada a taxa informada no quadrante ou a taxa disponível na
tabela de Derivadas” — GAC, agosto, p. 5–9.

**Interpretação humana:** variantes financeiras autorizadas para os modelos apontados.

**Destino Compra Car:** Policies `subsidized_financing` distintas.

**Confidence:** MEDIUM.

**Observações:** não aplicar a tabela a modelos não nomeados.

### GE-17 — Taxa e Trade-In não cumulativos

**Trecho encontrado:** “Carros vendidos utilizando as taxas ... NÃO possuem direito ao bônus de
Trade-In” — Jeep, abril, p. 6.

**Interpretação humana:** duas Offers alternativas.

**Destino Compra Car:** Offer A com `subsidized_financing`; Offer B com `trade_in_bonus`.

**Confidence:** HIGH.

**Observações:** a regra muda em julho para determinados MMVs.

### GE-18 — Taxa e Trade-In cumulativos

**Trecho encontrado:** “Bônus de Trade-In ... E Taxa 0% com 60% de entrada em 24x” — Jeep, julho,
p. 6.

**Interpretação humana:** uma Offer contendo as duas Policies.

**Destino Compra Car:** Offer `[trade_in_bonus, subsidized_financing]`.

**Confidence:** HIGH.

**Observações:** não transportar para outras versões/páginas.

## 9.4 Benefícios não financeiros e vouchers

### GE-19 — Seguro grátis

**Trecho encontrado:** “1 ano de seguro + 15.000 Trade-In” — GWM, julho, p. 2.

**Interpretação humana:** seguro e Trade-In cumulativos.

**Destino Compra Car:** Offer `[free_insurance, trade_in_bonus]`.

**Confidence:** HIGH.

**Observações:** é alternativa à combinação com taxa.

### GE-20 — Wallbox

**Trecho encontrado:** “Wallbox incluso em ambas versões” — GAC, junho, p. 8.

**Interpretação humana:** benefício de Wallbox para os Products nomeados.

**Destino Compra Car:** `free_wallbox`.

**Confidence:** MEDIUM.

**Observações:** conferir se “acompanha o veículo” é item de série ou campanha temporal.

### GE-21 — Wallbox ou recarga

**Trecho encontrado:** “Wallbox ou 1 ano Recarga — Incluso” — Geely, junho, p. 4–5.

**Interpretação humana:** benefícios alternativos, não cumulativos.

**Destino Compra Car:** Offer com `free_wallbox` e Offer com `fuel_or_recharge_voucher`.

**Confidence:** HIGH para alternativas; MEDIUM para monetização da recarga.

**Observações:** não colocar ambos na mesma Offer.

### GE-22 — Voucher de recarga

**Trecho encontrado:** “Voucher de Recarga R$ 100,00” — Geely, junho, p. 3.

**Interpretação humana:** crédito monetário para recarga elétrica.

**Destino Compra Car:** `fuel_or_recharge_voucher`, tipo `electric_recharge`, R$ 100.

**Confidence:** HIGH.

**Observações:** distinto de Wallbox.

### GE-23 — Recarga por energia/período

**Trecho encontrado:** “até 12 meses ou 1.500 kWh” — Geely, junho, p. 8.

**Interpretação humana:** recarga grátis limitada pelo primeiro critério atingido.

**Destino Compra Car:** `fuel_or_recharge_voucher` em `REVIEW`.

**Confidence:** HIGH para regra; LOW para valor monetário.

**Observações:** nunca inventar conversão de kWh para reais.

### GE-24 — Voucher de instalação

**Trecho encontrado:** “Voucher de R$ 1.300,00 para desconto na instalação” — Leapmotor, março,
p. 4.

**Interpretação humana:** crédito de instalação, não recarga.

**Destino Compra Car:** Policy nova/novo tipo de voucher.

**Confidence:** HIGH.

**Observações:** não usar `electric_recharge`.

### GE-25 — Revisões grátis

**Trecho encontrado:** “Bônus CRM — Revisões de Série ... benefício das 2 revisões” — Volvo, junho,
p. 6.

**Interpretação humana:** duas revisões incluídas para cliente CRM e MMVs elegíveis.

**Destino Compra Car:** `free_maintenance` com `maintenance_count=2`, composta com loyalty quando
aplicável.

**Confidence:** HIGH.

**Observações:** não aplicar a toda a linha Volvo.

### GE-26 — Primeira parcela paga

**Trecho encontrado:** “Bônus 1ª Parcela R$ 4.000” — Geely, junho, p. 4 e regras p. 7.

**Interpretação humana:** benefício fixo ligado à primeira parcela ou desconto à vista.

**Destino Compra Car:** Policy candidata `first_installment_bonus`.

**Confidence:** HIGH.

**Observações:** não inferir o valor da parcela real acima de R$ 4.000.

### GE-27 — Pacote composto

**Trecho encontrado:** “Pacote Tranquilidade ... assistência + proteção da bateria + recompra
garantida + carregador portátil + Wallbox” — GWM, julho, p. 3–4.

**Interpretação humana:** conjunto adicional às ofertas principais.

**Destino Compra Car:** decompor em Policies; Offer recebe os componentes aplicáveis ao Product.

**Confidence:** MEDIUM.

**Observações:** carregador/Wallbox são apenas para Plug-In; não duplicar pacote e componentes.

### GE-28 — Uso opcional do bônus

**Trecho encontrado:** “Possibilidades de uso: desconto ... IPVA + Emplacamento + Seguro Grátis ...
supervalorização usado” — Geely, junho, p. 7.

**Interpretação humana:** exemplos de negociação usando um mesmo montante de bônus.

**Destino Compra Car:** manter a Policy de bônus; não criar IPVA, emplacamento, seguro e Trade-In.

**Confidence:** HIGH.

**Observações:** criar múltiplas Policies duplicaria o benefício.

## 9.5 Canal, Product e conteúdo ignorado

### GE-29 — MMV por MVS

**Trecho encontrado:** “Fastback ... MVS 376AJD1 ... 2025/2026” — Fiat, julho, p. 3.

**Interpretação humana:** código e MY identificam o Product da condição.

**Destino Compra Car:** matching de Product; MVS como alias/evidência.

**Confidence:** HIGH.

**Observações:** não criar Product se houver mais de um candidato.

### GE-30 — Cor como restrição

**Trecho encontrado:** “Preto Eclipse (0KL), Branco Alvorada (0AH)” — Leapmotor, julho, p. 6.

**Interpretação humana:** restrição da campanha, não necessariamente nova versão.

**Destino Compra Car:** evidência/restrição; Product Spec somente se o catálogo possuir a cor.

**Confidence:** MEDIUM.

**Observações:** promoção da Offer requer decisão sobre elegibilidade por cor.

### GE-31 — Wallbox de série

**Trecho encontrado:** “Aion UT, Hyptec HT e Aion V — o Wallbox já acompanha o veículo” — GAC,
julho, p. 11.

**Interpretação humana:** possível característica permanente, não campanha mensal.

**Destino Compra Car:** `REVIEW` entre Product Spec e Policy.

**Confidence:** LOW/REVIEW.

**Observações:** comparar outras competências para verificar permanência.

### GE-32 — Canal corporativo isolado

**Trecho encontrado:** “Os incentivos adicionais da Política Comercial do mês não são elegíveis aos
canais Parceria e Corporativa” — Volvo CV5526, p. 6.

**Interpretação humana:** nenhuma Policy de varejo deve ser herdada nesses canais.

**Destino Compra Car:** restrição/`REVIEW`; não criar Offer de varejo.

**Confidence:** HIGH.

**Observações:** desconto N1/N2 depende de suporte de canal.

### GE-33 — Isenção fiscal

**Trecho encontrado:** “Desconto de isenção de impostos + bônus da fábrica” — GAC, junho, p. 17.

**Interpretação humana:** a isenção legal e o bônus da fábrica são componentes diferentes.

**Destino Compra Car:** ignorar isenção; criar apenas bônus se valor e Product estiverem explícitos.

**Confidence:** HIGH.

**Observações:** não monetizar tributo sem valor oficial.

### GE-34 — Floor Plan

**Trecho encontrado:** “prazos de carência para pagamento ... veículos financiados ... para o estoque
da concessionária” — Fiat, julho, p. 4.

**Interpretação humana:** financiamento de estoque, sem benefício ao comprador.

**Destino Compra Car:** Ignorar.

**Confidence:** HIGH.

**Observações:** nunca criar `subsidized_financing`.

### GE-35 — Premiação interna

**Trecho encontrado:** “Salesperson R$ 500 ... Manager R$ 250” — GAC, julho, p. 12.

**Interpretação humana:** incentivo interno de performance.

**Destino Compra Car:** Ignorar.

**Confidence:** HIGH.

**Observações:** não é benefício do cliente.

### GE-36 — Assinatura

**Trecho encontrado:** “Nissan Move é o serviço oficial ... mensalidades com reajuste anual” — Nissan,
julho, p. 50–56.

**Interpretação humana:** oferta de assinatura, não compra nem preço público do veículo.

**Destino Compra Car:** Ignorar no pipeline de cartas de compra.

**Confidence:** HIGH.

**Observações:** eventual módulo de assinatura exigiria domínio próprio.

### GE-37 — Prazo de entrega

**Trecho encontrado:** “prazo de entrega do produto é de 60 dias” — Leapmotor, julho, p. 3–5.

**Interpretação humana:** informação operacional.

**Destino Compra Car:** Ignorar como entidade; preservar em observação/evidência.

**Confidence:** HIGH.

**Observações:** não altera vigência.

### GE-38 — Quantidade limitada

**Trecho encontrado:** “Sealion 07 ... 100 un.” — BYD, julho, p. 18.

**Interpretação humana:** campanha sujeita a cota.

**Destino Compra Car:** Offer em `REVIEW` com restrição de quantidade.

**Confidence:** MEDIUM.

**Observações:** sem controle de consumo, não publicar como ilimitada.

### GE-39 — Errata

**Trecho encontrado:** “LPC_0026_2026_ERRATA” — Leapmotor, julho, p. 1.

**Interpretação humana:** as correções desse documento prevalecem na mesma vigência/escopo.

**Destino Compra Car:** substituir candidatos conflitantes antes da revisão, preservando ambas as
evidências.

**Confidence:** HIGH.

**Observações:** não apagar histórico da carta anterior.

### GE-40 — Carta complementar sem base no corpus

**Trecho encontrado:** “Conforme citado na DVE_0044_2026” — Fiat, julho, p. 3.

**Interpretação humana:** há dependência de uma carta não presente na pasta.

**Destino Compra Car:** interpretar apenas os valores explícitos da complementar; demais campos em
`REVIEW`.

**Confidence:** LOW/REVIEW.

**Observações:** é proibido reconstruir a carta-base por suposição.

# 10. Regras para futura IA

## 10.1 Regras invioláveis

1. Nunca criar uma Policy que não esteja explícita na carta.
2. Nunca inferir valor monetário, taxa, entrada, prazo, parcela, data ou quantidade.
3. Nunca assumir MMV por semelhança textual ou por imagem do veículo.
4. Nunca aplicar uma campanha de um modelo, versão, MY, cor, pacote, canal ou região a outro.
5. Nunca tratar preço promocional como MSRP quando a carta mantiver PPS/MSRP distinto.
6. Nunca calcular desconto pela diferença entre dois valores se o papel comercial de cada valor não
   estiver claro.
7. Nunca somar rebate/participação da rede ao benefício do cliente.
8. Nunca transformar bônus atacado, Floor Plan, comissão ou premiação interna em Policy.
9. Nunca transformar isenção fiscal legal em benefício da montadora.
10. Nunca interpretar marketing, slogan, exemplo de uso ou sugestão de anúncio como regra suficiente.
11. Nunca combinar Policies separadas por `OU`.
12. Nunca separar Policies ligadas por `E` quando a oferta só é válida em conjunto.
13. Nunca herdar cumulatividade de outra competência.
14. Nunca herdar incentivos entre canais.
15. Nunca ignorar nota de rodapé, tabela-resumo, errata ou carta complementar relevante.
16. Nunca promover plano com balão como financiamento linear.
17. Nunca converter kWh, meses de serviço ou item físico em reais sem valor explícito.
18. Nunca transformar item permanente de série em campanha mensal sem confirmação.
19. Nunca usar `other` para evitar uma decisão de taxonomia.
20. Nunca criar Product ou Product Spec automaticamente por mera menção na carta.
21. Quando houver dúvida material, retornar `REVIEW`.

## 10.2 Procedimento de interpretação humana

1. Identificar documento, fabricante, competência, edição, errata/complementar e vigência geral.
2. Separar blocos por canal e região.
3. Identificar o MMV completo de cada linha: marca, modelo, versão, fabricação/MY e códigos.
4. Vincular toda evidência à página e ao bloco do MMV.
5. Identificar MSRP sem misturá-lo com preço promocional.
6. Extrair cada benefício atômico separadamente.
7. Resolver `E`, `OU`, “adicional”, “ambas”, “não cumulativo” e “somente”.
8. Construir uma Offer por alternativa válida.
9. Aplicar regras de elegibilidade: usado, marca do usado, canal, região, cor, pacote, estoque e datas.
10. Ler a tabela-resumo e todas as regras finais antes de concluir.
11. Aplicar errata/complementar com precedência apenas no escopo declarado.
12. Classificar conteúdo interno/jurídico/visual como Ignorar.
13. Comparar o Product sugerido com o catálogo; múltiplos ou nenhum candidato resultam em `REVIEW`.
14. Comparar a Policy com o catálogo atual; tipo inexistente resulta em `REVIEW`, nunca em aproximação
    silenciosa.
15. Produzir confidence por campo e explicar toda incerteza.

## 10.3 Regras de confidence

- `HIGH` exige evidência textual direta, Product inequívoco, valor/unidade claros e relação `E/OU`
  resolvida.
- `MEDIUM` cabe quando o dado está explícito, mas o destino depende de restrição ou capacidade ainda
  não modelada.
- `LOW` nunca é publicável; deve ser `REVIEW`.
- Confidence do documento não substitui confidence por campo.
- Um único campo crítico `LOW` — Product, preço, vigência, valor, canal ou composição — impede a
  prontidão da Offer.

## 10.4 Regras de vigência

- usar a vigência comercial declarada, não a data de criação do PDF;
- uma janela de pagamento/comprovação não estende a vigência da oferta;
- “até publicação da próxima carta” fica aberta até que a sucessora seja conhecida;
- vigência especial de uma página prevalece apenas para aquele recorte;
- carta posterior não retroage sem texto explícito;
- errata usa sua vigência declarada e não apaga evidência anterior;
- se o início/fim não puder ser atribuído ao MMV, `REVIEW`.

## 10.5 Regras de Offer

- uma Offer pertence a um Product, canal/escopo e intervalo;
- duas opções com Policies iguais mas valores ou elegibilidades diferentes continuam distintas;
- pacote composto deve ser decomposto;
- Policy comum a todas as opções deve aparecer em cada Offer aplicável;
- valor total anunciado não autoriza calcular componente ausente;
- “adicional” indica cumulatividade, salvo regra específica em contrário;
- “uma das condições”, “opções não cumulativas” e `OU` indicam Offers diferentes;
- se a carta mistura `E/OU` de modo ilegível, não tentar otimizar: `REVIEW`.

# 11. Lacunas antes da Sprint 10B

## 11.1 Decisões bloqueadoras de negócio

1. Aprovar se preço “de/por” sempre vira `invoice_discount` ou se alguns “por” são novos preços
   públicos.
2. Definir representação de canal/região/público elegível para evitar publicar condição de VD,
   corporativo, PCD ou regional como varejo nacional.
3. Definir representação de restrições de Trade-In: marca/modelo do usado, FIPE mínima, faixa de valor,
   parentesco e Auto Avaliar.
4. Decidir como modelar quantidade limitada e consumo de cota.
5. Decidir como modelar restrição por cor/pacote sem multiplicar Products indevidamente.
6. Aprovar Policies para primeira parcela paga e carência.
7. Aprovar vouchers de instalação e acessórios.
8. Aprovar tipos para carregador portátil, assistência/carro cortesia, proteção de bateria e recompra
   garantida.
9. Definir quando Wallbox “acompanha o veículo” é Product Spec versus Policy.
10. Definir tratamento de plano com balão e parcela final.
11. Definir se desconto de venda direta/corporativo entra no módulo comercial atual ou permanece fora.
12. Definir como representar campanha “até a próxima carta” antes de existir sucessora.

## 11.2 Decisões de qualidade e revisão

13. Aprovar vocabulário de issue codes para conflito, falta de MMV, canal, período, valor, `E/OU`,
    errata, cota e tipo inexistente.
14. Aprovar escala de confidence e limiares — este guia define semântica, não threshold automático.
15. Definir evidência mínima por Price, Policy e Offer.
16. Definir se exemplos de uso de bônus devem permanecer apenas em observações ou em restrições
    estruturadas.
17. Definir precedência quando tabela detalhada e resumo divergirem sem errata.
18. Definir tratamento de carta complementar quando a carta-base não estiver disponível.
19. Definir identidade de Offers alternativas para impedir deduplicação incorreta.
20. Validar com operação os 40 Golden Examples e ampliar o conjunto quando novas marcas/tipos forem
    incluídos.

## 11.3 Pendências específicas encontradas no corpus

- **PENDENTE:** a carta Fiat complementar depende de `DVE_0044_2026`, ausente da pasta.
- **PENDENTE:** Geely usa referências e contatos Renault em partes do template; confirmar se é herança
  operacional ou erro editorial.
- **PENDENTE:** algumas tabelas Volkswagen e GAC dependem fortemente de layout; confirmar MMVs/valores
  em revisão humana antes de virarem fixtures definitivas.
- **PENDENTE:** confirmar se Wallbox GAC que “acompanha o veículo” é item permanente de série.
- **PENDENTE:** decidir se “bônus na NF” deve ser sempre `invoice_discount` em GWM/Nissan.
- **PENDENTE:** o Pacote Tranquilidade não traz valor individual para vários componentes.
- **PENDENTE:** campanhas Nissan CRM dependem de voucher/score individual e não podem ser
  materializadas como universais.
- **PENDENTE:** condições corporativas Volvo N1/N2 e descontos de volume não cabem no escopo nacional
  atual sem dimensão de canal.
- **PENDENTE:** o corpus inclui referência a campanhas e manuais externos não presentes; este guia não
  os incorporou.

## Fechamento quantitativo

- Cartas realmente analisadas: **19**.
- Páginas lidas: **469**.
- Grupos de fabricantes/marcas encontrados: **11** — Volkswagen, GAC, Geely, BYD, Volvo, GWM,
  Fiat, Leapmotor, Nissan, Jeep e OMODA & JAECOO.
- Tipos distintos de campanhas/benefícios ao cliente catalogados: **27**.
- Padrões reais de composição de Offer catalogados: **36**.
- Golden Examples produzidos: **40**.
- Dúvidas/lacunas de negócio formalizadas: **20 decisões gerais**, além de **9 pendências específicas
  do corpus**.

Este guia é deliberadamente conservador: sua função não é maximizar extração, mas impedir que uma
interpretação plausível se transforme em condição comercial incorreta.
