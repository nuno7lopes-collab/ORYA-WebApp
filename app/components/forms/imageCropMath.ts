export type CropOffset = { x: number; y: number };
export type CropSize = { width: number; height: number };

export function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  if (!Number.isFinite(min) || !Number.isFinite(max)) return value;
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

export function computeBaseScale(frame: CropSize, image: CropSize) {
  if (!frame.width || !frame.height || !image.width || !image.height) return 1;
  return Math.max(frame.width / image.width, frame.height / image.height);
}

export function clampCropOffset(offset: CropOffset, frame: CropSize, image: CropSize, scale: number): CropOffset {
  if (!frame.width || !frame.height || !image.width || !image.height || !scale) return offset;
  const scaledWidth = image.width * scale;
  const scaledHeight = image.height * scale;
  const maxX = Math.max(0, (scaledWidth - frame.width) / 2);
  const maxY = Math.max(0, (scaledHeight - frame.height) / 2);
  return {
    x: clamp(offset.x, -maxX, maxX),
    y: clamp(offset.y, -maxY, maxY),
  };
}

export function computeSourceCrop(frame: CropSize, image: CropSize, offset: CropOffset, scale: number) {
  if (!frame.width || !frame.height || !image.width || !image.height || !scale) {
    return { x: 0, y: 0, width: image.width, height: image.height };
  }

  const scaledWidth = image.width * scale;
  const scaledHeight = image.height * scale;
  const imageLeft = frame.width / 2 - scaledWidth / 2 + offset.x;
  const imageTop = frame.height / 2 - scaledHeight / 2 + offset.y;
  const cropWidth = frame.width / scale;
  const cropHeight = frame.height / scale;

  const rawX = (0 - imageLeft) / scale;
  const rawY = (0 - imageTop) / scale;
  const maxX = Math.max(0, image.width - cropWidth);
  const maxY = Math.max(0, image.height - cropHeight);

  return {
    x: clamp(rawX, 0, maxX),
    y: clamp(rawY, 0, maxY),
    width: cropWidth,
    height: cropHeight,
  };
}
