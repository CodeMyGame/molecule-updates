import QRCode from 'qrcode';
import { PNG } from 'pngjs';
import { QrStyle, isFinderModule } from '../../shared/qr-render';

export function renderQrPngBuffer(
  text: string,
  style: QrStyle = 'square',
  targetWidth = 160,
  centerIcon = true
): Buffer {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'Q' });
  const modCount = qr.modules.size;
  const margin = 2;
  const totalMods = modCount + margin * 2;
  const modPx = Math.max(3, Math.floor(targetWidth / totalMods));
  const rawSize = modPx * totalMods;
  // Ensure actualSize is an exact multiple of 8 for ESC/POS raster byte pitch alignment
  const actualSize = Math.ceil(rawSize / 8) * 8;
  const offset = Math.floor((actualSize - rawSize) / 2);

  const badgeMod = Math.max(7, Math.round(modCount * 0.22));
  const badgeSize = badgeMod * modPx;
  const badgeX = Math.floor((actualSize - badgeSize) / 2);
  const badgeY = Math.floor((actualSize - badgeSize) / 2);
  const cx = actualSize / 2;
  const cy = actualSize / 2;

  const png = new PNG({ width: actualSize, height: actualSize });
  png.data.fill(255);

  function setPixel(px: number, py: number, val: number) {
    if (px < 0 || px >= actualSize || py < 0 || py >= actualSize) return;
    const idx = (py * actualSize + px) << 2;
    png.data[idx] = val;
    png.data[idx + 1] = val;
    png.data[idx + 2] = val;
  }

  function setBlack(px: number, py: number) {
    setPixel(px, py, 0);
  }

  function isBadgeZone(x: number, y: number, w: number, h: number): boolean {
    if (!centerIcon) return false;
    return x + w > badgeX && x < badgeX + badgeSize && y + h > badgeY && y < badgeY + badgeSize;
  }

  function drawFinderPattern(r0: number, c0: number) {
    const x0 = offset + (c0 + margin) * modPx;
    const y0 = offset + (r0 + margin) * modPx;
    const w = 7 * modPx;
    const strokeW = modPx;

    const radOuter = style === 'dots' ? w * 0.35 : style === 'rounded' ? w * 0.25 : style === 'classy' ? w * 0.18 : 0;
    const radInner = style === 'dots' ? 1.5 * modPx : style === 'rounded' ? modPx * 0.9 : style === 'classy' ? modPx * 0.6 : 0;

    for (let y = 0; y < w; y++) {
      for (let x = 0; x < w; x++) {
        let insideOuter = true;
        if (radOuter > 0) {
          const left = x < radOuter;
          const right = x >= w - radOuter;
          const top = y < radOuter;
          const bottom = y >= w - radOuter;
          if ((left || right) && (top || bottom)) {
            const cx = left ? radOuter : w - radOuter - 1;
            const cy = top ? radOuter : w - radOuter - 1;
            insideOuter = (x - cx) * (x - cx) + (y - cy) * (y - cy) <= radOuter * radOuter;
          }
        }
        if (insideOuter) {
          const inHole = x >= strokeW && x < w - strokeW && y >= strokeW && y < w - strokeW;
          if (!inHole) {
            setBlack(x0 + x, y0 + y);
          }
        }
      }
    }

    const inStart = 2 * modPx;
    const inSize = 3 * modPx;
    for (let y = 0; y < inSize; y++) {
      for (let x = 0; x < inSize; x++) {
        let draw = true;
        if (style === 'dots') {
          const cx = inSize / 2;
          const cy = inSize / 2;
          draw = (x - cx) * (x - cx) + (y - cy) * (y - cy) <= radInner * radInner;
        } else if (radInner > 0) {
          const left = x < radInner;
          const right = x >= inSize - radInner;
          const top = y < radInner;
          const bottom = y >= inSize - radInner;
          if ((left || right) && (top || bottom)) {
            const cx = left ? radInner : inSize - radInner - 1;
            const cy = top ? radInner : inSize - radInner - 1;
            draw = (x - cx) * (x - cx) + (y - cy) * (y - cy) <= radInner * radInner;
          }
        }
        if (draw) {
          setBlack(x0 + inStart + x, y0 + inStart + y);
        }
      }
    }
  }

  drawFinderPattern(0, 0);
  drawFinderPattern(0, modCount - 7);
  drawFinderPattern(modCount - 7, 0);

  for (let r = 0; r < modCount; r++) {
    for (let c = 0; c < modCount; c++) {
      if (isFinderModule(r, c, modCount)) continue;
      if (!qr.modules.get(r, c)) continue;
      const x0 = offset + (c + margin) * modPx;
      const y0 = offset + (r + margin) * modPx;
      if (isBadgeZone(x0, y0, modPx, modPx)) continue;

      for (let y = 0; y < modPx; y++) {
        for (let x = 0; x < modPx; x++) {
          let draw = true;
          if (style === 'dots') {
            const cx = modPx / 2 - 0.5;
            const cy = modPx / 2 - 0.5;
            const rDot = modPx * 0.44;
            draw = (x - cx) * (x - cx) + (y - cy) * (y - cy) <= rDot * rDot;
          } else if (style === 'rounded' || style === 'classy') {
            const rad = modPx * (style === 'rounded' ? 0.35 : 0.22);
            const left = x < rad;
            const right = x >= modPx - rad;
            const top = y < rad;
            const bottom = y >= modPx - rad;
            if ((left || right) && (top || bottom)) {
              const cx = left ? rad : modPx - rad - 1;
              const cy = top ? rad : modPx - rad - 1;
              draw = (x - cx) * (x - cx) + (y - cy) * (y - cy) <= rad * rad;
            }
          }
          if (draw) {
            setBlack(x0 + x, y0 + y);
          }
        }
      }
    }
  }

  // Draw center Molecule icon badge
  if (centerIcon) {
    // Fill white
    for (let y = 0; y < badgeSize; y++) {
      for (let x = 0; x < badgeSize; x++) {
        setPixel(badgeX + x, badgeY + y, 255);
      }
    }

    // Draw rounded border
    const rad = Math.max(2, Math.round(badgeSize * 0.2));
    const borderThickness = Math.max(1, Math.round(modPx * 0.6));
    for (let t = 0; t < borderThickness; t++) {
      const bx = badgeX + t;
      const by = badgeY + t;
      const bw = badgeSize - t * 2;
      for (let y = 0; y < bw; y++) {
        for (let x = 0; x < bw; x++) {
          const isBorder = (x === 0 || x === bw - 1 || y === 0 || y === bw - 1);
          const isCorner = (x < rad && y < rad) || (x >= bw - rad && y < rad) ||
                           (x < rad && y >= bw - rad) || (x >= bw - rad && y >= bw - rad);
          if (isBorder && !isCorner) {
            setBlack(bx + x, by + y);
          }
        }
      }
    }

    // Draw central nucleus
    const nucR = Math.max(2.5, badgeSize * 0.11);
    for (let dy = -nucR; dy <= nucR; dy++) {
      for (let dx = -nucR; dx <= nucR; dx++) {
        if (dx * dx + dy * dy <= (nucR + 0.3) * (nucR + 0.3)) {
          setBlack(Math.round(cx + dx), Math.round(cy + dy));
        }
      }
    }

    // Draw 3 crossing orbital ellipses (Molecule atom structure)
    const rx = badgeSize * 0.37;
    const ry = badgeSize * 0.13;
    const angles = [Math.PI / 6, Math.PI / 2, (5 * Math.PI) / 6];
    for (const angle of angles) {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      for (let t = 0; t < Math.PI * 2; t += 0.02) {
        const ex = rx * Math.cos(t);
        const ey = ry * Math.sin(t);
        const px = Math.round(cx + ex * cos - ey * sin);
        const py = Math.round(cy + ex * sin + ey * cos);
        setBlack(px, py);
        setBlack(px + 1, py);
      }
    }
  }

  return PNG.sync.write(png);
}
