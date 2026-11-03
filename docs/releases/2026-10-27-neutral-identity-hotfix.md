# Identidade temporariamente neutra — 27/10/2026

Hotfix baseado em `d681bc57c3fe07673ffc335605e1928ca5b1c0d5` (mesma aplicação da produção `6ab8a86`). Nenhum código da Sprint 24 foi incluído. A branch 24A consultada no início estava em `8043256`; não foi modificada.

Os nomes Compra Car, Carboot e Goboot saem dos textos visíveis, atributos acessíveis, compartilhamento, metadados, manifestação PWA e PDF. A descrição temporária é “Portal automotivo”. Mantidos os quatro squircles exclusivamente no controle do menu mobile e na sidebar, sem palavra ao lado. Ícones de aba e instalação usam pictograma genérico de automóvel; os arquivos originais de ícone são preservados e as três marcas por extenso em SVG saíram da pasta pública para `apps/web/identity-archive/`. Loaders usam apenas o indicador de progresso.

Os domínios Railway atuais ainda contêm `compra-car`. É possível renomear o subdomínio Railway, mas isso troca o endereço já compartilhado e exige revisar URLs de convite e recuperação; um domínio customizado é outra opção. A decisão do novo endereço fica para outra entrega. Nomes de pacotes, rotas de recursos internos, identificadores de banco e históricos Git não são apresentação ao usuário e permanecem intactos. Apps já instalados podem apresentar o nome ou o ícone antigos até que o dispositivo atualize os metadados; a atualização exata depende do navegador.

Validação local: 47 testes focados aprovados (identidade, PDF, navegação, instalação e metadados); typecheck dos 9 pacotes aprovado. Lint geral apresenta 48 avisos antigos e nenhum erro; format check geral aponta 180 arquivos com formatação legada. Teste geral teve 6 falhas antigas no core e 2 timeouts em execução concorrente, com 1.096 aprovados. Build local bloqueado por DNS de `fonts.googleapis.com`; CI `40503372486`: SUCCESS (testes, typecheck e build). Os dois testes que excederam o tempo na execução concorrente passaram quando repetidos isoladamente. Nenhuma migration, alteração de dados, configuração de autenticação ou alteração de worker é necessária. A futura integração da Sprint 24 precisa incluir este hotfix e as correções anteriores de especificações, evitando sobrescrever a apresentação neutra.

## QA publicado

- Commit `3372d3a78b1e45ee5d1b0be4e9e5005feaabdc32`, deployment `84d490c9-9088-4f9a-a38d-37d04488705a`: SUCCESS.
- Homepage e sidebar expandida verificadas no navegador: apenas o ícone temporário, título “Portal automotivo” e texto “Bem-vindo”; labels de acessibilidade neutros.
- Login abre e fecha, com texto neutro. Manifesto usa nome neutro e três ícones `neutral-*`; a antiga URL pública `/carboot/name_logo_official.svg` responde 404.
- QA worker continua no deployment `2bacff64-e223-4101-9f2b-2acc54f6fe80`, mesma fonte; branch Sprint 24 `8043256` não foi alterada.
- A mesma versão foi promovida para produção; banco, variáveis e worker não foram alterados.

## Produção publicada

- Commit de aplicação `3372d3a78b1e45ee5d1b0be4e9e5005feaabdc32`, deployment `38ab4b47-ef68-4d1e-a859-d74d3e279d66`: SUCCESS.
- Home, sidebar expandida e login verificados: título e textos neutros, sem nome antigo visível ou em atributos de acessibilidade inspecionados; os quatro squircles permanecem na navegação.
- Manifesto de instalação e metadados apontam aos ícones neutros; a URL pública do antigo wordmark devolve 404. Healthcheck `/api/health` retornou `{"status":"ok"}`.
- Os serviços web de QA e produção estão fixados no mesmo commit, sem publicação automática de novos pushes. Nenhum conteúdo de QA foi copiado para produção.

## Próxima integração e rollback

A Sprint 24 deve incorporar a branch deste hotfix (que já contém os hotfixes de especificações `cec3c4d` e `6ab8a86`) antes da próxima publicação. Não houve alteração nas branches da sprint ou no worker durante esta entrega.

Para rollback, reconectar o serviço web desejado ao commit anterior `6ab8a8658f1db85014aef21f868cee4525b65633`; não há migration ou mudança de dados a reverter. Os arquivos originais de identidade permanecem preservados no repositório.
