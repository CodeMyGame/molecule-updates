import { renderQrDataUri, type QrStyle } from '../../shared/qr-render';
import { drawQrOnCanvas } from './qrCanvasDraw';

export interface StandaloneQrOptions {
  style?: QrStyle;
  size?: number; // e.g. 512, 1024, 2048
  centerIcon?: boolean;
  fgColor?: string;
  bgColor?: string;
  label?: string;
  sublabel?: string;
}

export async function generateQrImage(
  text: string,
  options: StandaloneQrOptions = {}
): Promise<string> {
  const {
    style = 'rounded',
    size = 1024,
    centerIcon = true,
    fgColor = '#000000',
    bgColor = '#ffffff',
    label,
    sublabel,
  } = options;

  const extraHeight = label ? (sublabel ? 160 : 100) : 0;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size + extraHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return renderQrDataUri(text, style, 3, centerIcon);
  }

  // Background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw QR code directly to canvas
  const qrPadding = Math.round(size * 0.04);
  const qrDrawSize = size - qrPadding * 2;
  drawQrOnCanvas(ctx, text, qrPadding, qrPadding, qrDrawSize, style, centerIcon, fgColor, bgColor, 3);

  // Optional bottom label
  if (label) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0f172a';
    ctx.font = `bold ${Math.round(size * 0.045)}px sans-serif`;
    ctx.fillText(label, size / 2, size + 40);

    if (sublabel) {
      ctx.fillStyle = '#64748b';
      ctx.font = `500 ${Math.round(size * 0.028)}px sans-serif`;
      ctx.fillText(sublabel, size / 2, size + 85);
    }
  }

  return canvas.toDataURL('image/png');
}

export function downloadDataUri(dataUri: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUri;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
