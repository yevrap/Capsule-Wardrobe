import { useRef, useState, useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useProfiles } from '@/contexts/ProfileContext';
import { db } from '@/db';
import { exportProfile, type ExportProgress } from '@/utils/export';
import { previewImport, runImport, type ImportPreview, type ImportProgress } from '@/utils/import';
import type { Profile } from '@/types';
import styles from './SettingsPage.module.css';

// ─── Profile editor ───────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = { self: 'Me', partner: 'Partner', child: 'Child' };

function ProfileEditor({ profile }: { profile: Profile }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(profile.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(profile.name);
  }, [profile.name, editing]);

  async function save() {
    const name = draft.trim();
    setEditing(false);
    if (!name || name === profile.name) { setDraft(profile.name); return; }
    await db.profiles.update(profile.id, { name });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    if (e.key === 'Escape') { setDraft(profile.name); setEditing(false); }
  }

  return (
    <div className={styles.profileItem}>
      <div className={styles.profileItemAvatar}>
        {profile.name.charAt(0).toUpperCase()}
      </div>

      {editing ? (
        <div className={styles.profileEditRow}>
          <input
            ref={inputRef}
            className={styles.profileNameInput}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={save}
            onFocus={(e) => e.target.select()}
            maxLength={32}
            aria-label="Profile name"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
          <button type="button" className={styles.profileSaveBtn} onMouseDown={save}>
            Save
          </button>
        </div>
      ) : (
        <div className={styles.profileDisplayRow}>
          <div className={styles.profileItemInfo}>
            <span className={styles.profileItemName}>{profile.name}</span>
            <span className={styles.profileItemRole}>{ROLE_LABELS[profile.role] ?? profile.role}</span>
          </div>
          <button type="button" className={styles.profileRenameBtn} onClick={() => setEditing(true)}>
            Rename
          </button>
        </div>
      )}
    </div>
  );
}

function ProfileSection() {
  const { profiles } = useProfiles();
  return (
    <section className={styles.section}>
      <p className={styles.sectionLabel}>Profiles</p>
      <div className={styles.profileList}>
        {profiles.map((p) => <ProfileEditor key={p.id} profile={p} />)}
      </div>
    </section>
  );
}

// ─── App / Update section ─────────────────────────────────────────────────────

function UpdateSection() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<'idle' | 'up-to-date'>('idle');
  const needRefreshRef = useRef(needRefresh);
  useEffect(() => { needRefreshRef.current = needRefresh; }, [needRefresh]);

  async function handleCheck() {
    setChecking(true);
    setCheckResult('idle');
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      await reg?.update();
      await new Promise<void>((r) => setTimeout(r, 1500));
      if (!needRefreshRef.current) {
        setCheckResult('up-to-date');
        setTimeout(() => setCheckResult('idle'), 4000);
      }
    } catch {
      // ignore — service worker may not be registered in dev mode
    } finally {
      setChecking(false);
    }
  }

  const buildDate = new Date(__BUILD_DATE__).toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <section className={styles.section}>
      <p className={styles.sectionLabel}>App</p>

      <div className={styles.card}>
        <div className={styles.versionRow}>
          <div>
            <div className={styles.appName}>Capsule</div>
            <div className={styles.versionMeta}>
              v{__APP_VERSION__} · {buildDate}
            </div>
          </div>
          {needRefresh && (
            <span className={styles.updateBadge}>Update ready</span>
          )}
        </div>

        {needRefresh ? (
          <button
            type="button"
            className={['btn btn-primary', styles.updateBtn].join(' ')}
            onClick={() => updateServiceWorker(true)}
          >
            Update &amp; Restart
          </button>
        ) : (
          <div className={styles.checkRow}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleCheck}
              disabled={checking}
            >
              {checking ? 'Checking…' : 'Check for updates'}
            </button>
            {checkResult === 'up-to-date' && (
              <span className={styles.upToDate}>✓ Up to date</span>
            )}
          </div>
        )}

        <button
          type="button"
          className={styles.reloadLink}
          onClick={() => window.location.reload()}
        >
          Reload app
        </button>
      </div>
    </section>
  );
}

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
      await exportProfile(profile.id, (p) => setState({ status: 'running', progress: p }));
      setState({ status: 'done' });
      setTimeout(() => setState({ status: 'idle' }), 3000);
    } catch (err) {
      setState({ status: 'error', message: (err as Error).message });
    }
  }

  const running = state.status === 'running';

  return (
    <section className={styles.section}>
      <p className={styles.sectionLabel}>Export</p>
      <p className={styles.sectionSub}>
        Save {profile.name}'s wardrobe as a ZIP you can keep in Files, iCloud Drive, or share anywhere.
      </p>

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
      const result = await runImport(file, (p) => setState({ status: 'importing', progress: p }));
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
      <p className={styles.sectionLabel}>Restore</p>
      <p className={styles.sectionSub}>
        Import from a Capsule backup ZIP. Items with the same ID are updated, never duplicated.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept=".zip,application/zip"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        aria-label="Choose a Capsule backup ZIP file"
      />

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

      {state.status === 'previewing' && (
        <p className={styles.progressLabel} role="status">Reading file…</p>
      )}

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
                This profile already exists — items will be updated, not duplicated.
              </p>
            )}
          </div>
          <div className={styles.previewActions}>
            <button type="button" className="btn btn-ghost" onClick={reset}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={handleConfirm}>Import</button>
          </div>
        </div>
      )}

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

      {state.status === 'done' && (
        <div className={styles.successCard}>
          <p className={styles.successMsg}>
            ✓ Imported {state.result.garmentsImported}{' '}
            {state.result.garmentsImported === 1 ? 'garment' : 'garments'} for {state.result.profileName}
          </p>
          <button type="button" className="btn btn-ghost" style={{ marginTop: 12 }} onClick={reset}>
            Import another
          </button>
        </div>
      )}
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function SettingsPage() {
  const { profiles, activeProfile, setActiveProfileId } = useProfiles();

  return (
    <div className="page">
      <header className={styles.header}>
        <p className="label">Capsule</p>
        <h1>Settings</h1>
      </header>

      <ProfileSection />

      <div className={styles.divider} />

      <UpdateSection />

      <div className={styles.divider} />

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
