import type { ImportEngineRepository } from '../repositories/import-engine-repository';

export class GetImportBatch {
  constructor(private readonly repository: ImportEngineRepository) {}

  execute(batchId: string) {
    return this.repository.getBatch(batchId);
  }
}
