/**
 * Compress and convert an image file to WebP format using Canvas API.
 * @param file - The original image File
 * @param maxWidth - Maximum width (default 1920)
 * @param quality - WebP quality 0-1 (default 0.82)
 * @returns A new File object in WebP format
 */
export async function compressToWebP(
  file: File,
  maxWidth = 1920,
  quality = 0.82
): Promise<File> {
  // If it's a PDF, return as-is (can't convert)
  if (file.type === 'application/pdf') return file;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('Canvas toBlob failed'));
          const baseName = file.name.replace(/\.[^.]+$/, '');
          const webpFile = new File([blob], `${baseName}.webp`, {
            type: 'image/webp',
            lastModified: Date.now(),
          });
          resolve(webpFile);
        },
        'image/webp',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Convert a camera-captured Blob to a compressed WebP File.
 */
export async function blobToWebPFile(
  blob: Blob,
  name: string,
  maxWidth = 1920,
  quality = 0.82
): Promise<File> {
  const tempFile = new File([blob], `${name}.jpg`, {
    type: blob.type || 'image/jpeg',
    lastModified: Date.now(),
  });
  return compressToWebP(tempFile, maxWidth, quality);
}
