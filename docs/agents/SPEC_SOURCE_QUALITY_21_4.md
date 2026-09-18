# Sprint 21.4 — Papéis, contexto e qualidade

Seleção determinística cobre MODEL_OVERVIEW, VERSION_APPLICABILITY/CONFIGURATOR e TECHNICAL_DATA/MANUAL antes de duplicar papéis. Índices CATALOG servem de ponte para documentos ainda não descobertos. Bootstrap mantém o connector. Papéis são independentes do content-type e não dependem da marca.

PageContext conserva evidências de URL, título, todos os H1, canonical e container exclusivo. Fatos herdam modelo, nunca versão exata implicitamente. Seções aninhadas preservam ownership; modelos divergentes e cards de outras versões permanecem isolados.

ObservedIdentityLink armazena apenas identidades publicadas e evidência de ambos os extremos, modelo e MY quando informado. Upgrade de grupo técnico exige cadeia explícita de duas relações com mesmo modelo/MY. Não existe regra Comfortline → 1.0.

PDF.js existente fornece spans posicionados: rawPageText, normalizedPageText e structuredBlocks permanecem separados no relatório. Linhas são agrupadas por y, células por distância x; casos ambíguos são rejeitados. Não há OCR nem segunda biblioteca. Páginas técnicas, índice, sumário, glossário, referência e prosa são classificadas antes de emitir fatos. Grupos de motor preservam labels completos e locators independentes.

A truncagem 21.3 foi reproduzida: regex [A-Z]{2,4} capturava TOTA de TOTALFLEX. O novo parser preserva o cabeçalho completo; fixture mínima deriva dos trechos reais 258/259/260/265. Coordenadas dos testes sintéticos não são apresentadas como coordenadas reais.

Qualidade ACCEPTED/REJECTED/UNRESOLVED antecede emissão. Aplicabilidade incompleta não elimina fato técnico literal. Deduplicação inclui grupo de motor. Relatórios incluem decisões, rejeições de ruído e auditoria PDF. Não há Spec Master, escrita canônica, migrations ou persistência.

## Limitações

Heurísticas determinísticas podem deixar campos e relações não provados; não se completa a identidade com conhecimento automotivo. O orçamento é compartilhado e finito. O smoke único será registrado em SPRINT_21_4_REAL_GATE.md; nenhum resultado real é antecipado neste documento.
