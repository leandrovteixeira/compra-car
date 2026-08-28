import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildComparisonPdfUrl } from '../src/application/comparison/comparison-pdf-url';
import {
  COMPARISON_PDF_FILENAME,
  COMPARISON_PDF_MIME_TYPE,
  shareComparisonPdf,
} from '../src/application/comparison/comparison-pdf-share';

const source = (relativePath: string) =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');

function pdfResponse(): Response {
  return new Response(new Blob(['%PDF-1.7'], { type: COMPARISON_PDF_MIME_TYPE }), { status: 200 });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('URLs das ações do PDF', () => {
  it('preserva múltiplos vehicles e highlights=true', () => {
    const params = new URLSearchParams();
    params.append('vehicles', '10,20');
    params.append('vehicles', '30');
    params.set('highlights', 'true');

    expect(buildComparisonPdfUrl(params)).toBe(
      '/comparar/pdf?vehicles=10%2C20&vehicles=30&highlights=true',
    );
  });

  it('não adiciona highlights quando o modo está inativo', () => {
    expect(buildComparisonPdfUrl(new URLSearchParams({ vehicles: '10,20' }))).toBe(
      '/comparar/pdf?vehicles=10%2C20',
    );
  });

  it('liga o download visível à mesma URL e filename', () => {
    const component = source('../src/components/comparison-pdf-actions.tsx');
    expect(component).toContain('download={COMPARISON_PDF_FILENAME} href={pdfUrl}');
    expect(COMPARISON_PDF_FILENAME).toBe('comparacao-veiculos.pdf');
  });

  it('usa a densidade compacta compartilhada sem perder o reflow mobile', () => {
    const component = source('../src/components/comparison-pdf-actions.tsx');
    expect(component).toContain('ui-button ui-button--secondary ui-button--compact');
    expect(component).toContain('flex w-full min-w-0 gap-1.5 sm:w-auto');
    expect(component).not.toContain('rounded-xl');
  });
});

describe('compartilhamento nativo do PDF', () => {
  it('cria e compartilha um File PDF quando files são suportados', async () => {
    const share = vi.fn<(data?: ShareData) => Promise<void>>(async () => undefined);
    const canShare = vi.fn(() => true);
    const download = vi.fn();

    const result = await shareComparisonPdf('/comparar/pdf?vehicles=1,2', {
      download,
      fetchPdf: vi.fn(async () => pdfResponse()),
      navigator: { canShare, share },
    });

    expect(result).toBe('shared');
    expect(download).not.toHaveBeenCalled();
    expect(canShare).toHaveBeenCalledOnce();
    expect(share).toHaveBeenCalledOnce();
    const sharedFile = share.mock.calls[0]?.[0]?.files?.[0];
    expect(sharedFile).toBeInstanceOf(File);
    expect(sharedFile).toMatchObject({
      name: COMPARISON_PDF_FILENAME,
      type: COMPARISON_PDF_MIME_TYPE,
    });
  });

  it.each([
    ['navigator.share ausente', { canShare: vi.fn(() => true) }],
    ['navigator.canShare ausente', { share: vi.fn(async () => undefined) }],
  ])('baixa sem buscar quando %s', async (_reason, browserNavigator) => {
    const download = vi.fn();
    const fetchPdf = vi.fn(async () => pdfResponse());

    await expect(
      shareComparisonPdf('/comparar/pdf', {
        download,
        fetchPdf,
        navigator: browserNavigator,
      }),
    ).resolves.toBe('downloaded');
    expect(download).toHaveBeenCalledOnce();
    expect(fetchPdf).not.toHaveBeenCalled();
  });

  it('respeita canShare=false e baixa sem abrir o share sheet', async () => {
    const download = vi.fn();
    const share = vi.fn(async () => undefined);

    await expect(
      shareComparisonPdf('/comparar/pdf', {
        download,
        fetchPdf: vi.fn(async () => pdfResponse()),
        navigator: { canShare: vi.fn(() => false), share },
      }),
    ).resolves.toBe('downloaded');
    expect(download).toHaveBeenCalledOnce();
    expect(share).not.toHaveBeenCalled();
  });

  it('não baixa quando o usuário cancela o share sheet', async () => {
    const download = vi.fn();

    await expect(
      shareComparisonPdf('/comparar/pdf', {
        download,
        fetchPdf: vi.fn(async () => pdfResponse()),
        navigator: {
          canShare: vi.fn(() => true),
          share: vi.fn(async () => Promise.reject({ name: 'AbortError' })),
        },
      }),
    ).resolves.toBe('cancelled');
    expect(download).not.toHaveBeenCalled();
  });

  it.each([
    ['resposta HTTP falha', vi.fn(async () => new Response(null, { status: 500 }))],
    ['fetch rejeitado', vi.fn(async () => Promise.reject(new Error('offline')))],
  ])('trata %s com fallback controlado', async (_reason, fetchPdf) => {
    const download = vi.fn();

    await expect(
      shareComparisonPdf('/comparar/pdf', {
        download,
        fetchPdf,
        navigator: {
          canShare: vi.fn(() => true),
          share: vi.fn(async () => undefined),
        },
      }),
    ).resolves.toBe('downloaded');
    expect(download).toHaveBeenCalledOnce();
  });

  it('mantém loading semântico e sempre restaura o estado no componente', () => {
    const component = source('../src/components/comparison-pdf-actions.tsx');
    expect(component).toContain('disabled={isSharing}');
    expect(component).toContain("isSharing ? 'Preparando...' : 'Compartilhar'");
    expect(component).toContain('finally {\n      setIsSharing(false);\n    }');
    expect(component).toContain('if (isSharing) return;');
  });
});
