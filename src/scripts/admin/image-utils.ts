export type ImageExtension = 'jpg' | 'png' | 'webp';

export interface PreparedImage {
  base64: string;
  extension: ImageExtension;
  size: number;
}

function extensionForFile(file: File): ImageExtension {
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  return 'jpg';
}

export function extensionFromPath(path: string): ImageExtension {
  const extension = path.split('.').pop()?.toLowerCase() ?? 'jpg';
  if (extension === 'png') return 'png';
  if (extension === 'webp') return 'webp';
  return 'jpg';
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    return createImageBitmap(file);
  }

  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('تعذّر قراءة الصورة.'));
    };
    image.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('تعذّر تجهيز الصورة.'));
      },
      mime,
      quality,
    );
  });
}

/**
 * Resizes and compresses an image in the browser before upload so the
 * repository stays small and every upload fits the 4 MB Worker limit.
 */
export async function prepareImage(
  file: File,
  targetExtension?: ImageExtension,
  maxDimension = 2000,
): Promise<PreparedImage> {
  const extension = targetExtension ?? extensionForFile(file);
  const bitmap = await loadBitmap(file);
  const width = bitmap.width;
  const height = bitmap.height;

  if (!width || !height) {
    throw new Error('أبعاد الصورة غير صالحة.');
  }

  const attempts: Array<{ max: number; quality: number }> = [
    { max: maxDimension, quality: 0.86 },
    { max: Math.round(maxDimension * 0.8), quality: 0.8 },
    { max: Math.round(maxDimension * 0.6), quality: 0.72 },
  ];

  for (const attempt of attempts) {
    const scale = Math.min(1, attempt.max / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));

    const context = canvas.getContext('2d');
    if (!context) throw new Error('تعذّر تجهيز الصورة.');

    if (extension === 'jpg') {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const mime =
      extension === 'png'
        ? 'image/png'
        : extension === 'webp'
          ? 'image/webp'
          : 'image/jpeg';

    const blob = await canvasToBlob(canvas, mime, attempt.quality);
    if (blob.size <= 4 * 1024 * 1024) {
      const buffer = new Uint8Array(await blob.arrayBuffer());
      return {
        base64: bytesToBase64(buffer),
        extension,
        size: blob.size,
      };
    }
  }

  throw new Error('الصورة كبيرة جدًا حتى بعد الضغط. جرّب صورة أصغر.');
}

export function imageExtensionForFile(file: File): ImageExtension {
  return extensionForFile(file);
}
