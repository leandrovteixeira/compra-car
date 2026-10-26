# Correção de especificações e mobile — 26/10/2026

## Isolamento da Sprint 24

Base: `8fb99465982ad3f1e581fc84a684900fe70875a6` (documentação da release de produção `0ea4738`; mesma aplicação). Branch: `fix/specs-mobile-production-20261026`.

Promover somente esta branch/commit para web QA e produção. Não alterar branches Sprint 24, serviço worker, variáveis, schema ou dados. Antes da próxima entrega da Sprint 24, incorporar o commit deste hotfix (`git cherry-pick cec3c4d 6ab8a86` ou merge da branch `origin/fix/specs-mobile-production-20261026`) na worktree da sprint, resolvendo conflitos e executando validação. Não fazer reset/rebase forçado nem publicar a sprint inteira para corrigir UX.

## Diagnóstico dos nomes repetidos

Leitura somente de `public.specs` em QA e produção: mesmos registros ativos e metadados. A comparação mantém cada código de escala como linha independente; o nome genérico `display_pt` ocultava a opção (`detail_pt`). Assim, duas transmissões diferentes apareciam como duas linhas “Transmissão”. Não são registros a apagar. As linhas agora identificam a opção e mostram seu nome completo, sem truncar a opção no mobile, preservando códigos, presença e critérios.

A quantidade visível de repetições depende dos veículos selecionados, pois o repositório carrega somente itens associados aos veículos. Inventário completo dos nomes repetidos nos registros ativos:

| Nome anterior | IDs em specs | Opções / significado |
|---|---|---|
| Largura (mm) | 2, 67 | 2: Width; 67: Tires width |
| Tecnologia de propulsão | 15, 16, 860, 861, 900, 902 | 15: Híbrido plug-in (PHEV); 16: Elétrico (EV); 860: Híbrido leve (MHEV); 861: Híbrido (HEV); 900: Elétrico com extensor (REEV); 902: Combustão (ICE) |
| Turbo | 20, 865, 901 | 20: Turbo com injeção direta; 865: Turbo; 901: Aspirado |
| Tipo do motor à combustão | 22, 869 | 22: Em linha; 869: Em V |
| Transmissão | 32, 874, 875, 876, 903 | 32: Híbrida dedicada (DHT); 874: Manual (MT); 875: Dupla embreagem (DCT); 876: Continuamente variável (CVT); 903: Automática (AT) |
| Tração | 49, 895, 896 | 49: FWD (dianteira); 895: RWD (traseira); 896: AWD (integral) |
| Suspensão traseira | 54, 898 | 54: Multilink independente; 898: McPherson |
| Estepe | 70, 734, 776 | 70: Temporário; 734: Regular; 776: Kit reparo |
| Faróis dianteiros em LED | 75, 736, 779 | 75: Full LED; 736: LED parcial; 779: - |
| Luzes de condução diurna | 82, 742, 774 | 82: LED; 742: Halógenas; 774: - |
| Faróis de neblina traseiros | 93, 751, 780 | 93: LED; 751: Halógenos; 780: - |
| Teto solar | 110, 763, 764, 777 | 110: Elétrico panorâmico; 763: Elétrico; 764: Panorâmico fixo; 777: - |
| Material dos bancos | 119, 781, 782, 784 | 119: Premium sintético; 781: Tecido; 782: Tecido + premium sintético; 784: Couro |
| Ajuste do volante | 157, 814, 816, 848 | 157: Altura e profundidade; 814: Altura; 816: Elétrico de altura e profundidade; 848: Fixo |
| Luzes de leitura | 165, 821, 846 | 165: LED; 821: Halógenas; 846: - |
| Iluminação no porta malas | 168, 823, 847 | 168: LED; 823: Halógena; 847: - |
| Para sol com Iluminação | 171, 825, 849 | 171: LED; 825: Halógena; 849: - |
| Seletor de marcha | 187, 659, 716 | 187: SBW (shift by wire); 659: Na coluna de direção; 716: Regular |
| Sistema de reconhecimento de voz | 191, 663 | 191: Zona única; 663: Multi-zona |
| Carregador de celular por indução | 204, 671, 717 | 204: Duplo; 671: Convencional; 717: - |
| Conexão multimídia (Android Auto / Carplay) | 213, 679, 714 | 213: Sem fio; 679: USB; 714: - |
| Ar-condicionado | 227, 228, 691, 694, 695, 713 | 227: Automático; 228: Duas zonas; 691: Manual; 694: Três zonas; 695: Quatro zonas; 713: - |
| Trava de segurança infantil | 246, 247 | 246: Mecânica; 247: Elétrica |
| Câmera (RVM) | 281, 943, 945, 955 | 281: 360°; 943: Câmera de ré; 945: 540°; 955: - |
| Faróis de neblina dianteiros | 745, 746, 773 | 745: Halógenos; 746: LED; 773: - |
| Tilt down do espelho externo à ré | 758, 759, 775, 778 | 758: Direito; 759: Ambos; 775: Esquerdo; 778: - |
| Tipo de combustível | 904, 905, 906, 907, 908, 909 | 904: Gasolina; 905: Etanol; 906: Flex fuel; 907: Diesel; 908: Hidrogênio; 909: Elétrico |

“Largura (mm)” representa largura do carro (`DM_0002`, id 2) e dos pneus (`EX_0003`, id 67); esta última passa a “Largura dos pneus (mm)”. Em Fichas Técnicas, incluir o nome de exibição na chave de escala impede misturar faróis de neblina dianteiros e traseiros (mesmo `spec_set` em inglês).

## Unidades e dados

Causa: comparação lia unidade canônica, sem aplicar a apresentação pt-BR. Fichas possuíam outro formatador, com precisão inconsistente. Um único formatador agora atende comparação, PDF da comparação e fichas públicas/admin: `inch → pol`, `years → anos`, quatro torques `Nm / 9,80665 → kgfm` com exatamente uma casa, cilindrada `L × 1000 → cc` sem decimais. Não converter novamente entradas já em kgfm/cc e não converter litros de tanque/porta-malas. Valores e unidades de entrada permanecem canônicos no banco; ranking e importações não mudam.

## UX

- Drawer: fechar X, Escape e clique fora removem apenas `auth` pelo History API integrado ao Next; sem aguardar navegação RSC. Veículos e modo permanecem na URL.
- Fichas: margens públicas 20 px; margem admin mobile também 20 px; voltar público corrige destino para `/fichas-tecnicas`.
- Tabela: coluna de rótulos 132 px e versões 120 px no mobile; rolagem horizontal contida, arrasto e touch; rolagem vertical no documento; títulos fixos apenas após atingir o topo usando `ComparisonScrollRegion` compartilhado. Categorias continuam recolhíveis; controles não iniciam arrasto.

## Validação e publicação

- Typecheck: 9 pacotes aprovados.
- Regressões direcionadas: comparação (46), vencedores (7) e mappers (14), 67 testes aprovados.
- Lint direcionado: sem erros; lint geral mantém 51 avisos preexistentes de imagens/hooks (limite do projeto é zero).
- Teste geral: mesmas 6 falhas preexistentes no core, 1.098 aprovados; Turbo interrompe os pacotes dependentes.
- Format check geral: 188 arquivos com formatação legada; arquivos de implementação alterados formatados.
- Build local: bloqueado por resolução/download de fonts.googleapis.com (Inter); publicação depende de build de CI e Railway bem-sucedidos.
- Navegador local: 320/393/768/1440 px aprovados, sem overflow da página, margens 20 px, documento com rolagem vertical, cabeçalho fixo somente ao atingir top=0, arrasto horizontal mobile e categorias recolhíveis. Drawer X/Escape/reabrir aprovados em todas as larguras; clique fora aprovado onde o painel não ocupa toda a tela. Veículos e modo preservados.
- CI GitHub `40385887167`: SUCCESS em `cec3c4d5c5d7b6049f71aa660cc2d137b67325d7`, incluindo build completo.
- Suíte completa adicional do adapter: 131 aprovados, 3 pulados e 6 falhas em mocks antigos (`.not`/`.in` ausentes) de consultas de catálogo/preço, sem alterações nesses caminhos. Os 14 testes de mappers passam.
- Complemento `6ab8a8658f1db85014aef21f868cee4525b65633`: remove truncamento de nomes de escala; lint e typecheck direcionados aprovados. CI final `40387679729`: SUCCESS, incluindo build completo. Não modificar identidades visuais (solicitação anterior adiada).


### QA publicado

- Commit final: `6ab8a8658f1db85014aef21f868cee4525b65633`.
- Railway QA web: `f6b591ad-e2e1-44fe-9105-c1980ea9e233`, SUCCESS.
- Comparação real BMW X1 1187 × BYD Atto 2 1169: nenhuma etiqueta repetida; 2.000/1.500 cc; torque 30,6/12,6 kgfm; rodas 20/17 pol; garantia 2/6 anos; DCT e DHT identificados.
- Drawer fechado pelo X preservando veículos; nenhum login enviado.
- Ficha BYD Dolphin: quatro versões, unidades corretas; região com altura 12.499 px igual à altura total, sem scroll vertical interno. Após PageDown: documento em y=5.934 e cabeçalho flutuante visível em top=0.
- Worker QA permanece na mesma fonte/deployment anterior; branches Sprint 24 não alteradas. Em relação à Sprint 24A `8f31a44`, somente AI_CONTEXT/CHANGELOG se sobrepõem (documentação).

### Produção

- Commit `6ab8a8658f1db85014aef21f868cee4525b65633`, deployment `463b4f87-cdda-4856-bb79-ca2f8eeb5090`: SUCCESS.
- URL: https://compra-carweb-production.up.railway.app . `/api/health`: `{"status":"ok"}`.
- Comparação real 1187 × 1169: nenhuma etiqueta repetida; torque 30,6/12,6 kgfm; motor elétrico 33,0 kgfm; cilindrada 2.000/1.500 cc; garantia 2/6 anos; rodas 20/17 pol.
- Login abriu e fechou pelo X, mantendo `vehicles=1187,1169` na URL.
- Ficha Dolphin: quatro versões, torque e unidades pt-BR corretos; sem scroll vertical interno (altura igual ao conteúdo, 12.499 px). Cabeçalho flutuante visível em top=0 após rolagem do documento; botão voltar retorna a `/fichas-tecnicas`, sem enviar visitante à área admin.
- Banco, variáveis, permissões e agentes sem alterações. Nenhum dado de QA foi copiado. Somente SELECTs no Supabase nesta entrega.
- QA e produção fixados no mesmo commit final, sem publicação automática de novos pushes. Identidades visuais preservadas conforme orientação anterior.

### Amostra da comparação 1187 × 1169 (consulta somente leitura em produção)

| Nome repetido antes | IDs em specs presentes na comparação | Significados |
|---|---|---|
| Largura (mm) | 2, 67 | Veículo / pneus |
| Material dos bancos | 119, 781 | Premium sintético / tecido |
| Sistema de reconhecimento de voz | 191, 663 | Zona única / multizona |
| Transmissão | 32, 875 | DHT / DCT |
| Trava de segurança infantil | 246, 247 | Mecânica / elétrica |

A consulta não alterou registros. No QA publicado, todas essas linhas já têm nomes distintos. Confirmado também que opções longas de reconhecimento de voz estão sem line-clamp no commit final.

## Rollback e incorporação à Sprint 24

Rollback de código, sem rollback de banco: reconectar o serviço web QA ao commit anterior `59444884bc69763d72b761d4472c687b53287f0d` (deployment anterior `ceb525da-8c66-48eb-a3d1-76dd7d783dd8`) ou produção ao `0ea47383d94be55f4273c48ff3687126eaa285a2` (deployment anterior `fabe508e-9f1d-42e2-8650-1ef3caafc871`). Nenhuma migration faz parte deste hotfix.

Antes da próxima publicação da Sprint 24, incorporar **os dois commits** de aplicação (`cec3c4d` e `6ab8a86`), ou fazer merge de `origin/fix/specs-mobile-production-20261026`. Incorporar apenas `6ab8a86` via cherry-pick levaria somente o complemento de quebra de linha. Conciliar AI_CONTEXT/CHANGELOG sem apagar o histórico da sprint. Nenhuma branch da Sprint 24 foi modificada por esta entrega.
