import { useState } from 'react';
import { db } from '@/db';
import { generateId } from '@/utils/id';
import styles from './Onboarding.module.css';

export function Onboarding() {
  const [starting, setStarting] = useState(false);

  async function handleStart() {
    setStarting(true);
    // Create a default profile — the user can rename it and add more in Settings.
    await db.profiles.add({
      id: generateId(),
      name: 'My Wardrobe',
      role: 'self',
      sizes: {},
      goals: [],
      createdAt: new Date().toISOString(),
    });
    // ProfileProvider's useLiveQuery picks up the new profile and exits the
    // onboarding gate automatically — no navigate() needed.
  }

  return (
    <div className={styles.screen}>
      <div className={styles.welcomeContent}>
        <p className={styles.welcomeEyebrow} aria-hidden="true">◈</p>
        <h1 className={styles.welcomeTitle}>Capsule</h1>
        <p className={styles.welcomeSub}>Your wardrobe, organized.</p>
      </div>
      <div className={styles.welcomeFooter}>
        <button
          type="button"
          className="btn btn-primary"
          style={{ width: '100%' }}
          onClick={handleStart}
          disabled={starting}
        >
          {starting ? '…' : 'Get started'}
        </button>
        <p className={styles.onboardingHint}>
          Add more profiles any time from Settings.
        </p>
      </div>
    </div>
  );
}
