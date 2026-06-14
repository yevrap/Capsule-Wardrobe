import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { useProfiles } from '@/contexts/ProfileContext';
import { blobToUrl } from '@/utils/image';
import type { WearLog } from '@/types';
import styles from './JournalPage.module.css';

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function formatShortDate(dateStr: string): string {
  const todayStr = todayISO();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().split('T')[0];
  if (dateStr === todayStr)  return 'Today';
  if (dateStr === yStr)      return 'Yesterday';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ─── Feed entry row ───────────────────────────────────────────────────────────

function EntryRow({ log }: { log: WearLog }) {
  const navigate = useNavigate();
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    const blob = log.photo?.thumbnail;
    if (!blob) { setThumbUrl(null); return; }
    const url = blobToUrl(blob);
    setThumbUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [log.photo]);

  return (
    <button
      type="button"
      className={styles.entryRow}
      onClick={() => navigate(`/journal/${log.id}`)}
    >
      <div className={styles.entryThumb}>
        {thumbUrl
          ? <img src={thumbUrl} alt="" className={styles.entryThumbImg} />
          : <span className={styles.entryThumbPlaceholder} aria-hidden="true">◈</span>
        }
      </div>
      <div className={styles.entryInfo}>
        <p className={styles.entryDate}>{formatShortDate(log.date)}</p>
        {log.notes
          ? <p className={styles.entryNotes}>{log.notes}</p>
          : log.tags.length === 0
            ? <p className={styles.entryNotesEmpty}>No notes</p>
            : null
        }
        {log.tags.length > 0 && (
          <div className={styles.entryTags}>
            {log.tags.map((t) => (
              <span key={t} className={styles.entryTag}>{t}</span>
            ))}
          </div>
        )}
      </div>
      <span className={styles.entryChevron} aria-hidden="true">›</span>
    </button>
  );
}

// ─── Calendar view ────────────────────────────────────────────────────────────

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function CalendarView({
  logs,
  onDayPress,
}: {
  logs: WearLog[];
  onDayPress: (dateStr: string, existingLog?: WearLog) => void;
}) {
  const todayStr = todayISO();
  const todayDate = new Date();

  const [month, setMonth] = useState({
    year: todayDate.getFullYear(),
    month: todayDate.getMonth(),
  });

  const logsByDate = new Map(logs.map((l) => [l.date, l]));

  const monthStr = `${month.year}-${String(month.month + 1).padStart(2, '0')}`;
  const monthLogs = logs
    .filter((l) => l.date.startsWith(monthStr))
    .sort((a, b) => b.date.localeCompare(a.date));

  const firstWeekday = new Date(month.year, month.month, 1).getDay();
  const daysInMonth  = new Date(month.year, month.month + 1, 0).getDate();

  const cells: Array<number | null> = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function dateStr(day: number): string {
    return `${month.year}-${String(month.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function prevMonth() {
    setMonth((m) => m.month === 0
      ? { year: m.year - 1, month: 11 }
      : { year: m.year, month: m.month - 1 });
  }

  function nextMonth() {
    setMonth((m) => m.month === 11
      ? { year: m.year + 1, month: 0 }
      : { year: m.year, month: m.month + 1 });
  }

  const isCurrentMonth =
    month.year === todayDate.getFullYear() && month.month === todayDate.getMonth();

  const monthLabel = new Date(month.year, month.month, 1)
    .toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div className={styles.calendar}>
      <div className={styles.calHeader}>
        <button
          type="button"
          className={styles.calNavBtn}
          onClick={prevMonth}
          aria-label="Previous month"
        >
          ‹
        </button>
        <span className={styles.calMonth}>{monthLabel}</span>
        <button
          type="button"
          className={styles.calNavBtn}
          onClick={nextMonth}
          disabled={isCurrentMonth}
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <div className={styles.calGrid}>
        {DAY_LABELS.map((d) => (
          <div key={d} className={styles.calDayLabel}>{d}</div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`e${i}`} />;
          const ds       = dateStr(day);
          const hasLog   = logsByDate.has(ds);
          const isToday  = ds === todayStr;
          const isFuture = ds > todayStr;
          return (
            <button
              key={ds}
              type="button"
              disabled={isFuture}
              onClick={() => onDayPress(ds, logsByDate.get(ds))}
              aria-label={`${ds}${hasLog ? ', outfit logged' : ''}`}
              className={[
                styles.calDay,
                hasLog   ? styles.calDayLogged  : '',
                isToday  ? styles.calDayToday   : '',
                isFuture ? styles.calDayFuture  : '',
              ].join(' ')}
            >
              <span className={styles.calDayNum}>{day}</span>
              {hasLog && <span className={styles.calDot} aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      {monthLogs.length > 0 ? (
        <div className={styles.calEntries}>
          <p className={styles.calEntriesLabel}>
            {monthLogs.length} {monthLogs.length === 1 ? 'entry' : 'entries'} this month
          </p>
          {monthLogs.map((l) => <EntryRow key={l.id} log={l} />)}
        </div>
      ) : (
        <p className={styles.calEmpty}>No entries logged this month.</p>
      )}
    </div>
  );
}

// ─── Journal page ─────────────────────────────────────────────────────────────

export function JournalPage() {
  const navigate = useNavigate();
  const { activeProfile } = useProfiles();
  const [calView, setCalView] = useState(false);

  const todayStr = todayISO();

  const logs = useLiveQuery(
    () => activeProfile
      ? db.wearLogs
          .where('ownerId').equals(activeProfile.id)
          .reverse()
          .sortBy('date')
      : [],
    [activeProfile?.id],
  );

  const todayLog  = logs?.find((l) => l.date === todayStr);
  const pastLogs  = logs?.filter((l) => l.date !== todayStr) ?? [];

  function handleDayPress(dateStr: string, existing?: WearLog) {
    if (existing) navigate(`/journal/${existing.id}`);
    else          navigate(`/journal/add?date=${dateStr}`);
  }

  const todayFormatted = new Date().toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  return (
    <div className="page">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className={styles.header}>
        <div>
          <p className="label">Outfits</p>
          <h1 className={styles.heading}>Journal</h1>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          style={{ padding: '8px 18px', fontSize: 13 }}
          onClick={() => navigate('/journal/add')}
        >
          + Log
        </button>
      </header>

      {/* ── Tab row ────────────────────────────────────────────────────── */}
      <div className={styles.tabRow}>
        <button
          type="button"
          className={styles.tabBtn}
          onClick={() => navigate('/outfits')}
        >
          Saved
        </button>
        <button
          type="button"
          className={[styles.tabBtn, styles.tabBtnActive].join(' ')}
        >
          Journal
        </button>
        <div className={styles.viewToggle}>
          <button
            type="button"
            className={[styles.viewBtn, !calView ? styles.viewBtnActive : ''].join(' ')}
            onClick={() => setCalView(false)}
            aria-label="List view"
            aria-pressed={!calView}
          >
            ☰
          </button>
          <button
            type="button"
            className={[styles.viewBtn, calView ? styles.viewBtnActive : ''].join(' ')}
            onClick={() => setCalView(true)}
            aria-label="Calendar view"
            aria-pressed={calView}
          >
            ▦
          </button>
        </div>
      </div>

      {/* ── Feed or calendar ────────────────────────────────────────────── */}
      {calView ? (
        <CalendarView logs={logs ?? []} onDayPress={handleDayPress} />
      ) : (
        <div className={styles.feed}>
          {/* Today prompt or today's entry */}
          {todayLog ? (
            <EntryRow log={todayLog} />
          ) : (
            <button
              type="button"
              className={styles.todayPrompt}
              onClick={() => navigate('/journal/add')}
            >
              <span className={styles.todayIcon} aria-hidden="true">+</span>
              <div className={styles.todayText}>
                <p className={styles.todayLabel}>Log today's outfit</p>
                <p className={styles.todayDate}>{todayFormatted}</p>
              </div>
            </button>
          )}

          {/* Past entries */}
          {pastLogs.length === 0 && !todayLog && (
            <div className={styles.emptyFeed}>
              <span className={styles.emptyIcon} aria-hidden="true">◈</span>
              <p className={styles.emptyText}>
                Log your first look and it'll show up here.
              </p>
            </div>
          )}

          {pastLogs.map((l) => <EntryRow key={l.id} log={l} />)}
        </div>
      )}
    </div>
  );
}
