import QRCode from 'qrcode';

export type QrStyle = 'square' | 'rounded' | 'dots' | 'classy';

export const QR_STYLES: { id: QrStyle; name: string; desc: string }[] = [
  { id: 'square', name: 'Classic Square', desc: 'Standard sharp square modules' },
  { id: 'rounded', name: 'Modern Rounded', desc: 'Soft rounded modules and eyes' },
  { id: 'dots', name: 'Circular Dots', desc: 'Playful circular dot pattern' },
  { id: 'classy', name: 'Smooth Squircle', desc: 'Sleek premium squircle shapes' },
];

export function isFinderModule(r: number, c: number, size: number): boolean {
  if (r < 7 && c < 7) return true;
  if (r < 7 && c >= size - 7) return true;
  if (r >= size - 7 && c < 7) return true;
  return false;
}

function getRotatedEllipsePath(cx: number, cy: number, rx: number, ry: number, angleDeg: number): string {
  const theta = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const k = 0.55228475;

  const tr = (x: number, y: number) => ({
    x: +(cx + x * cos - y * sin).toFixed(2),
    y: +(cy + x * sin + y * cos).toFixed(2),
  });

  const p0 = tr(rx, 0);
  const c0p = tr(rx, k * ry);
  const c1m = tr(k * rx, ry);
  const p1 = tr(0, ry);
  const c1p = tr(-k * rx, ry);
  const c2m = tr(-rx, k * ry);
  const p2 = tr(-rx, 0);
  const c2p = tr(-rx, -k * ry);
  const c3m = tr(-k * rx, -ry);
  const p3 = tr(0, -ry);
  const c3p = tr(k * rx, -ry);
  const c0m = tr(rx, -k * ry);

  return `M ${p0.x} ${p0.y} C ${c0p.x} ${c0p.y} ${c1m.x} ${c1m.y} ${p1.x} ${p1.y} C ${c1p.x} ${c1p.y} ${c2m.x} ${c2m.y} ${p2.x} ${p2.y} C ${c2p.x} ${c2p.y} ${c3m.x} ${c3m.y} ${p3.x} ${p3.y} C ${c3p.x} ${c3p.y} ${c0m.x} ${c0m.y} ${p0.x} ${p0.y} Z`;
}

export function renderQrSvg(text: string, style: QrStyle = 'square', margin = 2, centerIcon = true): string {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'Q' });
  const size = qr.modules.size;
  const total = size + margin * 2;
  const m = 10;
  const svgW = total * m;
  const shapes: string[] = [];

  // Center badge dimensions (square badge ~22% of QR size)
  const badgeMod = Math.max(7, Math.round(size * 0.22));
  const badgeSize = badgeMod * m;
  const badgeX = (svgW - badgeSize) / 2;
  const badgeY = (svgW - badgeSize) / 2;
  const cx = svgW / 2;
  const cy = svgW / 2;

  function isBadgeModule(r: number, c: number): boolean {
    if (!centerIcon) return false;
    const x = (c + margin) * m;
    const y = (r + margin) * m;
    return x + m > badgeX && x < badgeX + badgeSize && y + m > badgeY && y < badgeY + badgeSize;
  }

  function drawFinder(r0: number, c0: number) {
    const x = (c0 + margin) * m;
    const y = (r0 + margin) * m;
    const w = 7 * m;
    const strokeW = m;
    const innerOffset = 2 * m;
    const innerSize = 3 * m;

    if (style === 'dots') {
      shapes.push(
        `<rect x="${x + strokeW / 2}" y="${y + strokeW / 2}" width="${w - strokeW}" height="${w - strokeW}" rx="${m * 2.2}" ry="${m * 2.2}" fill="none" stroke="#000000" stroke-width="${strokeW}" />`
      );
      shapes.push(
        `<circle cx="${x + w / 2}" cy="${y + w / 2}" r="${m * 1.5}" fill="#000000" />`
      );
    } else if (style === 'rounded') {
      shapes.push(
        `<rect x="${x + strokeW / 2}" y="${y + strokeW / 2}" width="${w - strokeW}" height="${w - strokeW}" rx="${m * 1.8}" ry="${m * 1.8}" fill="none" stroke="#000000" stroke-width="${strokeW}" />`
      );
      shapes.push(
        `<rect x="${x + innerOffset}" y="${y + innerOffset}" width="${innerSize}" height="${innerSize}" rx="${m * 0.9}" ry="${m * 0.9}" fill="#000000" />`
      );
    } else if (style === 'classy') {
      shapes.push(
        `<rect x="${x + strokeW / 2}" y="${y + strokeW / 2}" width="${w - strokeW}" height="${w - strokeW}" rx="${m * 1.2}" ry="${m * 1.2}" fill="none" stroke="#000000" stroke-width="${strokeW}" />`
      );
      shapes.push(
        `<rect x="${x + innerOffset}" y="${y + innerOffset}" width="${innerSize}" height="${innerSize}" rx="${m * 0.6}" ry="${m * 0.6}" fill="#000000" />`
      );
    } else {
      shapes.push(
        `<rect x="${x + strokeW / 2}" y="${y + strokeW / 2}" width="${w - strokeW}" height="${w - strokeW}" fill="none" stroke="#000000" stroke-width="${strokeW}" />`
      );
      shapes.push(
        `<rect x="${x + innerOffset}" y="${y + innerOffset}" width="${innerSize}" height="${innerSize}" fill="#000000" />`
      );
    }
  }

  // Draw 3 corner eyes
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Draw data modules
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (isFinderModule(r, c, size) || isBadgeModule(r, c)) continue;
      if (!qr.modules.get(r, c)) continue;
      const x = (c + margin) * m;
      const y = (r + margin) * m;

      if (style === 'dots') {
        shapes.push(`<circle cx="${x + m / 2}" cy="${y + m / 2}" r="${m * 0.44}" fill="#000000" />`);
      } else if (style === 'rounded') {
        shapes.push(`<rect x="${x + m * 0.05}" y="${y + m * 0.05}" width="${m * 0.9}" height="${m * 0.9}" rx="${m * 0.35}" ry="${m * 0.35}" fill="#000000" />`);
      } else if (style === 'classy') {
        shapes.push(`<rect x="${x + m * 0.08}" y="${y + m * 0.08}" width="${m * 0.84}" height="${m * 0.84}" rx="${m * 0.22}" ry="${m * 0.22}" fill="#000000" />`);
      } else {
        shapes.push(`<rect x="${x}" y="${y}" width="${m}" height="${m}" fill="#000000" />`);
      }
    }
  }

  // Draw center Molecule icon badge
  if (centerIcon) {
    const rx = Math.round(badgeSize * 0.25);
    const borderW = Math.max(2.5, Math.round(m * 0.7));
    shapes.push(
      `<rect x="${badgeX}" y="${badgeY}" width="${badgeSize}" height="${badgeSize}" rx="${rx}" ry="${rx}" fill="#ffffff" stroke="#000000" stroke-width="${borderW}" />`
    );
    // Center nucleus dot
    const nucR = Math.max(3, badgeSize * 0.12);
    shapes.push(`<circle cx="${cx}" cy="${cy}" r="${nucR}" fill="#000000" />`);
    // 3 crossing orbital ellipses (Molecule atom structure) rendered via pure cubic Bezier paths
    const elRx = badgeSize * 0.38;
    const elRy = badgeSize * 0.14;
    const strokeW = Math.max(2.2, badgeSize * 0.075);
    for (const angle of [30, 90, 150]) {
      const pathD = getRotatedEllipsePath(cx, cy, elRx, elRy, angle);
      shapes.push(
        `<path d="${pathD}" fill="none" stroke="#000000" stroke-width="${strokeW}" stroke-linecap="round" stroke-linejoin="round" />`
      );
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgW}" width="100%" height="100%"><rect width="${svgW}" height="${svgW}" fill="#ffffff"/>${shapes.join('')}</svg>`;
}

export function renderQrDataUri(text: string, style: QrStyle = 'square', margin = 2, centerIcon = true): string {
  const svg = renderQrSvg(text, style, margin, centerIcon);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
