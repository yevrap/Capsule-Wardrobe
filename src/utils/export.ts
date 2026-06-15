import JSZip from 'jszip';
import { db } from '@/db';
import type { Garment, GarmentPhoto } from '@/types';

// ─── ZIP format (v1) ─────────────────────────────────────────────────────────
//
//   manifest.json          — version tag + counts
//   profile.json           — Profile record (preserves id for upsert on import)
//   garments.json          — garment metadata; Blobs replaced by file paths
//   images/<gId>/<pId>-compressed.jpg
//   images/<gId>/<pId>-thumbnail.jpg
//
// Keeping JSON and images separate makes the format inspectable and
// forward-compatible — new fields in a future version are just ignored.

export const EXPORT_VERSION = 1;

export interface ExportManifest {
  capsuleVersion: number;
  exportedAt: string;
  profileId: string;
  garmentCount: number;
  photoCount: number;
}

// Photo ref stored in garments.json (replaces the Blob fields).
export interface ExportPhotoRef {
  id: string;
  tag: GarmentPhoto['tag'];
  capturedAt: string;
  compressedFile: string; // relative path inside ZIP
  thumbnailFile: string;
}

export type ExportGarment = Omit<Garment, 'photos'> & { photos: ExportPhotoRef[] };

export interface ExportProgress {
  phase: 'loading' | 'compressing' | 'done';
  current: number;
  total: number;
  label: string;
}

// ─── Main export function ────────────────────────────────────────────────────

export async function exportProfile(
  profileId: string,
  onProgress?: (p: ExportProgress) => void,
): Promise<void> {
  const [profile, garments] = await Promise.all([
    db.profiles.get(profileId),
    db.garments.where('ownerId').equals(profileId).toArray(),
  ]);

  if (!profile) throw new Error('Profile not found');

  const totalPhotos = garments.reduce((n, g) => n + g.photos.length, 0);
  const zip = new JSZip();
  const exportGarments: ExportGarment[] = [];

  // Add each garment's photos to the ZIP and build the metadata list.
  for (let i = 0; i < garments.length; i++) {
    const garment = garments[i];

    onProgress?.({
      phase: 'loading',
      current: i + 1,
      total: garments.length,
      label: `Reading ${i + 1} of ${garments.length} items…`,
    });

    const photoRefs: ExportPhotoRef[] = garment.photos.map((photo) => {
      const base = `images/${garment.id}/${photo.id}`;
      zip.file(`${base}-compressed.jpg`, photo.compressed);
      zip.file(`${base}-thumbnail.jpg`,  photo.thumbnail);
      return {
        id: photo.id,
        tag: photo.tag,
        capturedAt: photo.capturedAt,
        compressedFile: `${base}-compressed.jpg`,
        thumbnailFile:  `${base}-thumbnail.jpg`,
      };
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { photos: _blobs, ...rest } = garment;
    exportGarments.push({ ...rest, photos: photoRefs });
  }

  const manifest: ExportManifest = {
    capsuleVersion: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    profileId,
    garmentCount: garments.length,
    photoCount: totalPhotos,
  };

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('profile.json',  JSON.stringify(profile,  null, 2));
  zip.file('garments.json', JSON.stringify(exportGarments, null, 2));

  // Generate the ZIP blob, reporting compression progress.
  const blob = await zip.generateAsync(
    { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
    (meta) => {
      onProgress?.({
        phase: 'compressing',
        current: Math.round(meta.percent),
        total: 100,
        label: `Compressing… ${Math.round(meta.percent)}%`,
      });
    },
  );

  onProgress?.({ phase: 'done', current: 1, total: 1, label: 'Ready' });

  const safeName = profile.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const date = new Date().toISOString().slice(0, 10);
  await triggerDownload(blob, `capsule-${safeName}-${date}.zip`);
}

// ─── Cross-platform download / share ────────────────────────────────────────

async function triggerDownload(blob: Blob, filename: string): Promise<void> {
  // Use octet-stream (not application/zip) so Android doesn't auto-open the
  // file with its unzipper / file manager before the user saves it.
  const file = new File([blob], filename, { type: 'application/octet-stream' });

  // Web Share API with files — gives the native iOS/Android share sheet
  // (AirDrop, Files app, Drive, Messages…). Best mobile experience.
  if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Capsule backup' });
      return;
    } catch (err) {
      // AbortError = user dismissed the share sheet. Not an error.
      if ((err as DOMException).name === 'AbortError') return;
      // Any other error: fall through to <a download>.
    }
  }

  // Fallback: programmatic <a download> — works on desktop and Android Chrome.
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── AI-readable export ──────────────────────────────────────────────────────
//
//   wardrobe.md          — markdown with garment metadata + outfit listings
//   photos/<garmentId>.jpg — thumbnail for each garment (front tag preferred)
//
// Intended for pasting into an AI chat or agent to get outfit advice, analysis,
// or any other text-based AI workflow. Not a full backup — omits compressed
// images and DB IDs that are not meaningful outside the app.

export async function exportProfileForAI(
  profileId: string,
  onProgress?: (p: ExportProgress) => void,
): Promise<void> {
  const [profile, garments, outfits] = await Promise.all([
    db.profiles.get(profileId),
    db.garments.where('ownerId').equals(profileId).toArray(),
    db.outfits.where('ownerId').equals(profileId).toArray(),
  ]);

  if (!profile) throw new Error('Profile not found');

  const zip = new JSZip();
  const garmentMap = new Map(garments.map((g) => [g.id, g]));

  // Write thumbnails
  for (let i = 0; i < garments.length; i++) {
    const g = garments[i];
    onProgress?.({
      phase: 'loading',
      current: i + 1,
      total: garments.length,
      label: `Writing ${i + 1} of ${garments.length} items…`,
    });
    const photo = g.photos.find((p) => p.tag === 'front') ?? g.photos[0];
    if (photo) zip.file(`photos/${g.id}.jpg`, photo.thumbnail);
  }

  // Build wardrobe.md
  const lines: string[] = [
    `# ${profile.name} — Wardrobe`,
    ``,
    `Exported ${new Date().toISOString().slice(0, 10)} · ${garments.length} items · ${outfits.length} outfits`,
    ``,
    `---`,
    ``,
    `## Garments`,
    ``,
  ];

  for (const g of garments) {
    lines.push(`### ${g.name}`);
    lines.push(``);
    lines.push(`- **Category:** ${g.category}${g.subcategory ? ` / ${g.subcategory}` : ''}`);
    if (g.colors.length > 0)    lines.push(`- **Colors:** ${g.colors.join(', ')}`);
    if (g.brand)                lines.push(`- **Brand:** ${g.brand}`);
    if (g.size)                 lines.push(`- **Size:** ${g.size}${g.fit ? ` (${g.fit})` : ''}`);
    if (g.material.length > 0)  lines.push(`- **Material:** ${g.material.join(', ')}`);
    if (g.seasons.length > 0)   lines.push(`- **Seasons:** ${g.seasons.join(', ')}`);
    if (g.tags.length > 0)      lines.push(`- **Tags:** ${g.tags.join(', ')}`);
    lines.push(`- **Formality:** ${g.formality}/5 · **Warmth:** ${g.warmth}/5`);
    lines.push(`- **Times worn:** ${g.wearCount}${g.lastWornDate ? ` · Last worn: ${g.lastWornDate}` : ''}`);
    if (g.price != null)        lines.push(`- **Price:** ${g.price}${g.currency ? ` ${g.currency}` : ''}`);
    if (g.notes)                lines.push(`- **Notes:** ${g.notes}`);
    if (g.photos.length > 0)    lines.push(`- **Photo:** photos/${g.id}.jpg`);
    lines.push(`- **Status:** ${g.status}`);
    lines.push(``);
  }

  if (outfits.length > 0) {
    lines.push(`---`, ``, `## Outfits`, ``);
    for (const outfit of outfits) {
      lines.push(`### ${outfit.name}`, ``);
      const garmentNames = outfit.garmentIds
        .map((id) => garmentMap.get(id)?.name ?? `(id: ${id})`)
        .join(', ');
      lines.push(`- **Garments:** ${garmentNames}`);
      if (outfit.occasionTags.length > 0) lines.push(`- **Occasions:** ${outfit.occasionTags.join(', ')}`);
      if (outfit.selfScore != null)       lines.push(`- **Rating:** ${outfit.selfScore}/5`);
      lines.push(`- **Times worn:** ${outfit.timesWorn}${outfit.lastWorn ? ` · Last worn: ${outfit.lastWorn}` : ''}`);
      lines.push(``);
    }
  }

  zip.file('wardrobe.md', lines.join('\n'));

  const blob = await zip.generateAsync(
    { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
    (meta) => {
      onProgress?.({
        phase: 'compressing',
        current: Math.round(meta.percent),
        total: 100,
        label: `Compressing… ${Math.round(meta.percent)}%`,
      });
    },
  );

  onProgress?.({ phase: 'done', current: 1, total: 1, label: 'Ready' });

  const safeName = profile.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const date = new Date().toISOString().slice(0, 10);
  await triggerDownload(blob, `capsule-${safeName}-ai-${date}.zip`);
}
