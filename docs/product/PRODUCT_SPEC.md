# Especificação do Produto

## Nome provisório

Compra Car.

## Visão do produto

Uma ferramenta de apoio a vendedores de concessionárias para conhecer produtos, comparar veículos rapidamente na loja e apresentar vantagens ao cliente.

## Público-alvo principal

Vendedores de concessionárias.

## Público piloto

Grupo pequeno de vendedores de uma marca específica, ainda não identificada oficialmente na documentação.

**PENDENTE:** confirmar a marca e os participantes do piloto.

## Problema resolvido

- dificuldade de memorizar equipamentos e diferenças entre versões;
- demora para comparar produtos durante o atendimento;
- dificuldade para transformar especificações técnicas em argumentos de venda;
- risco de usar informações desatualizadas;
- dificuldade para compartilhar uma comparação organizada com o cliente.

## Proposta de valor

Permitir que o vendedor selecione 2 ou mais veículos elegíveis e compare rapidamente suas diferenças, vantagens e equipamentos em uma interface mobile, gerando um PDF completo para compartilhamento.

## Natureza do MVP

O MVP não será uma demonstração com poucos veículos fictícios. A unidade selecionável e comparável é `Vehicle`: uma combinação comercial específica de marca, modelo, versão, ano-modelo e ano de produção.

O catálogo público apresentará veículos ativos, revisados para publicação e com pelo menos um item comparável com valor válido conforme a semântica confirmada de `product_specs`. O MVP deverá operar sobre os dados disponíveis no Supabase atual, sem exigir uma nova carga do Excel ou uma reestruturação prévia do banco.

## Escopo do MVP

- aplicação mobile-first;
- funcionamento online;
- leitura do Supabase atual por uma camada de adaptação;
- seleção livre de 2 ou mais veículos ativos, públicos e comparáveis;
- pesquisa e filtros para localizar veículos;
- comparação mostrando apenas diferenças;
- opção para mostrar todos os itens;
- opção para mostrar apenas vantagens;
- comparação de equipamentos;
- comparação das especificações técnicas disponíveis;
- comparação dos preços disponíveis;
- geração de PDF completo;
- compartilhamento do PDF;
- aviso legal na interface e no PDF;
- identidade visual flexível por marca;
- Appsmith adotado como tecnologia do backoffice administrativo da Fase 1;
- Railway previsto para publicação;
- Next.js como frontend do MVP, com seleção e comparação técnica já implementadas.

## Escopo condicionado à validação

A comparação de políticas comerciais é desejável, mas não bloqueia o MVP. Sua inclusão depende de:

- auditoria dos dados disponíveis;
- confirmação da vigência de cada política;
- definição das regras de acesso;
- avaliação de confidencialidade;
- autorização para apresentação ao vendedor ou cliente;
- definição do contexto aplicável por concessionária, região ou canal.

O requisito `RF-016` somente será habilitado depois dessas condições. Caso não sejam satisfeitas, o restante do MVP seguirá sem políticas comerciais.

## Backoffice administrativo

O backoffice é um módulo interno separado da experiência pública. Sua Fase 1 cobre manutenção de veículos, preços e políticas em grade e comparação administrativa, sem alteração de schema. Appsmith é a tecnologia escolhida atualmente, mas as regras pertencem ao domínio administrativo descrito em `docs/admin`.

O comparador administrativo não aplica vencedor, perdedor ou vantagem visual. Ele usa um veículo de referência, múltiplos comparados, todos os specs e os indicadores financeiros aprovados. Essa decisão não altera o comparador público atual, que continua limitado aos contratos já implementados.

A Fase 2 prevê importações assistidas por IA para cartas comerciais e fichas técnicas, sempre por staging, revisão humana e promoção controlada. A IA nunca grava diretamente nas tabelas definitivas.

## Sequência inicial de implementação

Esta foi a sequência originalmente definida para iniciar o MVP. A inspeção mínima, o mapeamento do adaptador e a implementação inicial da UI já foram executados; as validações com dados reais, a conclusão do MVP e o piloto permanecem pendentes. A sequência técnica original é preservada:

```text
inspeção mínima do Supabase atual
→ mapeamento do adaptador legado
→ validação dos contratos com dados reais existentes
→ implementação da UI
→ MVP e piloto
```

A inspeção mínima cobre somente o schema e os dados existentes na superfície usada pelo MVP. Nenhuma alteração estrutural ampla do banco e nenhuma nova carga do Excel são pré-requisitos para implementar a UI, concluir o MVP ou iniciar o piloto. A auditoria completa permanece planejada para depois do MVP.

O frontend continuará isolado do legado por contratos normalizados e pelo Legacy Supabase Adapter.

## Evolução posterior ao MVP

Depois do MVP e do piloto, o importador Excel será ajustado para respeitar a estrutura vigente do Supabase atual. Nesse momento poderão ocorrer gradualmente:

- correções de dados;
- normalizações;
- melhorias arquiteturais;
- evolução do importador;
- cargas posteriores controladas;
- eventual migração para uma estrutura Supabase V2.

Essas evoluções não devem acoplar o frontend ao modelo legado nem bloquear a entrega inicial.

## Fora do escopo inicial

- reconstrução completa do banco;
- pagamentos;
- cadastro público irrestrito;
- importação por IA na Fase 1;
- recomendações automáticas complexas;
- múltiplos idiomas;
- histórico completo de preços;
- aplicativo nativo para iOS ou Android;
- integração automática contínua com Excel;
- gestão completa de usuários e permissões.

## Fluxo principal

1. O vendedor acessa o sistema.
2. O vendedor identifica ou recebe o tema da sua marca.
3. O vendedor localiza o primeiro veículo.
4. O vendedor localiza o segundo veículo.
5. O vendedor opcionalmente adiciona um terceiro veículo.
6. O vendedor abre a comparação.
7. O sistema exibe apenas as diferenças.
8. O vendedor pode alternar para mostrar todos os itens.
9. O vendedor pode alternar para mostrar apenas vantagens.
10. O vendedor gera o PDF.
11. O vendedor compartilha o PDF com o cliente.

## Requisitos funcionais

- **RF-001:** permitir selecionar 2 ou mais veículos elegíveis para comparação.
- **RF-002:** impedir o início da comparação com menos de 2 veículos.
- **RF-003:** permitir remover ou substituir qualquer veículo selecionado.
- **RF-004:** impedir a seleção duplicada da mesma versão de veículo.
- **RF-005:** disponibilizar para seleção somente veículos com `isActive = true`, `isPublic = true` e pelo menos um item comparável com valor válido conforme a semântica confirmada de `product_specs`.
- **RF-006:** permitir pesquisa por marca, modelo, versão e ano.
- **RF-007:** permitir filtros combináveis para localizar veículos. As combinações exatas estão **PENDENTE**.
- **RF-008:** mostrar somente diferenças por padrão ao abrir a comparação.
- **RF-009:** permitir alternar a comparação para mostrar todos os itens.
- **RF-010:** permitir alternar a comparação para mostrar somente vantagens.
- **RF-011:** manter diferença e vantagem como conceitos distintos.
- **RF-012:** indicar dados ausentes por estado explícito, sem tratá-los automaticamente como ausência do equipamento.
- **RF-013:** apresentar os equipamentos disponíveis para comparação.
- **RF-014:** apresentar as especificações técnicas disponíveis para comparação.
- **RF-015:** apresentar os preços disponíveis com sua data de referência.
- **RF-016:** apresentar políticas comerciais quando os dados e a viabilidade técnica forem confirmados.
- **RF-017:** gerar um PDF completo da comparação selecionada.
- **RF-018:** incluir no PDF a data e a hora de geração.
- **RF-019:** incluir o aviso legal vigente no PDF.
- **RF-020:** permitir visualizar o PDF gerado.
- **RF-021:** permitir compartilhar o PDF por mecanismo compatível com o dispositivo. A estratégia está **PENDENTE**.
- **RF-022:** mostrar estado de carregamento durante operações assíncronas.
- **RF-023:** mostrar mensagem de erro compreensível e uma ação de recuperação quando aplicável.
- **RF-024:** funcionar nas telas mobile definidas para o MVP. As dimensões mínimas suportadas estão **PENDENTE**.
- **RF-025:** adaptar o tema por marca sem sugerir que o aplicativo é oficial quando não houver autorização.
- **RF-026:** informar quando uma versão de veículo selecionada foi removida do catálogo ou tornou-se inativa antes da comparação.
- **RF-027:** informar a atualização e a qualidade dos dados quando essas informações estiverem disponíveis.
- **RF-028:** registrar no resultado da comparação e no PDF, quando disponíveis, a referência da carga ou snapshot utilizado, a data de atualização e a fonte, com aviso quando categorias tiverem datas de referência distintas.

## Requisitos não funcionais

- **RNF-001:** adotar mobile-first como princípio de interface e validação.
- **RNF-002:** oferecer performance aceitável em conexão móvel. Metas numéricas estão **PENDENTE**.
- **RNF-003:** manter chaves e segredos fora do código cliente e do repositório.
- **RNF-004:** nunca expor uma chave `service role` no navegador.
- **RNF-005:** revisar o RLS de toda superfície de dados utilizada pelo MVP antes da publicação.
- **RNF-006:** atender critérios básicos de acessibilidade, incluindo navegação, foco, contraste e rótulos claros.
- **RNF-007:** privilegiar clareza visual e leitura rápida durante o atendimento.
- **RNF-008:** exigir login em toda a aplicação, exceto nos fluxos públicos de autenticação planejados.
- **RNF-009:** preservar a rastreabilidade da fonte e da atualização dos dados quando possível.
- **RNF-010:** desacoplar a aplicação do banco legado por contratos, serviços e adaptadores.
- **RNF-011:** preferir mudanças pequenas, reversíveis e verificáveis.
- **RNF-012:** produzir logs de erro úteis sem expor segredos ou dados sensíveis.
- **RNF-013:** tratar os estados de disponibilidade dos dados sem perda semântica.
- **RNF-014:** manter regras de vantagem conhecidas, auditáveis e separadas da apresentação.
- **RNF-015:** garantir que o PDF seja produzido a partir de um contrato pronto, sem acesso direto ao banco.

## Autenticação e gestão de acesso planejadas

A arquitetura aprovada exige convite fechado e exatamente os papéis `admin` e `vendedor`. Todo novo usuário nasce como `vendedor`/`pending`; ao aceitar o convite e definir a senha passa a `active`; uma desativação administrativa passa a `disabled`; uma reativação retorna a `active`. Nenhum usuário se torna admin automaticamente, e o primeiro admin será promovido por operação manual, explícita e documentada.

`profiles` é a fonte de autorização. `user_metadata` não é confiável para privilégios. O Middleware somente lê ou atualiza sessão e redireciona, sem consultar o banco; autorização ocorre no servidor e no banco. Operações com Service Role exigem validação explícita antes da execução, e RLS não é a única barreira administrativa.

MFA não integra esta sprint: será obrigatório para admin em fase posterior e não obrigatório para vendedor no MVP. A futura `audit_log` registrará eventos críticos do ciclo de usuários, mas também não será implementada nesta fase.

## Critérios de sucesso do MVP

- o vendedor consegue encontrar os veículos elegíveis relevantes;
- o vendedor conclui uma comparação sem ajuda;
- a comparação abre em tempo aceitável, conforme meta **PENDENTE**;
- o filtro de diferenças funciona conforme a comparação semântica definida;
- o filtro de vantagens funciona conforme regras auditáveis;
- o PDF é gerado corretamente;
- o PDF pode ser compartilhado;
- os dados exibidos correspondem aos dados disponibilizados pelo Supabase atual;
- nenhum dado sensível é exposto;
- o grupo piloto consegue usar a aplicação em atendimento real.

## Métricas iniciais

As metas, a forma de coleta, a retenção e os responsáveis por estas métricas estão **PENDENTE**:

- número de comparações iniciadas e concluídas;
- número de PDFs gerados e compartilhados;
- veículos mais comparados;
- tempo médio para iniciar uma comparação;
- tempo médio de carregamento da comparação;
- taxa de erro por etapa do fluxo;
- feedback qualitativo dos vendedores do piloto.

## Aviso legal provisório

> **PENDENTE — texto sujeito a revisão jurídica:** As informações apresentadas possuem finalidade informativa e de apoio técnico à comparação entre veículos. Especificações, equipamentos, versões, preços e políticas comerciais podem ser alterados pelos fabricantes sem aviso prévio. Consulte sempre a documentação oficial da montadora. Esta aplicação é independente e não constitui material oficial de qualquer fabricante, salvo quando expressamente autorizado.

## Riscos

- dados desatualizados;
- inconsistências do banco legado;
- traduções incompletas;
- interpretação errada de vantagem;
- confusão com uma aplicação oficial;
- uso indevido de identidade visual;
- geração de PDF com dados incompletos;
- mudanças no schema atual;
- ajustes ou cargas posteriores do Excel com erros;
- exposição indevida de dados;
- desempenho insuficiente ao consultar todas as versões ativas do catálogo;
- regras divergentes entre a aplicação e o backoffice temporário;
- considerar uma versão existente historicamente como versão comercialmente ativa;
- divergência entre a atividade do registro e a disponibilidade real no mercado.

## Pendências

- **PENDENTE:** nome definitivo.
- **PENDENTE:** marca piloto.
- A regra de vantagem do MVP cobre `binary` e `numeric`; pesos, score e ranking `scale` permanecem pendentes.
- **PENDENTE:** escopo das políticas comerciais.
- A arquitetura de autenticação está aprovada em `docs/architecture/AUTHENTICATION_ARCHITECTURE.md`, incluindo ciclo de status, bootstrap manual do primeiro admin, MFA e auditoria futuros; sua implementação permanece pendente.
- **PENDENTE:** estratégia de compartilhamento.
- **PENDENTE:** texto jurídico final.
- **PENDENTE:** identidade visual autorizada.
- **PENDENTE:** data da carga mais recente.
- **PENDENTE:** lista de modelos do catálogo e de versões efetivamente ativas.
- **PENDENTE:** objetos e permissões reais do Supabase e do Appsmith necessários ao backoffice.
- **PENDENTE:** efeito de `product_specs.is_present = false` sobre presença, validade e comparabilidade.
