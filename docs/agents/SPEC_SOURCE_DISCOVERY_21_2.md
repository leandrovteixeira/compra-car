# Sprint 21.2 — Official Spec Source Discovery Gate

## Arquitetura

Descoberta e extração são fases distintas. A descoberta produz candidatos; não afirma fatos nem promove aplicabilidade por URL.

Seeds do Brand Connector ACTIVE → links HTML/data attributes/JSON inerte → página de modelo/configurador/literatura → documentos candidatos. Profundidade máxima 2; maxSources limita tentativas de fetch no run inteiro. Cada candidato mantém URL/finalURL, kind candidato, method, parentURL, depth, sinais de relevância/modelo/MY, status e rejeição.

Classificação genérica usa nomes do alvo, termos técnicos, configurador e literatura. Exclui finalidades institucionais, imprensa, dealers, redes sociais e financiamento. Seeds de outro modelo e PDFs sem vínculo ao modelo são rejeitados. Domínios de MEDIA_CENTER separados dos canais técnicos saem também da allowlist de busca e redirects. Nenhuma URL Nivus/VW foi adicionada ao código de produção.

Scripts JSON/estados serializados são lidos com JSON.parse e, quando necessário, decodeURIComponent. Não executa JavaScript, navegador ou anti-bot. Não transforma nodeId em URL. Links em atributos HTML e campos URL/href/link de JSON são classificados novamente pela política oficial antes do fetch. Há limites de bytes, nós e candidatos.

## Fixture real e captura preparatória

Uma captura preparatória do índice autorizado foi necessária, pois a 21.1 só guardou hash/metadados. Não foi um smoke de pesquisa nem usou OpenAI. Reutilizou o transport seguro e connector ACTIVE, com leituras de contexto Supabase.

- URL: https://www.vw.com.br/pt/carros.html
- HTTP 200, text/html, 827568 bytes, zero redirects.
- Hash: c77cc2603031043bb232a5237bb0ad87c477d9e0f9881daa883b12c6062448f8 (igual ao smoke 21.1).
- Fixture mínima derivada: scripts/agents/fixtures/spec-discovery-vw-lineup.html.
- Captura completa e metadados ficam somente em .local-reports/agents/spec-source/discovery-21-2/.

O card real Nivus é um botão e o estado usa nodeId=/nivus. Esse identificador não prova uma rota de navegação; a fixture verifica que não é inventada uma URL. Links oficiais de configurador e manuais realmente presentes são preservados. O estado capturado menciona MY2027 nas versões: não serve como prova de MY2026.

A navegação convencional lineup → model link → technical link é coberta também por fixture sintética claramente identificada nos testes. Não se afirma que um link Nivus inexistente na captura real tenha sido encontrado nela.

## Busca limitada

Após percorrer os links específicos disponíveis e até dois seeds sem fechar a descoberta de modelo/fonte técnica, o runtime pode fazer uma operação oficial de descoberta. O provider reutiliza BackgroundResearch, limita max_tool_calls=1, retorna somente URL/label com JSON schema estrito e filtra domínios.

Somente URLs presentes nos sources da chamada web_search são admitidas pelo provider. O grafo revalida a allowlist e finalidades antes do GET. O orçamento é compartilhado: discoveryCalls é subconjunto de semanticCalls; se a descoberta consumir a chamada, não haverá extração semântica adicional. 403/429/challenge interrompem inclusive fallbacks.

## Evidências e junção

O campo evidence da 21.1 é preservado. O runtime passa a preencher factEvidence[] e applicabilityEvidence[]. Evidência de valor e de aplicabilidade podem ter URL/hash/locator distintos.

A junção exige modelo e MY explícitos iguais ao alvo nas duas fontes e uma destas relações:

- mesma versão oficial;
- mesmo configurationId explícito do fabricante;
- seção explicitamente POWERTRAIN com engineDesignation, fuel e transmission iguais.

A fonte de aplicabilidade precisa nomear a versão oficial exata, modelo e MY em sua evidência. Uma versão explicitamente diferente nunca é substituída pela versão solicitada. MY ausente/diferente impede a junção; nome de modelo sozinho não autoriza atribuição. Não há mapeamento ao Spec Master.

PDF/manual pode ser descoberto e capturado, mas a boundary PDF permanece unsupported nesta etapa. Não foi adicionada dependência PDF/OCR. Descobrir uma URL técnica não significa que seu conteúdo foi extraído, nem que sua aplicabilidade foi provada.

## CLI

```powershell
pnpm agent:spec-source:dry-run -- --brand VW --model Nivus --version "Comfortline 200 TSI" --my 2026 --discovery-run 36c6d79b-45ca-49a6-abaa-66bd86d81d95 --provider hybrid --mode baseline --max-targets 1 --max-sources 5 --max-discovery-depth 2 --max-semantic-calls 1
```

Sem migrations, persistência Agent Platform, escrita Supabase ou alterações canônicas. Extractor/cache version 21.2.0. Gate encerrado com cobertura parcial: página Nivus alcançada; configurador genérico e dois acessórios consumiram o orçamento; nenhuma fonte técnica MY2026 ou observação. [Resultado completo e limitações](SPRINT_21_2_REAL_GATE.md).
