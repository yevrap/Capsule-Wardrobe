// ─── Profiles ────────────────────────────────────────────────────────────────

export type ProfileRole = 'self' | 'partner' | 'child';

export interface ProfileSizes {
  top?: string;
  bottom?: string;
  shoe?: string;
}

export interface ProfileGoal {
  description: string;
  targetDate?: string; // ISO date
}

export interface Profile {
  id: string;
  name: string;
  role: ProfileRole;
  sizes: ProfileSizes;
  bodyNotes?: string;
  goals: ProfileGoal[];
  birthDate?: string; // ISO date — used for child size/growth tracking
  createdAt: string;  // ISO datetime
}

// ─── Garments ────────────────────────────────────────────────────────────────

export type GarmentCategory =
  | 'top'
  | 'bottom'
  | 'dress'
  | 'outerwear'
  | 'footwear'
  | 'accessory'
  | 'underlayer';

export type GarmentStatus = 'active' | 'laundry' | 'stored' | 'donated' | 'outgrown';

export type GarmentFit = 'snug' | 'true' | 'loose';

export type Season = 'spring' | 'summer' | 'fall' | 'winter';

// Photo stored as Blobs so IndexedDB handles binary natively.
// `tag` describes which angle/purpose the photo serves.
// `compressed` is the original at ~1200px / 85% quality.
// `thumbnail` is ~400px / 75% quality for fast grid rendering.
export type PhotoTag = 'front' | 'back' | 'tag' | 'detail';

export interface GarmentPhoto {
  id: string;
  tag: PhotoTag;
  compressed: Blob;  // ~1200px wide, JPEG 85%
  thumbnail: Blob;   // ~400px wide, JPEG 75%  — shown in grids and lists
  capturedAt: string;
}

// Context scores drive the quantitative outfit scoring system (see antigravity.md).
export interface ContextScores {
  work: number; // 0–5
  play: number; // 0–5
  town: number; // 0–5
}

export interface Garment {
  id: string;
  ownerId: string; // references Profile.id

  name: string;
  category: GarmentCategory;
  subcategory?: string;

  colors: string[];   // e.g. ['navy', 'cream'] — drives color-harmony scoring
  pattern?: string;   // e.g. 'solid', 'stripe', 'plaid'
  material: string[]; // e.g. ['cotton', 'elastane']

  photos: GarmentPhoto[];
  description?: string;

  brand?: string;
  size?: string;
  fit?: GarmentFit;
  condition?: number; // 1–5

  formality: number; // 1–5 — used in pair-compatibility scoring
  warmth: number;    // 1–5 — used in weather-fit scoring
  seasons: Season[];
  contexts: ContextScores;

  store?: string;
  purchaseUrl?: string;
  price?: number;
  currency?: string;
  purchaseDate?: string; // ISO date

  careInstructions?: string;
  tags: string[];
  notes?: string;

  status: GarmentStatus;
  wearCount: number;
  lastWornDate?: string; // ISO date

  createdAt: string;  // ISO datetime
  updatedAt: string;  // ISO datetime
}

// ─── Outfits ─────────────────────────────────────────────────────────────────

export interface Outfit {
  id: string;
  ownerId: string;
  name: string;
  garmentIds: string[];
  photos: GarmentPhoto[];
  occasionTags: string[];
  selfScore?: number; // 1–5, user's own rating
  timesWorn: number;
  lastWorn?: string;  // ISO date
  createdAt: string;
}

// ─── Wear log ────────────────────────────────────────────────────────────────

export interface WearLog {
  id: string;
  ownerId: string;
  date: string; // YYYY-MM-DD
  photo?: {
    compressed: Blob; // ~1200px / 85% JPEG — same spec as GarmentPhoto.compressed
    thumbnail:  Blob; // ~400px  / 75% JPEG — same spec as GarmentPhoto.thumbnail
  };
  outfitId?: string;
  garmentIds: string[];
  tags: string[];
  notes?: string;
  createdAt: string; // ISO datetime
}

// ─── Stores ──────────────────────────────────────────────────────────────────

export interface Store {
  id: string;
  name: string;
  url?: string;
  notes?: string;
}
