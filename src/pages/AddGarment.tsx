import styles from './AddGarment.module.css';

// Phase 1: full add-garment form with multi-photo capture, category, colors,
// brand, size, store, buy link, price, tags, and notes.
// This stub ships with Phase 0 so navigation works end-to-end.
export function AddGarment() {
  return (
    <div className="page">
      <header className={styles.header}>
        <p className="label">New item</p>
        <h1>Add garment</h1>
      </header>

      <div className="empty-state">
        <span className={styles.icon} aria-hidden="true">+</span>
        <h3>Coming in Phase 1</h3>
        <p>
          Photo capture, category, colours, brand, size, store,
          buy link, price, tags, and notes.
        </p>
      </div>
    </div>
  );
}
