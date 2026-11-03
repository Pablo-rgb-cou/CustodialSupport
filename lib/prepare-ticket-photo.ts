const smallPhotoBytes = 350 * 1024;
const maxPhotoDimension = 1920;
const maxDecodePixels = 40_000_000;
const preparationTimeoutMs = 5000;

type Dimensions = { width: number; height: number; animated?: boolean };
type DecodedPhoto = { source: CanvasImageSource; width: number; height: number; dispose: () => void };

function ascii(bytes: Uint8Array, start: number, count: number) {
  return String.fromCharCode(...bytes.subarray(start, start + count));
}

// Inspect dimensions before decoding to avoid allocating a huge bitmap from a
// highly compressed file. Unknown or unusual headers simply keep the original.
async function photoDimensions(file: File): Promise<Dimensions | null> {
  const bytes = new Uint8Array(await file.slice(0, 65536).arrayBuffer());
  const view = new DataView(bytes.buffer);
  if (file.type === "image/png" && bytes.length >= 24 && view.getUint32(0) === 0x89504e47) {
    const dimensions = { width: view.getUint32(16), height: view.getUint32(20), animated: false };
    for (let offset = 8; offset + 12 <= bytes.length;) {
      const length = view.getUint32(offset);
      const kind = ascii(bytes, offset + 4, 4);
      if (kind === "acTL") { dimensions.animated = true; break; }
      if (kind === "IDAT" || length > bytes.length - offset - 12) break;
      offset += length + 12;
    }
    return dimensions;
  }
  if (file.type === "image/jpeg" && bytes.length >= 4 && view.getUint16(0) === 0xffd8) {
    let offset = 2;
    while (offset + 4 < bytes.length) {
      if (bytes[offset++] !== 0xff) return null;
      while (bytes[offset] === 0xff) offset += 1;
      const marker = bytes[offset++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) break;
      const length = view.getUint16(offset);
      if (length < 2 || length > bytes.length - offset) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && length >= 7) {
        return { width: view.getUint16(offset + 5), height: view.getUint16(offset + 3) };
      }
      offset += length;
    }
  }
  if (file.type === "image/webp" && bytes.length >= 30 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    const kind = ascii(bytes, 12, 4);
    if (kind === "VP8X") return {
      width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16),
      height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16),
      animated: Boolean(bytes[20] & 2),
    };
    if (kind === "VP8L" && bytes[20] === 0x2f) {
      const bits = view.getUint32(21, true);
      return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >>> 14) & 0x3fff) };
    }
    if (kind === "VP8 " && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
      return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
    }
  }
  return null;
}

function imageElement(file: File, signal: AbortSignal): Promise<DecodedPhoto> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new Error("Photo preparation cancelled")); return; }
    const image = new Image();
    const url = URL.createObjectURL(file);
    const release = () => {
      image.onload = null;
      image.onerror = null;
      signal.removeEventListener("abort", abort);
      URL.revokeObjectURL(url);
    };
    const abort = () => {
      release();
      image.src = "";
      reject(new Error("Photo preparation cancelled"));
    };
    signal.addEventListener("abort", abort, { once: true });
    image.onerror = () => { release(); reject(new Error("Could not decode photo")); };
    image.onload = () => {
      signal.removeEventListener("abort", abort);
      image.onload = null;
      image.onerror = null;
      resolve({ source: image, width: image.naturalWidth, height: image.naturalHeight, dispose: release });
    };
    image.decoding = "async";
    image.src = url;
  });
}

async function decodePhoto(file: File, signal: AbortSignal): Promise<DecodedPhoto> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      if (signal.aborted) { bitmap.close(); throw new Error("Photo preparation cancelled"); }
      return { source: bitmap, width: bitmap.width, height: bitmap.height, dispose: () => bitmap.close() };
    } catch {
      if (signal.aborted) throw new Error("Photo preparation cancelled");
    }
  }
  return imageElement(file, signal);
}

function encodeCanvas(canvas: HTMLCanvasElement, mime: string, signal: AbortSignal): Promise<Blob | null> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new Error("Photo preparation cancelled")); return; }
    const abort = () => reject(new Error("Photo preparation cancelled"));
    signal.addEventListener("abort", abort, { once: true });
    try {
      canvas.toBlob((blob) => {
        signal.removeEventListener("abort", abort);
        if (!signal.aborted) resolve(blob);
      }, mime, 0.85);
    } catch (error) {
      signal.removeEventListener("abort", abort);
      reject(error);
    }
  });
}

async function optimizePhoto(file: File, signal: AbortSignal): Promise<File> {
  const dimensions = await photoDimensions(file);
  if (signal.aborted || !dimensions || dimensions.animated || dimensions.width <= 0 || dimensions.height <= 0 ||
      dimensions.width > 16384 || dimensions.height > 16384 || dimensions.width * dimensions.height > maxDecodePixels) return file;
  const scale = Math.min(1, maxPhotoDimension / Math.max(dimensions.width, dimensions.height));
  // Very long screenshots would become unreadable after shrinking their width.
  if (Math.min(dimensions.width, dimensions.height) * scale < 480 && scale < 0.65) return file;
  const decoded = await decodePhoto(file, signal);
  let canvas: HTMLCanvasElement | null = null;
  try {
    if (signal.aborted || decoded.width <= 0 || decoded.height <= 0 || decoded.width * decoded.height > maxDecodePixels) return file;
    const ratio = Math.min(1, maxPhotoDimension / Math.max(decoded.width, decoded.height));
    canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(decoded.width * ratio));
    canvas.height = Math.max(1, Math.round(decoded.height * ratio));
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
    let blob = await encodeCanvas(canvas, "image/webp", signal);
    if (!blob || blob.type !== "image/webp") {
      // Older browsers may silently fall back to PNG when WebP is unsupported.
      // Fill transparency before JPEG encoding to keep screenshots legible.
      context.globalCompositeOperation = "destination-over";
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.globalCompositeOperation = "source-over";
      blob = await encodeCanvas(canvas, "image/jpeg", signal);
    }
    if (signal.aborted || !blob || !["image/webp", "image/jpeg"].includes(blob.type) || blob.size === 0 || blob.size >= file.size * 0.92) return file;
    const extension = blob.type === "image/webp" ? "webp" : "jpg";
    const name = file.name.replace(/\.[^.]*$/, "") || "ticket-photo";
    return new File([blob], `${name}.${extension}`, { type: blob.type, lastModified: file.lastModified });
  } finally {
    decoded.dispose();
    if (canvas) { canvas.width = 0; canvas.height = 0; }
  }
}

// This changes only newly uploaded large, static photos. It never changes GIF
// animation, small files, stored originals, or the private bucket/access policy.
export async function prepareTicketPhoto(file: File): Promise<File> {
  if (file.size <= smallPhotoBytes || !["image/jpeg", "image/png", "image/webp"].includes(file.type) || typeof document === "undefined") return file;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const deadline = new Promise<File>((resolve) => {
    timer = setTimeout(() => { controller.abort(); resolve(file); }, preparationTimeoutMs);
  });
  try {
    return await Promise.race([optimizePhoto(file, controller.signal).catch(() => file), deadline]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
