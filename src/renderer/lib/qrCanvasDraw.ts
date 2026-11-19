import QRCode from 'qrcode';
import { type QrStyle, isFinderModule } from '../../shared/qr-render';

export function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const maxR = Math.min(w / 2, h / 2);
  const rad = Math.max(0, Math.min(r, maxR));
  if (typeof (ctx as any).roundRect === 'function') {
    (ctx as any).roundRect(x, y, w, h, rad);
    return;
  }
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.arcTo(x + w, y, x + w, y + rad, rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.arcTo(x + w, y + h, x + w - rad, y + h, rad);
  ctx.lineTo(x + rad, y + h);
  ctx.arcTo(x, y + h, x, y + h - rad, rad);
  ctx.lineTo(x, y + rad);
  ctx.arcTo(x, y, x + rad, y, rad);
  ctx.closePath();
}

export function drawQrOnCanvas(
  ctx: CanvasRenderingContext2D,
  text: string,
  destX: number,
  destY: number,
  destSize: number,
  style: QrStyle = 'square',
  centerIcon = true,
  fgColor = '#000000',
  bgColor = '#ffffff',
  margin = 2
): void {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'Q' });
  const size = qr.modules.size;
  const total = size + margin * 2;
  const modPx = destSize / total;

  // 1. Fill background
  ctx.fillStyle = bgColor;
  ctx.fillRect(destX, destY, destSize, destSize);

  // Center badge dimensions (square badge ~22% of QR size)
  const badgeMod = Math.max(7, Math.round(size * 0.22));
  const badgeSize = badgeMod * modPx;
  const badgeX = destX + (destSize - badgeSize) / 2;
  const badgeY = destY + (destSize - badgeSize) / 2;
  const cx = destX + destSize / 2;
  const cy = destY + destSize / 2;

  function isBadgeModule(r: number, c: number): boolean {
    if (!centerIcon) return false;
    const x = destX + (c + margin) * modPx;
    const y = destY + (r + margin) * modPx;
    return (
      x + modPx > badgeX &&
      x < badgeX + badgeSize &&
      y + modPx > badgeY &&
      y < badgeY + badgeSize
    );
  }

  function drawFinder(r0: number, c0: number) {
    const fx = destX + (c0 + margin) * modPx;
    const fy = destY + (r0 + margin) * modPx;
    const fw = 7 * modPx;
    const strokeW = modPx;
    const innerOffset = 2 * modPx;
    const innerSize = 3 * modPx;

    ctx.strokeStyle = fgColor;
    ctx.fillStyle = fgColor;
    ctx.lineWidth = strokeW;

    if (style === 'dots') {
      ctx.beginPath();
      drawRoundedRectPath(ctx, fx + strokeW / 2, fy + strokeW / 2, fw - strokeW, fw - strokeW, modPx * 2.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(fx + fw / 2, fy + fw / 2, modPx * 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (style === 'rounded') {
      ctx.beginPath();
      drawRoundedRectPath(ctx, fx + strokeW / 2, fy + strokeW / 2, fw - strokeW, fw - strokeW, modPx * 1.8);
      ctx.stroke();
      ctx.beginPath();
      drawRoundedRectPath(ctx, fx + innerOffset, fy + innerOffset, innerSize, innerSize, modPx * 0.9);
      ctx.fill();
    } else if (style === 'classy') {
      ctx.beginPath();
      drawRoundedRectPath(ctx, fx + strokeW / 2, fy + strokeW / 2, fw - strokeW, fw - strokeW, modPx * 1.2);
      ctx.stroke();
      ctx.beginPath();
      drawRoundedRectPath(ctx, fx + innerOffset, fy + innerOffset, innerSize, innerSize, modPx * 0.6);
      ctx.fill();
    } else {
      ctx.strokeRect(fx + strokeW / 2, fy + strokeW / 2, fw - strokeW, fw - strokeW);
      ctx.fillRect(fx + innerOffset, fy + innerOffset, innerSize, innerSize);
    }
  }

  // Draw 3 corner finder patterns
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Draw data modules
  ctx.fillStyle = fgColor;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (isFinderModule(r, c, size) || isBadgeModule(r, c)) continue;
      if (!qr.modules.get(r, c)) continue;

      const mx = destX + (c + margin) * modPx;
      const my = destY + (r + margin) * modPx;

      if (style === 'dots') {
        ctx.beginPath();
        ctx.arc(mx + modPx / 2, my + modPx / 2, modPx * 0.44, 0, Math.PI * 2);
        ctx.fill();
      } else if (style === 'rounded') {
        ctx.beginPath();
        drawRoundedRectPath(ctx, mx + modPx * 0.05, my + modPx * 0.05, modPx * 0.9, modPx * 0.9, modPx * 0.35);
        ctx.fill();
      } else if (style === 'classy') {
        ctx.beginPath();
        drawRoundedRectPath(ctx, mx + modPx * 0.08, my + modPx * 0.08, modPx * 0.84, modPx * 0.84, modPx * 0.22);
        ctx.fill();
      } else {
        ctx.fillRect(mx, my, modPx + 0.1, modPx + 0.1);
      }
    }
  }

  // Draw center Molecule icon badge
  if (centerIcon) {
    const rx = Math.round(badgeSize * 0.25);
    const borderW = Math.max(2.5, Math.round(modPx * 0.7));

    // Badge background box
    ctx.save();
    ctx.beginPath();
    drawRoundedRectPath(ctx, badgeX, badgeY, badgeSize, badgeSize, rx);
    ctx.fillStyle = bgColor;
    ctx.fill();
    ctx.lineWidth = borderW;
    ctx.strokeStyle = fgColor;
    ctx.stroke();

    // Center nucleus dot
    const nucR = Math.max(3, badgeSize * 0.12);
    ctx.beginPath();
    ctx.arc(cx, cy, nucR, 0, Math.PI * 2);
    ctx.fillStyle = fgColor;
    ctx.fill();

    // 3 crossing orbital ellipses (Molecule atom structure)
    const elRx = badgeSize * 0.38;
    const elRy = badgeSize * 0.14;
    const strokeW = Math.max(2.2, badgeSize * 0.075);
    ctx.strokeStyle = fgColor;
    ctx.lineWidth = strokeW;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const angleDeg of [30, 90, 150]) {
      const angleRad = (angleDeg * Math.PI) / 180;
      ctx.beginPath();
      ctx.ellipse(cx, cy, elRx, elRy, angleRad, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}
