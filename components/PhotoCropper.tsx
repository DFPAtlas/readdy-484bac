'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface PhotoCropperProps {
  onCropComplete: (croppedFile: File, previewUrl: string) => void;
  onCancel: () => void;
  aspectRatio?: number;
  maxOutputSize?: number;
  outputQuality?: number;
}

export default function PhotoCropper({
  onCropComplete,
  onCancel,
  aspectRatio = 1,
  maxOutputSize = 800,
  outputQuality = 0.9,
}: PhotoCropperProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imageSrc, setImageSrc] = useState<string>('');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [error, setError] = useState('');
  const [cropping, setCropping] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const MAX_FILE_SIZE = 10 * 1024 * 1024;

  useEffect(() => {
    const updateContainerSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };
    updateContainerSize();
    window.addEventListener('resize', updateContainerSize);
    return () => window.removeEventListener('resize', updateContainerSize);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('Image must be less than 10MB');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      setImageSrc(src);
      setZoom(1);
      setPan({ x: 0, y: 0 });
    };
    reader.readAsDataURL(file);
  };

  const handleImageLoad = () => {
    if (imageRef.current) {
      const img = imageRef.current;
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  };

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      setZoom((prev) => Math.max(0.5, Math.min(3, prev + delta)));
    },
    []
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    },
    [isDragging, dragStart]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({ x: touch.clientX - pan.x, y: touch.clientY - pan.y });
    }
  };

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging || e.touches.length !== 1) return;
      const touch = e.touches[0];
      setPan({
        x: touch.clientX - dragStart.x,
        y: touch.clientY - dragStart.y,
      });
    },
    [isDragging, dragStart]
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const constrainPan = () => {
    if (!containerRef.current || !imageRef.current) return { x: pan.x, y: pan.y };

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const cropSize = Math.min(containerRect.width, containerRect.height);

    const scaledW = naturalSize.width * zoom;
    const scaledH = naturalSize.height * zoom;

    const minX = Math.min(0, (cropSize - scaledW) / 2);
    const maxX = Math.max(0, (cropSize - scaledW) / 2);
    const minY = Math.min(0, (cropSize - scaledH) / 2);
    const maxY = Math.max(0, (cropSize - scaledH) / 2);

    return {
      x: Math.max(minX, Math.min(maxX, pan.x)),
      y: Math.max(minY, Math.max(minY, pan.y)),
    };
  };

  const performCrop = async () => {
    if (!imageRef.current || !containerRef.current) return;
    setCropping(true);

    const img = imageRef.current;
    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const cropSize = Math.min(containerRect.width, containerRect.height);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setCropping(false);
      setError('Failed to process image');
      return;
    }

    const outputSize = maxOutputSize;
    canvas.width = outputSize;
    canvas.height = outputSize / aspectRatio;

    const scaleX = naturalSize.width / (naturalSize.width * zoom);
    const scaleY = naturalSize.height / (naturalSize.height * zoom);

    const constrained = constrainPan();
    const displayScale = cropSize / (naturalSize.width * zoom);

    const sourceX = (-constrained.x / displayScale) * (naturalSize.width / cropSize);
    const sourceY = (-constrained.y / displayScale) * (naturalSize.height / cropSize);
    const sourceW = outputSize / (zoom * displayScale * (naturalSize.width / cropSize));
    const sourceH = (outputSize / aspectRatio) / (zoom * displayScale * (naturalSize.height / cropSize));

    ctx.fillStyle = '#162236';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const imgScale = zoom;
    const drawX = constrained.x + (containerRect.width - naturalSize.width * imgScale) / 2;
    const drawY = constrained.y + (containerRect.height - naturalSize.height * imgScale) / 2;

    const cropLeft = (containerRect.width - cropSize) / 2;
    const cropTop = (containerRect.height - cropSize) / 2;

    const sourceCropX = (cropLeft - drawX) / imgScale;
    const sourceCropY = (cropTop - drawY) / imgScale;
    const sourceCropW = cropSize / imgScale;
    const sourceCropH = cropSize / imgScale;

    ctx.drawImage(
      img,
      Math.max(0, sourceCropX),
      Math.max(0, sourceCropY),
      Math.min(naturalSize.width, sourceCropW),
      Math.min(naturalSize.height, sourceCropH),
      0,
      0,
      canvas.width,
      canvas.height
    );

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCropping(false);
          setError('Failed to create cropped image');
          return;
        }
        const ext = selectedFile?.name.split('.').pop() || 'jpg';
        const croppedFile = new File([blob], `cropped-profile.${ext}`, {
          type: blob.type || 'image/jpeg',
          lastModified: Date.now(),
        });
        const previewUrl = URL.createObjectURL(blob);
        onCropComplete(croppedFile, previewUrl);
        setCropping(false);
      },
      'image/jpeg',
      outputQuality
    );
  };

  const cropOverlaySize = Math.min(containerSize.width, containerSize.height);

  return (
    <div className="w-full">
      {!imageSrc ? (
        <div className="text-center py-8">
          <div className="w-20 h-20 bg-[#162236] rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-dashed border-slate-600">
            <i className="ri-image-add-line text-3xl text-slate-500"></i>
          </div>
          <p className="text-slate-400 mb-4 text-sm">Select a photo to crop and resize</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-6 py-3 bg-teal-500 text-slate-900 rounded-xl font-medium hover:bg-teal-400 transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className="ri-upload-2-line w-5 h-5 flex items-center justify-center"></i>
            Choose Photo
          </button>
          {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
        </div>
      ) : (
        <div className="space-y-4">
          {error && (
            <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-3 text-center">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {/* Cropper container */}
          <div
            ref={containerRef}
            className="relative w-full aspect-square max-w-md mx-auto rounded-2xl overflow-hidden bg-[#162236] border border-slate-700/50 select-none touch-none"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          >
            <img
              ref={imageRef}
              src={imageSrc}
              alt="Crop source"
              onLoad={handleImageLoad}
              draggable={false}
              className="absolute pointer-events-none"
              style={{
                left: '50%',
                top: '50%',
                transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                maxWidth: 'none',
                maxHeight: 'none',
                width: naturalSize.width || 'auto',
                height: naturalSize.height || 'auto',
              }}
            />

            {/* Dark overlay outside crop area */}
            <div className="absolute inset-0 pointer-events-none">
              <div
                className="absolute bg-black/60"
                style={{
                  left: 0,
                  top: 0,
                  width: '100%',
                  height: `${(containerSize.height - cropOverlaySize) / 2}px`,
                }}
              />
              <div
                className="absolute bg-black/60"
                style={{
                  left: 0,
                  bottom: 0,
                  width: '100%',
                  height: `${(containerSize.height - cropOverlaySize) / 2}px`,
                }}
              />
              <div
                className="absolute bg-black/60"
                style={{
                  left: 0,
                  top: `${(containerSize.height - cropOverlaySize) / 2}px`,
                  width: `${(containerSize.width - cropOverlaySize) / 2}px`,
                  height: `${cropOverlaySize}px`,
                }}
              />
              <div
                className="absolute bg-black/60"
                style={{
                  right: 0,
                  top: `${(containerSize.height - cropOverlaySize) / 2}px`,
                  width: `${(containerSize.width - cropOverlaySize) / 2}px`,
                  height: `${cropOverlaySize}px`,
                }}
              />
            </div>

            {/* Crop frame */}
            <div
              className="absolute border-2 border-teal-400 rounded-xl pointer-events-none"
              style={{
                left: `${(containerSize.width - cropOverlaySize) / 2}px`,
                top: `${(containerSize.height - cropOverlaySize) / 2}px`,
                width: `${cropOverlaySize}px`,
                height: `${cropOverlaySize}px`,
              }}
            >
              {/* Grid lines */}
              <div className="absolute inset-0">
                <div className="absolute left-1/3 top-0 bottom-0 w-px bg-teal-400/30" />
                <div className="absolute left-2/3 top-0 bottom-0 w-px bg-teal-400/30" />
                <div className="absolute top-1/3 left-0 right-0 h-px bg-teal-400/30" />
                <div className="absolute top-2/3 left-0 right-0 h-px bg-teal-400/30" />
              </div>
              {/* Corner markers */}
              <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-teal-400 rounded-tl-sm" />
              <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-teal-400 rounded-tr-sm" />
              <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-teal-400 rounded-bl-sm" />
              <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-teal-400 rounded-br-sm" />
            </div>

            {/* Instruction overlay */}
            {!isDragging && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-sm rounded-full px-4 py-1.5 pointer-events-none">
                <p className="text-xs text-white/80 whitespace-nowrap">
                  Drag to pan · Scroll to zoom
                </p>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="max-w-md mx-auto space-y-3">
            {/* Zoom slider */}
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 flex items-center justify-center">
                <i className="ri-zoom-out-line text-slate-500 text-sm"></i>
              </div>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="flex-1 h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-teal-500"
              />
              <div className="w-5 h-5 flex items-center justify-center">
                <i className="ri-zoom-in-line text-slate-500 text-sm"></i>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setImageSrc('');
                  setSelectedFile(null);
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                  setError('');
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="flex-1 px-4 py-3 bg-[#162236] text-slate-300 border border-slate-700/50 rounded-xl font-medium hover:bg-slate-700/50 transition-colors whitespace-nowrap cursor-pointer flex items-center justify-center gap-2"
              >
                <i className="ri-restart-line w-4 h-4 flex items-center justify-center"></i>
                New Photo
              </button>
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-3 bg-[#162236] text-slate-300 border border-slate-700/50 rounded-xl font-medium hover:bg-slate-700/50 transition-colors whitespace-nowrap cursor-pointer flex items-center justify-center gap-2"
              >
                <i className="ri-close-line w-4 h-4 flex items-center justify-center"></i>
                Cancel
              </button>
              <button
                onClick={performCrop}
                disabled={cropping}
                className="flex-[2] px-4 py-3 bg-teal-500 text-slate-900 rounded-xl font-medium hover:bg-teal-400 transition-colors whitespace-nowrap cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {cropping ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
                    Cropping...
                  </>
                ) : (
                  <>
                    <i className="ri-crop-line w-4 h-4 flex items-center justify-center"></i>
                    Crop & Save
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}