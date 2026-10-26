# Correção de especificações e mobile — 26/10/2026

## Isolamento da Sprint 24

Base: `8fb99465982ad3f1e581fc84a684900fe70875a6` (documentação da release de produção `0ea4738`; mesma aplicação). Branch: `fix/specs-mobile-production-20261026`.

Promover somente esta branch/commit para web QA e produção. Não alterar branches Sprint 24, serviço worker, variáveis, schema ou dados. Antes da próxima entrega da Sprint 24, incorporar o commit deste hotfix (`git cherry-pick <commit>` ou merge da branch) na worktree da sprint, resolvendo conflitos e executando validação. Não fazer reset/rebase forçado nem publicar a sprint inteira para corrigir UX.

## Diagnóstico dos nomes repetidos

Leitura somente de `public.specs` em QA e produção: mesmos registros ativos e metadados. A comparação mantém cada código de escala como linha independente; o nome genérico `display_pt` ocultava a opção (`detail_pt`). Assim, duas transmissões diferentes apareciam como duas linhas “Transmissão”. Não são registros a apagar. As linhas agora identificam a opção, preservando códigos, presença e critérios.

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
- Validação visual e publicação em andamento. Não modificar identidades visuais (solicitação anterior adiada).

