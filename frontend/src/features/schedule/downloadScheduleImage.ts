import { toPng } from 'html-to-image';

interface DownloadScheduleImageOptions {
  fileName: string;
  targetWidth: number;
  backgroundColor: string;
}

function waitForImages(node: HTMLElement) {
  const images = [...node.querySelectorAll('img')];
  return Promise.all(images.map(image => {
    if (image.complete && image.naturalWidth > 0) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      image.addEventListener('load', () => resolve(), { once: true });
      image.addEventListener('error', () => reject(new Error('Не удалось загрузить изображение в макете.')), { once: true });
    });
  }));
}

export async function downloadScheduleImage(node: HTMLElement, {
  fileName,
  targetWidth,
  backgroundColor,
}: DownloadScheduleImageOptions) {
  await document.fonts?.ready;
  await waitForImages(node);

  const width = node.getBoundingClientRect().width;
  if (!Number.isFinite(width) || width <= 0) throw new Error('Макет пока не готов к сохранению.');

  const dataUrl = await toPng(node, {
    backgroundColor,
    cacheBust: true,
    pixelRatio: Math.max(1, targetWidth / width),
  });
  const anchor = document.createElement('a');
  anchor.href = dataUrl;
  anchor.download = fileName;
  anchor.click();
}
