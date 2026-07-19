# Fluxo de Interface Mobile-first

Este documento define o fluxo conceitual do MVP. Componentes, rotas, medidas e identidade visual finais estão **PENDENTE** e serão detalhados antes da implementação.

## Tela 1 — Entrada

### Objetivo

Apresentar o produto, contextualizar a experiência da marca e oferecer uma entrada clara para a comparação.

### Elementos

- identidade do produto;
- marca ou tema aplicável;
- aviso de independência em relação a fabricantes, salvo autorização expressa;
- botão principal para iniciar comparação;
- **PENDENTE:** acesso ou identificação do usuário.

### Ações

- iniciar uma nova comparação;
- prosseguir para autenticação, caso ela seja exigida;
- consultar o aviso de independência e informações essenciais.

### Validações

- carregar apenas um tema válido ou o tema neutro de fallback;
- não exibir identidade de marca como oficial sem autorização registrada;
- impedir avanço quando uma autenticação obrigatória estiver incompleta.

### Estados

- carregando configuração;
- pronta para iniciar;
- tema indisponível com fallback neutro;
- falha de configuração;
- **PENDENTE:** autenticado, não autenticado ou acesso controlado por outro mecanismo.

### Comportamento mobile

- conteúdo principal visível sem rolagem excessiva;
- ação principal grande e alcançável com uma mão;
- aviso legível, sem competir com a ação principal;
- adaptação segura a orientação e áreas reservadas do dispositivo.

### Pendências

- **PENDENTE:** autenticação;
- **PENDENTE:** nome, logo e tema autorizados;
- **PENDENTE:** conteúdo e posição finais do aviso de independência.

## Tela 2 — Seleção de veículos

### Objetivo

Permitir localizar e selecionar 2 veículos obrigatórios e, opcionalmente, um terceiro, usando somente veículos elegíveis ao catálogo público.

### Elementos

- busca textual direta por marca, modelo, versão ou ano;
- seleção progressiva por `Marca → Modelo → Versão/Ano`;
- filtros opcionais por marca, modelo, versão e ano;
- indicação de que somente veículos ativos, publicados e comparáveis são apresentados;
- resultados com identificação suficiente para distinguir versões;
- resumo dos veículos selecionados;
- controles para remover ou substituir cada seleção;
- espaço opcional para o terceiro veículo;
- botão `Comparar`;
- mensagens de validação e qualidade dos dados.

### Ações

- pesquisar diretamente por texto;
- navegar pela seleção progressiva;
- combinar filtros opcionais sem precisar preencher todos eles;
- selecionar um resultado;
- adicionar o terceiro veículo;
- remover ou substituir um veículo;
- limpar busca ou filtros;
- iniciar a comparação.

### Validações

- exigir pelo menos 2 veículos para comparar;
- impedir seleção duplicada da mesma versão;
- aceitar apenas veículos com `isActive` e `isPublic` verdadeiros e ao menos um item comparável;
- revalidar atividade antes de iniciar a comparação;
- indicar quando não houver dados suficientes para identificar uma opção;
- não interpretar informação ausente como ausência de equipamento.
- não exigir o preenchimento de todos os filtros para pesquisar ou selecionar uma versão.

### Estados

- carregamento inicial;
- busca em andamento;
- resultados disponíveis;
- nenhum resultado;
- filtros sem correspondência;
- qualquer quantidade de veículos selecionados;
- erro de conexão;
- versão de veículo removida do catálogo ou tornada inativa;
- dados incompletos ou conflitantes.

### Comportamento mobile

- filtros apresentados de forma progressiva ou recolhível;
- busca direta e seleção progressiva disponíveis como caminhos complementares;
- seleção atual permanece visível sem ocupar toda a tela;
- alvos de toque grandes e espaçados;
- busca com pouca digitação e feedback imediato;
- botão `Comparar` acessível, mas desabilitado até a seleção ser válida.

### Pendências

- **PENDENTE:** ordenação e paginação dos resultados;
- **PENDENTE:** comportamento exato dos filtros combinados;
- **PENDENTE:** campos e imagens exibidos em cada opção;
- **PENDENTE:** forma visual para três veículos em telas estreitas.

## Tela 3 — Comparação simplificada

### Objetivo

Apresentar rapidamente diferenças e vantagens entre os veículos selecionados, preservando o significado e a qualidade de cada dado.

### Elementos

- cabeçalho com todos os veículos selecionados;
- modo `Diferenças` selecionado por padrão;
- botão ou controle `Mostrar tudo`;
- botão ou controle `Mostrar só vantagens`;
- categorias expansíveis;
- indicação clara e não exclusivamente cromática de vantagem;
- indicação clara de dado ausente, não aplicável, desatualizado ou conflitante;
- seção de preços com data de referência;
- seção de equipamentos;
- seção de especificações;
- seção de políticas comerciais, quando disponível e autorizada;
- informação de atualização dos dados quando possível;
- botão `Gerar PDF`;
- botão `Alterar seleção`;
- acesso ao aviso legal.

### Ações

- alternar entre diferenças, todos os itens e vantagens;
- expandir ou recolher categorias;
- consultar explicação de estado ou vantagem;
- retornar e trocar veículos;
- iniciar a geração do PDF.

### Validações

- confirmar que existem pelo menos 2 versões distintas no resultado;
- garantir um valor ou estado explícito por veículo em cada item;
- mostrar vantagem somente quando houver regra conhecida e auditável;
- não classificar ausência de dado como desvantagem;
- manter diferença e vantagem como propriedades separadas;
- preservar a ordem dos veículos selecionados.

### Estados

- carregando comparação;
- comparação disponível;
- categoria expandida ou recolhida;
- nenhum item no modo selecionado;
- dados incompletos;
- dados desatualizados ou conflitantes;
- erro recuperável;
- versão de veículo removida do catálogo ou inativa após a seleção.

### Comportamento mobile

- evitar tabelas horizontais extensas;
- usar cartões, colunas compactas ou outro padrão validado para comparar sem perder contexto;
- permitir categorias recolhíveis;
- manter identificação dos veículos visível apenas se não reduzir excessivamente a área útil;
- garantir leitura e ações principais com uma mão;
- não depender de gestos ocultos para funções essenciais.

### Pendências

- **PENDENTE:** regra e representação exata de vantagem;
- **PENDENTE:** estrutura visual definitiva para 3 veículos;
- **PENDENTE:** categorias, ordem e expansão inicial;
- **PENDENTE:** política de arredondamento, unidades e equivalência;
- **PENDENTE:** viabilidade e exposição das políticas comerciais.

## Fluxo 4 — Geração e compartilhamento de PDF

No MVP, a geração de PDF não precisa ser uma rota ou tela separada. Ela pode ser implementada como modal, painel inferior ou estado incorporado à tela de comparação, preservando o contexto e os veículos selecionados.

Uma tela ou rota independente permanece como evolução futura caso sejam necessários personalização do relatório, escolha de seções, dados do cliente, histórico ou vários modelos de documento.

### Objetivo

Confirmar a comparação, gerar um PDF completo e permitir visualização e compartilhamento com feedback claro, sem exigir saída da comparação.

### Elementos

- resumo dos veículos incluídos;
- modal, painel inferior ou região incorporada à comparação;
- indicação do conteúdo completo que será gerado;
- ação para gerar o PDF;
- indicador de progresso;
- mensagem de sucesso;
- mensagem de erro e opção de tentar novamente;
- botão `Visualizar`;
- botão `Compartilhar`;
- aviso legal que será incluído;
- data e hora de geração.

### Ações

- confirmar e gerar;
- fechar ou recolher o fluxo antes da geração, permanecendo na comparação;
- tentar novamente após falha;
- visualizar o arquivo concluído;
- compartilhar por mecanismo disponível no dispositivo;
- fechar o fluxo sem perder a seleção ou o estado da comparação.

### Validações

- receber um contrato de comparação pronto, sem consulta direta ao banco pelo gerador;
- garantir que o PDF reflita exatamente os veículos selecionados;
- incluir data, hora e aviso legal;
- representar dados ausentes e de qualidade sem inferência indevida;
- impedir múltiplas gerações acidentais enquanto uma solicitação estiver em andamento.

### Estados

- pronto para gerar;
- gerando;
- gerado com sucesso;
- visualizando;
- compartilhamento disponível ou indisponível;
- falha de geração;
- falha de compartilhamento;
- resultado expirado, caso exista validade definida.

### Comportamento mobile

- progresso e resultado visíveis sem rolagem desnecessária;
- ações principais grandes e claramente ordenadas;
- compartilhamento usa capacidade compatível com o dispositivo, com fallback **PENDENTE**;
- fechamento do modal, painel ou estado incorporado não descarta seleção ou comparação durante a sessão.

### Pendências

- **PENDENTE:** estratégia técnica de geração;
- **PENDENTE:** escolher entre modal, painel inferior ou estado incorporado;
- **PENDENTE:** formato, layout e paginação do documento;
- **PENDENTE:** estratégia e fallback de compartilhamento;
- **PENDENTE:** armazenamento, validade e descarte do arquivo;
- **PENDENTE:** texto jurídico final.

## Tela 5 — Estados especiais

### Objetivo

Oferecer respostas consistentes para situações que interrompem ou limitam o fluxo principal.

### Elementos

- indicador de carregamento com contexto;
- mensagem de ausência de resultados;
- mensagem de erro de conexão;
- alerta de dados incompletos;
- alerta de versão de veículo removida do catálogo ou inativa;
- mensagem de falha no PDF;
- ação principal de recuperação;
- suporte ou referência adicional quando aplicável.

### Ações

- tentar novamente;
- revisar busca e filtros;
- trocar veículo inválido;
- retornar à comparação;
- repetir geração ou compartilhamento do PDF;
- cancelar uma operação quando tecnicamente possível.

### Validações

- mensagens não devem expor detalhes internos, segredos ou dados sensíveis;
- cada erro recuperável deve oferecer uma ação coerente;
- dados incompletos devem manter seus estados sem serem convertidos em ausência;
- versão de veículo inativa não pode seguir para uma nova comparação;
- uma falha de PDF não deve apagar a seleção válida.

### Estados

- carregando;
- sem resultados;
- erro de conexão;
- dados incompletos;
- dado desatualizado;
- dado conflitante;
- versão de veículo removida do catálogo ou inativa;
- falha na comparação;
- falha na geração ou no compartilhamento do PDF.

### Comportamento mobile

- mensagens curtas, diretas e próximas do contexto afetado;
- ações de recuperação alcançáveis com uma mão;
- progresso não depende apenas de animação;
- alertas não bloqueiam toda a experiência quando uma recuperação local for possível.

### Pendências

- **PENDENTE:** catálogo final de mensagens;
- **PENDENTE:** critérios de repetição automática;
- **PENDENTE:** canais de suporte e identificadores de incidente;
- **PENDENTE:** comportamento offline, que não faz parte do escopo atual.

## Regras de navegação

- Não permitir comparação com menos de 2 veículos.
- Permitir retorno sem perder a seleção.
- Permitir trocar qualquer veículo selecionado.
- Preservar o estado durante a sessão.
- Impedir duplicação do mesmo veículo.
- Tratar o terceiro veículo como opcional.
- Garantir que o PDF reflita exatamente os veículos selecionados.
- O modo visual da tela não deve necessariamente limitar o conteúdo completo do PDF.
- Revalidar atividade, publicação e comparabilidade dos veículos antes de produzir a comparação.
- Não descartar uma seleção válida em caso de falha recuperável.
- O comportamento de atualização, recarga e expiração da sessão está **PENDENTE**.

## Princípios de UX

- permitir uso com uma mão;
- usar botões e alvos de toque grandes;
- favorecer leitura rápida;
- exigir pouca digitação;
- manter contraste adequado;
- usar linguagem direta;
- evitar tabelas horizontais extensas no mobile;
- usar categorias recolhíveis;
- manter cabeçalho fixo apenas se não prejudicar a área útil;
- não depender apenas de cor para indicar vantagem;
- oferecer feedback imediato;
- evitar excesso de informação;
- preservar contexto ao retornar entre telas;
- explicar estados de dados sem jargão técnico desnecessário.

## Wireframes textuais

### Seleção

```text
┌──────────────────────────────┐
│ Compra Car        [Tema]     │
├──────────────────────────────┤
│ Buscar marca, modelo...      │
│ [Marca] [Modelo] [Ano]       │
├──────────────────────────────┤
│ Selecionados:                │
│ 1. Veículo A       [Trocar]  │
│ 2. Veículo B       [Trocar]  │
│ 3. Adicionar opcional        │
├──────────────────────────────┤
│ Resultados ativos            │
│ [Versão / ano]    [Adicionar]│
│ [Versão / ano]    [Adicionar]│
├──────────────────────────────┤
│          [Comparar]          │
└──────────────────────────────┘
```

### Comparação

```text
┌──────────────────────────────┐
│ Veículo A │ Veículo B │ (C) │
├──────────────────────────────┤
│ [Diferenças] [Tudo] [Vant.]  │
├──────────────────────────────┤
│ ▾ Preços                     │
│ Item       A       B      (C)│
│ ▸ Equipamentos               │
│ ▸ Especificações             │
│ ▸ Políticas, se disponíveis  │
├──────────────────────────────┤
│ [Alterar]       [Gerar PDF]  │
└──────────────────────────────┘
```

Uma vantagem deverá usar ícone, texto ou outro sinal além de cor. O arranjo para três veículos é **PENDENTE** de validação.

### Geração de PDF associada à comparação

```text
┌──────────────────────────────┐
│ Comparação A × B × (C)        │
│ ...categorias e itens...      │
├──────────────────────────────┤
│ MODAL / PAINEL DE PDF    [×]  │
│ Veículos selecionados        │
│ Conteúdo completo             │
│ Data, hora e aviso legal      │
│ [Gerar PDF]                  │
│ Progresso / sucesso / erro    │
│ [Visualizar] [Compartilhar]  │
└──────────────────────────────┘
```

## Pendências

- **PENDENTE:** logo.
- **PENDENTE:** nome final.
- **PENDENTE:** paleta.
- **PENDENTE:** tipografia.
- **PENDENTE:** autenticação.
- **PENDENTE:** regras de vantagem.
- **PENDENTE:** compartilhamento.
- **PENDENTE:** estrutura visual para 3 veículos.
- **PENDENTE:** ordenação das categorias.
- **PENDENTE:** dimensões mínimas suportadas e critérios de acessibilidade verificáveis.
