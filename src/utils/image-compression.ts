/**
 * Compresses and resizes an image blob to a base64 data URI.
 * Helps keep PDF sizes manageable and avoids react-pdf rendering failures with large URIs.
 */
export async function compressImageToDataUri(
  blob: Blob,
  maxDimension = 1000,
  quality = 0.75
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      let { width, height } = img;

      const scale = Math.min(1, maxDimension / Math.max(width, height));
      if (scale < 1) {
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      // Force JPEG for better compatibility and smaller size in PDF
      resolve(canvas.toDataURL('image/jpeg', quality));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}
