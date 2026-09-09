import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { validContract } from '../../../packages/core/test/fixtures/import/structured-commercial-fixture';
import { fixtureWorkbook } from '../../../packages/core/test/fixtures/import/structured-commercial-workbook';
import { previewStructuredPolicies } from '../src/server/structured-policies-preview';
import { validateStructuredPolicies } from '../src/app/admin/imports/structured-policies/actions';
import StructuredPoliciesPage from '../src/app/admin/imports/structured-policies/page';
import { StructuredPoliciesPreview } from '../src/components/admin/structured-policies-preview';
import { AdminNav } from '../src/components/admin/admin-nav';
import {
  XLSX_MIME,
  STRUCTURED_POLICIES_MAX_BYTES,
} from '../src/application/admin/structured-policies';

const { guard, persist, catalogRead } = vi.hoisted(() => ({
  guard: vi.fn(),
  catalogRead: vi.fn(),
  persist: vi.fn(() => {
    throw new Error('Persistence forbidden');
  }),
}));
vi.mock('@/auth/authorization', () => ({ requireRole: guard }));
vi.mock('@compra-car/adapter-supabase', () => ({
  LegacySupabaseAdapter: class {
    listCommercialResolutionProducts = catalogRead;
    createAdministrativeVehicle = persist;
    updateAdministrativeVehicle = persist;
  },
}));
vi.mock('next/navigation', () => ({ usePathname: () => '/admin/imports/structured-policies' }));
const upload = (contract = validContract()) =>
  new File([new Uint8Array(fixtureWorkbook(contract))], 'synthetic.xlsx', { type: XLSX_MIME });
const render = async (file: File) => {
  const result = await previewStructuredPolicies(file);
  return {
    result,
    html: renderToStaticMarkup(createElement(StructuredPoliciesPreview, { result })),
  };
};

describe('structured policies upload and preview', () => {
  it('never queries the catalog for structural errors, parser failure or a partial year pair', async () => {
    const contract = validContract();
    for (const file of [
      new File(['bad'], 'bad.xlsx'),
      upload({ ...contract, metadata: { ...contract.metadata, contractVersion: 'invalid' } }),
      upload({
        ...contract,
        products: contract.products.map((product) => ({ ...product, productionYear: null })),
      }),
    ]) {
      expect((await previewStructuredPolicies(file)).status).not.toBe('STRUCTURALLY_VALID');
    }
    expect(catalogRead).not.toHaveBeenCalled();
  });

  it('renders exact matched identity and real ID next to the documentary identity', async () => {
    catalogRead.mockResolvedValue([
      {
        id: 'catalog-42',
        brand: 'JEEP',
        model: 'COMPASS',
        version: 'LONGITUDE',
        productionYear: 2026,
        modelYear: 2026,
        isActive: true,
        isPublic: true,
      },
    ]);
    const { result, html } = await render(upload());
    expect(result).toMatchObject({
      status: 'STRUCTURALLY_VALID',
      resolution: {
        status: 'PRODUCT_RESOLUTION_COMPLETE',
        counts: { MATCHED: 1, NOT_FOUND: 0, AMBIGUOUS: 0, NEEDS_OPERATOR_DECISION: 0 },
      },
    });
    expect(html).toContain('Compass');
    expect(html).toContain('JEEP COMPASS LONGITUDE 2026/2026');
    expect(html).toContain('catalog-42');
    expect(catalogRead).toHaveBeenCalledTimes(1);
    expect(persist).not.toHaveBeenCalled();
  });

  it('renders mixed statuses, exact counters, candidate IDs and MVS as context only', async () => {
    const contract = validContract();
    const product = contract.products[0]!;
    catalogRead.mockResolvedValue([
      {
        id: 'match',
        brand: 'Jeep',
        model: 'Compass',
        version: 'Longitude',
        productionYear: 2026,
        modelYear: 2026,
        isActive: true,
        isPublic: true,
      },
      ...['candidate-1', 'candidate-2'].map((id) => ({
        id,
        brand: 'Jeep',
        model: 'Duplicated',
        version: 'Longitude',
        productionYear: 2026,
        modelYear: 2026,
        isActive: true,
        isPublic: true,
      })),
    ]);
    const { result, html } = await render(
      upload({
        ...contract,
        products: [
          product,
          { ...product, productExternalKey: 'missing', model: 'Missing', sourceMvs: 'match' },
          { ...product, productExternalKey: 'ambiguous', model: 'Duplicated' },
          { ...product, productExternalKey: 'years', productionYear: null, modelYear: null },
        ],
      }),
    );
    expect(result).toMatchObject({
      status: 'STRUCTURALLY_VALID',
      resolution: {
        status: 'PRODUCT_REVIEW_REQUIRED',
        counts: { MATCHED: 1, NOT_FOUND: 1, AMBIGUOUS: 1, NEEDS_OPERATOR_DECISION: 1 },
      },
    });
    for (const status of ['MATCHED', 'NOT_FOUND', 'AMBIGUOUS', 'NEEDS_OPERATOR_DECISION'])
      expect(html).toContain(`<strong>1</strong> ${status}`);
    expect(html).toContain('candidate-1');
    expect(html).toContain('candidate-2');
    expect(html).toContain('2 candidatos');
    expect(html).toContain('PY/MY pendente');
    expect(html).toContain('MVS/código');
    expect(html).toContain('Issues da extração');
    expect(html).not.toMatch(/READY_TO_APPLY|>Apply<|>Publicar</u);
    expect(catalogRead).toHaveBeenCalledTimes(1);
    expect(persist).not.toHaveBeenCalled();
  });

  it('keeps catalog failure separate from structural validation and never reports false NOT_FOUND', async () => {
    catalogRead.mockRejectedValue(new Error('private connection details'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const { result, html } = await render(upload());
      expect(result).toMatchObject({
        status: 'STRUCTURALLY_VALID',
        resolution: { status: 'PRODUCT_RESOLUTION_FAILED' },
      });
      expect(html).toContain('Estrutura válida');
      expect(html).not.toMatch(/NOT_FOUND|private connection details/u);
      expect(persist).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });

  it.each(['green', 'yellow', 'red'])(
    'previews canonical %s confidence from the real Core boundary',
    async (confidenceStatus) => {
      const contract = validContract();
      const { result, html } = await render(
        upload({
          ...contract,
          products: contract.products.map((row) => ({ ...row, confidenceStatus })),
          policies: contract.policies.map((row) => ({ ...row, confidenceStatus })),
          offers: contract.offers.map((row) => ({ ...row, confidenceStatus })),
        }),
      );
      expect(result.status).toBe('STRUCTURALLY_VALID');
      expect(html).toContain('STRUCTURALLY_VALID');
      expect(html).toContain(confidenceStatus);
      expect(html).not.toContain('confidence_status is unsupported');
    },
  );

  it('shows unsupported confidence diagnostics without translating blue into a supported value', async () => {
    const contract = validContract();
    const { result, html } = await render(
      upload({
        ...contract,
        products: contract.products.map((row) => ({ ...row, confidenceStatus: 'blue' })),
      }),
    );
    expect(result.status).toBe('STRUCTURALLY_INVALID');
    expect(html).toContain('INVALID_VALUE');
    expect(html).toContain('Products · linha 2 · confidence_status');
  });

  beforeEach(() => {
    vi.clearAllMocks();
    guard.mockResolvedValue(undefined);
    catalogRead.mockResolvedValue([]);
  });

  it('renders both submenu children and preserves the PDF destination', () => {
    const html = renderToStaticMarkup(createElement(AdminNav));
    expect(html).toContain('Cartas comerciais');
    expect(html).toContain('href="/admin/imports"');
    expect(html).toContain('Políticas estruturadas (Excel)');
    expect(html).toContain('aria-current="page"');
    const pdf = readFileSync(new URL('../src/app/admin/imports/page.tsx', import.meta.url), 'utf8');
    expect(pdf).toContain('loadAdminImportBatches(query)');
    expect(pdf).toContain('href="/admin/imports/new"');
  });

  it('renders the guarded initial upload without empty preview or publication action', async () => {
    const html = renderToStaticMarkup(await StructuredPoliciesPage());
    expect(guard).toHaveBeenCalledWith('admin');
    expect(html).toContain('type="file"');
    expect(html).toContain('Validar estrutura');
    expect(html).not.toContain('<table');
    expect(html).not.toMatch(/Apply|Publicar/u);
  });

  it.each(['xls', 'xlsm', 'csv', 'pdf', 'txt'])(
    'rejects %s before reading bytes',
    async (extension) => {
      const file = new File(['fake'], `file.${extension}`);
      const read = vi.spyOn(file, 'arrayBuffer');
      expect((await previewStructuredPolicies(file)).status).toBe('UNSUPPORTED_FILE');
      expect(read).not.toHaveBeenCalled();
    },
  );

  it('rejects incompatible MIME, oversize files and disguised non-workbooks', async () => {
    expect(
      (
        await previewStructuredPolicies(
          new File(['fake'], 'fake.xlsx', { type: 'application/pdf' }),
        )
      ).status,
    ).toBe('UNSUPPORTED_FILE');
    expect(
      (
        await previewStructuredPolicies({
          name: 'big.xlsx',
          type: XLSX_MIME,
          size: STRUCTURED_POLICIES_MAX_BYTES + 1,
        } as File)
      ).status,
    ).toBe('FILE_TOO_LARGE');
    const { result, html } = await render(new File(['%PDF-1.7'], 'fake.xlsx', { type: XLSX_MIME }));
    expect(result.status).toBe('PARSER_FAILURE');
    expect(html).toContain('INVALID_XLSX');
  });

  it('runs real parsing and validation, then renders metadata and dynamic counts', async () => {
    const contract = validContract();
    const { result, html } = await render(upload(contract));
    expect(result.status).toBe('STRUCTURALLY_VALID');
    expect(html).toContain('STRUCTURALLY_VALID');
    for (const value of [
      contract.metadata.issuerBrand,
      contract.metadata.competence,
      contract.metadata.validFrom,
      contract.metadata.validTo,
      contract.metadata.promptVersion,
      contract.metadata.handbookVersion,
    ])
      expect(html).toContain(value!);
    expect(html).toContain(`<strong>${contract.products.length}</strong> Produtos`);
    expect(html).toContain(`<strong>${contract.policies.length}</strong> Políticas`);
    expect(html).toContain(`<strong>${contract.offers.length}</strong> Ofertas`);
    expect(html).not.toMatch(/READY_TO_APPLY|>Apply<|>Publicar</u);
  });

  it('shows deterministic structural diagnostics with reason code and location', async () => {
    const contract = validContract();
    const file = upload({
      ...contract,
      policies: contract.policies.map((policy) => ({
        ...policy,
        policyType: 'unsupported-test-type',
      })),
    });
    const first = await render(file);
    expect(first.result.status).toBe('STRUCTURALLY_INVALID');
    expect(first.html).toContain('INVALID_VALUE');
    expect(first.html).toContain('Policies · linha 2 · policy_type');
    expect(await previewStructuredPolicies(file)).toEqual(first.result);
  });

  it('keeps commercial issues and missing PY/MY nonfatal', async () => {
    const contract = validContract();
    const { result, html } = await render(
      upload({
        ...contract,
        products: contract.products.map((product) => ({
          ...product,
          productionYear: null,
          modelYear: null,
        })),
        issues: [
          {
            issueExternalKey: 'issue-1',
            entityType: 'product',
            entityKey: 'product-1',
            severity: 'blocker',
            reasonCode: 'MISSING_YEAR_PAIR',
            explanation: 'Operator decision required',
            decisionTaken: null,
            sourcePage: 1,
            sourceReference: null,
            promptVersion: 'v0.2',
            blocksApply: true,
          },
        ],
      }),
    );
    expect(result.status).toBe('STRUCTURALLY_VALID');
    expect(html).toContain('PY/MY pendente');
    expect(html).toContain('NEEDS_OPERATOR_DECISION');
    expect(html).toContain('Issues da extração');
    expect(html).toContain('MISSING_YEAR_PAIR');
  });

  it('guards the action before reading upload and never persists commercial data', async () => {
    const data = new FormData();
    data.set('file', upload());
    expect((await validateStructuredPolicies(data)).status).toBe('STRUCTURALLY_VALID');
    expect(persist).not.toHaveBeenCalled();
    guard.mockRejectedValueOnce(new Error('Denied'));
    const read = vi.spyOn(data, 'get');
    await expect(validateStructuredPolicies(data)).rejects.toThrow('Denied');
    expect(read).not.toHaveBeenCalled();
  });

  it('hides unexpected technical details and logs a safe event', async () => {
    const file = upload();
    vi.spyOn(file, 'arrayBuffer').mockRejectedValue(new Error('sensitive detail'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const { result, html } = await render(file);
      expect(result.status).toBe('TECHNICAL_ERROR');
      expect(html).not.toContain('sensitive detail');
      expect(log).toHaveBeenCalledWith('[structured-policies] Unexpected preview failure');
    } finally {
      log.mockRestore();
    }
  });
});
