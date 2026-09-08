import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

interface Artifact {
  readonly reconciliation: {
    readonly candidateCatalog: readonly Record<string, unknown>[];
  };
  readonly dryRun: {
    readonly sourceSha256: string;
    readonly totals: Record<string, number>;
    readonly checks: Record<string, boolean | number>;
    readonly vehicles: readonly {
      readonly sourceColumn: string;
      readonly fullName: string;
      readonly brand: string;
      readonly model: string;
      readonly version: string;
      readonly productionYear: number;
      readonly modelYear: number;
      readonly matchStatus: string;
      readonly existingProductId: string | null;
      readonly specs: readonly {
        readonly code: string;
        readonly kind: 'numeric' | 'binary' | 'scale';
        readonly value?: number;
        readonly isPresent?: boolean;
        readonly sourceNormalization?: string;
      }[];
    }[];
  };
}

async function main(): Promise<void> {
  const root = resolve(__dirname, '../..');
  const artifact = JSON.parse(
    await readFile(resolve(root, 'temp/vehicle-specs-reconciled-dry-run.json'), 'utf8'),
  ) as Artifact;
  const expectedSha = '3A50FD77989C187ED465C202FB168B61E2EE846A8DAC16D1EDA4999E7F67E0B6';
  const totals = artifact.dryRun.totals;
  const matchingIsPreApply = totals.existingExact === 9 && totals.newProduct === 267;
  const matchingIsPostApply = totals.existingExact === 276 && totals.newProduct === 0;
  if (
    artifact.dryRun.sourceSha256 !== expectedSha ||
    totals.vehicles !== 276 ||
    totals.specColumns !== 293 ||
    (!matchingIsPreApply && !matchingIsPostApply) ||
    totals.ambiguous !== 0 ||
    totals.invalid !== 0 ||
    totals.specCellsParsed !== 37949 ||
    totals.uniqueUnknownSpecCodes !== 0 ||
    artifact.reconciliation.candidateCatalog.length !== 321
  ) {
    throw new Error('Artifact não corresponde às invariantes aprovadas para apply.');
  }
  const specs = artifact.reconciliation.candidateCatalog.map((spec) => ({
    code: spec.code,
    group_name: spec.groupName,
    equipment_group: spec.equipmentGroup,
    spec_set: spec.specSet,
    detail: spec.detail,
    type: spec.type,
    unit: spec.unit,
    value_direction: spec.valueDirection,
    unit_perceived_value: spec.unitPerceivedValue,
    relative_value: spec.relativeValue,
    is_baseline: spec.isBaseline,
    is_active: spec.isActive,
    notes: spec.notes,
    commercial_category: spec.commercialCategory,
  }));
  const products = artifact.dryRun.vehicles.map((vehicle) => ({
    source_column: vehicle.sourceColumn,
    full_name: vehicle.fullName,
    brand: vehicle.brand,
    model: vehicle.model,
    version: vehicle.version,
    production_year: vehicle.productionYear,
    model_year: vehicle.modelYear,
    expected_existing_id: vehicle.existingProductId ? Number(vehicle.existingProductId) : null,
  }));
  const specIndex = new Map(specs.map((spec, index) => [String(spec.code), index]));
  const productSpecs = artifact.dryRun.vehicles.flatMap((vehicle, productIndex) =>
    vehicle.specs.map((spec) => {
      const equipmentIndex = specIndex.get(spec.code);
      if (equipmentIndex === undefined) throw new Error(`Spec ausente do payload: ${spec.code}.`);
      return [
        productIndex,
        equipmentIndex,
        spec.kind === 'numeric' ? spec.value : null,
        spec.kind === 'numeric' ? null : spec.isPresent,
      ] as const;
    }),
  );
  const normalizations = artifact.dryRun.vehicles.flatMap((vehicle, productIndex) =>
    vehicle.specs.flatMap((spec) => {
      if (!spec.sourceNormalization) return [];
      const equipmentIndex = specIndex.get(spec.code);
      if (equipmentIndex === undefined) throw new Error(`Spec normalizada ausente: ${spec.code}.`);
      return [[productIndex, equipmentIndex, spec.sourceNormalization] as const];
    }),
  );
  if (normalizations.length !== 46) throw new Error('Esperadas 46 normalizações históricas.');
  if (productSpecs.length !== 37949) throw new Error('Payload não contém 37.949 associações.');
  const payload = {
    schemaVersion: 'vehicle-specs-staging-apply/1',
    projectId: 'shfsjyjxmgwnlexmdkcs',
    sourceSha256: expectedSha,
    specs,
    products,
    productSpecs,
    normalizations,
    pendingMalformedCount: 13,
  };
  const serialized = JSON.stringify(payload);
  const path = resolve(root, 'temp/vehicle-specs-staging-apply-payload.json');
  await writeFile(path, serialized, 'utf8');
  process.stdout.write(
    `${JSON.stringify({ path, bytes: Buffer.byteLength(serialized), sha256: createHash('sha256').update(serialized).digest('hex').toUpperCase(), counts: { specs: specs.length, products: products.length, productSpecs: productSpecs.length } }, null, 2)}\n`,
  );
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
