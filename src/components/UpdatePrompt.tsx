import { useRegisterSW } from 'virtual:pwa-register/react';
import styles from './UpdatePrompt.module.css';

// Shown when a new service worker is waiting. Lets the user choose when to
// reload rather than having the app silently update under them.
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className={styles.banner} role="status" aria-live="polite">
      <p className={styles.text}>New version available</p>
      <button
        type="button"
        className={styles.updateBtn}
        onClick={() => updateServiceWorker(true)}
      >
        Update
      </button>
      <button
        type="button"
        className={styles.dismissBtn}
        onClick={() => setNeedRefresh(false)}
        aria-label="Dismiss update prompt"
      >
        ✕
      </button>
    </div>
  );
}
