import type {
  ImportEngineRepository,
  ImportBatchListQuery,
} from '../repositories/import-engine-repository';

export class ListImportBatches {
  constructor(private readonly repository: ImportEngineRepository) {}

  execute(query: ImportBatchListQuery) {
    return this.repository.listBatches(query);
  }
}
