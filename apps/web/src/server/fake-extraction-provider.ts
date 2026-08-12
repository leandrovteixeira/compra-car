import 'server-only';
import { createHash } from 'node:crypto';
import type { ExtractionProvider, ExtractionRequest, ExtractionResult } from '@compra-car/core';
import fixture from '../../../../docs/import/examples/commercial-letter-mmv-example-v1.json';

export class FakeExtractionProvider implements ExtractionProvider {
  readonly key = 'fake';
  readonly version = '1';
  constructor(private readonly payloads: readonly unknown[] = [fixture]) {}
  async extract(request: ExtractionRequest): Promise<ExtractionResult> {
    const hash = createHash('sha256');
    for (const document of [...request.documents].sort((a, b) =>
      a.contentSha256.localeCompare(b.contentSha256),
    ))
      hash.update(document.bytes);
    return {
      providerRunId: `fake-${hash.digest('hex').slice(0, 24)}`,
      payloads: structuredClone(this.payloads),
      usage: {
        inputUnits: request.documents.reduce(
          (total, document) => total + document.bytes.byteLength,
          0,
        ),
        outputUnits: this.payloads.length,
      },
    };
  }
}
