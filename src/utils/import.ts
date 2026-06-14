import JSZip from 'jszip';
import { db } from '@/db';
import type { Garment, GarmentPhoto } from '@/types';
import { EXPORT_VERSION, type ExportGarment, type ExportManifest } from './export';

// ─── Step 1: preview without committing ─────────────────────────────────────
// Call this first so the UI can show what's in the file before the user confirms.

export interface ImportPreview {
  profileName: string;
  garmentCount: number;
  photoCount: number;
  exportedAt: string;
  // true if a profile with the same id already exists in this device's DB.
  // Importing will merge/overwrite existing records — it won't duplicate them.
  willMerge: boolean;
}

export async function previewImport(file: File): Promise<ImportPreview> {
  const zip = await JSZip.loadAsync(file);

  const manifestText = await zip.file('manifest.json')?.async('string');
  const profileText  = await zip.file('profile.json')?.async('string');

  if (!manifestText || !profileText) {
    throw new Error('Not a valid Capsule backup — missing manifest or profile data.');
  }

  const manifest: ExportManifest = JSON.parse(manifestText);

  if (manifest.capsuleVersion !== EXPORT_VERSION) {
    throw new Error(
      `This backup was made with a newer version of Capsule (v${manifest.capsuleVersion}). ` +
      `Please update the app to import it.`,
    );
  }

  const profile = JSON.parse(profileText);
  const existing = await db.profiles.get(manifest.profileId);

  return {
    profileName: profile.name,
    garmentCount: manifest.garmentCount,
    photoCount: manifest.photoCount,
    exportedAt: manifest.exportedAt,
    willMerge: !!existing,
  };
}

// ─── Step 2: actually import ─────────────────────────────────────────────────
// Uses Dexie's `put` / `bulkPut` so re-importing the same backup is safe —
// records are updated in place, never duplicated.

export interface ImportProgress {
  current: number;
  total: number;
  label: string;
}

export interface ImportResult {
  profileId: string;
  profileName: string;
  garmentsImported: number;
}

export async function runImport(
  file: File,
  onProgress?: (p: ImportProgress) => void,
): Promise<ImportResult> {
  const zip = await JSZip.loadAsync(file);

  const profileText  = await zip.file('profile.json')?.async('string');
  const garmentsText = await zip.file('garments.json')?.async('string');

  if (!profileText || !garmentsText) {
    throw new Error('Invalid Capsule backup — missing required files.');
  }

  const profile = JSON.parse(profileText);
  const exportGarments: ExportGarment[] = JSON.parse(garmentsText);
  const total = exportGarments.length;

  // Upsert profile first so garments can reference it.
  await db.profiles.put(profile);

  // Reconstruct each garment: pull photo Blobs out of the ZIP.
  const garments: Garment[] = [];

  for (let i = 0; i < exportGarments.length; i++) {
    const eg = exportGarments[i];

    onProgress?.({
      current: i + 1,
      total,
      label: `Importing ${i + 1} of ${total}…`,
    });

    const photos: GarmentPhoto[] = await Promise.all(
      eg.photos.map(async (ref) => {
        const [compBuf, thumbBuf] = await Promise.all([
          zip.file(ref.compressedFile)?.async('arraybuffer') ?? Promise.resolve(new ArrayBuffer(0)),
          zip.file(ref.thumbnailFile)?.async('arraybuffer')  ?? Promise.resolve(new ArrayBuffer(0)),
        ]);

        return {
          id: ref.id,
          tag: ref.tag,
          capturedAt: ref.capturedAt,
          compressed: new Blob([compBuf],  { type: 'image/jpeg' }),
          thumbnail:  new Blob([thumbBuf], { type: 'image/jpeg' }),
        };
      }),
    );

    garments.push({ ...eg, photos } as Garment);
  }

  // bulkPut = insert-or-replace on primary key — idempotent.
  await db.garments.bulkPut(garments);

  return {
    profileId: profile.id,
    profileName: profile.name,
    garmentsImported: garments.length,
  };
}
