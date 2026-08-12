import { describe, expect, it } from 'vitest';

import nextConfig from '../next.config';
import {
  exceedsImportSelectionLimit,
  IMPORT_ENGINE_MAX_SELECTION_BYTES,
  IMPORT_ENGINE_SERVER_ACTION_BODY_SIZE_LIMIT,
} from '../src/config/import-engine-upload';

describe('admin import upload transport limits', () => {
  it('configures both Server Actions and middleware with the centralized 64 MB ceiling', () => {
    expect(IMPORT_ENGINE_SERVER_ACTION_BODY_SIZE_LIMIT).toBe('64mb');
    expect(nextConfig.experimental?.serverActions?.bodySizeLimit).toBe(
      IMPORT_ENGINE_SERVER_ACTION_BODY_SIZE_LIMIT,
    );
    expect(nextConfig.experimental?.middlewareClientMaxBodySize).toBe(
      IMPORT_ENGINE_SERVER_ACTION_BODY_SIZE_LIMIT,
    );
  });

  it('reserves multipart overhead below the transport ceiling', () => {
    expect(exceedsImportSelectionLimit([{ size: IMPORT_ENGINE_MAX_SELECTION_BYTES }])).toBe(false);
    expect(exceedsImportSelectionLimit([{ size: IMPORT_ENGINE_MAX_SELECTION_BYTES + 1 }])).toBe(
      true,
    );
  });
});
