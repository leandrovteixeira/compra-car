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

Permitir que o vendedor selecione 2 ou 3 versões ativas de veículo e compare rapidamente suas diferenças, vantagens e equipamentos em uma interface mobile, gerando um PDF completo para compartilhamento.

## Natureza do MVP

O MVP não será uma demonstração com poucos veículos fictícios. O catálogo pode conter modelos ativos, mas a unidade efetivamente selecionável e comparável é uma `VehicleVersion` ativa, denominada em linguagem de produto como versão ativa de veículo.

O MVP deverá operar com todas as versões ativas disponíveis no Supabase atual. A aplicação consumirá inicialmente os dados existentes, sem exigir uma nova carga do Excel ou uma reestruturação prévia do banco.

## Escopo do MVP

- aplicação mobile-first;
- funcionamento online;
- leitura do Supabase atual por uma camada de adaptação;
- seleção livre de 2 ou 3 versões ativas de veículo;
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
- Appsmith mantido como backoffice temporário;
- Railway previsto para publicação;
- Next.js previsto para o frontend.

## Escopo condicionado à validação

A comparação de políticas comerciais é desejável, mas não bloqueia o MVP. Sua inclusão depende de:

- auditoria dos dados disponíveis;
- confirmação da vigência de cada política;
- definição das regras de acesso;
- avaliação de confidencialidade;
- autorização para apresentação ao vendedor ou cliente;
- definição do contexto aplicável por concessionária, região ou canal.

O requisito `RF-016` somente será habilitado depois dessas condições. Caso não sejam satisfeitas, o restante do MVP seguirá sem políticas comerciais.

## Sequência inicial de implementação

O Supabase atual já contém os dados necessários para iniciar o MVP. A implementação deve seguir esta sequência:

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

- novo backoffice;
- reconstrução completa do banco;
- pagamentos;
- cadastro público irrestrito;
- inteligência artificial generativa;
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

- **RF-001:** permitir selecionar 2 ou 3 versões ativas de veículo para comparação.
- **RF-002:** impedir o início da comparação com menos de 2 veículos.
- **RF-003:** permitir remover ou substituir qualquer veículo selecionado.
- **RF-004:** impedir a seleção duplicada da mesma versão de veículo.
- **RF-005:** disponibilizar para seleção somente versões de veículo consideradas ativas no catálogo validado.
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
- **RNF-008:** preservar a rastreabilidade da fonte e da atualização dos dados quando possível.
- **RNF-009:** desacoplar a aplicação do banco legado por contratos, serviços e adaptadores.
- **RNF-010:** preferir mudanças pequenas, reversíveis e verificáveis.
- **RNF-011:** produzir logs de erro úteis sem expor segredos ou dados sensíveis.
- **RNF-012:** tratar os estados de disponibilidade dos dados sem perda semântica.
- **RNF-013:** manter regras de vantagem conhecidas, auditáveis e separadas da apresentação.
- **RNF-014:** garantir que o PDF seja produzido a partir de um contrato pronto, sem acesso direto ao banco.

## Critérios de sucesso do MVP

- o vendedor consegue encontrar as versões ativas de veículo relevantes;
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
- **PENDENTE:** regra exata de vantagem.
- **PENDENTE:** escopo das políticas comerciais.
- **PENDENTE:** estratégia de autenticação.
- **PENDENTE:** estratégia de compartilhamento.
- **PENDENTE:** texto jurídico final.
- **PENDENTE:** identidade visual autorizada.
- **PENDENTE:** data da carga mais recente.
- **PENDENTE:** lista de modelos do catálogo e de versões efetivamente ativas.
