import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { useProfiles } from '@/contexts/ProfileContext';
import { useInventoryFilter } from '@/hooks/useInventoryFilter';
import { blobToUrl } from '@/utils/image';
import { CATEGORIES } from '@/components/GarmentForm';
import type { Garment } from '@/types';
import styles from './Inventory.module.css';

// ─── Garment card ─────────────────────────────────────────────────────────────

function GarmentCard({ garment }: { garment: Garment }) {
  const navigate = useNavigate();
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    const thumb = garment.photos[0]?.thumbnail;
    if (!thumb) { setThumbUrl(null); return; }
    const url = blobToUrl(thumb);
    setThumbUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [garment.photos]);

  return (
    <button
      className={styles.gridItem}
      onClick={() => navigate(`/item/${garment.id}`)}
      type="button"
      aria-label={garment.name}
    >
      <div className={styles.gridThumb}>
        {thumbUrl
          ? <img src={thumbUrl} alt={garment.name} className={styles.gridThumbImg} />
          : <span className={styles.gridThumbPlaceholder} aria-hidden="true">◈</span>
        }
      </div>
      <p className={styles.gridName}>{garment.name}</p>
      {garment.brand && <p className={styles.gridBrand}>{garment.brand}</p>}
    </button>
  );
}

// ─── Inventory page ───────────────────────────────────────────────────────────

export function Inventory() {
  const navigate = useNavigate();
  const { activeProfile, profiles, setActiveProfileId } = useProfiles();

  const garments = useLiveQuery(
    () =>
      activeProfile
        ? db.garments.where('ownerId').equals(activeProfile.id).reverse().sortBy('createdAt')
        : [],
    [activeProfile?.id],
  );

  const {
    filter, setFilter, filtered, allTags,
    activeFilterCount, toggleCategory, toggleTag, clearAll,
  } = useInventoryFilter(garments);

  const total    = garments?.length ?? 0;
  const showing  = filtered.length;
  const filtered_ = garments ? filtered : undefined; // undefined while loading

  return (
    <div className="page">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className={styles.header}>
        <div>
          <p className="label">Wardrobe</p>
          <h1 className={styles.profileName}>{activeProfile?.name ?? '—'}</h1>
        </div>
        {profiles.length > 1 && (
          <div className={styles.profilePills}>
            {profiles.map((p) => (
              <button
                key={p.id}
                type="button"
                className={[styles.profilePill, activeProfile?.id === p.id ? styles.profilePillActive : ''].join(' ')}
                onClick={() => setActiveProfileId(p.id)}
                aria-label={`Switch to ${p.name}`}
              >
                {p.name.charAt(0).toUpperCase()}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* ── Search + filters (shown once there are items) ──────────────── */}
      {total > 0 && (
        <div className={styles.filterBar}>

          {/* Search */}
          <div className={styles.searchRow}>
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Search name, brand, tag…"
              value={filter.search}
              onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
              aria-label="Search wardrobe"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
            />
            {activeFilterCount > 0 && (
              <button type="button" className={styles.clearBtn} onClick={clearAll}>
                Clear {activeFilterCount > 1 ? `(${activeFilterCount})` : ''}
              </button>
            )}
          </div>

          {/* Category chips */}
          <div className={styles.filterRow} role="group" aria-label="Filter by category">
            {CATEGORIES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={[styles.filterChip, filter.categories.includes(value) ? styles.filterChipActive : ''].join(' ')}
                onClick={() => toggleCategory(value)}
                aria-pressed={filter.categories.includes(value)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Tag chips — only shown when the wardrobe has tags */}
          {allTags.length > 0 && (
            <div className={styles.filterRow} role="group" aria-label="Filter by tag">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={[styles.filterChip, filter.tags.includes(tag) ? styles.filterChipActive : ''].join(' ')}
                  onClick={() => toggleTag(tag)}
                  aria-pressed={filter.tags.includes(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Content ────────────────────────────────────────────────────── */}
      {total === 0 ? (
        <div className="empty-state">
          <span className={styles.emptyIcon} aria-hidden="true">◈</span>
          <h3>No items yet</h3>
          <p>Add your first garment to start building your wardrobe.</p>
          <button type="button" className="btn btn-primary" style={{ marginTop: 8 }}
            onClick={() => navigate('/add')}>
            Add garment
          </button>
        </div>
      ) : (
        <>
          <div className={styles.toolbar}>
            <p className={styles.count}>
              {activeFilterCount > 0 && showing !== total
                ? `${showing} of ${total}`
                : `${total} ${total === 1 ? 'item' : 'items'}`}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-primary"
                style={{ padding: '8px 18px', fontSize: 13, minHeight: 'auto' }}
                onClick={() => navigate('/add')}>
                + Add
              </button>
            </div>
          </div>

          {showing === 0 ? (
            <div className="empty-state" style={{ paddingTop: 40 }}>
              <h3>No matches</h3>
              <p>Try a different search or clear the filters.</p>
              <button type="button" className="btn btn-ghost" style={{ marginTop: 8 }}
                onClick={clearAll}>
                Clear filters
              </button>
            </div>
          ) : (
            <div className={styles.grid}>
              {(filtered_ ?? []).map((g) => (
                <GarmentCard key={g.id} garment={g} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
