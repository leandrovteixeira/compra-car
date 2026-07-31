# Sprint 9G — Gestão de políticas e combinações

## Objetivo

Consolidar a operação administrativa por veículo em um workspace único para criar, consultar e
administrar Policies e combinações, preservando o banco como fonte da verdade.

## Lifecycle aprovado

- Policy `draft`: editável e arquivável quando não estiver em uso por Offer não arquivada.
- Policy `published`: economicamente imutável e somente arquivável quando não estiver em uso.
- Policy `archived`: somente leitura.
- Offer `draft`: memberships substituíveis atomicamente e registro arquivável.
- Offer `published`: imutável e arquivável.
- Offer `archived`: somente leitura; memberships preservidas para histórico.
- Não há DELETE físico nem supersession na Sprint 9G.

## RPCs administrativas

- `update_commercial_policy_draft`;
- `archive_commercial_policy`;
- `replace_commercial_offer_draft`;
- `archive_commercial_offer`.

Todas exigem ator administrativo, correlation ID e `expected_lock_version`. As mutações registram
snapshots não sensíveis em `pricing_audit_events`; a substituição de Offer rederiva MSRP, vigência e
benefício e troca memberships na mesma transação.

## Workspace

- um seletor de Product fornece o contexto de Marca, Modelo, Versão, MY e PY;
- veículo sem dados recebe formulário vazio, sem erro;
- Policies e Offers existentes são carregadas do banco e filtradas pelo Product selecionado;
- Policies em uso identificam as combinações dependentes;
- no máximo 10 novas Policies podem ser enviadas por vez, sem ocultar registros existentes;
- combinação usa somente Policies persistidas e elegíveis;
- troca de veículo com alterações locais pede confirmação;
- após mutações, Server Actions revalidam a rota e a UI relê o banco.

## Próxima etapa

Importação assistida por IA: documento → extração → staging/revisão → aprovação humana →
persistência. Nenhuma extração por IA integra a Sprint 9G.

## Implantação e validação

A migration foi aplicada exclusivamente ao Staging `shfsjyjxmgwnlexmdkcs`, sob a versão remota
`20260731172651`. O teste pgTAP 016 executou 16 asserções em transação revertida. A consulta de
resíduos confirmou zero usuário, Product, Policy, Offer e evento de auditoria de fixture. Produção
não foi acessada e `Legacy` não foi alterado.

## Estabilização 9G.1

- `onDirty` é disparado pelo evento do usuário antes do updater local; callbacks do pai não são
  executados durante render.
- Linhas totalmente vazias não integram o payload. Qualquer linha parcialmente preenchida continua
  candidata à validação atômica.
- O sucesso limpa estado transitório, relê o banco e recompõe a linha da matriz com o Product atual.
- A nomenclatura administrativa centralizada mostra Varejo, Trade-In, Loyalty, Taxa, IPVA, Seguro,
  Wallbox, Emplac., Manut., Voucher e Outro, preservando identifiers físicos.
- No desktop, topbar, header contextual e header da tabela formam uma pilha sticky com offsets em
  variáveis CSS compartilhadas; backgrounds são opacos e as tabelas não criam scroll vertical rival.

O dataset administrativo do Staging foi ampliado de 2 para 10 Products por meio do script
idempotente `scripts/staging/07-expand-admin-dataset.sql`. Os oito veículos adicionais vêm de
`Legacy/products.csv`; a carga adiciona cenários com preço draft/publicado/ausente, Policies fixas e
calculadas e uma Offer draft com dois memberships, sem remover ou arquivar registros anteriores.

## Fechamento 9G.2–9G.4

- A publicação de preço em D encerra atomicamente o predecessor sobreposto em D-1, preservando
  auditoria, imutabilidade e proteção contra overlap.
- O workspace administrativo por veículo suporta edição e arquivamento controlados de Policies e
  Offers, publicação individual de preços e batch atômico de Offers.
- Offers `draft` podem manter `valid_to = NULL`; a publicação revalida todo o agregado e bloqueia
  vigência aberta até decisão posterior de lifecycle.
- A validação manual final foi concluída no Staging. Produção não recebeu estas migrations.
- Refinamentos futuros de UX para a rotina mensal permanecem fora deste checkpoint.
