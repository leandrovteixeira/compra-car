import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL?.trim();
const serverKey = process.env.SUPABASE_SERVER_KEY?.trim();

if (!url || !serverKey) {
  throw new Error('SUPABASE_URL e SUPABASE_SERVER_KEY são obrigatórias para a auditoria.');
}

const client = createClient(url, serverKey, {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
});

const { data, error } = await client
  .from('specs')
  .select('id,code,type,group_name,equipment_group,spec_set,detail')
  .order('id');

if (error) {
  throw new Error('Não foi possível consultar specs para a auditoria somente leitura.');
}

const normalizeSpaces = (value) =>
  String(value ?? '')
    .trim()
    .replace(/\s+/gu, ' ');
const specs = data ?? [];
const numeric = specs.filter((spec) => spec.type === 'numeric');
const binary = specs.filter((spec) => spec.type === 'binary');
const scale = specs.filter((spec) => spec.type === 'scale');
const detailMismatches = [...numeric, ...binary]
  .filter((spec) => normalizeSpaces(spec.detail) !== normalizeSpaces(spec.spec_set))
  .map(({ id, code, type, spec_set: specSet, detail }) => ({
    id,
    code,
    type,
    specSet,
    detail,
  }));

const scaleGroups = new Map();
const scaleIdentityIssues = [];
for (const spec of scale) {
  const groupKey = [spec.group_name, spec.equipment_group, spec.spec_set].join('\u001f');
  const details = scaleGroups.get(groupKey) ?? new Map();
  const detailKey = normalizeSpaces(spec.detail);
  const identities = details.get(detailKey) ?? [];
  identities.push({ id: spec.id, code: spec.code });
  details.set(detailKey, identities);
  scaleGroups.set(groupKey, details);

  if (spec.id === null || spec.id === undefined || !normalizeSpaces(spec.code)) {
    scaleIdentityIssues.push({ id: spec.id, code: spec.code });
  }
}

const duplicateScaleDetails = [];
for (const [group, details] of scaleGroups) {
  for (const [detail, identities] of details) {
    if (identities.length > 1) duplicateScaleDetails.push({ group, detail, identities });
  }
}

process.stdout.write(
  `${JSON.stringify(
    {
      source: 'remote Supabase specs (read-only)',
      numericCount: numeric.length,
      binaryCount: binary.length,
      scaleRecordCount: scale.length,
      scaleGroupCount: scaleGroups.size,
      detailMismatchCount: detailMismatches.length,
      detailMismatches,
      duplicateScaleDetailCount: duplicateScaleDetails.length,
      duplicateScaleDetails,
      scaleIdentityIssueCount: scaleIdentityIssues.length,
      scaleIdentityIssues,
    },
    null,
    2,
  )}\n`,
);
