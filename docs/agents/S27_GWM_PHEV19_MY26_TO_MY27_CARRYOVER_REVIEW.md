# Sprint 27 — comparação documental Haval H6 PHEV19 MY2026 × MY2027 Flex

**Data:** 2026-11-03. **Escopo:** 44 specs que estavam sem evidência identificada na ficha oficial MY2027 Flex, produto QA 1166. Nenhuma alteração em QA.

## Fontes primárias

- [PDF oficial GWM MY2026](https://www.gwmmotors.com.br/content/dam/gwm/pages/br/pt/models/haval-h6-phev19-my25/lancamento-/Ficha%20T%C3%A9cnica%20-%20Novo%20Haval%20PHEV19%202026.pdf), explicitamente rotulado **MY'26**.
- [PDF oficial GWM PHEV19 Flex MY2027](https://www.gwmmotors.com.br/content/dam/gwm/pages/br/pt/models/haval-h6-phev19-my25/ficha-tecnica-haval-h6-phev19-flex.pdf).
- Snapshot de QA produto 1166 (MY2027); comparação somente leitura com **duas entradas duplicadas** de MY2026: produtos 1024 e 1107.

## Resultado

- **4/44 encontrados explicitamente no PDF MY2026, sem evidência explicitamente identificada na ficha MY2027:** `CO_0009` (Wi-Fi 4G hotspot, p.4), `SF_0033` (sistema ativo Full Parking Assist, p.3), `EX_0024` (farol de neblina traseiro LED, p.5), `PW_0020` (transmissão de 2 velocidades, p.7; 2027 informa DHAT-1).
- **10/44 com indícios ou contexto indiretos no MY2026**, insuficientes para aprovação do código canônico. Exemplos: CarPlay/Android Auto sem fio **não confirma** `CO_0007` Bluetooth; TCS **não confirma** ESC; 1 motor elétrico dianteiro **não confirma** potência/torque isolados.
- **30/44 também não constam explicitamente no PDF MY2026**; precisam de outras fontes (manual, site, PBEV etc.).
- **44/44 com valores/presenças exatamente iguais em QA entre MY2026 (produtos 1024 e 1107) e MY2027 (1166)**. Isso reforça a **hipótese de carry-over do cadastro**, mas não demonstra a origem de cada valor nem confirma fisicamente que a versão Flex manteve tudo. Não confundir dados iguais no banco com fontes independentes.
- O PDF MY2026 não informa separadamente **150 cv, 229,5 Nm, 177 cv, 299,8 Nm** nem regimes RPM dos motores. Esses campos **não são recuperados** da ficha antiga.
- Não inferir ausência no veículo por ausência na ficha; preservar a regra existente `UNKNOWN = NOT_AVAILABLE` e não alterar `product_specs` neste teste.

## Variações explícitas de MY2026 para Flex MY2027

| Campo | PDF MY2026 | PDF MY2027 Flex |
|---|---|---|
| Combustível motor ICE | Gasolina | Flex |
| Torque combinado | 540 Nm | 535 Nm |
| 0–100 km/h | 7,6 s | 7,4 s |
| Autonomia elétrica Inmetro declarada | 73 km | 77 km |
| Transmissão | 2 velocidades | DHAT-1 |
| Vão livre do solo | 200 mm | 201 mm |
| Ângulo ataque/saída | 22° / 30° | 21° / 28° |
| Wi-Fi hotspot / Full Parking Assist / neblina traseira | Mencionados | Não explicitamente identificados |

**Próxima etapa recomendada:** localizar manual específico do PHEV19 Flex 2026/2027 e página oficial de produto; mapear evidência positiva por código, URL, página, MY, hash; submeter diferenças de equipamento à revisão antes de aplicar. Para powertrain e consumo exigir confirmação específica da versão Flex, não herança cega.
