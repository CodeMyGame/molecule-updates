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
    version: '1.1.22',
    title: 'Takeaway Parcels, Partner Tags & Live KOT Table Status',
    date: 'Latest Update',
    badge: 'Latest',
    summary: 'Dedicated Takeaway & Parcels shelf, custom delivery partner tags (Zomato, Swiggy, Blinkit), live KOT status on table cards, 1-click Excel order export, and high-contrast mode switcher.',
    highlights: [
      {
        title: 'Takeaway Parcels & Partner Tagging',
        description: 'Tag takeaway orders with delivery partner presets (Zomato, Swiggy, Blinkit, Dunzo, Direct) or create custom tags (+ Add). Parcels are cleanly numbered (Parcel #1, Parcel #2) instead of long IDs.',
        tag: 'New',
        icon: 'PackageCheck',
      },
      {
        title: 'Takeaway Shelf on Tables View',
        description: 'View and manage all active takeaway parcels directly on the Tables floor screen in a dedicated shelf with 1-tap Quick Pay and real-time status badges.',
        tag: 'New',
        icon: 'Move',
      },
      {
        title: 'Live KOT Status on Table Cards',
        description: 'Occupied tables now display live kitchen progress (KOT Sent, Preparing, Ready for Pickup, Served) so servers know order status at a glance.',
        tag: 'New',
        icon: 'Zap',
      },
      {
        title: 'Full Order Data Export for Excel',
        description: 'Download all historical sales, dish breakdowns, taxes, and split-tender payment methods into an Excel-compatible CSV file directly from Settings or Activation.',
        tag: 'New',
        icon: 'ShieldCheck',
      },
      {
        title: 'High-Contrast Order Mode Switcher',
        description: 'Crystal-clear visual contrast between Dine In and Takeaway tabs with vibrant solid colors and real-time active order count badges on both modes.',
        tag: 'Improved',
        icon: 'Sparkles',
      },
      {
        title: 'Clean Mode Switching & Price Integrity',
        description: 'Switching between Dine In and Takeaway cleanly isolates carts without cross-contamination. Re-ordering customer dishes with custom addons preserves exact base dish pricing.',
        tag: 'Improved',
        icon: 'ShieldCheck',
      },
    ],
  },
  {
    version: '1.1.21',
    title: 'High Performance, Version Rollback & Compact Billing',
    date: 'November 2026',
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

export const LATEST_VERSION = RELEASES[0]?.version || '1.1.22';
