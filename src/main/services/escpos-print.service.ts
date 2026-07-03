import { join } from 'path';
import { tmpdir } from 'os';
import { writeFileSync } from 'fs';
import { BrowserWindow } from 'electron';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const nativePrinter = require('@grandchef/node-printer');

// Re-export node-thermal-printer for direct use by KOT and bill printers
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ntp = require('node-thermal-printer');
export const ThermalPrinter: typeof import('node-thermal-printer').ThermalPrinter = ntp.printer;
export const PrinterTypes: typeof import('node-thermal-printer').PrinterTypes = ntp.types;

/**
 * Create a ThermalPrinter instance for buffer generation only.
 * Uses a dummy file interface — we never call execute(), only getBuffer().
 */
export function createPrinter(width = 42): InstanceType<typeof import('node-thermal-printer').ThermalPrinter> {
  return new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: join(tmpdir(), 'molecule-dummy-printer'),
    width,
    characterSet: 'PC437_USA' as any,
    removeSpecialCharacters: false,
  });
}

export const VIRTUAL_PRINTER_NAME = '__virtual_thermal__';

/**
 * Send a raw ESC/POS buffer to a named printer.
 * Uses @grandchef/node-printer for cross-platform support (Windows, macOS, Linux).
 * If the printer is the virtual thermal printer, show a preview window instead.
 */
export function sendRawToPrinter(printerName: string, data: Buffer): Promise<void> {
  if (printerName === VIRTUAL_PRINTER_NAME) {
    return showVirtualPrinterPreview(data);
  }

  return new Promise((resolve, reject) => {
    nativePrinter.printDirect({
      data,
      printer: printerName,
      type: 'RAW',
      success(jobID: number) {
        resolve();
      },
      error(err: Error) {
        reject(err);
      },
    });
  });
}

/**
 * Scan an ESC/POS buffer for `GS v 0` raster image commands and produce a
 * monochrome PNG-like RGBA buffer for preview. Returns null if no raster
 * blocks are present (i.e. text-mode buffer — fall through to text preview).
 */
function extractRasterPreview(data: Buffer): { rgba: Buffer; width: number; height: number } | null {
  const blocks: { width: number; height: number; bytes: Buffer }[] = [];
  let i = 0;
  while (i < data.length - 7) {
    // Look for 1D 76 30 (GS v 0)
    if (data[i] === 0x1D && data[i + 1] === 0x76 && data[i + 2] === 0x30) {
      // m, xL, xH, yL, yH at i+3..i+7
      const xL = data[i + 4];
      const xH = data[i + 5];
      const yL = data[i + 6];
      const yH = data[i + 7];
      const widthBytes = xL + xH * 256;
      const height = yL + yH * 256;
      const dataStart = i + 8;
      const dataEnd = dataStart + widthBytes * height;
      if (dataEnd <= data.length) {
        blocks.push({
          width: widthBytes * 8,
          height,
          bytes: data.subarray(dataStart, dataEnd),
        });
        i = dataEnd;
        continue;
      }
    }
    i++;
  }
  if (blocks.length === 0) return null;

  // Stack blocks vertically; assume same width.
  const width = blocks[0].width;
  const totalHeight = blocks.reduce((sum, b) => sum + b.height, 0);
  const widthBytes = width / 8;
  const rgba = Buffer.alloc(width * totalHeight * 4);

  let yOffset = 0;
  for (const block of blocks) {
    for (let y = 0; y < block.height; y++) {
      for (let x = 0; x < width; x++) {
        const byteIdx = y * widthBytes + (x >> 3);
        const bit = (block.bytes[byteIdx] >> (7 - (x & 7))) & 1;
        const dst = ((yOffset + y) * width + x) * 4;
        const v = bit ? 0 : 255;
        rgba[dst] = v;
        rgba[dst + 1] = v;
        rgba[dst + 2] = v;
        rgba[dst + 3] = 255;
      }
    }
    yOffset += block.height;
  }

  return { rgba, width, height: totalHeight };
}

/**
 * Show ESC/POS buffer content in a preview window.
 * If the buffer contains raster `GS v 0` blocks (raster print mode), render
 * the actual bitmap. Otherwise strip control codes and show as text.
 */
function showVirtualPrinterPreview(data: Buffer): Promise<void> {
  const raster = extractRasterPreview(data);
  if (raster) return showVirtualRasterPreview(raster, data.length);

  // Strip ESC/POS binary commands, keep only printable ASCII + newlines
  const lines: string[] = [];
  let currentLine = '';
  let i = 0;
  while (i < data.length) {
    const byte = data[i];
    if (byte === 0x1b) {
      // ESC command — skip ESC + command byte + variable params
      i++; // skip ESC
      if (i < data.length) {
        const cmd = data[i];
        i++; // skip command byte
        // Commands with 1 param byte
        if ([0x21, 0x40, 0x45, 0x47, 0x4d, 0x61, 0x64].includes(cmd)) {
          if (cmd !== 0x40) i++; // ESC @ has no params
        }
        // ESC ( — variable length
        else if (cmd === 0x28 && i + 1 < data.length) {
          const pL = data[i]; const pH = data[i + 1];
          i += 2 + pL + pH * 256;
        }
      }
    } else if (byte === 0x1d) {
      // GS command — skip
      i++;
      if (i < data.length) {
        const cmd = data[i];
        i++;
        if ([0x21, 0x42, 0x48, 0x56, 0x66, 0x68, 0x77, 0x7c].includes(cmd)) {
          i++; // 1 param
        } else if (cmd === 0x28 && i + 1 < data.length) {
          const pL = data[i]; const pH = data[i + 1];
          i += 2 + pL + pH * 256;
        }
      }
    } else if (byte === 0x0a) {
      // Newline
      lines.push(currentLine);
      currentLine = '';
      i++;
    } else if (byte >= 0x20 && byte < 0x7f) {
      currentLine += String.fromCharCode(byte);
      i++;
    } else {
      i++; // skip other control bytes
    }
  }
  if (currentLine) lines.push(currentLine);

  const receiptText = lines.join('\n');
  const bufferSize = data.length;

  const html = `<!DOCTYPE html>
<html>
<head>
<style>
  body {
    font-family: -apple-system, sans-serif;
    margin: 0;
    padding: 20px;
    background: #e8e8e8;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .label {
    font-size: 11px;
    color: #666;
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .receipt {
    background: #fff;
    padding: 16px 20px;
    width: 302px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.12);
    border-radius: 2px;
    white-space: pre;
    font-family: 'Menlo', 'Consolas', 'Monaco', 'Liberation Mono', monospace;
    font-size: 11.5px;
    line-height: 1.6;
    font-weight: 600;
    color: #000;
    letter-spacing: 0.2px;
  }
  .meta {
    margin-top: 12px;
    font-size: 11px;
    color: #999;
    text-align: center;
  }
</style>
</head>
<body>
  <div class="label">Virtual Thermal Printer Preview</div>
  <div class="receipt">${receiptText.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</div>
  <div class="meta">node-thermal-printer &bull; ESC/POS buffer: ${bufferSize} bytes &bull; ${lines.length} lines</div>
</body>
</html>`;

  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      width: 420,
      height: 650,
      title: 'Virtual Thermal Printer',
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });

    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    win.webContents.on('did-finish-load', () => resolve());
    win.webContents.on('did-fail-load', () => {
      win.destroy();
      reject(new Error('Failed to load preview'));
    });
  });
}

/**
 * Render a raster bitmap to a BMP file and open a preview window. BMP is the
 * simplest format with no compression — easy to hand-build, no library
 * needed. The window shows the bitmap at 1:1 pixel scale so the user sees
 * exactly what would print.
 */
function showVirtualRasterPreview(
  raster: { rgba: Buffer; width: number; height: number },
  bufferSize: number,
): Promise<void> {
  // Build a 24-bit BMP from the RGBA buffer.
  const { width, height } = raster;
  const rowSize = Math.floor((24 * width + 31) / 32) * 4; // BMP rows pad to 4 bytes
  const pixelArraySize = rowSize * height;
  const fileSize = 54 + pixelArraySize;
  const bmp = Buffer.alloc(fileSize);
  // BMP file header (14 bytes)
  bmp.write('BM', 0, 'ascii');
  bmp.writeUInt32LE(fileSize, 2);
  bmp.writeUInt32LE(0, 6);
  bmp.writeUInt32LE(54, 10);
  // DIB header BITMAPINFOHEADER (40 bytes)
  bmp.writeUInt32LE(40, 14);
  bmp.writeInt32LE(width, 18);
  bmp.writeInt32LE(-height, 22); // negative = top-down
  bmp.writeUInt16LE(1, 26);
  bmp.writeUInt16LE(24, 28);
  bmp.writeUInt32LE(0, 30);
  bmp.writeUInt32LE(pixelArraySize, 34);
  bmp.writeInt32LE(2835, 38);
  bmp.writeInt32LE(2835, 42);
  bmp.writeUInt32LE(0, 46);
  bmp.writeUInt32LE(0, 50);
  // Pixel data — BGR order, no alpha, padded rows
  for (let y = 0; y < height; y++) {
    const rowStart = 54 + y * rowSize;
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = rowStart + x * 3;
      bmp[dst] = raster.rgba[src + 2];
      bmp[dst + 1] = raster.rgba[src + 1];
      bmp[dst + 2] = raster.rgba[src];
    }
  }
  // Write BMP to a temp file — avoids Chromium's ~2MB data URI limit which
  // would silently fail for large (scale 2/3) receipts.
  const bmpPath = join(tmpdir(), `molecule-raster-preview-${Date.now()}.bmp`);
  writeFileSync(bmpPath, bmp);

  const html = `<!DOCTYPE html>
<html>
<head>
<style>
  body {
    font-family: -apple-system, sans-serif;
    margin: 0;
    padding: 24px;
    background: #2a2a2a;
    color: #ddd;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .label {
    font-size: 12px;
    color: #aaa;
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 1.5px;
  }
  .receipt-wrap {
    background: #fff;
    padding: 20px 8px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.4);
    margin: 12px 0;
  }
  .receipt-wrap img {
    display: block;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  }
  .meta {
    margin-top: 12px;
    font-size: 11px;
    color: #888;
    text-align: center;
  }
  .meta b { color: #ddd; }
  .ruler {
    width: ${width}px;
    height: 10px;
    margin-bottom: 4px;
    background: linear-gradient(
      to right,
      #888 0px, #888 1px, transparent 1px, transparent 8px
    );
    background-size: 8px 100%;
    border-bottom: 1px solid #888;
  }
</style>
</head>
<body>
  <div class="label">Virtual Thermal Printer — Raster Preview</div>
  <div class="meta">Pixel-perfect render of what would go to your 3-inch printer.<br>
    Each pixel = one printer dot @ 203 DPI.</div>
  <div class="receipt-wrap">
    <div class="ruler"></div>
    <img src="file://${bmpPath.replace(/\\/g, '/')}" width="${width}" height="${height}" />
  </div>
  <div class="meta">
    <b>${width} × ${height} dots</b> &bull;
    ESC/POS buffer: <b>${bufferSize.toLocaleString()} bytes</b> &bull;
    Paper width: <b>${(width / 8).toFixed(1)}mm @ 8 dots/mm</b>
  </div>
</body>
</html>`;

  const htmlPath = join(tmpdir(), `molecule-raster-preview-${Date.now()}.html`);
  writeFileSync(htmlPath, html, 'utf8');

  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      width: Math.max(width + 80, 480),
      height: Math.min(900, height + 220),
      title: 'Virtual Thermal Printer — Raster Preview',
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });
    win.loadFile(htmlPath);
    win.webContents.on('did-finish-load', () => resolve());
    win.webContents.on('did-fail-load', () => {
      win.destroy();
      reject(new Error('Failed to load raster preview'));
    });
  });
}

// Keep EscPosBuilder as a lightweight backward-compatible wrapper
// for any code that still uses it (bill ESC/POS builder in ipc/index.ts).
export class EscPosBuilder {
  private p = createPrinter();

  init(): this {
    return this;
  }

  text(str: string): this {
    this.p.print(str);
    return this;
  }

  line(str = ''): this {
    this.p.println(str);
    return this;
  }

  feed(lines = 1): this {
    for (let i = 0; i < lines; i++) this.p.newLine();
    return this;
  }

  bold(on = true): this {
    this.p.bold(on);
    return this;
  }

  alignCenter(): this {
    this.p.alignCenter();
    return this;
  }

  alignLeft(): this {
    this.p.alignLeft();
    return this;
  }

  alignRight(): this {
    this.p.alignRight();
    return this;
  }

  doubleHeight(): this {
    this.p.setTextDoubleHeight();
    return this;
  }

  doubleWidth(): this {
    this.p.setTextDoubleWidth();
    return this;
  }

  doubleSize(): this {
    this.p.setTextQuadArea();
    return this;
  }

  normal(): this {
    this.p.setTextNormal();
    return this;
  }

  fontA(): this {
    this.p.setTypeFontA();
    return this;
  }

  fontB(): this {
    this.p.setTypeFontB();
    return this;
  }

  separator(char = '-', _width = 42): this {
    this.p.drawLine(char);
    return this;
  }

  columns(left: string, right: string, _width = 42): this {
    this.p.leftRight(left, right);
    return this;
  }

  cut(): this {
    this.p.cut();
    return this;
  }

  build(): Buffer {
    return this.p.getBuffer();
  }
}
