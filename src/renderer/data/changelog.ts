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
    title: 'Hold Orders, QR Payments & Faster Billing',
    date: 'Latest Update',
    badge: 'Latest',
    summary: 'Easily pause and resume table orders, print clean UPI QR codes for instant payments, and enjoy a smoother checkout experience.',
    highlights: [
      {
        title: 'Hold & Resume Orders',
        description: 'Need to pause an order while customers decide? Put it on hold with one click and resume anytime without losing any added dishes.',
        tag: 'New',
        icon: 'Zap',
      },
      {
        title: 'Instant QR Payment on Bills',
        description: 'A clean, high-contrast QR code is printed directly on bills so customers can quickly scan and pay using Google Pay, PhonePe, or Paytm.',
        tag: 'Improved',
        icon: 'QrCode',
      },
      {
        title: 'One-Tap Order Refresh',
        description: 'Instantly sync active table items and orders with a single tap on the refresh button without having to switch screens.',
        tag: 'New',
        icon: 'Sparkles',
      },
      {
        title: 'Smoother & Safer Bill Saving',
        description: 'Dishes, customer details, and custom items are now saved even more reliably so your billing counter runs without interruption.',
        tag: 'Improved',
        icon: 'ShieldCheck',
      },
    ],
  },
];

export const LATEST_VERSION = RELEASES[0]?.version || '1.1.20';
