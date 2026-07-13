export function getExtName(fileName: string): string {
  const idx = fileName.lastIndexOf('.');
  if (idx < 0) return '';
  return fileName.slice(idx + 1).toLowerCase();
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

export function fileToBase64(file: File, type = false): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (type) {
        resolve(result);
      } else {
        const idx = result.indexOf(',');
        resolve(idx >= 0 ? result.slice(idx + 1) : result);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function base64Size(base64String: string): number {
  if (!base64String) return 0;
  const padding = (base64String.match(/=+$/) || [''])[0].length;
  return Math.floor((base64String.length * 3) / 4) - padding;
}

export async function compressImage(file: File, config: { convertSize?: number; quality?: number } = {}): Promise<File> {
  const { convertSize = 1024 * 1024, quality = 0.8 } = config;
  if (file.size < convertSize) return file;

  const Compressor = (await import('compressorjs')).default;
  return new Promise((resolve, reject) => {
    new Compressor(file, {
      quality,
      mimeType: 'image/jpeg',
      success(result) {
        resolve(result as File);
      },
      error(err) {
        reject(err);
      },
    });
  });
}