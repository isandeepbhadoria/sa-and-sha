// Pure geometry for ImageCropModal's pan/zoom crop box — kept dependency-free
// and framework-free so it's trivially testable without a browser.
//
// Model: a source image of size (imgW, imgH) is rendered inside a fixed
// viewport of size (containerW, containerH) at some `scale` (image pixels ->
// viewport pixels), then panned by (offsetX, offsetY) viewport pixels. The
// viewport always shows a sub-rectangle of the source image — that
// sub-rectangle is what gets cropped out.

// The smallest scale at which the image still fully covers the viewport in
// both dimensions (same idea as CSS `object-fit: cover`).
export function baseCoverScale(
  imgW: number, imgH: number,
  containerW: number, containerH: number
): number {
  if (imgW <= 0 || imgH <= 0) return 1;
  return Math.max(containerW / imgW, containerH / imgH);
}

// Centers the image in the viewport at the given scale.
export function centeredOffset(
  imgW: number, imgH: number,
  containerW: number, containerH: number,
  scale: number
): { x: number; y: number } {
  const renderedW = imgW * scale;
  const renderedH = imgH * scale;
  return {
    x: (containerW - renderedW) / 2,
    y: (containerH - renderedH) / 2,
  };
}

// Keeps the viewport fully inside the rendered image — no blank gaps at any
// pan position, whatever the current scale.
export function clampOffset(
  offsetX: number, offsetY: number,
  imgW: number, imgH: number,
  containerW: number, containerH: number,
  scale: number
): { x: number; y: number } {
  const renderedW = imgW * scale;
  const renderedH = imgH * scale;
  // Image can be panned so its right/bottom edge lines up with the
  // container (offset = containerW - renderedW, i.e. as negative as the
  // overhang), up to its left/top edge lining up with the container (0).
  const minX = Math.min(0, containerW - renderedW);
  const minY = Math.min(0, containerH - renderedH);
  const maxX = 0;
  const maxY = 0;
  return {
    x: Math.min(maxX, Math.max(minX, offsetX)),
    y: Math.min(maxY, Math.max(minY, offsetY)),
  };
}

// The viewport's current window, translated back into source-image pixel
// coordinates — this is the rectangle to hand to canvas drawImage() as the
// crop source. Guaranteed to stay within [0, imgW] x [0, imgH] as long as
// offsetX/offsetY were produced by clampOffset for the same scale.
export function computeSourceCropRect(
  imgW: number, imgH: number,
  containerW: number, containerH: number,
  scale: number, offsetX: number, offsetY: number
): { sx: number; sy: number; sw: number; sh: number } {
  const sx = -offsetX / scale;
  const sy = -offsetY / scale;
  const sw = containerW / scale;
  const sh = containerH / scale;
  return {
    sx: Math.max(0, Math.min(sx, imgW - sw)),
    sy: Math.max(0, Math.min(sy, imgH - sh)),
    sw: Math.min(sw, imgW),
    sh: Math.min(sh, imgH),
  };
}
