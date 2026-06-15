import Dexie, { type Table } from 'dexie';
import type { Garment, Outfit, Profile, Store, WearLog } from '@/types';

// CapsuleDB is the single IndexedDB database for the app.
// All data lives here — no network, no backend.
//
// Schema versioning: bump the version number and add a new `.version(N).stores()`
// block whenever you add tables or indexed fields. Never mutate an existing version.
class CapsuleDB extends Dexie {
  profiles!: Table<Profile>;
  garments!: Table<Garment>;
  outfits!: Table<Outfit>;
  wearLogs!: Table<WearLog>;
  stores!: Table<Store>;

  constructor() {
    super('capsule');

    this.version(1).stores({
      // Primary key listed first, then indexed fields.
      // Arrays marked with * create multi-entry indexes (queryable per element).
      profiles: 'id, role, createdAt',
      garments: 'id, ownerId, category, status, createdAt, updatedAt, *tags, *colors, *seasons',
      outfits:  'id, ownerId, createdAt, *occasionTags',
      wearLogs: 'id, ownerId, date, outfitId',
      stores:   'id, name',
    });

    // v2: add compound index + *tags to wearLogs for calendar queries and tag filtering.
    this.version(2).stores({
      wearLogs: 'id, ownerId, date, outfitId, *tags, [ownerId+date]',
    });

    // v3: add support for Garment embeddings (stored as number[] properties)
    this.version(3).stores({});
  }
}

export const db = new CapsuleDB();
