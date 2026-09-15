import React, { useEffect, useRef, useState } from 'react';
import { X, ZoomIn, Check, ImageOff } from 'lucide-react';
import {
  baseCoverScale,
  centeredOffset,
  clampOffset,
  computeSourceCropRect
} from '../../utils/imageCropMath';

// Draws the current crop window onto a canvas at the target export size and
// compresses it, stepping quality down until under maxBytes (or the floor).
async function exportCroppedImage(
  img: HTMLImageElement,
  crop: { sx: number; sy: number; sw: number; sh: number },
  targetWidth: number,
  targetHeight: number,
  sourceFileName: string
): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, targetWidth, targetHeight);

  const maxBytes = 500 * 1024;
  const minQuality = 0.5;
  let quality = 0.88;

  const toBlob = (q: number): Promise<Blob | null> =>
    new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', q));

  let blob = await toBlob(quality);
  while (blob && blob.size > maxBytes && quality > minQuality) {
    quality = Math.max(minQuality, quality - 0.1);
    blob = await toBlob(quality);
  }
  if (!blob) throw new Error('Failed to export cropped image');

  const baseName = sourceFileName.replace(/\.[^.]+$/, '') || 'photo';
  return new File([blob], `${baseName}-cropped.jpg`, { type: 'image/jpeg' });
}

interface ImageCropModalProps {
  file: File;
  title: string;
  accentColor?: string;
  targetWidth?: number;
  targetHeight?: number;
  onConfirm: (croppedFile: File) => void;
  onUseOriginal: () => void;
  onCancel: () => void;
}

// 3:4 crop viewport — matches the aspect-[3/4] box every product image is
// displayed in across the storefront (grid cards, PDP, thumbnails), so a
// crop made here shows exactly as framed, instead of an unpredictable
// browser auto-crop at display time.
const VIEWPORT_W = 300;
const VIEWPORT_H = 400;

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  file,
  title,
  accentColor = '#B08D57',
  targetWidth = 1200,
  targetHeight = 1600,
  onConfirm,
  onUseOriginal,
  onCancel
}) => {
  const [objectUrl, setObjectUrl] = useState<string>('');
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const imgRef = useRef<HTMLImageElement>(null);
  const dragState = useRef<{ startX: number; startY: number; startOffsetX: number; startOffsetY: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleImageLoad = () => {
    const img = imgRef.current;
    if (!img) return;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    setNaturalSize({ w, h });
    const scale = baseCoverScale(w, h, VIEWPORT_W, VIEWPORT_H);
    setOffset(centeredOffset(w, h, VIEWPORT_W, VIEWPORT_H, scale));
    setZoom(1);
  };

  const currentScale = naturalSize ? baseCoverScale(naturalSize.w, naturalSize.h, VIEWPORT_W, VIEWPORT_H) * zoom : 1;

  const applyClamp = (nextOffset: { x: number; y: number }, scale: number) => {
    if (!naturalSize) return nextOffset;
    return clampOffset(nextOffset.x, nextOffset.y, naturalSize.w, naturalSize.h, VIEWPORT_W, VIEWPORT_H, scale);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!naturalSize) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    dragState.current = { startX: e.clientX, startY: e.clientY, startOffsetX: offset.x, startOffsetY: offset.y };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState.current || !naturalSize) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    const next = { x: dragState.current.startOffsetX + dx, y: dragState.current.startOffsetY + dy };
    setOffset(applyClamp(next, currentScale));
  };

  const handlePointerUp = () => {
    dragState.current = null;
  };

  const handleZoomChange = (nextZoom: number) => {
    if (!naturalSize) return;
    const base = baseCoverScale(naturalSize.w, naturalSize.h, VIEWPORT_W, VIEWPORT_H);
    setZoom(nextZoom);
    setOffset(prev => applyClamp(prev, base * nextZoom));
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!naturalSize) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const nextZoom = Math.min(3, Math.max(1, zoom + delta));
    handleZoomChange(nextZoom);
  };

  const handleApply = async () => {
    const img = imgRef.current;
    if (!img || !naturalSize) return;
    setIsProcessing(true);
    try {
      const crop = computeSourceCropRect(naturalSize.w, naturalSize.h, VIEWPORT_W, VIEWPORT_H, currentScale, offset.x, offset.y);
      const cropped = await exportCroppedImage(img, crop, targetWidth, targetHeight, file.name);
      onConfirm(cropped);
    } catch (err) {
      console.error('Crop export failed:', err);
      onUseOriginal();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-stone-100">
          <h3 className="text-sm font-bold text-stone-800">{title}</h3>
          <button type="button" onClick={onCancel} className="text-stone-400 hover:text-stone-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {loadError ? (
            <div
              className="mx-auto flex flex-col items-center justify-center gap-2 bg-stone-100 border border-stone-200 rounded-lg text-stone-400"
              style={{ width: VIEWPORT_W, height: VIEWPORT_H }}
            >
              <ImageOff className="w-6 h-6" />
              <span className="text-[11px]">Couldn't preview this image</span>
            </div>
          ) : (
            <div
              className="relative mx-auto overflow-hidden rounded-lg border border-stone-200 bg-stone-100 touch-none select-none"
              style={{ width: VIEWPORT_W, height: VIEWPORT_H, cursor: naturalSize ? 'grab' : 'default' }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              onWheel={handleWheel}
            >
              {objectUrl && (
                <img
                  ref={imgRef}
                  src={objectUrl}
                  alt=""
                  draggable={false}
                  onLoad={handleImageLoad}
                  onError={() => setLoadError(true)}
                  className="absolute top-0 left-0 pointer-events-none max-w-none max-h-none"
                  style={
                    naturalSize
                      ? {
                          width: naturalSize.w * currentScale,
                          height: naturalSize.h * currentScale,
                          maxWidth: 'none',
                          transform: `translate(${offset.x}px, ${offset.y}px)`
                        }
                      : { opacity: 0 }
                  }
                />
              )}
            </div>
          )}

          {naturalSize && !loadError && (
            <div className="flex items-center gap-2">
              <ZoomIn className="w-3.5 h-3.5 text-stone-400 shrink-0" />
              <input
                type="range"
                min={1}
                max={3}
                step={0.02}
                value={zoom}
                onChange={(e) => handleZoomChange(Number(e.target.value))}
                className="w-full accent-current"
                style={{ color: accentColor }}
              />
            </div>
          )}

          <p className="text-[10px] text-stone-400">
            Drag to reposition, scroll or use the slider to zoom. Cropped to 3:4 — the same shape used everywhere on
            the storefront — and resized/compressed automatically for fast page loads.
          </p>
        </div>

        <div className="flex items-center justify-between gap-2 p-4 border-t border-stone-100 bg-stone-50">
          <button
            type="button"
            onClick={onUseOriginal}
            disabled={isProcessing}
            className="text-[10px] font-bold uppercase tracking-wide text-stone-500 hover:text-stone-800 disabled:opacity-50"
          >
            Use Original, Skip Crop
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isProcessing}
              className="px-3 py-2 rounded text-[10px] font-bold uppercase tracking-wide text-stone-600 hover:bg-stone-100 disabled:opacity-50"
            >
              Skip Photo
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={isProcessing || !naturalSize || loadError}
              className="flex items-center gap-1.5 px-4 py-2 rounded text-[10px] font-bold uppercase tracking-wide text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: accentColor }}
            >
              {isProcessing ? (
                <span>Processing...</span>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" /> Apply Crop
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
