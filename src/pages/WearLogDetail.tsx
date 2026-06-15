import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { blobToUrl } from '@/utils/image';
import styles from './WearLogDetail.module.css';

function formatFullDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

export function WearLogDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const log = useLiveQuery(
    async () => {
      if (!id) return null;
      return (await db.wearLogs.get(id)) ?? null;
    },
    [id],
  );

  const linkedOutfit = useLiveQuery(
    async () => {
      if (!log?.outfitId) return null;
      return (await db.outfits.get(log.outfitId)) ?? null;
    },
    [log?.outfitId],
  );

  useEffect(() => {
    const blob = log?.photo?.compressed;
    if (!blob) { setPhotoUrl(null); return; }
    const url = blobToUrl(blob);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [log?.photo]);

  // Always show the chrome so there's never a blank screen during load.
  if (log === undefined || !log) {
    return (
      <div className={styles.detail}>
        <div className={styles.topBar}>
          <button type="button" className={styles.backBtn} onClick={() => navigate(-1)}>
            ← Back
          </button>
        </div>
        {log === null && (
          <div className="empty-state"><h3>Entry not found</h3></div>
        )}
      </div>
    );
  }

  async function handleDelete() {
    await db.wearLogs.delete(log!.id);
    navigate('/journal', { replace: true });
  }

  return (
    <div className={styles.detail}>
      {/* ── Top bar ────────────────────────────────────────────────────── */}
      <div className={styles.topBar}>
        <button type="button" className={styles.backBtn} onClick={() => navigate(-1)}>
          ← Back
        </button>
        <div style={{ display: 'flex', gap: 12 }}>
          {log.photo && (
            <button
              type="button"
              className={styles.editBtn}
              onClick={() => navigate('/identify', { state: { sourcePhoto: log.photo?.compressed } })}
            >
              🔎 Scan items
            </button>
          )}
          <button
            type="button"
            className={styles.editBtn}
            onClick={() => navigate(`/journal/${log.id}/edit`)}
          >
            Edit
          </button>
        </div>
      </div>

      {/* ── Photo ──────────────────────────────────────────────────────── */}
      {photoUrl && (
        <div className={styles.photoWrap}>
          <img src={photoUrl} alt="Outfit" className={styles.photo} />
        </div>
      )}

      {/* ── Content ────────────────────────────────────────────────────── */}
      <div className={styles.body}>
        <p className={styles.dateLabel}>{formatFullDate(log.date)}</p>

        {log.notes && <p className={styles.notes}>{log.notes}</p>}

        {log.tags.length > 0 && (
          <div className={styles.tags}>
            {log.tags.map((t) => (
              <span key={t} className={styles.tag}>{t}</span>
            ))}
          </div>
        )}

        {linkedOutfit && (
          <div className={styles.linkedSection}>
            <p className="label">Saved outfit</p>
            <button
              type="button"
              className={styles.linkedOutfit}
              onClick={() => navigate(`/outfit/${linkedOutfit.id}`)}
            >
              <span className={styles.linkedOutfitName}>{linkedOutfit.name}</span>
              <span className={styles.linkedOutfitMeta}>
                {linkedOutfit.garmentIds.length}{' '}
                {linkedOutfit.garmentIds.length === 1 ? 'piece' : 'pieces'}
              </span>
              <span className={styles.linkedChevron} aria-hidden="true">›</span>
            </button>
          </div>
        )}

        {!photoUrl && !log.notes && log.tags.length === 0 && !linkedOutfit && (
          <p className={styles.emptyNote}>No details added.</p>
        )}
      </div>

      {/* ── Delete ─────────────────────────────────────────────────────── */}
      <div className={styles.deleteArea}>
        {!confirmDelete ? (
          <button
            type="button"
            className={styles.deleteBtn}
            onClick={() => setConfirmDelete(true)}
          >
            Delete entry
          </button>
        ) : (
          <div className={styles.confirmRow}>
            <p className={styles.confirmText}>Delete this entry permanently?</p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={handleDelete}>
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
