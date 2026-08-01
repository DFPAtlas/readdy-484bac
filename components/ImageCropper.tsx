'use client';

import { useState, useCallback, useEffect } from 'react';
import Cropper, { Area } from 'react-easy-crop';

interface ImageCropperProps {
  file: File;
  aspect?: number;
  onCrop: (croppedFile: File) => void;
  onCancel: () => void;
}

function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = imageSrc;
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('No canvas context')); return; }
      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
      );
      canvas.toBlob((blob) => {
        if (!blob) { reject(new Error('Canvas toBlob failed')); return; }
        resolve(blob);
      }, 'image/jpeg', 0.9);
    };
    image.onerror = () => reject(new Error('Image load failed'));
  });
}

export default function ImageCropper({ file, aspect = 1, onCrop, onCancel }: ImageCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [imageSrc, setImageSrc] = useState<string>('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      setImageSrc(reader.result as string);
    });
    reader.readAsDataURL(file);
    return () => { reader.abort(); };
  }, [file]);

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleSave = useCallback(async () => {
    if (!croppedAreaPixels || !imageSrc) return;
    setProcessing(true);
    try {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels);
      const croppedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
      onCrop(croppedFile);
    } catch {
      onCancel();
    } finally {
      setProcessing(false);
    }
  }, [croppedAreaPixels, imageSrc, file.name, onCrop, onCancel]);

  if (!imageSrc) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="bg-[#111d35] rounded-2xl p-6">
          <div className="w-10 h-10 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] w-full max-w-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1e2d4d] flex items-center justify-between">
          <h3 className="text-white font-semibold text-sm">Crop Profile Photo</h3>
          <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer">
            <i className="ri-close-line text-lg"></i>
          </button>
        </div>

        <div className="relative w-full h-72 bg-black">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            cropShape="round"
            showGrid={false}
          />
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center gap-3">
            <i className="ri-zoom-in-line text-slate-400 text-sm"></i>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 h-1.5 bg-[#1e2d4d] rounded-full appearance-none cursor-pointer accent-teal-500"
            />
            <i className="ri-zoom-out-line text-slate-400 text-sm"></i>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white border border-[#1e2d4d] hover:bg-[#162036] cursor-pointer whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={processing}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-teal-500 text-white hover:bg-teal-400 disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              {processing ? 'Saving...' : 'Crop & Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}