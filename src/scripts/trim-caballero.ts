/**
 * Genera los PNG del caballero (la moneda) en varios tamaños:
 *
 *   - Con la moneda limpia (sin el aro oscuro): `caballero-coin-<tamaño>.png`
 *   - Con el aro original (sin quitar bordes):   `caballero-<tamaño>.png`
 *
 * Tamaños por defecto: grande 256, mediano 128, pequeño 64 (se puede elegir
 * con argumentos, p. ej. `bun run trim-caballero 320 128 64`). Cada tamaño se
 * escala directamente desde el master 320×320 con el kernel "area" (conserva
 * el máximo detalle posible al reducir, sin escalados encadenados).
 *
 * El aro se quita con un flood-fill desde los bordes del lienzo a través de
 * píxeles NO azules, usando el azul del disco como barrera. El original
 * `caballero.png` nunca se toca.
 *
 * El PNG de salida se emite a mano (signature + IHDR + IDAT zlib + IEND con
 * CRC32) porque OpenTUI no expone un guardado de imagen.
 *
 * Uso: `bun run trim-caballero [tamaños...]` (alias: `bun run trim-caballero`).
 */
import { readFile, writeFile } from "node:fs/promises";
import { NativeImage } from "@opentui/core";

const INPUT = "assets/troops/caballero.png";
/** Tamaños por defecto; se pueden sobreescribir con argumentos de CLI. */
const DEFAULT_SIZES = [256, 128, 64];
/** Nombres de archivo por tamaño (índice del array de tamaños). */
const SIZE_NAMES = ["grande", "mediano", "pequeno"];

// --- flood-fill del aro ---------------------------------------------------

/** ¿Es un píxel de la moneda azul (barrera del flood)? */
function isDisc(data: Uint8Array, i: number): boolean {
  return data[i + 3]! >= 40 && data[i + 2]! > data[i]! + 60 && data[i + 2]! > data[i + 1]! + 20;
}

/** Marca el aro oscuro: píxeles opacos no-azules conectados al borde. */
function maskRing(data: Uint8Array, width: number, height: number, stride: number): Uint8Array {
  const inRing = new Uint8Array(width * height);
  const stack: number[] = [];
  function seed(x: number, y: number): void {
    const p = y * width + x;
    if (inRing[p] !== 0) return;
    const i = (y * stride) + x * 4;
    if (data[i + 3]! >= 40 && !isDisc(data, i)) {
      inRing[p] = 1;
      stack.push(p);
    }
  }
  for (let x = 0; x < width; x++) {
    seed(x, 0);
    seed(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    seed(0, y);
    seed(width - 1, y);
  }
  while (stack.length > 0) {
    const p = stack.pop()!;
    const x = p % width;
    const y = (p - x) / width;
    if (x > 0) seed(x - 1, y);
    if (x < width - 1) seed(x + 1, y);
    if (y > 0) seed(x, y - 1);
    if (y < height - 1) seed(x, y + 1);
  }
  return inRing;
}

/** Aplica el alpha=0 del aro sobre los píxeles RGBA. */
function applyRingAlpha(rgba: Uint8Array, width: number, height: number, stride: number, inRing: Uint8Array): void {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (inRing[y * width + x] === 1) {
        const i = (y * stride) + x * 4;
        rgba[i + 3] = 0;
      }
    }
  }
}

// --- escritor PNG mínimo ---------------------------------------------------

const CRC_TABLE = ((): Uint32Array => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  const MOD = 65521;
  for (const byte of bytes) {
    a = (a + byte) % MOD;
    b = (b + a) % MOD;
  }
  return ((b << 16) | a) >>> 0;
}

/**
 * `Bun.deflateSync` emite deflate CRUDO (RFC 1951); PNG exige un stream zlib
 * (RFC 1950): cabecera de 2 bytes + deflate + checksum Adler-32.
 */
function zlibStream(data: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> {
  const deflated = Bun.deflateSync(data);
  const out = new Uint8Array(new ArrayBuffer(2 + deflated.length + 4));
  // CMF/FLG: 0x78 0x9c = método deflate, ventana 32K, nivel por defecto.
  out[0] = 0x78;
  out[1] = 0x9c;
  out.set(deflated, 2);
  const adler = adler32(data);
  const view = new DataView(out.buffer);
  view.setUint32(2 + deflated.length, adler, false);
  return out;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  out.set(typeBytes, 4);
  out.set(data, 8);
  return out;
}

// CRC sobre el chunk completo (tipo + datos), escrito al final del chunk.
function finalizeChunk(out: Uint8Array, type: string, data: Uint8Array): Uint8Array {
  const crcInput = new Uint8Array(4 + data.length);
  crcInput.set(new TextEncoder().encode(type), 0);
  crcInput.set(data, 4);
  const crc = crc32(crcInput);
  const view = new DataView(out.buffer);
  view.setUint32(8 + data.length, crc);
  return out;
}

function encodePng(rgba: Uint8Array<ArrayBuffer>, width: number, height: number): Uint8Array<ArrayBuffer> {
  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, width);
  ihdrView.setUint32(4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // raw scanlines con filtro 0
  const stride = width * 4;
  const raw = new Uint8Array(new ArrayBuffer((stride + 1) * height));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }
  const idatData = zlibStream(raw);
  const parts = [
    signature,
    finalizeChunk(chunk("IHDR", ihdr), "IHDR", ihdr),
    finalizeChunk(chunk("IDAT", idatData), "IDAT", idatData),
    finalizeChunk(chunk("IEND", new Uint8Array()), "IEND", new Uint8Array()),
  ];
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(new ArrayBuffer(total));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

// --- main -------------------------------------------------------------------

const sizesArg = process.argv.slice(2).map((value) => Number.parseInt(value, 10)).filter((value) => Number.isFinite(value) && value > 0);
const sizes = sizesArg.length > 0 ? sizesArg : DEFAULT_SIZES;

const input = await readFile(INPUT);
const source = NativeImage.decode(input);
const raw = source.raw();
const { width, height, stride, format } = raw;
if (format !== "rgba8") throw new Error(`Formato inesperado: ${format}`);

// Variante limpia: aro transparente sobre el master (aplicado una sola vez).
const cleanedRgba = new Uint8Array(new ArrayBuffer(raw.data.byteLength));
cleanedRgba.set(raw.data, 0);
const inRing = maskRing(cleanedRgba, width, height, stride);
applyRingAlpha(cleanedRgba, width, height, stride, inRing);
const cleaned = NativeImage.fromRgba(cleanedRgba, width, height, stride);

try {
  for (let index = 0; index < sizes.length; index++) {
    const size = sizes[index]!;
    const name = SIZE_NAMES[index] ?? `tam${size}`;
    // Limpia (caballero-coin-*) y original con aro (caballero-*).
    for (const [suffix, base] of [
      ["coin", cleaned],
      ["", source],
    ] as const) {
      let resized: NativeImage;
      try {
        resized = base.resize({ width: Math.min(size, base.width) });
      } catch (error) {
        console.error(`  ✗ no se pudo escalar a ${size}px: ${String(error)}`);
        continue;
      }
      try {
        const outWidth = resized.width;
        const outHeight = resized.height;
        const outRaw = resized.raw();
        const rgba = new Uint8Array(new ArrayBuffer(outRaw.data.byteLength));
        rgba.set(outRaw.data, 0);
        const png = encodePng(rgba, outWidth, outHeight);
        const file = `assets/troops/caballero${suffix === "coin" ? "-coin" : ""}-${name}.png`;
        await writeFile(file, png);
        console.log(`  ✓ ${file} (${outWidth}×${outHeight})`);
      } finally {
        resized.dispose();
      }
    }
  }
  console.log(`Listo: ${sizes.length} tamaños × 2 variantes (limpia + aro original).`);
} finally {
  cleaned.dispose();
}