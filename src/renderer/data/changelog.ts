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
    version: '1.1.21',
    title: 'High Performance, Version Rollback & Compact Billing',
    date: 'Latest Update',
    badge: 'Latest',
    summary: 'Instant staff unlocking, smooth 60 FPS billing, 1-click version rollback in settings, and a cleaner active orders bar.',
    highlights: [
      {
        title: 'Blazing Fast Performance',
        description: 'Instant lock-screen unlocking with zero freeze, optimized background cloud sync, and sub-millisecond cart updates during rush hours.',
        tag: 'Improved',
        icon: 'Zap',
      },
      {
        title: 'Safe Version Rollback',
        description: 'Easily revert to any of the last 3 stable releases directly from Settings with zero data loss or database risk.',
        tag: 'New',
        icon: 'ShieldCheck',
      },
      {
        title: 'Cleaner Active Orders Bar',
        description: 'Active order pills in the top header are now sleek, compact, and show real-time KOT statuses without cluttering your screen.',
        tag: 'Improved',
        icon: 'Sparkles',
      },
      {
        title: 'Flexible Split Shifts',
        description: 'Staff can now clock in and out multiple times per day (e.g. morning and evening shifts) seamlessly.',
        tag: 'New',
        icon: 'PackageCheck',
      },
      {
        title: 'Smart Cart Refresh',
        description: 'Order refresh button only appears when an order is placed, preventing accidental refreshes on new carts.',
        tag: 'New',
        icon: 'Sparkles',
      },
      {
        title: 'Database Auto-Maintenance',
        description: 'Automated background SQLite checkpoints ensure lightning-fast database queries even after weeks of non-stop operation.',
        tag: 'Improved',
        icon: 'ShieldCheck',
      },
    ],
  },
  {
    version: '1.1.20',
    title: 'Hold Orders, QR Payments & Faster Billing',
    date: 'November 2026',
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

export const LATEST_VERSION = RELEASES[0]?.version || '1.1.21';
