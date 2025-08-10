// DownloadCircleButton.tsx
import React from 'react';

async function addWatermarkAndDownload(videoEl: HTMLVideoElement, filename = 'circle.mp4') {
  // Простейший путь: взять canvas, отрендерить текущее кадр + watermark и скачать как image.
  // Если нужно скачать видео — лучше снимать blob на сервере. Здесь пример для кадра/превью.
  const canvas = document.createElement('canvas');
  canvas.width = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
  // размытие (пример)
  // ctx.filter = 'blur(2px)'; // фильтр применится к следующему drawImage
  // водяной знак
  ctx.font = '24px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText('MyApp', canvas.width - 100, canvas.height - 20);

  canvas.toBlob(blob => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename.replace('.mp4', '.png');
    a.click();
    URL.revokeObjectURL(a.href);
  }, 'image/png');
}

export const DownloadCircleButton: React.FC<{ videoRef: React.RefObject<HTMLVideoElement> }> = ({ videoRef }) => {
  return (
    <button onClick={() => {
      const v = videoRef.current;
      if (!v) return alert('видео недоступно');
      addWatermarkAndDownload(v);
    }}>
      Скачать кружок
    </button>
  );
};
