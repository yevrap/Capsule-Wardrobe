import { useRef, useState } from 'react';
import { useProfiles } from '@/contexts/ProfileContext';
import { exportProfile, type ExportProgress } from '@/utils/export';
import { previewImport, runImport, type ImportPreview, type ImportProgress } from '@/utils/import';
import type { Profile } from '@/types';
import styles from './DataPage.module.css';

// ─── Export section ───────────────────────────────────────────────────────────

type ExportState =
  | { status: 'idle' }
  | { status: 'running'; progress: ExportProgress }
  | { status: 'done' }
  | { status: 'error'; message: string };

function ExportSection({ profile }: { profile: Profile }) {
  const [state, setState] = useState<ExportState>({ status: 'idle' });

  async function handleExport() {
    setState({ status: 'running', progress: { phase: 'loading', current: 0, total: 1, label: 'Loading…' } });
    try {
      await exportProfile(profile.id, (p) =>
        setState({ status: 'running', progress: p }),
      );
      setState({ status: 'done' });
      // Reset after a moment so the button is available again.
      setTimeout(() => setState({ status: 'idle' }), 3000);
    } catch (err) {
      setState({ status: 'error', message: (err as Error).message });
    }
  }

  const running = state.status === 'running';

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>Export</h2>
        <p className={styles.sectionSub}>
          Save {profile.name}'s wardrobe as a ZIP file you can keep in Files,
          iCloud Drive, Google Drive, or send anywhere.
        </p>
      </div>

      <button
        type="button"
        className={['btn btn-primary', styles.actionBtn].join(' ')}
        onClick={handleExport}
        disabled={running}
      >
        {running ? '…' : '↑'}&nbsp;&nbsp;
        {running ? 'Exporting…' : `Export ${profile.name}'s wardrobe`}
      </button>

      {state.status === 'running' && (
        <div className={styles.progressArea} role="status">
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{
                width: state.progress.phase === 'compressing'
                  ? `${state.progress.current}%`
                  : state.progress.phase === 'done' ? '100%' : '10%',
              }}
            />
          </div>
          <p className={styles.progressLabel}>{state.progress.label}</p>
        </div>
      )}

      {state.status === 'done' && (
        <p className={styles.successMsg} role="status">✓ Export ready — check your share sheet or downloads</p>
      )}

      {state.status === 'error' && (
        <p className={styles.errorMsg} role="alert">{state.message}</p>
      )}
    </section>
  );
}

// ─── Import section ───────────────────────────────────────────────────────────

type ImportState =
  | { status: 'idle' }
  | { status: 'previewing' }
  | { status: 'preview'; preview: ImportPreview; file: File }
  | { status: 'importing'; progress: ImportProgress }
  | { status: 'done'; result: { profileName: string; garmentsImported: number } }
  | { status: 'error'; message: string };

function ImportSection() {
  const { setActiveProfileId } = useProfiles();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ImportState>({ status: 'idle' });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setState({ status: 'previewing' });
    try {
      const preview = await previewImport(file);
      setState({ status: 'preview', preview, file });
    } catch (err) {
      setState({ status: 'error', message: (err as Error).message });
    }
  }

  async function handleConfirm() {
    if (state.status !== 'preview') return;
    const { file } = state;

    setState({ status: 'importing', progress: { current: 0, total: 1, label: 'Starting…' } });
    try {
      const result = await runImport(file, (p) =>
        setState({ status: 'importing', progress: p }),
      );
      setState({ status: 'done', result });
      setActiveProfileId(result.profileId);
    } catch (err) {
      setState({ status: 'error', message: (err as Error).message });
    }
  }

  function reset() {
    setState({ status: 'idle' });
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>Import</h2>
        <p className={styles.sectionSub}>
          Restore from a Capsule backup ZIP. Existing items with the same ID
          are updated — nothing is duplicated.
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".zip,application/zip"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        aria-label="Choose a Capsule backup ZIP file"
      />

      {/* Idle / error — show the pick file button */}
      {(state.status === 'idle' || state.status === 'error') && (
        <>
          <button
            type="button"
            className={['btn btn-ghost', styles.actionBtn].join(' ')}
            onClick={() => fileInputRef.current?.click()}
          >
            ↓&nbsp;&nbsp;Choose backup file
          </button>
          {state.status === 'error' && (
            <p className={styles.errorMsg} role="alert">{state.message}</p>
          )}
        </>
      )}

      {/* Reading the file */}
      {state.status === 'previewing' && (
        <p className={styles.progressLabel} role="status">Reading file…</p>
      )}

      {/* Preview — show what's in the backup before committing */}
      {state.status === 'preview' && (
        <div className={styles.previewCard}>
          <div className={styles.previewMeta}>
            <p className={styles.previewName}>{state.preview.profileName}</p>
            <p className={styles.previewDetail}>
              {state.preview.garmentCount} {state.preview.garmentCount === 1 ? 'garment' : 'garments'}
              {' · '}
              {state.preview.photoCount} {state.preview.photoCount === 1 ? 'photo' : 'photos'}
            </p>
            <p className={styles.previewDetail}>
              Exported {new Date(state.preview.exportedAt).toLocaleDateString()}
            </p>
            {state.preview.willMerge && (
              <p className={styles.mergeNote}>
                This profile already exists on this device — items will be updated, not duplicated.
              </p>
            )}
          </div>

          <div className={styles.previewActions}>
            <button type="button" className="btn btn-ghost" onClick={reset}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={handleConfirm}>
              Import
            </button>
          </div>
        </div>
      )}

      {/* Import in progress */}
      {state.status === 'importing' && (
        <div className={styles.progressArea} role="status">
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{
                width: state.progress.total > 0
                  ? `${(state.progress.current / state.progress.total) * 100}%`
                  : '5%',
              }}
            />
          </div>
          <p className={styles.progressLabel}>{state.progress.label}</p>
        </div>
      )}

      {/* Done */}
      {state.status === 'done' && (
        <div className={styles.successCard}>
          <p className={styles.successMsg}>
            ✓ Imported {state.result.garmentsImported}{' '}
            {state.result.garmentsImported === 1 ? 'garment' : 'garments'} for{' '}
            {state.result.profileName}
          </p>
          <button type="button" className="btn btn-ghost" style={{ marginTop: 12 }} onClick={reset}>
            Import another
          </button>
        </div>
      )}
    </section>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function DataPage() {
  const { profiles, activeProfile, setActiveProfileId } = useProfiles();

  return (
    <div className="page">
      <header className={styles.header}>
        <p className="label">Backup</p>
        <h1>Data</h1>
      </header>

      {/* Profile selector — whose data to export */}
      {profiles.length > 1 && (
        <div className={styles.profileRow}>
          {profiles.map((p) => (
            <button
              key={p.id}
              type="button"
              className={[
                styles.profileChip,
                activeProfile?.id === p.id ? styles.profileChipActive : '',
              ].join(' ')}
              onClick={() => setActiveProfileId(p.id)}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {activeProfile && <ExportSection profile={activeProfile} />}

      <div className={styles.divider} />

      <ImportSection />
    </div>
  );
}
