import 'server-only';

type JsonObject = Record<string, unknown>;
const asObject = (value: unknown): JsonObject => value as JsonObject;
const clone = <T>(value: T): T => structuredClone(value);
const removedKeywords = new Set([
  '$id',
  '$schema',
  'title',
  'minLength',
  'maxLength',
  'uniqueItems',
  'minProperties',
]);

const permitsNull = (schema: JsonObject): boolean =>
  schema.type === 'null' ||
  (Array.isArray(schema.type) && schema.type.includes('null')) ||
  (Array.isArray(schema.anyOf) && schema.anyOf.some((branch) => permitsNull(asObject(branch))));

function adapt(schema: unknown): void {
  if (!schema || typeof schema !== 'object') return;
  const object = asObject(schema);
  if (Array.isArray(object.oneOf)) {
    object.anyOf = object.oneOf;
    delete object.oneOf;
  }
  for (const keyword of removedKeywords) delete object[keyword];
  if (!object.type && Array.isArray(object.enum)) {
    if (!object.enum.every((value) => typeof value === 'string'))
      throw new Error('OPENAI_SCHEMA_ENUM_TYPE_UNSUPPORTED');
    object.type = 'string';
  }
  if (!object.type && 'const' in object) {
    if (typeof object.const !== 'string') throw new Error('OPENAI_SCHEMA_CONST_TYPE_UNSUPPORTED');
    object.type = 'string';
  }
  if (object.type === 'object' && object.properties && typeof object.properties === 'object') {
    const originalRequired = new Set(
      Array.isArray(object.required) ? (object.required as string[]) : [],
    );
    const properties = asObject(object.properties);
    for (const [name, property] of Object.entries(properties)) {
      adapt(property);
      if (!originalRequired.has(name) && !permitsNull(asObject(property)))
        properties[name] = { anyOf: [property, { type: 'null' }] };
    }
    object.required = Object.keys(properties);
  }
  if (object.items) adapt(object.items);
  if (Array.isArray(object.anyOf)) object.anyOf.forEach(adapt);
  if (object.$defs && typeof object.$defs === 'object')
    Object.values(asObject(object.$defs)).forEach(adapt);
}

export function createOpenAIStructuredOutputProjection(
  canonicalSchema: Readonly<JsonObject>,
): Readonly<JsonObject> {
  const projected = clone(canonicalSchema);
  adapt(projected);
  return projected;
}

const selectBranch = (schema: JsonObject, value: unknown, root: JsonObject): JsonObject => {
  if (typeof schema.$ref === 'string') {
    const name = /^#\/\$defs\/([^/]+)$/u.exec(schema.$ref)?.[1];
    if (!name) throw new Error('OPENAI_SCHEMA_UNRESOLVED_REF');
    return selectBranch(asObject(asObject(root.$defs)[name]), value, root);
  }
  if (Array.isArray(schema.oneOf)) {
    const objectValue = value && typeof value === 'object' ? asObject(value) : {};
    const selected =
      schema.oneOf.find((branch) => {
        const resolved = selectBranch(asObject(branch), value, root);
        const properties = asObject(resolved.properties ?? {});
        return Object.entries(properties).every(
          ([key, property]) =>
            !('const' in asObject(property)) || objectValue[key] === asObject(property).const,
        );
      }) ?? schema.oneOf[0];
    return selectBranch(asObject(selected), value, root);
  }
  return schema;
};

function toTransport(value: unknown, schema: JsonObject, root: JsonObject): unknown {
  const selected = selectBranch(schema, value, root);
  if (selected !== schema) return toTransport(value, selected, root);
  if (selected.type === 'object' && selected.properties && value && typeof value === 'object') {
    const source = asObject(value);
    return Object.fromEntries(
      Object.entries(asObject(selected.properties)).map(([name, property]) => [
        name,
        name in source ? toTransport(source[name], asObject(property), root) : null,
      ]),
    );
  }
  if (selected.type === 'array' && Array.isArray(value))
    return value.map((item) => toTransport(item, asObject(selected.items), root));
  return value;
}

export function projectCanonicalValueForOpenAITransport(
  value: unknown,
  canonicalSchema: Readonly<JsonObject>,
): unknown {
  return toTransport(value, asObject(canonicalSchema), asObject(canonicalSchema));
}

export function reconstructCanonicalValueFromOpenAITransport(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reconstructCanonicalValueFromOpenAITransport);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(asObject(value))
      .filter(([, item]) => item !== null)
      .map(([key, item]) => [key, reconstructCanonicalValueFromOpenAITransport(item)]),
  );
}
