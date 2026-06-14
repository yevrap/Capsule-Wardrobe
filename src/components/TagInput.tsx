import { useState, type KeyboardEvent } from 'react';
import styles from './TagInput.module.css';

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  id?: string;
}

// Type a value and press Enter or comma to add it as a chip.
// Tap/click a chip to remove it.
export function TagInput({ value, onChange, placeholder = 'Type and press Enter', id }: TagInputProps) {
  const [draft, setDraft] = useState('');

  function commit(raw: string) {
    const tag = raw.trim().toLowerCase();
    if (tag && !value.includes(tag)) {
      onChange([...value, tag]);
    }
    setDraft('');
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit(draft);
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  function handleBlur() {
    if (draft.trim()) commit(draft);
  }

  return (
    <div className={styles.container}>
      {value.map((tag) => (
        <button
          key={tag}
          type="button"
          className={styles.chip}
          onClick={() => onChange(value.filter((t) => t !== tag))}
          aria-label={`Remove ${tag}`}
        >
          {tag} <span className={styles.chipX} aria-hidden="true">✕</span>
        </button>
      ))}
      <input
        id={id}
        type="text"
        className={styles.input}
        value={draft}
        placeholder={value.length === 0 ? placeholder : ''}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        autoComplete="off"
        autoCapitalize="none"
      />
    </div>
  );
}
