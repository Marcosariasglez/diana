import { useCallback, useRef, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { IMPORT_ERROR_MESSAGES, ImportError, importRepository } from '@/services';
import { useHistoryStore } from '@/store/useHistoryStore';
import type { ImportProgress } from '@/types/import';
import { IMPORT_PHASE_LABELS, importSummary } from './profileLogic';

export interface ProfileImportState {
  importing: boolean;
  progress: ImportProgress | null;
  phaseLabel: string | null;
  summary: string | null;
  error: string | null;
  pickAndImport: () => Promise<void>;
}

export function useProfileImport(): ProfileImportState {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const pickAndImport = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setImporting(true);
    setSummary(null);
    setError(null);
    setProgress(null);
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: [
          'text/csv',
          'text/comma-separated-values',
          'application/csv',
          'application/zip',
          'application/x-zip-compressed',
          'application/octet-stream',
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled || !picked.assets?.[0]) return;
      const asset = picked.assets[0];
      setProgress({ phase: 'reading', processed: 0, total: 0 });
      const result = await importRepository.parseLetterboxd(
        { uri: asset.uri, name: asset.name },
        { onProgress: setProgress },
      );
      useHistoryStore.getState().importResult(result);
      setSummary(importSummary(result));
    } catch (e) {
      setError(e instanceof ImportError ? e.message : IMPORT_ERROR_MESSAGES['read-failed']);
    } finally {
      busy.current = false;
      setImporting(false);
      setProgress(null);
    }
  }, []);

  return {
    importing,
    progress,
    phaseLabel: progress
      ? IMPORT_PHASE_LABELS[progress.phase]
      : importing
        ? IMPORT_PHASE_LABELS.reading
        : null,
    summary,
    error,
    pickAndImport,
  };
}
