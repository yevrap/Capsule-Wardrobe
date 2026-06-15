// Image compression utilities.
//
// Two outputs per photo:
//   compressed  — ~1200px wide, JPEG 85% quality.
//                 High enough for AI image-editing APIs that need a recognisable garment.
//   thumbnail   — ~400px wide, JPEG 75% quality.
//                 Fast to render in inventory grids; never sent to AI models.

function resizeAndCompress(
  file: File | Blob,
  maxWidth: number,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      const scale = img.width > maxWidth ? maxWidth / img.width : 1;
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);

      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas 2D context unavailable')); return; }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('canvas.toBlob returned null'));
        },
        'image/jpeg',
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Image failed to load'));
    };

    img.src = objectUrl;
  });
}

export function compressOriginal(file: File): Promise<Blob> {
  return resizeAndCompress(file, 1200, 0.85);
}

export function generateThumbnail(file: File | Blob): Promise<Blob> {
  return resizeAndCompress(file, 400, 0.75);
}

// Returns a temporary object URL from a Blob. Remember to call URL.revokeObjectURL
// when the component unmounts to avoid memory leaks.
export function blobToUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

/**
 * Downscales a file or blob to 224x224 and returns its raw RGBA ImageData.
 */
export function getModelInputData(fileOrBlob: File | Blob): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(fileOrBlob);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 224;
      canvas.height = 224;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Canvas 2D context unavailable'));
        return;
      }

      // Draw and stretch/crop to fill 224x224 square (MobileNet standard input)
      ctx.drawImage(img, 0, 0, 224, 224);
      URL.revokeObjectURL(objectUrl);

      try {
        const imageData = ctx.getImageData(0, 0, 224, 224);
        resolve(imageData);
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Image failed to load for model preprocessing'));
    };

    img.src = objectUrl;
  });
}

