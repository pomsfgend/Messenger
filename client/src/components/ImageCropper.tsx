

import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import type { Point, Area } from 'react-easy-crop';
import { useI18n } from '../hooks/useI18n';

interface ImageCropperProps {
  imageSrc: string;
  onClose: () => void;
  onCropComplete: (croppedAreaPixels: Area) => void;
}

const ImageCropper: React.FC<ImageCropperProps> = ({ imageSrc, onClose, onCropComplete }) => {
  const { t } = useI18n();
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropChange = useCallback((location: Point) => {
    setCrop(location);
  }, []);

  const onZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom);
  }, []);

  const handleCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = () => {
    if (croppedAreaPixels) {
      onCropComplete(croppedAreaPixels);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[130] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 animate-fade-in-up flex flex-col" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">{t('cropper.title')}</h2>
        <div className="relative w-full h-80 bg-slate-200 dark:bg-slate-900 rounded-lg">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            onCropChange={onCropChange}
            onZoomChange={onZoomChange}
            onCropComplete={handleCropComplete}
            cropShape="round"
            showGrid={false}
          />
        </div>
        <div className="flex items-center gap-4">
            <span className="text-sm">{t('cropper.zoom')}</span>
            <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                aria-labelledby="Zoom"
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full"
            />
        </div>
        <div className="flex justify-end gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
          <button onClick={onClose} className="bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors">{t('common.cancel')}</button>
          <button onClick={handleSave} className="bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-indigo-400/50">
            {t('common.saveChanges')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageCropper;