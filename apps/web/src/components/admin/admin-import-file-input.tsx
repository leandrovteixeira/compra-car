'use client';

import { useCallback } from 'react';

import { importDocumentFileFieldName } from '@/application/admin/import-document-submission';

import type { SelectedImportFile } from './admin-import-file-selection';

export function AdminImportFileInput({
  item,
  rehydrationToken,
}: {
  readonly item: SelectedImportFile;
  readonly rehydrationToken: object;
}) {
  const assignFile = useCallback(
    (input: HTMLInputElement | null) => {
      if (!input || !rehydrationToken || typeof DataTransfer === 'undefined') return;
      const transfer = new DataTransfer();
      transfer.items.add(item.file);
      input.files = transfer.files;
    },
    [item.file, rehydrationToken],
  );

  return (
    <input
      ref={assignFile}
      aria-hidden="true"
      className="hidden"
      name={importDocumentFileFieldName(item.id)}
      tabIndex={-1}
      type="file"
    />
  );
}
