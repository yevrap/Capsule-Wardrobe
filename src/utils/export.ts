import JSZip from 'jszip';
import { db } from '@/db';
import type { Garment, GarmentPhoto, Outfit } from '@/types';

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

// ─── Backup export (ZIP) ─────────────────────────────────────────────────────

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
  await triggerDownload(blob, `capsule-${safeName}-${date}.zip`, 'Capsule backup');
}

// ─── Lookbook export (self-contained HTML) ───────────────────────────────────
//
// Produces a single .html file with all garment thumbnails embedded as base64
// data URIs, outfit cards, and wear stats. Opens in any browser on any device.
// No external dependencies — fully offline-capable.

export async function exportProfileLookbook(
  profileId: string,
  onProgress?: (p: ExportProgress) => void,
): Promise<void> {
  const [profile, garments, outfits] = await Promise.all([
    db.profiles.get(profileId),
    db.garments.where('ownerId').equals(profileId).toArray(),
    db.outfits.where('ownerId').equals(profileId).toArray(),
  ]);

  if (!profile) throw new Error('Profile not found');

  const garmentMap = new Map(garments.map((g) => [g.id, g]));

  // Convert each garment's best thumbnail Blob to a base64 data URI.
  const photoUris = new Map<string, string>();
  for (let i = 0; i < garments.length; i++) {
    onProgress?.({
      phase: 'loading',
      current: i + 1,
      total: garments.length,
      label: `Loading photos ${i + 1} of ${garments.length}…`,
    });
    const g = garments[i];
    const photo = g.photos.find((p) => p.tag === 'front') ?? g.photos[0];
    if (photo) photoUris.set(g.id, await blobToDataUri(photo.thumbnail));
  }

  onProgress?.({ phase: 'compressing', current: 50, total: 100, label: 'Building lookbook…' });

  const totalWears = garments.reduce((n, g) => n + g.wearCount, 0);
  const mostWorn   = garments.reduce<Garment | undefined>(
    (best, g) => (!best || g.wearCount > best.wearCount ? g : best), undefined,
  );
  const date = new Date().toISOString().slice(0, 10);

  const html = buildLookbookHtml({
    profileName: profile.name,
    date,
    garments,
    outfits,
    garmentMap,
    photoUris,
    totalWears,
    mostWorn,
  });

  onProgress?.({ phase: 'done', current: 1, total: 1, label: 'Ready' });

  const blob = new Blob([html], { type: 'text/html' });
  const safeName = profile.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  await triggerDownload(blob, `capsule-${safeName}-lookbook-${date}.html`, 'Capsule lookbook');
}

// ─── Lookbook HTML builder ───────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

interface LookbookData {
  profileName: string;
  date: string;
  garments: Garment[];
  outfits: Outfit[];
  garmentMap: Map<string, Garment>;
  photoUris: Map<string, string>;
  totalWears: number;
  mostWorn: Garment | undefined;
}

function buildLookbookHtml(d: LookbookData): string {
  const { profileName, date, garments, outfits, garmentMap, photoUris, totalWears, mostWorn } = d;

  function garmentCard(g: Garment): string {
    const uri  = photoUris.get(g.id);
    const cpw  = g.price && g.wearCount > 0
      ? ` &middot; $${(g.price / g.wearCount).toFixed(0)}/wear` : '';
    const worn = g.wearCount > 0
      ? `<span class="ga">${g.wearCount}&times;</span>${cpw}` : 'Not worn';
    const last = g.lastWornDate
      ? `<br><span class="dim">Last ${esc(g.lastWornDate)}</span>` : '';
    const chips = [...g.colors, ...g.seasons]
      .map((t) => `<span class="chip">${esc(t)}</span>`).join('');

    return `<div class="gc">
  <div class="gt">${uri
    ? `<img src="${uri}" alt="${esc(g.name)}" loading="lazy">`
    : '<span class="ph">&#9672;</span>'}</div>
  <p class="gn" title="${esc(g.name)}">${esc(g.name)}</p>
  ${g.brand ? `<p class="gb">${esc(g.brand)}</p>` : ''}
  <p class="gw">${worn}${last}</p>
  ${chips ? `<div class="chips">${chips}</div>` : ''}
</div>`;
  }

  function outfitCard(o: Outfit): string {
    const oGarments = o.garmentIds.map((id) => garmentMap.get(id)).filter(Boolean) as Garment[];
    const tags  = o.occasionTags.map((t) => `<span class="chip">${esc(t)}</span>`).join('');
    const tiles = oGarments.map((g) => {
      const uri = photoUris.get(g.id);
      return `<div class="ogt">
  <div class="ogth">${uri ? `<img src="${uri}" alt="${esc(g.name)}" loading="lazy">` : ''}</div>
  <p class="ogn">${esc(g.name)}</p>
</div>`;
    }).join('');

    const wornLine = o.timesWorn > 0
      ? `${o.timesWorn}&times;${o.lastWorn ? `<br>${esc(o.lastWorn)}` : ''}` : 'Not worn';

    return `<div class="oc">
  <div class="oh">
    <p class="on">${esc(o.name)}</p>
    <p class="ow">${wornLine}</p>
  </div>
  ${tags ? `<div class="ot">${tags}</div>` : ''}
  ${tiles ? `<div class="og">${tiles}</div>` : ''}
</div>`;
  }

  const statsHtml = [
    { n: garments.length, l: 'Items'       },
    { n: outfits.length,  l: 'Outfits'     },
    { n: totalWears,      l: 'Total wears' },
    mostWorn && mostWorn.wearCount > 0
      ? { n: mostWorn.wearCount, l: 'Most worn' } : null,
  ].filter(Boolean).map(
    (s) => s && `<div class="stat"><div class="sn">${s.n}</div><div class="sl">${esc(s.l)}</div></div>`,
  ).join('');

  const outfitSection = outfits.length > 0 ? `
<h2 class="sh">Outfits &middot; ${outfits.length}</h2>
<div class="outfits">${outfits.map(outfitCard).join('')}</div>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(profileName)} &mdash; Capsule</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{background:#0A0A0A;color:#F0EDE8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.5;-webkit-text-size-adjust:100%}
body{padding:24px 20px 72px;max-width:1120px;margin:0 auto}
@media(min-width:600px){body{padding:40px 40px 96px}}
header{margin-bottom:40px;padding-bottom:24px;border-bottom:1px solid #2A2A2A}
.logo{font-size:11px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:#6B6B6B;margin-bottom:10px}
h1{font-size:clamp(2rem,5vw,3rem);font-weight:200;letter-spacing:-.03em;margin-bottom:8px}
.meta{font-size:13px;color:#6B6B6B}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-bottom:48px}
.stat{background:#141414;border:1px solid #2A2A2A;border-radius:12px;padding:16px 18px}
.sn{font-size:2rem;font-weight:200;color:#C8B89A;line-height:1}
.sl{font-size:11px;font-weight:500;letter-spacing:.1em;text-transform:uppercase;color:#6B6B6B;margin-top:6px}
.sh{font-size:11px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:#6B6B6B;padding-bottom:12px;border-bottom:1px solid #2A2A2A;margin-bottom:24px}
.garments{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-bottom:64px}
@media(min-width:480px){.garments{grid-template-columns:repeat(3,1fr)}}
@media(min-width:680px){.garments{grid-template-columns:repeat(4,1fr)}}
@media(min-width:920px){.garments{grid-template-columns:repeat(5,1fr)}}
.gc{display:flex;flex-direction:column;gap:6px}
.gt{aspect-ratio:3/4;border-radius:10px;background:#141414;border:1px solid #2A2A2A;overflow:hidden;display:flex;align-items:center;justify-content:center}
.gt img{width:100%;height:100%;object-fit:cover;display:block}
.ph{color:#2A2A2A;font-size:2rem}
.gn{font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gb{font-size:11px;color:#6B6B6B;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:-2px}
.gw{font-size:11px;color:#6B6B6B;line-height:1.5}
.ga{color:#C8B89A}
.dim{color:#444}
.chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:1px}
.chip{padding:2px 8px;border-radius:100px;font-size:11px;background:#141414;border:1px solid #2A2A2A;color:#6B6B6B;text-transform:capitalize}
.outfits{display:flex;flex-direction:column;gap:16px;margin-bottom:64px}
.oc{background:#141414;border:1px solid #2A2A2A;border-radius:14px;padding:20px}
.oh{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
.on{font-size:1.05rem;font-weight:400}
.ow{font-size:12px;color:#6B6B6B;text-align:right;flex-shrink:0;line-height:1.5}
.ot{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:14px}
.og{display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:10px}
.ogt{display:flex;flex-direction:column;gap:4px}
.ogth{aspect-ratio:3/4;border-radius:8px;background:#1E1E1E;border:1px solid #2A2A2A;overflow:hidden}
.ogth img{width:100%;height:100%;object-fit:cover;display:block}
.ogn{font-size:10px;color:#6B6B6B;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
footer{font-size:12px;color:#444;text-align:center;padding-top:24px;border-top:1px solid #2A2A2A}
</style>
</head>
<body>
<header>
  <div class="logo">Capsule &middot; Wardrobe</div>
  <h1>${esc(profileName)}</h1>
  <p class="meta">Exported ${esc(date)} &middot; ${garments.length} items &middot; ${outfits.length} outfits</p>
</header>
<div class="stats">${statsHtml}</div>
<h2 class="sh">Wardrobe &middot; ${garments.length} items</h2>
<div class="garments">${garments.map(garmentCard).join('')}</div>
${outfitSection}
<footer>Generated by Capsule &middot; ${esc(date)}</footer>
</body>
</html>`;
}

// ─── Cross-platform download / share ────────────────────────────────────────

async function triggerDownload(blob: Blob, filename: string, shareTitle: string): Promise<void> {
  // Use octet-stream for the share target regardless of the blob's actual MIME
  // type. This prevents Android from auto-opening the file before the user can
  // save it. The file extension still identifies the format to iOS/macOS.
  const file = new File([blob], filename, { type: 'application/octet-stream' });

  // Web Share API with files — gives the native iOS/Android share sheet
  // (AirDrop, Files app, Drive, Messages…). Best mobile experience.
  if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: shareTitle });
      return;
    } catch (err) {
      // AbortError = user dismissed the share sheet. Not an error.
      if ((err as DOMException).name === 'AbortError') return;
      // Any other error: fall through to <a download>.
    }
  }

  // Fallback: programmatic <a download> — works on desktop and Android Chrome.
  // Uses the original blob (not the octet-stream File) so the browser receives
  // the correct MIME type for the downloaded file.
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
