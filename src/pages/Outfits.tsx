import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { useProfiles } from '@/contexts/ProfileContext';
import { blobToUrl } from '@/utils/image';
import type { Garment, Outfit } from '@/types';
import styles from './Outfits.module.css';

// ─── Garment photo collage ────────────────────────────────────────────────────

function OutfitCollage({ previewGarments }: { previewGarments: Garment[] }) {
  const [urls, setUrls] = useState<string[]>([]);

  const photoKey = previewGarments.map((g) => g.photos[0]?.id ?? 'x').join(',');

  useEffect(() => {
    const created = previewGarments.map((g) => {
      const blob = g.photos[0]?.thumbnail;
      return blob ? blobToUrl(blob) : '';
    });
    setUrls(created);
    return () => created.filter(Boolean).forEach((u) => URL.revokeObjectURL(u));
    // photoKey encodes all garment+photo IDs — stable string dep is intentional
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoKey]);

  const count = previewGarments.length;

  if (count === 0) {
    return (
      <div className={styles.collageSingle}>
        <span className={styles.collageEmpty} aria-hidden="true">◈</span>
      </div>
    );
  }

  if (count === 1) {
    return (
      <div className={styles.collageSingle}>
        {urls[0]
          ? <img src={urls[0]} alt="" className={styles.collageImg} />
          : <span className={styles.collageEmpty} aria-hidden="true">◈</span>
        }
      </div>
    );
  }

  // 2–4 garments: 2×2 grid (empty slots are just the surface colour)
  return (
    <div className={styles.collageGrid}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={styles.collageCell}>
          {urls[i]
            ? <img src={urls[i]} alt="" className={styles.collageImg} />
            : <div className={styles.collageBlank} />
          }
        </div>
      ))}
    </div>
  );
}

// ─── Outfit card ──────────────────────────────────────────────────────────────

function OutfitCard({
  outfit,
  garmentMap,
}: {
  outfit: Outfit;
  garmentMap: Map<string, Garment>;
}) {
  const navigate = useNavigate();
  const previewGarments = outfit.garmentIds
    .slice(0, 4)
    .map((id) => garmentMap.get(id))
    .filter((g): g is Garment => g !== undefined);

  return (
    <button
      type="button"
      className={styles.card}
      onClick={() => navigate(`/outfit/${outfit.id}`)}
      aria-label={outfit.name}
    >
      <OutfitCollage previewGarments={previewGarments} />
      <p className={styles.cardName}>{outfit.name}</p>
      <p className={styles.cardMeta}>
        {outfit.garmentIds.length} {outfit.garmentIds.length === 1 ? 'piece' : 'pieces'}
        {outfit.occasionTags.length > 0 && ` · ${outfit.occasionTags[0]}`}
      </p>
    </button>
  );
}

// ─── Outfits page ─────────────────────────────────────────────────────────────

export function Outfits() {
  const navigate = useNavigate();
  const { activeProfile } = useProfiles();

  const outfits = useLiveQuery(
    () =>
      activeProfile
        ? db.outfits.where('ownerId').equals(activeProfile.id).reverse().sortBy('createdAt')
        : [],
    [activeProfile?.id],
  );

  const garments = useLiveQuery(
    () =>
      activeProfile
        ? db.garments.where('ownerId').equals(activeProfile.id).toArray()
        : [],
    [activeProfile?.id],
  );

  const garmentMap = useMemo(() => {
    const m = new Map<string, Garment>();
    garments?.forEach((g) => m.set(g.id, g));
    return m;
  }, [garments]);

  const total = outfits?.length ?? 0;

  return (
    <div className="page">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className={styles.header}>
        <div>
          <p className="label">Outfits</p>
          <h1 className={styles.heading}>Your looks</h1>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          style={{ padding: '8px 18px', fontSize: 13 }}
          onClick={() => navigate('/outfits/add')}
        >
          + Create
        </button>
      </header>

      {total === 0 ? (
        <div className="empty-state">
          <span className={styles.emptyIcon} aria-hidden="true">◈</span>
          <h3>No outfits yet</h3>
          <p>Combine garments into a look and save it here.</p>
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: 8 }}
            onClick={() => navigate('/outfits/add')}
          >
            Create first outfit
          </button>
        </div>
      ) : (
        <>
          <p className={styles.count}>{total} {total === 1 ? 'outfit' : 'outfits'}</p>
          <div className={styles.grid}>
            {(outfits ?? []).map((o) => (
              <OutfitCard key={o.id} outfit={o} garmentMap={garmentMap} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
