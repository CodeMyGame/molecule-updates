export interface ReleaseHighlight {
  title: string;
  description: string;
  tag: 'New' | 'Improved' | 'Fix';
  icon: 'QrCode' | 'Atom' | 'Palette' | 'Printer' | 'Languages' | 'ShieldCheck' | 'Move' | 'PackageCheck' | 'Sparkles' | 'Coins' | 'Zap' | 'BarChart3' | 'Lock';
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
    version: '1.1.23',
    title: 'Customer QR Menu Studio & Printable Menu Posters',
    date: 'Latest Release',
    badge: 'Latest',
    summary: 'Launch an online digital menu for your customers with instant table QR codes, download or print high-resolution menu posters with golden frames, and share guest Wi-Fi details with one tap.',
    highlights: [
      {
        title: 'Customer QR Digital Menu',
        description: 'Guests can scan a QR code at their table to view your full menu on their mobile phone in a clean, non-collapsing 2-column layout with dish details and dietary icons.',
        tag: 'New',
        icon: 'QrCode',
      },
      {
        title: 'Printable Menu Posters (A4 High-Res)',
        description: 'Generate beautiful ready-to-hang menu posters with classic golden borders, clear prices, and an instant scan QR code for your counter or entrance.',
        tag: 'New',
        icon: 'Palette',
      },
      {
        title: 'Automatic Online Menu Updates',
        description: 'Any changes you make to dishes, prices, or categories in your POS automatically update on your live online menu without extra steps.',
        tag: 'New',
        icon: 'Sparkles',
      },
      {
        title: 'Table-Specific QR Codes',
        description: 'Generate unique QR codes for each dining table (e.g. Table 1, Table 2). When scanned, the customer menu automatically knows which table the guest is sitting at.',
        tag: 'New',
        icon: 'Atom',
      },
      {
        title: 'Guest Wi-Fi Sharing',
        description: 'Share your restaurant Wi-Fi name and password directly on the customer menu card so guests can connect with one tap.',
        tag: 'New',
        icon: 'Zap',
      },
      {
        title: 'Standalone QR Code Downloads',
        description: 'Download clean, high-contrast QR codes in multiple styles to print on acrylic stands, table stickers, or promotional cards.',
        tag: 'New',
        icon: 'Printer',
      },
    ],
  },
  {
    version: '1.1.22',
    title: 'Ingredient Tracking, Cancellation Protection & Kitchen Statuses',
    date: 'November 2026',
    summary: 'Track raw ingredient consumption per dish sold, prevent unauthorized kitchen order cancellations with manager password protection, see live cooking status on tables, and export sales to Excel.',
    highlights: [
      {
        title: 'Raw Ingredient & Stock Tracking',
        description: 'See exactly how much cheese, chicken, veggies, or buns are consumed per dish sold. Track quantities used and ingredient costs across your menu.',
        tag: 'New',
        icon: 'BarChart3',
      },
      {
        title: 'Manager Password for Cancellations',
        description: 'Cancelling already-sent kitchen orders or voiding items now requires a manager password to prevent unauthorized cancellations and staff food waste.',
        tag: 'New',
        icon: 'Lock',
      },
      {
        title: 'Instant Search & Smooth Scrolling',
        description: 'Browse through hundreds of menu items, inventory lists, and past bills effortlessly with zero lag.',
        tag: 'New',
        icon: 'Sparkles',
      },
      {
        title: 'Automatic Stock Return on Cancellations',
        description: 'If an order is cancelled or an item is removed, all deducted ingredients are automatically returned back into your live stock.',
        tag: 'Improved',
        icon: 'PackageCheck',
      },
      {
        title: 'Takeaway Parcel Numbering & Delivery Tags',
        description: 'Number daily takeaway orders sequentially (Parcel #1, Parcel #2) and label orders for Zomato, Swiggy, or counter takeaway.',
        tag: 'New',
        icon: 'Move',
      },
      {
        title: 'Kitchen Cooking Status on Tables',
        description: 'Dining tables show real-time kitchen progress badges (Sent to Kitchen, Preparing, Ready, Served) so servers know when food is ready.',
        tag: 'New',
        icon: 'Zap',
      },
      {
        title: 'One-Click Excel Sales Download',
        description: 'Download your entire sales history, bill details, and tax summaries into an Excel spreadsheet with one click for easy accounting and GST filing.',
        tag: 'New',
        icon: 'ShieldCheck',
      },
      {
        title: 'Clear Table Layout & Running Orders',
        description: 'Dining tables stay neatly sorted in order (T1, T2, T3...) with clear badges showing running orders and occupied tables at a glance.',
        tag: 'Improved',
        icon: 'Palette',
      },
    ],
  },
  {
    version: '1.1.21',
    title: 'Faster Counter Billing & Shift Handover',
    date: 'November 2026',
    summary: 'Faster order entry during rush hours, smoother shift handovers, and compact running order badges.',
    highlights: [
      {
        title: 'Faster Billing Counter',
        description: 'Smoother screen transitions and faster order entry even during the busiest lunch and dinner rush hours.',
        tag: 'Improved',
        icon: 'Zap',
      },
      {
        title: 'Staff Shift Clock-In & Handover',
        description: 'Staff can clock in and out for morning and evening shifts, with seamless cashier shift handovers and drawer float tracking.',
        tag: 'New',
        icon: 'PackageCheck',
      },
      {
        title: 'Compact Order Status Bar',
        description: 'Running order badges in the top bar are neat, compact, and show real-time kitchen statuses without cluttering your screen.',
        tag: 'Improved',
        icon: 'Sparkles',
      },
      {
        title: 'One-Tap Order Refresh',
        description: 'Quickly refresh running table items with one tap whenever waiters update orders.',
        tag: 'New',
        icon: 'Sparkles',
      },
      {
        title: 'Reliable All-Day Operation',
        description: 'Automatic self-maintenance keeps Molecule POS fast and responsive all day without ever slowing down.',
        tag: 'Improved',
        icon: 'ShieldCheck',
      },
    ],
  },
  {
    version: '1.1.20',
    title: 'Hold Orders & UPI QR Payments',
    date: 'November 2026',
    summary: 'Easily pause and resume table orders, print UPI payment QR codes on bills, and enjoy smooth checkout.',
    highlights: [
      {
        title: 'Hold & Resume Running Orders',
        description: 'Need to pause an order while customers decide more dishes? Put it on hold with one click and resume anytime without losing any items.',
        tag: 'New',
        icon: 'Zap',
      },
      {
        title: 'UPI Payment QR Code on Receipts',
        description: 'A clean, high-contrast QR code is printed directly on bills so customers can quickly scan and pay using Google Pay, PhonePe, or Paytm.',
        tag: 'Improved',
        icon: 'QrCode',
      },
      {
        title: 'Instant Bill Sync',
        description: 'Sync table changes with one click so cashiers and servers stay on the same page.',
        tag: 'New',
        icon: 'Sparkles',
      },
      {
        title: 'Reliable Bill Storage',
        description: 'Your sales, customer records, and bills are saved safely so your billing counter runs without interruption.',
        tag: 'Improved',
        icon: 'ShieldCheck',
      },
    ],
  },
];

export const LATEST_VERSION = RELEASES[0]?.version || '1.1.23';
