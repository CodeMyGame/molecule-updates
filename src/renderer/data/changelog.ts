export interface ReleaseHighlight {
  title: string;
  description: string;
  tag: 'New' | 'Improved' | 'Fix';
  icon: 'QrCode' | 'Atom' | 'Palette' | 'Printer' | 'Languages' | 'ShieldCheck' | 'Move' | 'PackageCheck' | 'Sparkles' | 'Coins' | 'Zap';
}

export interface ReleaseEntry {
  version: string;
  title: string;
  date: string;
  badge?: string;
  summary: string;
  highlights: ReleaseHighlight[];
}

export const RELEASES: ReleaseEntry[] = [
  {
    version: '1.1.20',
    title: "Hold Order Management, QR Bill Upgrades & What's New",
    date: 'November 2026',
    badge: 'Latest',
    summary: 'Seamless hold & unhold billing workflow with table retention, clean high-contrast UPI QR bill printing without clutter, cart auto-refresh, foreign key safeguards, and What\'s New release updates.',
    highlights: [
      {
        title: 'Hold & Unhold Table Billing',
        description: 'Easily hold orders while keeping tables selected and active items visible in the cart, with a single-tap Unhold button to resume billing anytime.',
        tag: 'New',
        icon: 'Zap',
      },
      {
        title: 'Minimalist UPI QR Bill Presentation',
        description: 'Clean receipt QR code display with centered atom emblem and uncluttered layout, omitting redundant text labels for quick scanning.',
        tag: 'Improved',
        icon: 'QrCode',
      },
      {
        title: 'Live Cart Order Refresh',
        description: 'Quick refresh button beside KOT toggle instantly re-syncs active table items and orders without switching screens.',
        tag: 'New',
        icon: 'Sparkles',
      },
      {
        title: 'Foreign Key & Order Robustness',
        description: 'Defensive validation on custom items, staff references, and customer links protects against SQLite constraint issues during hold and resume.',
        tag: 'Improved',
        icon: 'ShieldCheck',
      },
      {
        title: "What's New Release Modal",
        description: 'In-app notification dialog showcasing release features and enhancements to users right after updating.',
        tag: 'New',
        icon: 'Sparkles',
      },
    ],
  },
  {
    version: '1.1.19',
    title: 'Dynamic UPI QR on Bills & Styled Receipt Printing',
    date: 'November 2026',
    summary: 'Empower your billing counter with dynamic scannable UPI QR codes on thermal and PDF bills, complete with custom QR shapes, Molecule atom branding, and virtual printer previewing.',
    highlights: [
      {
        title: 'Dynamic UPI QR on Printed Bills',
        description: 'Auto-computes order grand total, embeds UPI ID, and formats payment note with Restaurant Name & Order ID for seamless 1-tap checkout.',
        tag: 'New',
        icon: 'QrCode',
      },
      {
        title: 'Molecule Atom QR Centerpiece',
        description: 'Embedded orbital atom emblem with Level-Q error correction for scannability across Google Pay, PhonePe, and Paytm.',
        tag: 'New',
        icon: 'Atom',
      },
      {
        title: 'Customizable QR Shapes & Styles',
        description: 'Personalize receipt aesthetics with Square, Rounded, Dots, or Classy corner styles in Print Settings.',
        tag: 'New',
        icon: 'Palette',
      },
      {
        title: 'Virtual Thermal Printer Live Preview',
        description: 'Direct monochrome bitmap rendering previewing exact ESC/POS raster printouts before physical printer delivery.',
        tag: 'Improved',
        icon: 'Printer',
      },
      {
        title: 'Multilingual Regional Support',
        description: 'Full translation synchronization across 15 international and regional languages.',
        tag: 'Improved',
        icon: 'Languages',
      },
    ],
  },
  {
    version: '1.1.18',
    title: 'Operational Resilience & Shift Protection',
    date: 'October 2026',
    summary: 'Enterprise stability upgrades including day session concurrency protections, smooth table floor plan transfers, and automated inventory PO receiving.',
    highlights: [
      {
        title: 'Day Session Concurrency Guard',
        description: 'Eliminates dual open drawers and automatically re-balances stale orphaned shifts.',
        tag: 'Improved',
        icon: 'ShieldCheck',
      },
      {
        title: 'Floor Plan Table Move Synchronization',
        description: 'Transfer active tables with preserved dish items, running totals, and audit trail notes.',
        tag: 'Improved',
        icon: 'Move',
      },
      {
        title: 'Automated PO Stock Ingestion',
        description: 'One-click purchase order receiving increments raw inventory and posts vendor audit transactions.',
        tag: 'New',
        icon: 'PackageCheck',
      },
    ],
  },
  {
    version: '1.1.17',
    title: 'Promotional Engine & Customer Loyalty',
    date: 'October 2026',
    summary: 'Automated promotional discount coupons (HAPPY20, FLAT100), tiered customer loyalty coins accrual, and redemption management.',
    highlights: [
      {
        title: 'Smart Promotional Offers Engine',
        description: 'Evaluates active promotions in real-time and applies the maximum customer savings automatically.',
        tag: 'New',
        icon: 'Sparkles',
      },
      {
        title: 'Loyalty Coins Khata Integration',
        description: 'Accrue coins on customer spend and redeem directly against bill balances.',
        tag: 'New',
        icon: 'Coins',
      },
      {
        title: 'Performance Optimization',
        description: 'Sub-millisecond billing queries and cached category rendering for fast peak-hour checkouts.',
        tag: 'Improved',
        icon: 'Zap',
      },
    ],
  },
];

export const LATEST_VERSION = RELEASES[0]?.version || '1.1.20';
