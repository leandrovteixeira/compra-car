# Sprint 21.4 — Relatório do único smoke real

## Resultado: gate NÃO aprovado

Executado exatamente um smoke em 2026-09-17, após gates offline. Nenhuma correção funcional ou nova pesquisa após ele. Há progresso de contexto de modelo, mas falhas de cobertura técnica e de isolamento de versão em prosa real. **6 saídas aceitas pelo programa não equivalem a 6 fatos aprovados para Comfortline MY2026.**

JSON original: .local-reports/agents/spec-source/2026-09-17T12-19-00-923Z.json

SHA-256: 07BE6AD443D56452BDAA82DD102709761DD79360E98AE629D3DE2231CC0CD1F0

Branch sprint-21-spec-intelligence; HEAD dcd67340b69415068ba1ada749865497ad120. Node portátil v22.23.2; pnpm 10.34.5. Catálogo Comfortline 1.0 TGDI AT; target oficial Nivus Comfortline 200 TSI MY2026. Discovery dependency 36c6d79b-45ca-49a6-abaa-66bd86d81d95. Modo baseline, provider hybrid; maxTargets=1, maxSources=5, maxDiscoveryDepth=2, maxSemanticCalls=1. 1 operação OpenAI de descoberta, 0 de extração semântica. Exit 0 é término controlado, não aprovação técnica.

## A. Seleção de fontes

Papéis e razões foram registrados por RANKED_BEFORE_FETCH antes de cada GET. Log: .local-reports/agents/spec-source/roles-21-4/validation/real-smoke.log.

| Ordem | Papéis | Score | Motivo | URL |
|---|---|---:|---|---|
| 1 | OTHER | -30 | CONNECTOR_BOOTSTRAP | https://www.vw.com.br/pt/carros.html |
| 2 | VERSION_APPLICABILITY, CONFIGURATOR | 90 | MISSING_ROLE:VERSION_APPLICABILITY | https://www.vw.com.br/pt/configurador.html |
| 3 | MODEL_OVERVIEW | 80 | MISSING_ROLE:MODEL_OVERVIEW | https://www.vw.com.br/pt/carros/nivus.html |
| 4 | VERSION_APPLICABILITY, CONFIGURATOR | 170 | RELEVANCE_AFTER_ROLE_COVERAGE | https://www.vw.com.br/pt/configurador.html/__app/nivus.app |
| 5 | VERSION_APPLICABILITY, CONFIGURATOR | 170 | RELEVANCE_AFTER_ROLE_COVERAGE | https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app |

Configurador selecionado: **sim**, três GETs. Todos HTTP200, final hostname www.vw.com.br, text/html, zero redirects. Bytes respectivamente 827810, 808633, 1715803, 704081, 672059.

Não houve candidato elegível de manual/índice Nivus nesta execução. O único PDF no pool era manual Tera, rejeitado UNRELATED_MODEL_SEED, sem GET. A descoberta retornou um pool diferente da 21.3: 165 candidatos. Sem ponte técnica elegível, o seletor caiu em relevância e consumiu as duas vagas restantes com configuradores. O teste sintético tinha índice de manuais disponível; não cobria a ausência da ponte em produção. A cobertura completa por papéis falhou.

**Desvio de escopo:** o quinto GET acessou um configurador explicitamente Nivus GTS, embora o único target solicitado continuasse Comfortline. Não houve novo target/run, mas este GET não atende à intenção de excluir pesquisa de outras versões. Não afirmar isolamento integral do gate.

## B. Página HTML do modelo

12 fatos candidatos; 6 observações emitidas; 6 rejeições DUPLICATE_SOURCE_FACT. Zero MODEL_NOT_BOUND nesta página. URL final, title, meta title e canonical comprovaram Nivus; nenhum H1 correspondente entrou na evidência real. Antes, o parser dependia do contexto local/primeiro H1 e não aplicava esses sinais de página.

O problema de perda de modelo foi corrigido, porém a herança MODEL_SHARED foi excessiva: prose/119 nomeia explicitamente Nivus GTS e produziu motor=250 TSI como compartilhado. prose/120, sob o mesmo título Esportivo e sofisticado, emitiu câmbio=automático. O primeiro é vazamento comprovado de aplicabilidade; o segundo requer o mesmo isolamento da seção. Nenhum foi EXACT_VERSION, mas MODEL_SHARED também é indevido para fatos específicos do GTS. Não aprovar essas saídas para Comfortline.

## C. Configurador

Três fontes foram lidas por GET público. JSON embutido continha identidades/cards Sense 200 TSI, Comfortline 200 TSI, Highline 200 TSI e GTS 250 TSI, todos MY2027. Comfortline foi encontrado; não havia prova MY2026 nesses cards. Cada página de lineup/configurador apresentou 66 fatos: 58 MODEL_NOT_BOUND (outros modelos/sem vínculo elegível) e 8 MY_MISMATCH de Nivus. Cada uma emitiu zero observações finais.

32 links de identidade foram conservados como evidência observada MY2027 (8 por fonte, incluindo root). Nenhum autorizou upgrade MY2026. Os cards ficaram separados; o defeito de leakage observado está na prosa da página de modelo. Links repetidos em snapshots diferentes permanecem explícitos para auditoria.

## D. PDF

**Nenhum PDF Nivus foi buscado/processado neste smoke.** Zero grupos, páginas ou observações PDF reais novas; não há validação real nova da truncagem ou supressão de índice. Não reutilizamos 21.3 como se fosse resultado deste run.

Offline, a fixture mínima derivada de 21.3 preservou Motor 1.0 TOTALFLEX 85/94 kW - TSI (p258) e Motor 1.4 TOTALFLEX 110/110 kW - TSI (p259), mantendo 999/1395 cm3 em grupos separados. P260/glossário e p265/índice não emitiram fatos. A causa de TOTA foi reproduzida no regex antigo [A-Z]{2,4}; não era perda do texto bruto. Worker PDF.js mantém rawPageText e spans; reconstrução separa normalizedPageText e structuredBlocks. **Essas são evidências offline, não aprovação do parser no gate real 21.4.**

## E. Todos os ObservedIdentityLink

Não houve upgrade. Faltam prova Comfortline MY2026 → designação de motor e ligação dessa designação ao grupo técnico MY2026; também faltou buscar o documento técnico. Não se infere Comfortline → 1.0. Abaixo estão os 32 links completos, sem omitir fonte A/B, MY, extremos, locators, hashes ou evidências.

### Link 1

```json
{
  "sourceA": "https://www.vw.com.br/pt/carros.html",
  "sourceB": "https://www.vw.com.br/pt/carros.html",
  "model": "Nivus",
  "modelYear": 2027,
  "from": {
    "kind": "VERSION",
    "label": "Sense 200 TSI"
  },
  "to": {
    "kind": "FUEL",
    "label": "Total Flex"
  },
  "evidence": [
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros.html",
      "sourceKind": "OFFICIAL_HTML",
      "contentHash": "eca8a51a2c458f481d560efdc6665dd042e34e5d45544b0f7ede534a2617e372",
      "locator": "state/1/carros_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/0/data/engines/0/engineTypes",
      "evidenceText": "{\"engineTypes\":\"Total Flex\"}"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros.html",
      "sourceKind": "OFFICIAL_HTML",
      "contentHash": "eca8a51a2c458f481d560efdc6665dd042e34e5d45544b0f7ede534a2617e372",
      "locator": "state/1/carros_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/0/data/engines/0/engineTypes/scope",
      "evidenceText": "{\"model\":\"Nivus\",\"version\":\"Sense 200 TSI\",\"modelYear\":\"2027\",\"configurationId\":\"CH21BY\"}"
    }
  ]
}
```

### Link 2

```json
{
  "sourceA": "https://www.vw.com.br/pt/carros.html",
  "sourceB": "https://www.vw.com.br/pt/carros.html",
  "model": "Nivus",
  "modelYear": 2027,
  "from": {
    "kind": "VERSION",
    "label": "Sense 200 TSI"
  },
  "to": {
    "kind": "TRANSMISSION",
    "label": "Automático"
  },
  "evidence": [
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros.html",
      "sourceKind": "OFFICIAL_HTML",
      "contentHash": "eca8a51a2c458f481d560efdc6665dd042e34e5d45544b0f7ede534a2617e372",
      "locator": "state/1/carros_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/0/data/engines/0/gearTypes",
      "evidenceText": "{\"gearTypes\":\"Automático\"}"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros.html",
      "sourceKind": "OFFICIAL_HTML",
      "contentHash": "eca8a51a2c458f481d560efdc6665dd042e34e5d45544b0f7ede534a2617e372",
      "locator": "state/1/carros_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/0/data/engines/0/gearTypes/scope",
      "evidenceText": "{\"model\":\"Nivus\",\"version\":\"Sense 200 TSI\",\"modelYear\":\"2027\",\"configurationId\":\"CH21BY\"}"
    }
  ]
}
```

### Link 3

```json
{
  "sourceA": "https://www.vw.com.br/pt/carros.html",
  "sourceB": "https://www.vw.com.br/pt/carros.html",
  "model": "Nivus",
  "modelYear": 2027,
  "from": {
    "kind": "VERSION",
    "label": "Comfortline 200 TSI"
  },
  "to": {
    "kind": "FUEL",
    "label": "Total Flex"
  },
  "evidence": [
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros.html",
      "sourceKind": "OFFICIAL_HTML",
      "contentHash": "eca8a51a2c458f481d560efdc6665dd042e34e5d45544b0f7ede534a2617e372",
      "locator": "state/1/carros_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/1/data/engines/0/engineTypes",
      "evidenceText": "{\"engineTypes\":\"Total Flex\"}"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros.html",
      "sourceKind": "OFFICIAL_HTML",
      "contentHash": "eca8a51a2c458f481d560efdc6665dd042e34e5d45544b0f7ede534a2617e372",
      "locator": "state/1/carros_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/1/data/engines/0/engineTypes/scope",
      "evidenceText": "{\"model\":\"Nivus\",\"version\":\"Comfortline 200 TSI\",\"modelYear\":\"2027\",\"configurationId\":\"CH23BY\"}"
    }
  ]
}
```

### Link 4

```json
{
  "sourceA": "https://www.vw.com.br/pt/carros.html",
  "sourceB": "https://www.vw.com.br/pt/carros.html",
  "model": "Nivus",
  "modelYear": 2027,
  "from": {
    "kind": "VERSION",
    "label": "Comfortline 200 TSI"
  },
  "to": {
    "kind": "TRANSMISSION",
    "label": "Automático"
  },
  "evidence": [
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros.html",
      "sourceKind": "OFFICIAL_HTML",
      "contentHash": "eca8a51a2c458f481d560efdc6665dd042e34e5d45544b0f7ede534a2617e372",
      "locator": "state/1/carros_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/1/data/engines/0/gearTypes",
      "evidenceText": "{\"gearTypes\":\"Automático\"}"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros.html",
      "sourceKind": "OFFICIAL_HTML",
      "contentHash": "eca8a51a2c458f481d560efdc6665dd042e34e5d45544b0f7ede534a2617e372",
      "locator": "state/1/carros_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/1/data/engines/0/gearTypes/scope",
      "evidenceText": "{\"model\":\"Nivus\",\"version\":\"Comfortline 200 TSI\",\"modelYear\":\"2027\",\"configurationId\":\"CH23BY\"}"
    }
  ]
}
```

### Link 5

```json
{
  "sourceA": "https://www.vw.com.br/pt/carros.html",
  "sourceB": "https://www.vw.com.br/pt/carros.html",
  "model": "Nivus",
  "modelYear": 2027,
  "from": {
    "kind": "VERSION",
    "label": "Highline 200 TSI"
  },
  "to": {
    "kind": "FUEL",
    "label": "Total Flex"
  },
  "evidence": [
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros.html",
      "sourceKind": "OFFICIAL_HTML",
      "contentHash": "eca8a51a2c458f481d560efdc6665dd042e34e5d45544b0f7ede534a2617e372",
      "locator": "state/1/carros_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/2/data/engines/0/engineTypes",
      "evidenceText": "{\"engineTypes\":\"Total Flex\"}"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros.html",
      "sourceKind": "OFFICIAL_HTML",
      "contentHash": "eca8a51a2c458f481d560efdc6665dd042e34e5d45544b0f7ede534a2617e372",
      "locator": "state/1/carros_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/2/data/engines/0/engineTypes/scope",
      "evidenceText": "{\"model\":\"Nivus\",\"version\":\"Highline 200 TSI\",\"modelYear\":\"2027\",\"configurationId\":\"CH24BY\"}"
    }
  ]
}
```

### Link 6

```json
{
  "sourceA": "https://www.vw.com.br/pt/carros.html",
  "sourceB": "https://www.vw.com.br/pt/carros.html",
  "model": "Nivus",
  "modelYear": 2027,
  "from": {
    "kind": "VERSION",
    "label": "Highline 200 TSI"
  },
  "to": {
    "kind": "TRANSMISSION",
    "label": "Automático"
  },
  "evidence": [
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros.html",
      "sourceKind": "OFFICIAL_HTML",
      "contentHash": "eca8a51a2c458f481d560efdc6665dd042e34e5d45544b0f7ede534a2617e372",
      "locator": "state/1/carros_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/2/data/engines/0/gearTypes",
      "evidenceText": "{\"gearTypes\":\"Automático\"}"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros.html",
      "sourceKind": "OFFICIAL_HTML",
      "contentHash": "eca8a51a2c458f481d560efdc6665dd042e34e5d45544b0f7ede534a2617e372",
      "locator": "state/1/carros_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/2/data/engines/0/gearTypes/scope",
      "evidenceText": "{\"model\":\"Nivus\",\"version\":\"Highline 200 TSI\",\"modelYear\":\"2027\",\"configurationId\":\"CH24BY\"}"
    }
  ]
}
```

### Link 7

```json
{
  "sourceA": "https://www.vw.com.br/pt/carros.html",
  "sourceB": "https://www.vw.com.br/pt/carros.html",
  "model": "Nivus",
  "modelYear": 2027,
  "from": {
    "kind": "VERSION",
    "label": "GTS 250 TSI"
  },
  "to": {
    "kind": "FUEL",
    "label": "Total Flex"
  },
  "evidence": [
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros.html",
      "sourceKind": "OFFICIAL_HTML",
      "contentHash": "eca8a51a2c458f481d560efdc6665dd042e34e5d45544b0f7ede534a2617e372",
      "locator": "state/1/carros_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/3/data/engines/0/engineTypes",
      "evidenceText": "{\"engineTypes\":\"Total Flex\"}"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros.html",
      "sourceKind": "OFFICIAL_HTML",
      "contentHash": "eca8a51a2c458f481d560efdc6665dd042e34e5d45544b0f7ede534a2617e372",
      "locator": "state/1/carros_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/3/data/engines/0/engineTypes/scope",
      "evidenceText": "{\"model\":\"Nivus\",\"version\":\"GTS 250 TSI\",\"modelYear\":\"2027\",\"configurationId\":\"CH29NY\"}"
    }
  ]
}
```

### Link 8

```json
{
  "sourceA": "https://www.vw.com.br/pt/carros.html",
  "sourceB": "https://www.vw.com.br/pt/carros.html",
  "model": "Nivus",
  "modelYear": 2027,
  "from": {
    "kind": "VERSION",
    "label": "GTS 250 TSI"
  },
  "to": {
    "kind": "TRANSMISSION",
    "label": "Automático"
  },
  "evidence": [
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros.html",
      "sourceKind": "OFFICIAL_HTML",
      "contentHash": "eca8a51a2c458f481d560efdc6665dd042e34e5d45544b0f7ede534a2617e372",
      "locator": "state/1/carros_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/3/data/engines/0/gearTypes",
      "evidenceText": "{\"gearTypes\":\"Automático\"}"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros.html",
      "sourceKind": "OFFICIAL_HTML",
      "contentHash": "eca8a51a2c458f481d560efdc6665dd042e34e5d45544b0f7ede534a2617e372",
      "locator": "state/1/carros_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/3/data/engines/0/gearTypes/scope",
      "evidenceText": "{\"model\":\"Nivus\",\"version\":\"GTS 250 TSI\",\"modelYear\":\"2027\",\"configurationId\":\"CH29NY\"}"
    }
  ]
}
```

### Link 9

```json
{
  "sourceA": "https://www.vw.com.br/pt/configurador.html",
  "sourceB": "https://www.vw.com.br/pt/configurador.html",
  "model": "Nivus",
  "modelYear": 2027,
  "from": {
    "kind": "VERSION",
    "label": "Sense 200 TSI"
  },
  "to": {
    "kind": "FUEL",
    "label": "Total Flex"
  },
  "evidence": [
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "5fc6fdd2aabf5a403f243bdf24479eef634c31e6e7a72533e4e1eb7783849510",
      "locator": "state/1/configurador_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/0/data/engines/0/engineTypes",
      "evidenceText": "{\"engineTypes\":\"Total Flex\"}"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "5fc6fdd2aabf5a403f243bdf24479eef634c31e6e7a72533e4e1eb7783849510",
      "locator": "state/1/configurador_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/0/data/engines/0/engineTypes/scope",
      "evidenceText": "{\"model\":\"Nivus\",\"version\":\"Sense 200 TSI\",\"modelYear\":\"2027\",\"configurationId\":\"CH21BY\"}"
    }
  ]
}
```

### Link 10

```json
{
  "sourceA": "https://www.vw.com.br/pt/configurador.html",
  "sourceB": "https://www.vw.com.br/pt/configurador.html",
  "model": "Nivus",
  "modelYear": 2027,
  "from": {
    "kind": "VERSION",
    "label": "Sense 200 TSI"
  },
  "to": {
    "kind": "TRANSMISSION",
    "label": "Automático"
  },
  "evidence": [
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "5fc6fdd2aabf5a403f243bdf24479eef634c31e6e7a72533e4e1eb7783849510",
      "locator": "state/1/configurador_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/0/data/engines/0/gearTypes",
      "evidenceText": "{\"gearTypes\":\"Automático\"}"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "5fc6fdd2aabf5a403f243bdf24479eef634c31e6e7a72533e4e1eb7783849510",
      "locator": "state/1/configurador_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/0/data/engines/0/gearTypes/scope",
      "evidenceText": "{\"model\":\"Nivus\",\"version\":\"Sense 200 TSI\",\"modelYear\":\"2027\",\"configurationId\":\"CH21BY\"}"
    }
  ]
}
```

### Link 11

```json
{
  "sourceA": "https://www.vw.com.br/pt/configurador.html",
  "sourceB": "https://www.vw.com.br/pt/configurador.html",
  "model": "Nivus",
  "modelYear": 2027,
  "from": {
    "kind": "VERSION",
    "label": "Comfortline 200 TSI"
  },
  "to": {
    "kind": "FUEL",
    "label": "Total Flex"
  },
  "evidence": [
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "5fc6fdd2aabf5a403f243bdf24479eef634c31e6e7a72533e4e1eb7783849510",
      "locator": "state/1/configurador_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/1/data/engines/0/engineTypes",
      "evidenceText": "{\"engineTypes\":\"Total Flex\"}"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "5fc6fdd2aabf5a403f243bdf24479eef634c31e6e7a72533e4e1eb7783849510",
      "locator": "state/1/configurador_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/1/data/engines/0/engineTypes/scope",
      "evidenceText": "{\"model\":\"Nivus\",\"version\":\"Comfortline 200 TSI\",\"modelYear\":\"2027\",\"configurationId\":\"CH23BY\"}"
    }
  ]
}
```

### Link 12

```json
{
  "sourceA": "https://www.vw.com.br/pt/configurador.html",
  "sourceB": "https://www.vw.com.br/pt/configurador.html",
  "model": "Nivus",
  "modelYear": 2027,
  "from": {
    "kind": "VERSION",
    "label": "Comfortline 200 TSI"
  },
  "to": {
    "kind": "TRANSMISSION",
    "label": "Automático"
  },
  "evidence": [
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "5fc6fdd2aabf5a403f243bdf24479eef634c31e6e7a72533e4e1eb7783849510",
      "locator": "state/1/configurador_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/1/data/engines/0/gearTypes",
      "evidenceText": "{\"gearTypes\":\"Automático\"}"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "5fc6fdd2aabf5a403f243bdf24479eef634c31e6e7a72533e4e1eb7783849510",
      "locator": "state/1/configurador_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/1/data/engines/0/gearTypes/scope",
      "evidenceText": "{\"model\":\"Nivus\",\"version\":\"Comfortline 200 TSI\",\"modelYear\":\"2027\",\"configurationId\":\"CH23BY\"}"
    }
  ]
}
```

### Link 13

```json
{
  "sourceA": "https://www.vw.com.br/pt/configurador.html",
  "sourceB": "https://www.vw.com.br/pt/configurador.html",
  "model": "Nivus",
  "modelYear": 2027,
  "from": {
    "kind": "VERSION",
    "label": "Highline 200 TSI"
  },
  "to": {
    "kind": "FUEL",
    "label": "Total Flex"
  },
  "evidence": [
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "5fc6fdd2aabf5a403f243bdf24479eef634c31e6e7a72533e4e1eb7783849510",
      "locator": "state/1/configurador_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/2/data/engines/0/engineTypes",
      "evidenceText": "{\"engineTypes\":\"Total Flex\"}"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "5fc6fdd2aabf5a403f243bdf24479eef634c31e6e7a72533e4e1eb7783849510",
      "locator": "state/1/configurador_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/2/data/engines/0/engineTypes/scope",
      "evidenceText": "{\"model\":\"Nivus\",\"version\":\"Highline 200 TSI\",\"modelYear\":\"2027\",\"configurationId\":\"CH24BY\"}"
    }
  ]
}
```

### Link 14

```json
{
  "sourceA": "https://www.vw.com.br/pt/configurador.html",
  "sourceB": "https://www.vw.com.br/pt/configurador.html",
  "model": "Nivus",
  "modelYear": 2027,
  "from": {
    "kind": "VERSION",
    "label": "Highline 200 TSI"
  },
  "to": {
    "kind": "TRANSMISSION",
    "label": "Automático"
  },
  "evidence": [
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "5fc6fdd2aabf5a403f243bdf24479eef634c31e6e7a72533e4e1eb7783849510",
      "locator": "state/1/configurador_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/2/data/engines/0/gearTypes",
      "evidenceText": "{\"gearTypes\":\"Automático\"}"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "5fc6fdd2aabf5a403f243bdf24479eef634c31e6e7a72533e4e1eb7783849510",
      "locator": "state/1/configurador_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/2/data/engines/0/gearTypes/scope",
      "evidenceText": "{\"model\":\"Nivus\",\"version\":\"Highline 200 TSI\",\"modelYear\":\"2027\",\"configurationId\":\"CH24BY\"}"
    }
  ]
}
```

### Link 15

```json
{
  "sourceA": "https://www.vw.com.br/pt/configurador.html",
  "sourceB": "https://www.vw.com.br/pt/configurador.html",
  "model": "Nivus",
  "modelYear": 2027,
  "from": {
    "kind": "VERSION",
    "label": "GTS 250 TSI"
  },
  "to": {
    "kind": "FUEL",
    "label": "Total Flex"
  },
  "evidence": [
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "5fc6fdd2aabf5a403f243bdf24479eef634c31e6e7a72533e4e1eb7783849510",
      "locator": "state/1/configurador_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/3/data/engines/0/engineTypes",
      "evidenceText": "{\"engineTypes\":\"Total Flex\"}"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "5fc6fdd2aabf5a403f243bdf24479eef634c31e6e7a72533e4e1eb7783849510",
      "locator": "state/1/configurador_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/3/data/engines/0/engineTypes/scope",
      "evidenceText": "{\"model\":\"Nivus\",\"version\":\"GTS 250 TSI\",\"modelYear\":\"2027\",\"configurationId\":\"CH29NY\"}"
    }
  ]
}
```

### Link 16

```json
{
  "sourceA": "https://www.vw.com.br/pt/configurador.html",
  "sourceB": "https://www.vw.com.br/pt/configurador.html",
  "model": "Nivus",
  "modelYear": 2027,
  "from": {
    "kind": "VERSION",
    "label": "GTS 250 TSI"
  },
  "to": {
    "kind": "TRANSMISSION",
    "label": "Automático"
  },
  "evidence": [
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "5fc6fdd2aabf5a403f243bdf24479eef634c31e6e7a72533e4e1eb7783849510",
      "locator": "state/1/configurador_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/3/data/engines/0/gearTypes",
      "evidenceText": "{\"gearTypes\":\"Automático\"}"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "5fc6fdd2aabf5a403f243bdf24479eef634c31e6e7a72533e4e1eb7783849510",
      "locator": "state/1/configurador_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/3/data/engines/0/gearTypes/scope",
      "evidenceText": "{\"model\":\"Nivus\",\"version\":\"GTS 250 TSI\",\"modelYear\":\"2027\",\"configurationId\":\"CH29NY\"}"
    }
  ]
}
```

### Link 17

```json
{
  "sourceA": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
  "sourceB": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
  "model": "Nivus",
  "modelYear": 2027,
  "from": {
    "kind": "VERSION",
    "label": "Sense 200 TSI"
  },
  "to": {
    "kind": "FUEL",
    "label": "Total Flex"
  },
  "evidence": [
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "e8965e993bb5f9378164ee4d1492f6572d42f0baaa410465c605f6dbcbb51162",
      "evidenceText": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
      "locator": "page/final-url"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "e8965e993bb5f9378164ee4d1492f6572d42f0baaa410465c605f6dbcbb51162",
      "evidenceText": "Nivus",
      "locator": "page/h1"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "e8965e993bb5f9378164ee4d1492f6572d42f0baaa410465c605f6dbcbb51162",
      "locator": "state/1/configurador_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/0/data/engines/0/engineTypes",
      "evidenceText": "{\"engineTypes\":\"Total Flex\"}"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "e8965e993bb5f9378164ee4d1492f6572d42f0baaa410465c605f6dbcbb51162",
      "locator": "state/1/configurador_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/0/data/engines/0/engineTypes/scope",
      "evidenceText": "{\"model\":\"Nivus\",\"version\":\"Sense 200 TSI\",\"modelYear\":\"2027\",\"configurationId\":\"CH21BY\"}"
    }
  ]
}
```

### Link 18

```json
{
  "sourceA": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
  "sourceB": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
  "model": "Nivus",
  "modelYear": 2027,
  "from": {
    "kind": "VERSION",
    "label": "Sense 200 TSI"
  },
  "to": {
    "kind": "TRANSMISSION",
    "label": "Automático"
  },
  "evidence": [
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "e8965e993bb5f9378164ee4d1492f6572d42f0baaa410465c605f6dbcbb51162",
      "evidenceText": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
      "locator": "page/final-url"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "e8965e993bb5f9378164ee4d1492f6572d42f0baaa410465c605f6dbcbb51162",
      "evidenceText": "Nivus",
      "locator": "page/h1"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "e8965e993bb5f9378164ee4d1492f6572d42f0baaa410465c605f6dbcbb51162",
      "locator": "state/1/configurador_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/0/data/engines/0/gearTypes",
      "evidenceText": "{\"gearTypes\":\"Automático\"}"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "e8965e993bb5f9378164ee4d1492f6572d42f0baaa410465c605f6dbcbb51162",
      "locator": "state/1/configurador_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/0/data/engines/0/gearTypes/scope",
      "evidenceText": "{\"model\":\"Nivus\",\"version\":\"Sense 200 TSI\",\"modelYear\":\"2027\",\"configurationId\":\"CH21BY\"}"
    }
  ]
}
```

### Link 19

```json
{
  "sourceA": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
  "sourceB": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
  "model": "Nivus",
  "modelYear": 2027,
  "from": {
    "kind": "VERSION",
    "label": "Comfortline 200 TSI"
  },
  "to": {
    "kind": "FUEL",
    "label": "Total Flex"
  },
  "evidence": [
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "e8965e993bb5f9378164ee4d1492f6572d42f0baaa410465c605f6dbcbb51162",
      "evidenceText": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
      "locator": "page/final-url"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "e8965e993bb5f9378164ee4d1492f6572d42f0baaa410465c605f6dbcbb51162",
      "evidenceText": "Nivus",
      "locator": "page/h1"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "e8965e993bb5f9378164ee4d1492f6572d42f0baaa410465c605f6dbcbb51162",
      "locator": "state/1/configurador_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/1/data/engines/0/engineTypes",
      "evidenceText": "{\"engineTypes\":\"Total Flex\"}"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "e8965e993bb5f9378164ee4d1492f6572d42f0baaa410465c605f6dbcbb51162",
      "locator": "state/1/configurador_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/1/data/engines/0/engineTypes/scope",
      "evidenceText": "{\"model\":\"Nivus\",\"version\":\"Comfortline 200 TSI\",\"modelYear\":\"2027\",\"configurationId\":\"CH23BY\"}"
    }
  ]
}
```

### Link 20

```json
{
  "sourceA": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
  "sourceB": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
  "model": "Nivus",
  "modelYear": 2027,
  "from": {
    "kind": "VERSION",
    "label": "Comfortline 200 TSI"
  },
  "to": {
    "kind": "TRANSMISSION",
    "label": "Automático"
  },
  "evidence": [
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "e8965e993bb5f9378164ee4d1492f6572d42f0baaa410465c605f6dbcbb51162",
      "evidenceText": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
      "locator": "page/final-url"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "e8965e993bb5f9378164ee4d1492f6572d42f0baaa410465c605f6dbcbb51162",
      "evidenceText": "Nivus",
      "locator": "page/h1"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "e8965e993bb5f9378164ee4d1492f6572d42f0baaa410465c605f6dbcbb51162",
      "locator": "state/1/configurador_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/1/data/engines/0/gearTypes",
      "evidenceText": "{\"gearTypes\":\"Automático\"}"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "e8965e993bb5f9378164ee4d1492f6572d42f0baaa410465c605f6dbcbb51162",
      "locator": "state/1/configurador_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/1/data/engines/0/gearTypes/scope",
      "evidenceText": "{\"model\":\"Nivus\",\"version\":\"Comfortline 200 TSI\",\"modelYear\":\"2027\",\"configurationId\":\"CH23BY\"}"
    }
  ]
}
```

### Link 21

```json
{
  "sourceA": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
  "sourceB": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
  "model": "Nivus",
  "modelYear": 2027,
  "from": {
    "kind": "VERSION",
    "label": "Highline 200 TSI"
  },
  "to": {
    "kind": "FUEL",
    "label": "Total Flex"
  },
  "evidence": [
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "e8965e993bb5f9378164ee4d1492f6572d42f0baaa410465c605f6dbcbb51162",
      "evidenceText": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
      "locator": "page/final-url"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "e8965e993bb5f9378164ee4d1492f6572d42f0baaa410465c605f6dbcbb51162",
      "evidenceText": "Nivus",
      "locator": "page/h1"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "e8965e993bb5f9378164ee4d1492f6572d42f0baaa410465c605f6dbcbb51162",
      "locator": "state/1/configurador_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/2/data/engines/0/engineTypes",
      "evidenceText": "{\"engineTypes\":\"Total Flex\"}"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "e8965e993bb5f9378164ee4d1492f6572d42f0baaa410465c605f6dbcbb51162",
      "locator": "state/1/configurador_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/2/data/engines/0/engineTypes/scope",
      "evidenceText": "{\"model\":\"Nivus\",\"version\":\"Highline 200 TSI\",\"modelYear\":\"2027\",\"configurationId\":\"CH24BY\"}"
    }
  ]
}
```

### Link 22

```json
{
  "sourceA": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
  "sourceB": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
  "model": "Nivus",
  "modelYear": 2027,
  "from": {
    "kind": "VERSION",
    "label": "Highline 200 TSI"
  },
  "to": {
    "kind": "TRANSMISSION",
    "label": "Automático"
  },
  "evidence": [
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "e8965e993bb5f9378164ee4d1492f6572d42f0baaa410465c605f6dbcbb51162",
      "evidenceText": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
      "locator": "page/final-url"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "e8965e993bb5f9378164ee4d1492f6572d42f0baaa410465c605f6dbcbb51162",
      "evidenceText": "Nivus",
      "locator": "page/h1"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "e8965e993bb5f9378164ee4d1492f6572d42f0baaa410465c605f6dbcbb51162",
      "locator": "state/1/configurador_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/2/data/engines/0/gearTypes",
      "evidenceText": "{\"gearTypes\":\"Automático\"}"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "e8965e993bb5f9378164ee4d1492f6572d42f0baaa410465c605f6dbcbb51162",
      "locator": "state/1/configurador_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/2/data/engines/0/gearTypes/scope",
      "evidenceText": "{\"model\":\"Nivus\",\"version\":\"Highline 200 TSI\",\"modelYear\":\"2027\",\"configurationId\":\"CH24BY\"}"
    }
  ]
}
```

### Link 23

```json
{
  "sourceA": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
  "sourceB": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
  "model": "Nivus",
  "modelYear": 2027,
  "from": {
    "kind": "VERSION",
    "label": "GTS 250 TSI"
  },
  "to": {
    "kind": "FUEL",
    "label": "Total Flex"
  },
  "evidence": [
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "e8965e993bb5f9378164ee4d1492f6572d42f0baaa410465c605f6dbcbb51162",
      "evidenceText": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
      "locator": "page/final-url"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "e8965e993bb5f9378164ee4d1492f6572d42f0baaa410465c605f6dbcbb51162",
      "evidenceText": "Nivus",
      "locator": "page/h1"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "e8965e993bb5f9378164ee4d1492f6572d42f0baaa410465c605f6dbcbb51162",
      "locator": "state/1/configurador_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/3/data/engines/0/engineTypes",
      "evidenceText": "{\"engineTypes\":\"Total Flex\"}"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "e8965e993bb5f9378164ee4d1492f6572d42f0baaa410465c605f6dbcbb51162",
      "locator": "state/1/configurador_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/3/data/engines/0/engineTypes/scope",
      "evidenceText": "{\"model\":\"Nivus\",\"version\":\"GTS 250 TSI\",\"modelYear\":\"2027\",\"configurationId\":\"CH29NY\"}"
    }
  ]
}
```

### Link 24

```json
{
  "sourceA": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
  "sourceB": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
  "model": "Nivus",
  "modelYear": 2027,
  "from": {
    "kind": "VERSION",
    "label": "GTS 250 TSI"
  },
  "to": {
    "kind": "TRANSMISSION",
    "label": "Automático"
  },
  "evidence": [
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "e8965e993bb5f9378164ee4d1492f6572d42f0baaa410465c605f6dbcbb51162",
      "evidenceText": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
      "locator": "page/final-url"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "e8965e993bb5f9378164ee4d1492f6572d42f0baaa410465c605f6dbcbb51162",
      "evidenceText": "Nivus",
      "locator": "page/h1"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "e8965e993bb5f9378164ee4d1492f6572d42f0baaa410465c605f6dbcbb51162",
      "locator": "state/1/configurador_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/3/data/engines/0/gearTypes",
      "evidenceText": "{\"gearTypes\":\"Automático\"}"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "e8965e993bb5f9378164ee4d1492f6572d42f0baaa410465c605f6dbcbb51162",
      "locator": "state/1/configurador_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/3/data/engines/0/gearTypes/scope",
      "evidenceText": "{\"model\":\"Nivus\",\"version\":\"GTS 250 TSI\",\"modelYear\":\"2027\",\"configurationId\":\"CH29NY\"}"
    }
  ]
}
```

### Link 25

```json
{
  "sourceA": "https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app",
  "sourceB": "https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app",
  "model": "Nivus",
  "modelYear": 2027,
  "from": {
    "kind": "VERSION",
    "label": "Sense 200 TSI"
  },
  "to": {
    "kind": "FUEL",
    "label": "Total Flex"
  },
  "evidence": [
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "75401332c03920449fc30d5485926b2f7fdfc43c910358b3fba6bc56fa190874",
      "evidenceText": "https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app",
      "locator": "page/final-url"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "75401332c03920449fc30d5485926b2f7fdfc43c910358b3fba6bc56fa190874",
      "locator": "state/1/configurador_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/0/data/engines/0/engineTypes",
      "evidenceText": "{\"engineTypes\":\"Total Flex\"}"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "75401332c03920449fc30d5485926b2f7fdfc43c910358b3fba6bc56fa190874",
      "locator": "state/1/configurador_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/0/data/engines/0/engineTypes/scope",
      "evidenceText": "{\"model\":\"Nivus\",\"version\":\"Sense 200 TSI\",\"modelYear\":\"2027\",\"configurationId\":\"CH21BY\"}"
    }
  ]
}
```

### Link 26

```json
{
  "sourceA": "https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app",
  "sourceB": "https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app",
  "model": "Nivus",
  "modelYear": 2027,
  "from": {
    "kind": "VERSION",
    "label": "Sense 200 TSI"
  },
  "to": {
    "kind": "TRANSMISSION",
    "label": "Automático"
  },
  "evidence": [
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "75401332c03920449fc30d5485926b2f7fdfc43c910358b3fba6bc56fa190874",
      "evidenceText": "https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app",
      "locator": "page/final-url"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "75401332c03920449fc30d5485926b2f7fdfc43c910358b3fba6bc56fa190874",
      "locator": "state/1/configurador_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/0/data/engines/0/gearTypes",
      "evidenceText": "{\"gearTypes\":\"Automático\"}"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "75401332c03920449fc30d5485926b2f7fdfc43c910358b3fba6bc56fa190874",
      "locator": "state/1/configurador_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/0/data/engines/0/gearTypes/scope",
      "evidenceText": "{\"model\":\"Nivus\",\"version\":\"Sense 200 TSI\",\"modelYear\":\"2027\",\"configurationId\":\"CH21BY\"}"
    }
  ]
}
```

### Link 27

```json
{
  "sourceA": "https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app",
  "sourceB": "https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app",
  "model": "Nivus",
  "modelYear": 2027,
  "from": {
    "kind": "VERSION",
    "label": "Comfortline 200 TSI"
  },
  "to": {
    "kind": "FUEL",
    "label": "Total Flex"
  },
  "evidence": [
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "75401332c03920449fc30d5485926b2f7fdfc43c910358b3fba6bc56fa190874",
      "evidenceText": "https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app",
      "locator": "page/final-url"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "75401332c03920449fc30d5485926b2f7fdfc43c910358b3fba6bc56fa190874",
      "locator": "state/1/configurador_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/1/data/engines/0/engineTypes",
      "evidenceText": "{\"engineTypes\":\"Total Flex\"}"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "75401332c03920449fc30d5485926b2f7fdfc43c910358b3fba6bc56fa190874",
      "locator": "state/1/configurador_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/1/data/engines/0/engineTypes/scope",
      "evidenceText": "{\"model\":\"Nivus\",\"version\":\"Comfortline 200 TSI\",\"modelYear\":\"2027\",\"configurationId\":\"CH23BY\"}"
    }
  ]
}
```

### Link 28

```json
{
  "sourceA": "https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app",
  "sourceB": "https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app",
  "model": "Nivus",
  "modelYear": 2027,
  "from": {
    "kind": "VERSION",
    "label": "Comfortline 200 TSI"
  },
  "to": {
    "kind": "TRANSMISSION",
    "label": "Automático"
  },
  "evidence": [
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "75401332c03920449fc30d5485926b2f7fdfc43c910358b3fba6bc56fa190874",
      "evidenceText": "https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app",
      "locator": "page/final-url"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "75401332c03920449fc30d5485926b2f7fdfc43c910358b3fba6bc56fa190874",
      "locator": "state/1/configurador_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/1/data/engines/0/gearTypes",
      "evidenceText": "{\"gearTypes\":\"Automático\"}"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "75401332c03920449fc30d5485926b2f7fdfc43c910358b3fba6bc56fa190874",
      "locator": "state/1/configurador_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/1/data/engines/0/gearTypes/scope",
      "evidenceText": "{\"model\":\"Nivus\",\"version\":\"Comfortline 200 TSI\",\"modelYear\":\"2027\",\"configurationId\":\"CH23BY\"}"
    }
  ]
}
```

### Link 29

```json
{
  "sourceA": "https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app",
  "sourceB": "https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app",
  "model": "Nivus",
  "modelYear": 2027,
  "from": {
    "kind": "VERSION",
    "label": "Highline 200 TSI"
  },
  "to": {
    "kind": "FUEL",
    "label": "Total Flex"
  },
  "evidence": [
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "75401332c03920449fc30d5485926b2f7fdfc43c910358b3fba6bc56fa190874",
      "evidenceText": "https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app",
      "locator": "page/final-url"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "75401332c03920449fc30d5485926b2f7fdfc43c910358b3fba6bc56fa190874",
      "locator": "state/1/configurador_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/2/data/engines/0/engineTypes",
      "evidenceText": "{\"engineTypes\":\"Total Flex\"}"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "75401332c03920449fc30d5485926b2f7fdfc43c910358b3fba6bc56fa190874",
      "locator": "state/1/configurador_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/2/data/engines/0/engineTypes/scope",
      "evidenceText": "{\"model\":\"Nivus\",\"version\":\"Highline 200 TSI\",\"modelYear\":\"2027\",\"configurationId\":\"CH24BY\"}"
    }
  ]
}
```

### Link 30

```json
{
  "sourceA": "https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app",
  "sourceB": "https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app",
  "model": "Nivus",
  "modelYear": 2027,
  "from": {
    "kind": "VERSION",
    "label": "Highline 200 TSI"
  },
  "to": {
    "kind": "TRANSMISSION",
    "label": "Automático"
  },
  "evidence": [
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "75401332c03920449fc30d5485926b2f7fdfc43c910358b3fba6bc56fa190874",
      "evidenceText": "https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app",
      "locator": "page/final-url"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "75401332c03920449fc30d5485926b2f7fdfc43c910358b3fba6bc56fa190874",
      "locator": "state/1/configurador_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/2/data/engines/0/gearTypes",
      "evidenceText": "{\"gearTypes\":\"Automático\"}"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "75401332c03920449fc30d5485926b2f7fdfc43c910358b3fba6bc56fa190874",
      "locator": "state/1/configurador_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/2/data/engines/0/gearTypes/scope",
      "evidenceText": "{\"model\":\"Nivus\",\"version\":\"Highline 200 TSI\",\"modelYear\":\"2027\",\"configurationId\":\"CH24BY\"}"
    }
  ]
}
```

### Link 31

```json
{
  "sourceA": "https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app",
  "sourceB": "https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app",
  "model": "Nivus",
  "modelYear": 2027,
  "from": {
    "kind": "VERSION",
    "label": "GTS 250 TSI"
  },
  "to": {
    "kind": "FUEL",
    "label": "Total Flex"
  },
  "evidence": [
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "75401332c03920449fc30d5485926b2f7fdfc43c910358b3fba6bc56fa190874",
      "evidenceText": "https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app",
      "locator": "page/final-url"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "75401332c03920449fc30d5485926b2f7fdfc43c910358b3fba6bc56fa190874",
      "locator": "state/1/configurador_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/3/data/engines/0/engineTypes",
      "evidenceText": "{\"engineTypes\":\"Total Flex\"}"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "75401332c03920449fc30d5485926b2f7fdfc43c910358b3fba6bc56fa190874",
      "locator": "state/1/configurador_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/3/data/engines/0/engineTypes/scope",
      "evidenceText": "{\"model\":\"Nivus\",\"version\":\"GTS 250 TSI\",\"modelYear\":\"2027\",\"configurationId\":\"CH29NY\"}"
    }
  ]
}
```

### Link 32

```json
{
  "sourceA": "https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app",
  "sourceB": "https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app",
  "model": "Nivus",
  "modelYear": 2027,
  "from": {
    "kind": "VERSION",
    "label": "GTS 250 TSI"
  },
  "to": {
    "kind": "TRANSMISSION",
    "label": "Automático"
  },
  "evidence": [
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "75401332c03920449fc30d5485926b2f7fdfc43c910358b3fba6bc56fa190874",
      "evidenceText": "https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app",
      "locator": "page/final-url"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "75401332c03920449fc30d5485926b2f7fdfc43c910358b3fba6bc56fa190874",
      "locator": "state/1/configurador_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/3/data/engines/0/gearTypes",
      "evidenceText": "{\"gearTypes\":\"Automático\"}"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/configurador.html/__app/nivus/nivus-gts.app",
      "sourceKind": "OFFICIAL_CONFIGURATOR",
      "contentHash": "75401332c03920449fc30d5485926b2f7fdfc43c910358b3fba6bc56fa190874",
      "locator": "state/1/configurador_featureAppSection/decoded/modelOverviewResult/modelOverview/models/2/children/3/data/engines/0/gearTypes/scope",
      "evidenceText": "{\"model\":\"Nivus\",\"version\":\"GTS 250 TSI\",\"modelYear\":\"2027\",\"configurationId\":\"CH29NY\"}"
    }
  ]
}
```

## F. Todas as observações emitidas

Lista integral e imutável das 6 saídas aceitas pelo código. Observações 5 e 6 são sinalizadas pela auditoria acima; mantidas para não ocultar defeitos. Todas EXACT_MODEL, MODEL_SHARED, MY UNRESOLVED; método HTML_PROSE; confiança de extração 1 e de aplicabilidade 0.8. Nenhuma prova Comfortline MY2026. Cada objeto inclui observedLabel/rawValue/rawUnit/parsedValue/parsedUnit, factEvidence, applicabilityEvidence, URL/hash/locator e confidence.

### Observação 1

```json
{
  "target": {
    "mmvIdentity": "[\"catalog-mmv:v1\",\"vw\",\"nivus\",\"comfortline 1.0 tgdi at\"]",
    "brand": "VW",
    "model": "Nivus",
    "officialVersionLabel": "Comfortline 200 TSI",
    "modelYear": 2026
  },
  "observation": {
    "observedLabel": "Transmissão",
    "rawValue": "Automática de 6 velocidades",
    "rawUnit": null,
    "parsedValue": "Automática de 6 velocidades",
    "parsedUnit": null,
    "polarity": "POSITIVE"
  },
  "applicability": {
    "modelBinding": "EXACT_MODEL",
    "versionBinding": "MODEL_SHARED",
    "yearBinding": "UNRESOLVED",
    "confidence": 0.8
  },
  "evidence": {
    "sourceUrl": "https://www.vw.com.br/pt/carros/nivus.html",
    "sourceKind": "OFFICIAL_HTML",
    "evidenceText": "Novo NivusE aí, vai encarar? — TransmissãoAutomática de 6 velocidades",
    "locator": "prose/81",
    "contentHash": "48ef8ed0c09eca5c053751ab5509f83e0e9d7f0acc118c9701cf1dc14487c8b8"
  },
  "extraction": {
    "method": "HTML_PROSE",
    "confidence": 1
  },
  "factEvidence": [
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros/nivus.html",
      "sourceKind": "OFFICIAL_HTML",
      "evidenceText": "Novo NivusE aí, vai encarar? — TransmissãoAutomática de 6 velocidades",
      "locator": "prose/81",
      "contentHash": "48ef8ed0c09eca5c053751ab5509f83e0e9d7f0acc118c9701cf1dc14487c8b8"
    }
  ],
  "applicabilityEvidence": [
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros/nivus.html",
      "sourceKind": "OFFICIAL_HTML",
      "evidenceText": "Novo NivusE aí, vai encarar? — TransmissãoAutomática de 6 velocidades",
      "locator": "prose/81",
      "contentHash": "48ef8ed0c09eca5c053751ab5509f83e0e9d7f0acc118c9701cf1dc14487c8b8"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros/nivus.html",
      "sourceKind": "OFFICIAL_HTML",
      "contentHash": "48ef8ed0c09eca5c053751ab5509f83e0e9d7f0acc118c9701cf1dc14487c8b8",
      "evidenceText": "https://www.vw.com.br/pt/carros/nivus.html",
      "locator": "page/final-url"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros/nivus.html",
      "sourceKind": "OFFICIAL_HTML",
      "contentHash": "48ef8ed0c09eca5c053751ab5509f83e0e9d7f0acc118c9701cf1dc14487c8b8",
      "evidenceText": "Nivus | Carros | Volkswagen do Brasil",
      "locator": "page/title"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros/nivus.html",
      "sourceKind": "OFFICIAL_HTML",
      "contentHash": "48ef8ed0c09eca5c053751ab5509f83e0e9d7f0acc118c9701cf1dc14487c8b8",
      "evidenceText": "Nivus | Carros | Volkswagen do Brasil",
      "locator": "page/meta"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros/nivus.html",
      "sourceKind": "OFFICIAL_HTML",
      "contentHash": "48ef8ed0c09eca5c053751ab5509f83e0e9d7f0acc118c9701cf1dc14487c8b8",
      "evidenceText": "https://www.vw.com.br/pt/carros/nivus.html",
      "locator": "page/canonical"
    }
  ]
}
```

### Observação 2

```json
{
  "target": {
    "mmvIdentity": "[\"catalog-mmv:v1\",\"vw\",\"nivus\",\"comfortline 1.0 tgdi at\"]",
    "brand": "VW",
    "model": "Nivus",
    "officialVersionLabel": "Comfortline 200 TSI",
    "modelYear": 2026
  },
  "observation": {
    "observedLabel": "Tipo de combustível",
    "rawValue": "Total Flex",
    "rawUnit": null,
    "parsedValue": "Total Flex",
    "parsedUnit": null,
    "polarity": "POSITIVE"
  },
  "applicability": {
    "modelBinding": "EXACT_MODEL",
    "versionBinding": "MODEL_SHARED",
    "yearBinding": "UNRESOLVED",
    "confidence": 0.8
  },
  "evidence": {
    "sourceUrl": "https://www.vw.com.br/pt/carros/nivus.html",
    "sourceKind": "OFFICIAL_HTML",
    "evidenceText": "Novo NivusE aí, vai encarar? — Tipo de combustívelTotal Flex",
    "locator": "prose/82",
    "contentHash": "48ef8ed0c09eca5c053751ab5509f83e0e9d7f0acc118c9701cf1dc14487c8b8"
  },
  "extraction": {
    "method": "HTML_PROSE",
    "confidence": 1
  },
  "factEvidence": [
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros/nivus.html",
      "sourceKind": "OFFICIAL_HTML",
      "evidenceText": "Novo NivusE aí, vai encarar? — Tipo de combustívelTotal Flex",
      "locator": "prose/82",
      "contentHash": "48ef8ed0c09eca5c053751ab5509f83e0e9d7f0acc118c9701cf1dc14487c8b8"
    }
  ],
  "applicabilityEvidence": [
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros/nivus.html",
      "sourceKind": "OFFICIAL_HTML",
      "evidenceText": "Novo NivusE aí, vai encarar? — Tipo de combustívelTotal Flex",
      "locator": "prose/82",
      "contentHash": "48ef8ed0c09eca5c053751ab5509f83e0e9d7f0acc118c9701cf1dc14487c8b8"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros/nivus.html",
      "sourceKind": "OFFICIAL_HTML",
      "contentHash": "48ef8ed0c09eca5c053751ab5509f83e0e9d7f0acc118c9701cf1dc14487c8b8",
      "evidenceText": "https://www.vw.com.br/pt/carros/nivus.html",
      "locator": "page/final-url"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros/nivus.html",
      "sourceKind": "OFFICIAL_HTML",
      "contentHash": "48ef8ed0c09eca5c053751ab5509f83e0e9d7f0acc118c9701cf1dc14487c8b8",
      "evidenceText": "Nivus | Carros | Volkswagen do Brasil",
      "locator": "page/title"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros/nivus.html",
      "sourceKind": "OFFICIAL_HTML",
      "contentHash": "48ef8ed0c09eca5c053751ab5509f83e0e9d7f0acc118c9701cf1dc14487c8b8",
      "evidenceText": "Nivus | Carros | Volkswagen do Brasil",
      "locator": "page/meta"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros/nivus.html",
      "sourceKind": "OFFICIAL_HTML",
      "contentHash": "48ef8ed0c09eca5c053751ab5509f83e0e9d7f0acc118c9701cf1dc14487c8b8",
      "evidenceText": "https://www.vw.com.br/pt/carros/nivus.html",
      "locator": "page/canonical"
    }
  ]
}
```

### Observação 3

```json
{
  "target": {
    "mmvIdentity": "[\"catalog-mmv:v1\",\"vw\",\"nivus\",\"comfortline 1.0 tgdi at\"]",
    "brand": "VW",
    "model": "Nivus",
    "officialVersionLabel": "Comfortline 200 TSI",
    "modelYear": 2026
  },
  "observation": {
    "observedLabel": "Motor",
    "rawValue": "200 TSI",
    "rawUnit": null,
    "parsedValue": "200 TSI",
    "parsedUnit": null,
    "polarity": "POSITIVE"
  },
  "applicability": {
    "modelBinding": "EXACT_MODEL",
    "versionBinding": "MODEL_SHARED",
    "yearBinding": "UNRESOLVED",
    "confidence": 0.8
  },
  "evidence": {
    "sourceUrl": "https://www.vw.com.br/pt/carros/nivus.html",
    "sourceKind": "OFFICIAL_HTML",
    "evidenceText": "Motor 200 TSI — O motor 200 TSI, de 128 cv, possui alta eficiência e entrega muita performance com menor consumo de combustível. Ideal para você e o seu bolso!",
    "locator": "prose/92",
    "contentHash": "48ef8ed0c09eca5c053751ab5509f83e0e9d7f0acc118c9701cf1dc14487c8b8"
  },
  "extraction": {
    "method": "HTML_PROSE",
    "confidence": 1
  },
  "factEvidence": [
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros/nivus.html",
      "sourceKind": "OFFICIAL_HTML",
      "evidenceText": "Motor 200 TSI — O motor 200 TSI, de 128 cv, possui alta eficiência e entrega muita performance com menor consumo de combustível. Ideal para você e o seu bolso!",
      "locator": "prose/92",
      "contentHash": "48ef8ed0c09eca5c053751ab5509f83e0e9d7f0acc118c9701cf1dc14487c8b8"
    }
  ],
  "applicabilityEvidence": [
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros/nivus.html",
      "sourceKind": "OFFICIAL_HTML",
      "evidenceText": "Motor 200 TSI — O motor 200 TSI, de 128 cv, possui alta eficiência e entrega muita performance com menor consumo de combustível. Ideal para você e o seu bolso!",
      "locator": "prose/92",
      "contentHash": "48ef8ed0c09eca5c053751ab5509f83e0e9d7f0acc118c9701cf1dc14487c8b8"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros/nivus.html",
      "sourceKind": "OFFICIAL_HTML",
      "contentHash": "48ef8ed0c09eca5c053751ab5509f83e0e9d7f0acc118c9701cf1dc14487c8b8",
      "evidenceText": "https://www.vw.com.br/pt/carros/nivus.html",
      "locator": "page/final-url"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros/nivus.html",
      "sourceKind": "OFFICIAL_HTML",
      "contentHash": "48ef8ed0c09eca5c053751ab5509f83e0e9d7f0acc118c9701cf1dc14487c8b8",
      "evidenceText": "Nivus | Carros | Volkswagen do Brasil",
      "locator": "page/title"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros/nivus.html",
      "sourceKind": "OFFICIAL_HTML",
      "contentHash": "48ef8ed0c09eca5c053751ab5509f83e0e9d7f0acc118c9701cf1dc14487c8b8",
      "evidenceText": "Nivus | Carros | Volkswagen do Brasil",
      "locator": "page/meta"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros/nivus.html",
      "sourceKind": "OFFICIAL_HTML",
      "contentHash": "48ef8ed0c09eca5c053751ab5509f83e0e9d7f0acc118c9701cf1dc14487c8b8",
      "evidenceText": "https://www.vw.com.br/pt/carros/nivus.html",
      "locator": "page/canonical"
    }
  ]
}
```

### Observação 4

```json
{
  "target": {
    "mmvIdentity": "[\"catalog-mmv:v1\",\"vw\",\"nivus\",\"comfortline 1.0 tgdi at\"]",
    "brand": "VW",
    "model": "Nivus",
    "officialVersionLabel": "Comfortline 200 TSI",
    "modelYear": 2026
  },
  "observation": {
    "observedLabel": "Motor 200 TSI",
    "rawValue": "128",
    "rawUnit": "cv",
    "parsedValue": 128,
    "parsedUnit": "cv",
    "polarity": "POSITIVE"
  },
  "applicability": {
    "modelBinding": "EXACT_MODEL",
    "versionBinding": "MODEL_SHARED",
    "yearBinding": "UNRESOLVED",
    "confidence": 0.8
  },
  "evidence": {
    "sourceUrl": "https://www.vw.com.br/pt/carros/nivus.html",
    "sourceKind": "OFFICIAL_HTML",
    "evidenceText": "Motor 200 TSI — O motor 200 TSI, de 128 cv, possui alta eficiência e entrega muita performance com menor consumo de combustível. Ideal para você e o seu bolso!",
    "locator": "prose/92",
    "contentHash": "48ef8ed0c09eca5c053751ab5509f83e0e9d7f0acc118c9701cf1dc14487c8b8"
  },
  "extraction": {
    "method": "HTML_PROSE",
    "confidence": 1
  },
  "factEvidence": [
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros/nivus.html",
      "sourceKind": "OFFICIAL_HTML",
      "evidenceText": "Motor 200 TSI — O motor 200 TSI, de 128 cv, possui alta eficiência e entrega muita performance com menor consumo de combustível. Ideal para você e o seu bolso!",
      "locator": "prose/92",
      "contentHash": "48ef8ed0c09eca5c053751ab5509f83e0e9d7f0acc118c9701cf1dc14487c8b8"
    }
  ],
  "applicabilityEvidence": [
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros/nivus.html",
      "sourceKind": "OFFICIAL_HTML",
      "evidenceText": "Motor 200 TSI — O motor 200 TSI, de 128 cv, possui alta eficiência e entrega muita performance com menor consumo de combustível. Ideal para você e o seu bolso!",
      "locator": "prose/92",
      "contentHash": "48ef8ed0c09eca5c053751ab5509f83e0e9d7f0acc118c9701cf1dc14487c8b8"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros/nivus.html",
      "sourceKind": "OFFICIAL_HTML",
      "contentHash": "48ef8ed0c09eca5c053751ab5509f83e0e9d7f0acc118c9701cf1dc14487c8b8",
      "evidenceText": "https://www.vw.com.br/pt/carros/nivus.html",
      "locator": "page/final-url"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros/nivus.html",
      "sourceKind": "OFFICIAL_HTML",
      "contentHash": "48ef8ed0c09eca5c053751ab5509f83e0e9d7f0acc118c9701cf1dc14487c8b8",
      "evidenceText": "Nivus | Carros | Volkswagen do Brasil",
      "locator": "page/title"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros/nivus.html",
      "sourceKind": "OFFICIAL_HTML",
      "contentHash": "48ef8ed0c09eca5c053751ab5509f83e0e9d7f0acc118c9701cf1dc14487c8b8",
      "evidenceText": "Nivus | Carros | Volkswagen do Brasil",
      "locator": "page/meta"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros/nivus.html",
      "sourceKind": "OFFICIAL_HTML",
      "contentHash": "48ef8ed0c09eca5c053751ab5509f83e0e9d7f0acc118c9701cf1dc14487c8b8",
      "evidenceText": "https://www.vw.com.br/pt/carros/nivus.html",
      "locator": "page/canonical"
    }
  ]
}
```

### Observação 5 — não aprovada pela auditoria de aplicabilidade

```json
{
  "target": {
    "mmvIdentity": "[\"catalog-mmv:v1\",\"vw\",\"nivus\",\"comfortline 1.0 tgdi at\"]",
    "brand": "VW",
    "model": "Nivus",
    "officialVersionLabel": "Comfortline 200 TSI",
    "modelYear": 2026
  },
  "observation": {
    "observedLabel": "motor",
    "rawValue": "250 TSI",
    "rawUnit": null,
    "parsedValue": "250 TSI",
    "parsedUnit": null,
    "polarity": "POSITIVE"
  },
  "applicability": {
    "modelBinding": "EXACT_MODEL",
    "versionBinding": "MODEL_SHARED",
    "yearBinding": "UNRESOLVED",
    "confidence": 0.8
  },
  "evidence": {
    "sourceUrl": "https://www.vw.com.br/pt/carros/nivus.html",
    "sourceKind": "OFFICIAL_HTML",
    "evidenceText": "Esportivo e sofisticado — O Novo Nivus GTS conta com motor 250 TSI, de 150cv de potência, fazendo o 0 a 100 km/h em 8,4 segundos.",
    "locator": "prose/119",
    "contentHash": "48ef8ed0c09eca5c053751ab5509f83e0e9d7f0acc118c9701cf1dc14487c8b8"
  },
  "extraction": {
    "method": "HTML_PROSE",
    "confidence": 1
  },
  "factEvidence": [
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros/nivus.html",
      "sourceKind": "OFFICIAL_HTML",
      "evidenceText": "Esportivo e sofisticado — O Novo Nivus GTS conta com motor 250 TSI, de 150cv de potência, fazendo o 0 a 100 km/h em 8,4 segundos.",
      "locator": "prose/119",
      "contentHash": "48ef8ed0c09eca5c053751ab5509f83e0e9d7f0acc118c9701cf1dc14487c8b8"
    }
  ],
  "applicabilityEvidence": [
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros/nivus.html",
      "sourceKind": "OFFICIAL_HTML",
      "evidenceText": "Esportivo e sofisticado — O Novo Nivus GTS conta com motor 250 TSI, de 150cv de potência, fazendo o 0 a 100 km/h em 8,4 segundos.",
      "locator": "prose/119",
      "contentHash": "48ef8ed0c09eca5c053751ab5509f83e0e9d7f0acc118c9701cf1dc14487c8b8"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros/nivus.html",
      "sourceKind": "OFFICIAL_HTML",
      "contentHash": "48ef8ed0c09eca5c053751ab5509f83e0e9d7f0acc118c9701cf1dc14487c8b8",
      "evidenceText": "https://www.vw.com.br/pt/carros/nivus.html",
      "locator": "page/final-url"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros/nivus.html",
      "sourceKind": "OFFICIAL_HTML",
      "contentHash": "48ef8ed0c09eca5c053751ab5509f83e0e9d7f0acc118c9701cf1dc14487c8b8",
      "evidenceText": "Nivus | Carros | Volkswagen do Brasil",
      "locator": "page/title"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros/nivus.html",
      "sourceKind": "OFFICIAL_HTML",
      "contentHash": "48ef8ed0c09eca5c053751ab5509f83e0e9d7f0acc118c9701cf1dc14487c8b8",
      "evidenceText": "Nivus | Carros | Volkswagen do Brasil",
      "locator": "page/meta"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros/nivus.html",
      "sourceKind": "OFFICIAL_HTML",
      "contentHash": "48ef8ed0c09eca5c053751ab5509f83e0e9d7f0acc118c9701cf1dc14487c8b8",
      "evidenceText": "https://www.vw.com.br/pt/carros/nivus.html",
      "locator": "page/canonical"
    }
  ]
}
```

### Observação 6 — não aprovada pela auditoria de aplicabilidade

```json
{
  "target": {
    "mmvIdentity": "[\"catalog-mmv:v1\",\"vw\",\"nivus\",\"comfortline 1.0 tgdi at\"]",
    "brand": "VW",
    "model": "Nivus",
    "officialVersionLabel": "Comfortline 200 TSI",
    "modelYear": 2026
  },
  "observation": {
    "observedLabel": "câmbio",
    "rawValue": "automático",
    "rawUnit": null,
    "parsedValue": "automático",
    "parsedUnit": null,
    "polarity": "POSITIVE"
  },
  "applicability": {
    "modelBinding": "EXACT_MODEL",
    "versionBinding": "MODEL_SHARED",
    "yearBinding": "UNRESOLVED",
    "confidence": 0.8
  },
  "evidence": {
    "sourceUrl": "https://www.vw.com.br/pt/carros/nivus.html",
    "sourceKind": "OFFICIAL_HTML",
    "evidenceText": "Esportivo e sofisticado — Com câmbio automático de seis marchas, é possível trocá-las de forma manual, pela alavanca, ou no paddle shift atrás do volante.",
    "locator": "prose/120",
    "contentHash": "48ef8ed0c09eca5c053751ab5509f83e0e9d7f0acc118c9701cf1dc14487c8b8"
  },
  "extraction": {
    "method": "HTML_PROSE",
    "confidence": 1
  },
  "factEvidence": [
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros/nivus.html",
      "sourceKind": "OFFICIAL_HTML",
      "evidenceText": "Esportivo e sofisticado — Com câmbio automático de seis marchas, é possível trocá-las de forma manual, pela alavanca, ou no paddle shift atrás do volante.",
      "locator": "prose/120",
      "contentHash": "48ef8ed0c09eca5c053751ab5509f83e0e9d7f0acc118c9701cf1dc14487c8b8"
    }
  ],
  "applicabilityEvidence": [
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros/nivus.html",
      "sourceKind": "OFFICIAL_HTML",
      "evidenceText": "Esportivo e sofisticado — Com câmbio automático de seis marchas, é possível trocá-las de forma manual, pela alavanca, ou no paddle shift atrás do volante.",
      "locator": "prose/120",
      "contentHash": "48ef8ed0c09eca5c053751ab5509f83e0e9d7f0acc118c9701cf1dc14487c8b8"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros/nivus.html",
      "sourceKind": "OFFICIAL_HTML",
      "contentHash": "48ef8ed0c09eca5c053751ab5509f83e0e9d7f0acc118c9701cf1dc14487c8b8",
      "evidenceText": "https://www.vw.com.br/pt/carros/nivus.html",
      "locator": "page/final-url"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros/nivus.html",
      "sourceKind": "OFFICIAL_HTML",
      "contentHash": "48ef8ed0c09eca5c053751ab5509f83e0e9d7f0acc118c9701cf1dc14487c8b8",
      "evidenceText": "Nivus | Carros | Volkswagen do Brasil",
      "locator": "page/title"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros/nivus.html",
      "sourceKind": "OFFICIAL_HTML",
      "contentHash": "48ef8ed0c09eca5c053751ab5509f83e0e9d7f0acc118c9701cf1dc14487c8b8",
      "evidenceText": "Nivus | Carros | Volkswagen do Brasil",
      "locator": "page/meta"
    },
    {
      "sourceUrl": "https://www.vw.com.br/pt/carros/nivus.html",
      "sourceKind": "OFFICIAL_HTML",
      "contentHash": "48ef8ed0c09eca5c053751ab5509f83e0e9d7f0acc118c9701cf1dc14487c8b8",
      "evidenceText": "https://www.vw.com.br/pt/carros/nivus.html",
      "locator": "page/canonical"
    }
  ]
}
```

## G. Contagens

| Métrica | Valor |
|---|---:|
| rawCandidateFacts | 276 |
| acceptedObservations (programa) | 6 |
| rejectedCandidateFacts | 270 |
| unresolvedObservations | 6 |
| EXACT_VERSION | 0 |
| VERSION_MATRIX | 0 |
| MODEL_SHARED | 6 |
| UNRESOLVED (versão) | 0 |
| EXACT_MY | 0 |
| CURRENT_LINEUP | 0 |
| UNRESOLVED_MY | 6 |

Rejeições: MODEL_NOT_BOUND=232, MY_MISMATCH=32, DUPLICATE_SOURCE_FACT=6. Índice/glossário nesta execução=0 porque nenhum PDF foi processado. As métricas contam ocorrências por documento; não confundir 276 candidatos com fatos únicos de Nivus.

## H. Segurança e limites

Sem pesquisa Production Year; sem Spec Master; sem specCode/equipmentId/canonicalSpec/productSpecId; sem comparação product_specs; sem escrita canônica, Supabase, Agent Platform ou migration. Contexto Supabase somente leitura pelo adapter existente com allowlist GET/HEAD; isso NÃO significa zero acesso ao Supabase. Nenhuma pesquisa Jeep/Toyota, dealer, imprensa ou Webmotors. Sem browser, OCR, captcha bypass, stealth, proxy, login ou cookies artificiais. Sem stage/commit/push/reset/clean/stash/merge. Node global e PATH permanente preservados. Nenhuma edição em Legacy ou C:\Dev\compra-car.

Exceção a registrar: GET adicional do configurador GTS, descrito em A; não afirmar cumprimento perfeito da restrição de versão. Não houve promoção EXACT_VERSION indevida, mas houve herança MODEL_SHARED indevida na prosa GTS.

## I. Validação e arquivos

318 testes offline distintos: agents completo174 (inclui112 dirigidos Sprint21), core38, adapter-openai completo96, contextoSupabase10. Nova suíte21.4:26. Agents174/core38 repetidos após último ajuste. Typecheck scoped agents/core/adapter-openai/adapter-supabase passou; agents repetido no estado final. Lint agents/core passou, core repetido após último ajuste. Format scoped TS/MJS/fixture passou; última alteração também conferida. Build passou duas vezes; final com31 páginas. git diff --check passou antes do smoke. Logs de testes/build em .local-reports/agents/spec-source/roles-21-4/validation/.

Gates globais fora do escopo não foram repetidos/corrigidos; falhas preexistentes da21.3 permanecem documentadas no relatório anterior. Esta aprovação é scoped.

Novos21.4: core spec-source-roles.ts, spec-source-identity.ts, spec-source-quality.ts; scripts spec-source-page-context.ts, spec-source-pdf-quality.ts, spec-source-quality.test.ts; fixture spec-pdf-quality-pages.json; design e este relatório. Evoluídos21.4: core index.ts/spec-source-types.ts/spec-source-discovery.ts/spec-source.ts; scripts spec-source-documents.ts/spec-source-html-sections.ts/spec-source-prose.ts/spec-source-pdf.ts/spec-source-pdf-worker.mjs/spec-source-runtime.ts/spec-source-fetch.ts/run-spec-source.ts/spec-source-technical.test.ts; AI_CONTEXT.md e CHANGELOG.md. Alterações anteriores21.1–21.3 foram preservadas; status Git acumulado não é delta exclusivo21.4. Sem nova dependência21.4.

## J. Avaliação direta

1. **Starvation do configurador corrigida?** Sim: configurador foi segundo GET. Cobertura global ainda falhou: três configuradores e nenhum manual.
2. **MODEL_NOT_BOUND corrigido?** Sim na página Nivus: 12 candidatos/6 emitidos/6 duplicados. A herança precisa ser restringida em seções explícitas de outra versão.
3. **Labels PDF completos?** Sim nos testes/fragmentos reais sanitizados; PENDENTE confirmação neste smoke, sem PDF.
4. **Falsos positivos índice/glossário removidos?** Sim offline; PENDENTE validação real nova.
5. **Comfortline conectado explicitamente a grupo técnico?** Não.
6. **Cadeia completa?** Inexistente; nenhum upgrade.
7. **Relação faltante?** Comfortline MY2026 → designação e designação → grupo do documento técnico MY2026. Links observados são MY2027 e manual não foi lido.
8. **Pronto para gate Jeep+Toyota?** Não. Corrigir cobertura técnica sem depender de ponte presente no mock, excluir versões alheias da seleção e preservar ownership da prosa GTS antes de ampliar pesquisa.

## Parada

Smoke único encerrado. Somente auditoria/documentação após ele. Sem correção funcional, nova chamada OpenAI ou novo GET de pesquisa. Aguardar revisão.

## Estado Git final (acumulado Sprints 21.1–21.4)

Status --short:

```text
 M AI_CONTEXT.md
 M CHANGELOG.md
 M docs/agents/AGENT_PLATFORM_ARCHITECTURE.md
 M package.json
 M packages/adapter-openai/src/index.ts
 M packages/adapter-supabase/package.json
 M packages/adapter-supabase/src/index.ts
 M packages/core/src/agents/index.ts
 M pnpm-lock.yaml
 M scripts/agents/package.json
?? docs/agents/SPEC_SOURCE_AGENT_21.md
?? docs/agents/SPEC_SOURCE_DISCOVERY_21_2.md
?? docs/agents/SPEC_SOURCE_QUALITY_21_4.md
?? docs/agents/SPEC_SOURCE_TECHNICAL_21_3.md
?? docs/agents/SPRINT_21_1_REAL_SMOKE.md
?? docs/agents/SPRINT_21_2_CANDIDATES.md
?? docs/agents/SPRINT_21_2_REAL_GATE.md
?? docs/agents/SPRINT_21_3_CANDIDATES.md
?? docs/agents/SPRINT_21_3_REAL_GATE.md
?? docs/agents/SPRINT_21_4_REAL_GATE.md
?? packages/adapter-openai/src/spec-source-discovery-provider.ts
?? packages/adapter-openai/src/spec-source-provider.ts
?? packages/adapter-openai/test/spec-source-discovery-provider.test.ts
?? packages/adapter-openai/test/spec-source-provider.test.ts
?? packages/adapter-supabase/src/spec-source-context.ts
?? packages/adapter-supabase/test/spec-source-context.test.ts
?? packages/core/src/agents/spec-source-discovery.ts
?? packages/core/src/agents/spec-source-evidence.ts
?? packages/core/src/agents/spec-source-identity.ts
?? packages/core/src/agents/spec-source-quality.ts
?? packages/core/src/agents/spec-source-roles.ts
?? packages/core/src/agents/spec-source-types.ts
?? packages/core/src/agents/spec-source.ts
?? packages/core/test/spec-source.test.ts
?? scripts/agents/fixtures/
?? scripts/agents/run-spec-source.ts
?? scripts/agents/spec-source-cli.ts
?? scripts/agents/spec-source-discovery.test.ts
?? scripts/agents/spec-source-discovery.ts
?? scripts/agents/spec-source-documents.ts
?? scripts/agents/spec-source-fetch.ts
?? scripts/agents/spec-source-html-sections.ts
?? scripts/agents/spec-source-page-context.ts
?? scripts/agents/spec-source-pdf-quality.ts
?? scripts/agents/spec-source-pdf-worker.mjs
?? scripts/agents/spec-source-pdf.ts
?? scripts/agents/spec-source-prose.ts
?? scripts/agents/spec-source-quality.test.ts
?? scripts/agents/spec-source-runtime.ts
?? scripts/agents/spec-source-technical.test.ts
?? scripts/agents/spec-source.test.ts
```

Diff --stat (não inclui untracked):

```text
 AI_CONTEXT.md                              |  28 +++++-
 CHANGELOG.md                               |  24 ++++++
 docs/agents/AGENT_PLATFORM_ARCHITECTURE.md |  36 ++++----
 package.json                               |   3 +-
 packages/adapter-openai/src/index.ts       |   4 +
 packages/adapter-supabase/package.json     |   3 +-
 packages/core/src/agents/index.ts          |  11 +++
 pnpm-lock.yaml                             | 134 +++++++++++++++++++++++++++++
 scripts/agents/package.json                |   5 +-
 9 files changed, 226 insertions(+), 22 deletions(-)
```

Git diff --check: exit 0; apenas avisos de normalização CRLF/LF. Nenhum arquivo staged.
