import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '@/db';
import type { Profile, ProfileRole } from '@/types';
import { generateId } from '@/utils/id';
import styles from './Onboarding.module.css';

// Suggested starter profiles — one tap to pre-fill name and role.
const STARTER_SUGGESTIONS: { label: string; name: string; role: ProfileRole }[] = [
  { label: 'Yourself',       name: '',       role: 'self'    },
  { label: 'Your partner',   name: '',       role: 'partner' },
  { label: 'A child',        name: '',       role: 'child'   },
];

interface DraftProfile {
  name: string;
  role: ProfileRole;
}

type Step = 'welcome' | 'profiles' | 'done';

export function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('welcome');
  const [drafts, setDrafts] = useState<DraftProfile[]>([
    { name: '', role: 'self' },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addDraft(role: ProfileRole) {
    setDrafts((prev) => [...prev, { name: '', role }]);
  }

  function removeDraft(index: number) {
    setDrafts((prev) => prev.filter((_, i) => i !== index));
  }

  function updateDraft(index: number, patch: Partial<DraftProfile>) {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  async function save() {
    const named = drafts.filter((d) => d.name.trim().length > 0);
    if (named.length === 0) {
      setError('Please enter at least one name.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const now = new Date().toISOString();
      const profiles: Profile[] = named.map((d) => ({
        id: generateId(),
        name: d.name.trim(),
        role: d.role,
        sizes: {},
        goals: [],
        createdAt: now,
      }));

      await db.profiles.bulkAdd(profiles);
      setStep('done');
    } catch (err) {
      setError('Something went wrong. Please try again.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  if (step === 'welcome') {
    return (
      <div className={styles.screen}>
        <div className={styles.welcomeContent}>
          <p className={styles.welcomeEyebrow} aria-hidden="true">◈</p>
          <h1 className={styles.welcomeTitle}>Capsule</h1>
          <p className={styles.welcomeSub}>Your wardrobe, organized.</p>
        </div>
        <div className={styles.welcomeFooter}>
          <button className="btn btn-primary" onClick={() => setStep('profiles')}>
            Get started
          </button>
        </div>
      </div>
    );
  }

  if (step === 'profiles') {
    const rolesAlreadyAdded = drafts.map((d) => d.role);

    return (
      <div className={styles.screen}>
        <div className={styles.stepHeader}>
          <h2>Who's using Capsule?</h2>
          <p className={styles.stepSub}>
            Add everyone's wardrobe now — you can always edit later.
          </p>
        </div>

        <div className={styles.draftList}>
          {drafts.map((draft, i) => (
            <div key={i} className={styles.draftRow}>
              <div className={styles.draftAvatar} aria-hidden="true">
                {draft.name.charAt(0).toUpperCase() || ROLE_ICON[draft.role]}
              </div>

              <div className={styles.draftFields}>
                <input
                  type="text"
                  placeholder={ROLE_PLACEHOLDER[draft.role]}
                  value={draft.name}
                  onChange={(e) => updateDraft(i, { name: e.target.value })}
                  maxLength={40}
                  autoFocus={i === 0}
                />
                <div className={styles.roleChips}>
                  {(['self', 'partner', 'child'] as ProfileRole[]).map((role) => (
                    <button
                      key={role}
                      className={[
                        styles.roleChip,
                        draft.role === role ? styles.roleChipActive : '',
                      ].join(' ')}
                      onClick={() => updateDraft(i, { role })}
                    >
                      {ROLE_LABEL[role]}
                    </button>
                  ))}
                </div>
              </div>

              {drafts.length > 1 && (
                <button
                  className={styles.removeBtn}
                  onClick={() => removeDraft(i)}
                  aria-label={`Remove ${draft.name || 'this person'}`}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Add another person — show suggestions for roles not yet added */}
        <div className={styles.addMore}>
          {STARTER_SUGGESTIONS.filter(
            (s) => !rolesAlreadyAdded.includes(s.role),
          ).map((s) => (
            <button
              key={s.role}
              className={styles.addMoreBtn}
              onClick={() => addDraft(s.role)}
            >
              + Add {s.label.toLowerCase()}
            </button>
          ))}
        </div>

        {error && <p className={styles.errorMsg}>{error}</p>}

        <div className={styles.stepFooter}>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Continue'}
          </button>
        </div>
      </div>
    );
  }

  // step === 'done'
  const named = drafts.filter((d) => d.name.trim().length > 0);
  return (
    <div className={styles.screen}>
      <div className={styles.doneContent}>
        <p className={styles.doneCheck} aria-hidden="true">✓</p>
        <h2>You're all set.</h2>
        <p className={styles.stepSub}>
          {named.length === 1
            ? `${named[0].name}'s wardrobe is ready.`
            : `${named.map((d) => d.name).join(', ')} — wardrobes ready.`}
        </p>
      </div>
      <div className={styles.stepFooter}>
        <button
          className="btn btn-primary"
          onClick={() => navigate('/inventory', { replace: true })}
        >
          Open Capsule
        </button>
      </div>
    </div>
  );
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ROLE_ICON: Record<ProfileRole, string>        = { self: '↑', partner: '→', child: '↓' };
const ROLE_LABEL: Record<ProfileRole, string>       = { self: 'Me', partner: 'Partner', child: 'Child' };
const ROLE_PLACEHOLDER: Record<ProfileRole, string> = {
  self:    'Your name',
  partner: "Partner's name",
  child:   "Child's name",
};
