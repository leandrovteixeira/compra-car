import type { ComparisonPageErrorCode, ComparisonPageResultDto } from '@compra-car/contracts';
import { renderToBuffer } from '@react-pdf/renderer';

import { createComparisonPdfDocument } from '@/pdf/comparison/comparison-pdf-document';
import {
  isComparisonHighlightsMode,
  prepareComparisonPdf,
  type ComparisonPdfViewModel,
} from '@/pdf/comparison/comparison-pdf-model';
import { loadComparisonPage } from '@/server/comparison-service';

interface ComparisonPdfRouteDependencies {
  readonly loadComparison: (
    rawVehicles: string | readonly string[] | undefined,
  ) => Promise<ComparisonPageResultDto>;
  readonly renderPdf: (model: ComparisonPdfViewModel) => Promise<Uint8Array>;
}

const DEFAULT_DEPENDENCIES: ComparisonPdfRouteDependencies = {
  loadComparison: loadComparisonPage,
  renderPdf: async (model) =>
    new Uint8Array(await renderToBuffer(createComparisonPdfDocument(model))),
};

function readVehicles(searchParams: URLSearchParams): string | readonly string[] | undefined {
  const values = searchParams.getAll('vehicles');
  if (values.length === 0) return undefined;
  return values.length === 1 ? values[0] : values;
}

function getErrorStatus(code: ComparisonPageErrorCode): number {
  if (code === 'VEHICLES_UNAVAILABLE') return 404;
  if (code === 'COMPARISON_UNAVAILABLE') return 503;
  return 400;
}

export async function handleComparisonPdfRequest(
  request: Request,
  dependencies: ComparisonPdfRouteDependencies = DEFAULT_DEPENDENCIES,
): Promise<Response> {
  const searchParams = new URL(request.url).searchParams;
  const result = await dependencies.loadComparison(readVehicles(searchParams));

  if (!result.ok) {
    return Response.json(
      { error: result.error },
      {
        status: getErrorStatus(result.error.code),
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }

  const onlyHighlights = isComparisonHighlightsMode(searchParams.get('highlights'));
  const { model } = prepareComparisonPdf(result.data, onlyHighlights);

  try {
    const pdf = await dependencies.renderPdf(model);
    return new Response(Uint8Array.from(pdf).buffer, {
      status: 200,
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition': 'inline; filename="comparacao-veiculos.pdf"',
        'Content-Type': 'application/pdf',
      },
    });
  } catch {
    return Response.json(
      {
        error: {
          code: 'PDF_GENERATION_FAILED',
          message: 'Não foi possível gerar o PDF agora. Tente novamente.',
        },
      },
      {
        status: 500,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }
}
