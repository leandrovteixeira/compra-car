import 'server-only';

import Ajv2020 from 'ajv/dist/2020.js';

import canonicalSchema from '../../../../docs/import/schemas/commercial-letter-mmv-payload-v1.schema.json';

type JsonObject = Record<string, unknown>;

export const COMMERCIAL_LETTER_EXTRACTION_SCHEMA_VERSION = 'CommercialLetterExtraction/1';

const clone = <T>(value: T): T => structuredClone(value);
const asObject = (value: unknown): JsonObject => value as JsonObject;
const OPENAI_SCHEMA_KEYWORDS = new Set([
  '$defs',
  '$ref',
  'additionalProperties',
  'anyOf',
  'const',
  'description',
  'enum',
  'exclusiveMaximum',
  'exclusiveMinimum',
  'format',
  'items',
  'maxItems',
  'maximum',
  'minItems',
  'minimum',
  'multipleOf',
  'pattern',
  'properties',
  'required',
  'type',
]);
const TRANSPORT_ONLY_REMOVED_KEYWORDS = new Set([
  '$id',
  '$schema',
  'maxLength',
  'minLength',
  'title',
  'uniqueItems',
]);
const OPENAI_FORMATS = new Set([
  'date',
  'date-time',
  'duration',
  'email',
  'hostname',
  'ipv4',
  'ipv6',
  'time',
  'uuid',
]);

const removeProperties = (schema: JsonObject, names: readonly string[]): void => {
  const properties = asObject(schema.properties);
  for (const name of names) delete properties[name];
  schema.required = (schema.required as string[]).filter((name) => !names.includes(name));
};

const permitsNull = (schema: JsonObject): boolean =>
  schema.type === 'null' ||
  (Array.isArray(schema.type) && schema.type.includes('null')) ||
  (Array.isArray(schema.anyOf) && schema.anyOf.some((branch) => permitsNull(asObject(branch))));

const makeNullable = (schema: JsonObject): JsonObject =>
  permitsNull(schema) ? schema : { anyOf: [schema, { type: 'null' }] };

function collectReferencedDefinitions(
  schema: unknown,
  available: JsonObject,
  collected: JsonObject,
): void {
  if (!schema || typeof schema !== 'object') return;
  const object = asObject(schema);
  if (typeof object.$ref === 'string') {
    const match = /^#\/\$defs\/([^/]+)$/u.exec(object.$ref);
    if (match) {
      const name = match[1]!;
      if (!(name in available)) throw new Error(`OPENAI_SCHEMA_UNRESOLVED_REF:${object.$ref}`);
      if (!(name in collected)) {
        collected[name] = clone(available[name]);
        collectReferencedDefinitions(collected[name], available, collected);
      }
    }
  }
  for (const value of Object.values(object)) {
    if (Array.isArray(value))
      value.forEach((item) => collectReferencedDefinitions(item, available, collected));
    else collectReferencedDefinitions(value, available, collected);
  }
}

function adaptContractForOpenAI(schema: unknown): void {
  if (!schema || typeof schema !== 'object') return;
  const object = asObject(schema);
  if (Array.isArray(object.oneOf)) {
    object.anyOf = object.oneOf;
    delete object.oneOf;
  }
  for (const keyword of TRANSPORT_ONLY_REMOVED_KEYWORDS) delete object[keyword];
  if (!object.type && Array.isArray(object.enum)) {
    if (!object.enum.every((value) => typeof value === 'string'))
      throw new Error('OPENAI_SCHEMA_ENUM_TYPE_INFERENCE_UNSUPPORTED');
    object.type = 'string';
  }
  if (!object.type && 'const' in object) {
    if (typeof object.const !== 'string')
      throw new Error('OPENAI_SCHEMA_CONST_TYPE_INFERENCE_UNSUPPORTED');
    object.type = 'string';
  }
  if (object.type === 'object' && object.properties && typeof object.properties === 'object') {
    object.required = Object.keys(asObject(object.properties));
    Object.values(asObject(object.properties)).forEach(adaptContractForOpenAI);
  }
  if (object.items) adaptContractForOpenAI(object.items);
  if (Array.isArray(object.anyOf)) object.anyOf.forEach(adaptContractForOpenAI);
  if (object.$defs && typeof object.$defs === 'object')
    Object.values(asObject(object.$defs)).forEach(adaptContractForOpenAI);
}

function buildExtractionSchema(): JsonObject {
  const row = clone(canonicalSchema) as JsonObject;
  removeProperties(row, ['schemaVersion', 'productMatch', 'promotionPlan', 'validation']);
  const availableDefinitions = asObject(row.$defs);
  removeProperties(asObject(availableDefinitions.publicPriceCandidate), [
    'promotionAction',
    'existingPriceId',
    'expectedLockVersion',
  ]);
  removeProperties(asObject(availableDefinitions.policy), [
    'promotionAction',
    'existingPolicyId',
    'predecessor',
  ]);
  removeProperties(asObject(availableDefinitions.offer), ['promotionAction', 'existingOfferId']);

  // These are the only optional fields in the extraction contract. Strict Structured Outputs
  // requires every property to be required, so absence is represented as null on the wire.
  const sourceProperties = asObject(asObject(availableDefinitions.source).properties);
  sourceProperties.notes = makeNullable(asObject(sourceProperties.notes));
  const mmvProperties = asObject(asObject(availableDefinitions.mmv).properties);
  mmvProperties.variantRestrictions = makeNullable(asObject(mmvProperties.variantRestrictions));
  // evidence.region is already nullable in the canonical schema.

  const definitions: JsonObject = {};
  delete row.$defs;
  collectReferencedDefinitions(row, availableDefinitions, definitions);
  const schema: JsonObject = {
    type: 'object',
    additionalProperties: false,
    required: ['rows'],
    properties: {
      rows: { type: 'array', minItems: 1, maxItems: 100, items: row },
    },
    $defs: definitions,
  };
  adaptContractForOpenAI(schema);
  return schema;
}

export interface OpenAITransportSchemaAudit {
  readonly propertyCount: number;
  readonly maxDepth: number;
  readonly referenceCount: number;
  readonly definitionCount: number;
  readonly anyOfCount: number;
  readonly enumValueCount: number;
  readonly globalStringSize: number;
  readonly largestEnumStringSize: number;
  readonly keywords: readonly string[];
}

export class OpenAITransportSchemaError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(`OPENAI_TRANSPORT_SCHEMA_INVALID:${issues.join('|')}`);
    this.name = 'OpenAITransportSchemaError';
  }
}

export function auditOpenAITransportSchema(schema: unknown): OpenAITransportSchemaAudit {
  const root = asObject(schema);
  const definitions = asObject(root.$defs);
  const issues: string[] = [];
  const keywords = new Set<string>();
  let propertyCount = 0;
  let referenceCount = 0;
  let maxDepth = 0;
  let anyOfCount = 0;
  let enumValueCount = 0;
  let globalStringSize = Object.keys(definitions).reduce((total, name) => total + name.length, 0);
  let largestEnumStringSize = 0;
  const countedNodes = new WeakSet<object>();

  if (root.type !== 'object') issues.push('root must be an object');

  const visit = (
    value: unknown,
    objectDepth: number,
    referenceStack: readonly string[],
    path: string,
  ): void => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    const object = asObject(value);
    const countThisNode = !countedNodes.has(object);
    countedNodes.add(object);
    const depth = objectDepth + (object.type === 'object' ? 1 : 0);
    maxDepth = Math.max(maxDepth, depth);
    for (const keyword of Object.keys(object)) {
      if (countThisNode) keywords.add(keyword);
      if (!OPENAI_SCHEMA_KEYWORDS.has(keyword)) issues.push(`unsupported keyword ${keyword}`);
    }
    if (object.type === 'object') {
      const properties = asObject(object.properties);
      const names = Object.keys(properties);
      if (countThisNode) {
        propertyCount += names.length;
        globalStringSize += names.reduce((total, name) => total + name.length, 0);
      }
      if (object.additionalProperties !== false)
        issues.push(`object must set additionalProperties=false at ${path}`);
      const required = Array.isArray(object.required) ? object.required : [];
      if (required.length !== names.length || names.some((name) => !required.includes(name)))
        issues.push(`all object properties must be required at ${path}`);
      for (const [name, property] of Object.entries(properties))
        visit(property, depth, referenceStack, `${path}/properties/${name}`);
    }
    if (object.type === 'array') {
      if (!object.items) issues.push('array must define items');
      else visit(object.items, depth, referenceStack, `${path}/items`);
    }
    if (object.format && !OPENAI_FORMATS.has(String(object.format)))
      issues.push(`unsupported format ${String(object.format)}`);
    if ((Array.isArray(object.enum) || 'const' in object) && !object.type)
      issues.push(`enum/const schema must declare type at ${path}`);
    if (countThisNode && Array.isArray(object.enum)) {
      enumValueCount += object.enum.length;
      const enumStringSize = object.enum.reduce(
        (total, item) => total + (typeof item === 'string' ? item.length : 0),
        0,
      );
      globalStringSize += enumStringSize;
      largestEnumStringSize = Math.max(largestEnumStringSize, enumStringSize);
      if (object.enum.length > 250 && enumStringSize > 15_000)
        issues.push(`single enum string limit exceeded at ${path}: ${enumStringSize}`);
    }
    if (countThisNode && typeof object.const === 'string') globalStringSize += object.const.length;
    if (Array.isArray(object.anyOf)) {
      if (countThisNode) anyOfCount += 1;
      object.anyOf.forEach((branch, index) =>
        visit(branch, depth, referenceStack, `${path}/anyOf/${index}`),
      );
    }
    if (typeof object.$ref === 'string') {
      if (countThisNode) referenceCount += 1;
      const match = /^#\/\$defs\/([^/]+)$/u.exec(object.$ref);
      const name = match?.[1];
      if (!name || !(name in definitions)) issues.push(`unresolved reference ${object.$ref}`);
      else if (referenceStack.includes(name)) issues.push(`cyclic reference ${object.$ref}`);
      else visit(definitions[name], depth, [...referenceStack, name], `#/$defs/${name}`);
    }
  };

  visit(root, 0, [], '#');
  if (propertyCount > 5_000) issues.push(`property limit exceeded: ${propertyCount}`);
  if (maxDepth > 10) issues.push(`depth limit exceeded: ${maxDepth}`);
  if (globalStringSize > 120_000) issues.push(`global string limit exceeded: ${globalStringSize}`);
  if (enumValueCount > 1_000) issues.push(`enum value limit exceeded: ${enumValueCount}`);
  const sourceNotes = asObject(asObject(asObject(definitions.source).properties).notes);
  const variantRestrictions = asObject(
    asObject(asObject(definitions.mmv).properties).variantRestrictions,
  );
  const evidenceRegion = asObject(asObject(asObject(definitions.evidence).properties).region);
  if (!permitsNull(sourceNotes)) issues.push('source.notes must permit null');
  if (!permitsNull(variantRestrictions)) issues.push('mmv.variantRestrictions must permit null');
  if (!permitsNull(evidenceRegion)) issues.push('evidence.region must permit null');
  if (issues.length) throw new OpenAITransportSchemaError([...new Set(issues)]);
  return {
    propertyCount,
    maxDepth,
    referenceCount,
    definitionCount: Object.keys(definitions).length,
    anyOfCount,
    enumValueCount,
    globalStringSize,
    largestEnumStringSize,
    keywords: [...keywords].sort(),
  };
}

export const commercialLetterExtractionSchema: Readonly<JsonObject> =
  Object.freeze(buildExtractionSchema());
export const commercialLetterExtractionSchemaAudit = auditOpenAITransportSchema(
  commercialLetterExtractionSchema,
);

const ajv = new Ajv2020({ allErrors: true, strict: true });
ajv.addFormat('date', (value: string) => {
  if (!/^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
});
const extractionValidator = ajv.compile(commercialLetterExtractionSchema);

export function validateCommercialLetterExtraction(value: unknown): asserts value is {
  rows: JsonObject[];
} {
  if (!extractionValidator(value)) throw new Error('PROVIDER_INVALID_OUTPUT');
}

const normalizeTransportOptionals = (row: JsonObject): JsonObject => {
  const normalized = clone(row);
  const source = asObject(normalized.source);
  if (source.notes === null) delete source.notes;
  const mmv = asObject(normalized.mmv);
  if (mmv.variantRestrictions === null) delete mmv.variantRestrictions;
  return normalized;
};

const blockedPolicy = (policy: JsonObject): JsonObject => ({
  ...policy,
  promotionAction: 'blocked',
  existingPolicyId: null,
  predecessor: null,
});

export function reconstructCanonicalPayloads(value: unknown): readonly JsonObject[] {
  validateCommercialLetterExtraction(value);
  return value.rows.map((transportRow) => {
    const row = normalizeTransportOptionals(transportRow);
    const price = asObject(row.publicPrice);
    return {
      ...row,
      schemaVersion: 'commercial-letter/mmv-payload/1',
      productMatch: {
        status: 'unmatched',
        selectedProductId: null,
        selectedBy: 'none',
        candidates: [],
        expectedProductFingerprint: null,
        issueIds: [],
      },
      publicPrice: {
        ...price,
        candidate: price.candidate
          ? {
              ...asObject(price.candidate),
              promotionAction: 'blocked',
              existingPriceId: null,
              expectedLockVersion: null,
            }
          : null,
      },
      policies: (row.policies as JsonObject[]).map(blockedPolicy),
      offers: (row.offers as JsonObject[]).map((offer) => ({
        ...offer,
        promotionAction: 'blocked',
        existingOfferId: null,
      })),
      promotionPlan: {
        mode: 'blocked',
        publishedPriceIdForOffers: null,
        affectedOffers: [],
        requiresExplicitConfirmation: true,
        issueIds: [],
      },
      validation: {
        blockingIssueCount: 0,
        warningCount: 0,
        readyForApproval: false,
        readyForPromotion: false,
      },
    };
  });
}

export const COMMERCIAL_LETTER_EXTRACTION_PROMPT_VERSION = '2';

export const commercialLetterExtractionInstructionsV1 = `
Você interpreta cartas comerciais; o servidor decide matching, validação e promoção.
Leia o dossiê inteiro como conjunto, considerando primary, errata, complement e anexos. Errata e
complemento prevalecem apenas no escopo explicitamente declarado. Produza uma row por MMV e recorte
comercial coerente. Não complete lacunas, não infira dados ausentes e não herde condições entre MMVs.
Preserve relações E e OU: políticas cumulativas ficam na mesma Offer; alternativas ficam em Offers
separadas. Diferencie MSRP/preço público de preço promocional e rebate de rede de benefício ao cliente.
Quando houver ambiguidade, crie issue aberta e bloqueante e reduza confidence; nunca escolha Product.
Para cada campo econômico relevante, inclua evidence curta e localizável com documentPage (começa em
1), excerpt e blockKey. Use o documentId informado no contexto por meio das notas/source quando útil.
Filename é somente provenance e nunca fonte semântica. Não transcreva trechos longos.
Não gere productMatch, IDs persistidos, fingerprint, locks, validation nem promotionPlan.
`.trim();

export const commercialLetterExtractionInstructionsV2 = `
Você interpreta cartas comerciais; o servidor decide matching, validação e promoção.
Leia o dossiê inteiro como conjunto, considerando primary, errata, complement e anexos. Errata e
complemento prevalecem somente no escopo explicitamente declarado. Produza uma row por MMV e recorte
comercial coerente. Ausência documental continua sendo ausência: não complete lacunas, não infira
dados e nunca propague condições por mera semelhança entre MMVs.

Antes da resposta, classifique internamente o escopo documental de cada condição como documento
inteiro, marca/linha, modelo, conjunto de versões, versão específica ou Offer/opção específica.
Aplique uma condição de escopo amplo a todos e somente aos MMVs abrangidos, salvo exclusão explícita.
Uma condição do modelo alcança suas versões abrangidas; uma condição de versão não alcança outra
versão. O escopo deve vir do texto, da tabela ou de seu contexto documental, nunca de suposição.

Construa internamente uma matriz de cobertura para cada MMV identificado. Verifique: MMV, model year,
production year, MSRP/preço público, preço promocional, bônus varejo, bônus de emplacamento,
financiamento, taxa zero, carência, acessórios, wallbox/recarga, benefícios gerais, restrições,
elegibilidade, alternativas de Offer, validade e evidence. Pergunte internamente se existe informação
documentada aplicável ao MMV que ainda não foi representada; não invente dados para preencher a matriz.

Faça duas passagens conceituais: primeiro extração, depois reconciliação de cobertura. Na segunda,
confirme que condições gerais alcançaram todos os MMVs aplicáveis; condições específicas ficaram no
escopo correto; tabelas foram reconciliadas linha/coluna por linha/coluna; cada MMV recebeu todos os
benefícios documentados; nenhuma lacuna foi preenchida; MSRP não virou preço promocional; bônus não
virou MSRP; e relações E/OU foram preservadas. Retorne somente o output estruturado, sem expor
raciocínio ou essas verificações internas.

Preserve relações E e OU: condições cumulativas ficam na mesma Offer e alternativas ficam em Offers
separadas. Quando um benefício geral se aplicar documentalmente a todas as opções, inclua-o em cada
Offer alternativa; não o associe a apenas uma nem o omita. Benefício específico de uma opção não se
propaga para outra. Diferencie MSRP/preço público de preço promocional e rebate de rede de benefício
ao cliente.

Interprete tabelas pelo conjunto: cabeçalhos, rótulos de linhas e colunas, células conceitualmente
mescladas, títulos imediatamente acima, notas imediatamente abaixo e escopo visual/textual. Cabeçalho
ou nota pode abranger múltiplas células e MMVs; não interprete cada célula isoladamente.

Confidence deve refletir certeza factual, clareza da fonte, associação ao MMV e completude da row.
Use confidence alta somente com fonte e escopo claros e reconciliação sem sinais de lacuna; média
quando houver ambiguidade ou possível cobertura incompleta; baixa quando a associação for incerta ou
informação material não estiver reconciliada. Não invente dados para elevar confidence.

Crie issue aberta e bloqueante de REVIEW e reduza confidence quando houver SOURCE_AMBIGUITY: escopo
ambíguo de benefício, tabela com mais de uma interpretação, alcance incerto de condição geral, relação
E/OU ambígua ou possível informação aplicável que a reconciliação não consiga representar com
segurança. Não crie REVIEW por simples ausência documental nem por falha de Product matching.

Cada benefício material deve ter evidence curta e localizável suficiente para provar existência,
valor, escopo e associação ao MMV/Offer quando relevante, com documentPage (começa em 1), excerpt e
blockKey. Evidência apenas do valor, sem sustentar seu escopo ou associação, não justifica confidence
alta. Use o documentId informado no contexto por meio das notas/source quando útil. Filename é somente
provenance e nunca fonte semântica. Não transcreva trechos longos.

Nunca escolha Product. Não gere productMatch, Product ID, selectedProductId, IDs persistidos,
fingerprint, locks, predecessor, validation, promotionPlan nem promoção.
`.trim();

export const commercialLetterExtractionInstructions = commercialLetterExtractionInstructionsV2;
