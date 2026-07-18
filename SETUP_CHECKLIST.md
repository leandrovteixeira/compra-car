# Compra Car — Checklist de Preparação

## Contas
- [ ] GitHub
- [ ] Supabase
- [ ] Railway
- [ ] Conta Microsoft com OneDrive
- [ ] Acesso ao Appsmith atual

## Aplicativos
- [ ] Visual Studio Code
- [ ] Git
- [ ] Node.js LTS
- [ ] npm
- [ ] Python
- [ ] Docker Desktop
- [ ] Supabase CLI
- [ ] GitHub CLI, opcional
- [ ] DBeaver, opcional

## Estrutura local sugerida
CompraCar/
├── apps/
│   └── web/
├── packages/
│   ├── database/
│   ├── scoring/
│   ├── reports/
│   └── ui/
├── supabase/
│   ├── legacy/
│   ├── migrations/
│   └── tests/
├── legacy/
│   ├── appsmith/
│   ├── scripts/
│   ├── exports/
│   └── documents/
├── docs/
│   ├── architecture/
│   ├── database/
│   ├── modules/
│   └── migration/
├── data/
│   ├── equipments/
│   └── fixtures/
├── scripts/
├── tests/
├── README.md
├── START.md
├── AI_CONTEXT.md
├── ROADMAP_MASTER.md
├── AGENTS.md
├── CHANGELOG.md
└── .gitignore

## Materiais necessários
- [ ] Export do Appsmith
- [ ] Export do schema do Supabase
- [ ] Lista de tabelas e views
- [ ] Queries usadas pelo comparador
- [ ] Scripts existentes
- [ ] Planilhas atuais
- [ ] Base de equipamentos
- [ ] Lista de marcas, modelos, versões e preços
- [ ] Regras atuais de comparação
- [ ] Três veículos-piloto
- [ ] Texto legal provisório
- [ ] Identidade visual provisória

## Segurança
- [ ] Nunca salvar service role no frontend
- [ ] Nunca commitar arquivos .env
- [ ] Revisar RLS das tabelas usadas pelo MVP
- [ ] Usar apenas chave pública no navegador
- [ ] Armazenar segredos no Railway e localmente em .env.local
