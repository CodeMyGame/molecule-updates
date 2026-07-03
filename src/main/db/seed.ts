import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

interface SeedVariation { name: string; price: number }
interface SeedItem {
  name: string; shortCode: string; categoryId: number;
  basePrice: number; taxRate: number; isVeg: boolean; isAvailable: boolean;
  sortOrder: number; variations?: SeedVariation[];
}
interface SeedCategory {
  id: number; name: string; sortOrder: number; isActive: boolean;
}
interface SeedAddonGroup {
  name: string;
  categoryId: number;
  minSelect: number;
  maxSelect: number;
  addons: { name: string; price: number; variationPrices?: { variationName: string; price: number }[] }[];
}

const CATEGORIES: SeedCategory[] = [
  { id: 1, name: 'Cold Coffee', sortOrder: 1, isActive: true },
  { id: 2, name: 'Burger', sortOrder: 2, isActive: true },
  { id: 3, name: 'Veg Hot Dog', sortOrder: 3, isActive: true },
  { id: 4, name: 'Maggi', sortOrder: 4, isActive: true },
  { id: 5, name: 'Fries', sortOrder: 5, isActive: true },
  { id: 6, name: 'Pasta', sortOrder: 6, isActive: true },
  { id: 7, name: 'Sandwich', sortOrder: 7, isActive: true },
  { id: 8, name: 'Waffle', sortOrder: 8, isActive: true },
  { id: 9, name: 'Pizza', sortOrder: 9, isActive: true },
  { id: 10, name: 'Garlic Bread', sortOrder: 10, isActive: true },
  { id: 11, name: 'Milk Shake', sortOrder: 11, isActive: true },
  { id: 12, name: 'Brownie', sortOrder: 12, isActive: true },
  { id: 13, name: 'Mocktail', sortOrder: 13, isActive: true },
  { id: 14, name: 'Wrap', sortOrder: 14, isActive: true },
  { id: 15, name: 'Chinese', sortOrder: 15, isActive: true },
  { id: 16, name: 'Hot & Cold', sortOrder: 16, isActive: true },
];

const ITEMS: SeedItem[] = [
  // Cold Coffee (category 1)
  { name: 'Cold coffee', shortCode: 'CLCF', categoryId: 1, basePrice: 8900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 1 },
  { name: 'Chocolate cold coffee', shortCode: 'CHCC', categoryId: 1, basePrice: 9900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 2 },
  // Burger (category 2)
  { name: 'Crispy burger', shortCode: 'CRBR', categoryId: 2, basePrice: 3900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 1 },
  { name: 'Spicy alloo tikki burger', shortCode: 'SATB', categoryId: 2, basePrice: 4900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 2 },
  { name: 'Schezwan burger', shortCode: 'SZBR', categoryId: 2, basePrice: 4900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 3 },
  { name: 'Cheesy burger', shortCode: 'CHBR', categoryId: 2, basePrice: 6900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 4 },
  { name: 'Fries burger', shortCode: 'FRBR', categoryId: 2, basePrice: 6900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 5 },
  { name: 'Supremo burger', shortCode: 'SPBR', categoryId: 2, basePrice: 6900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 6 },
  { name: 'Mexican burger', shortCode: 'MXBR', categoryId: 2, basePrice: 6900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 7 },
  { name: 'Crispy nachos burger', shortCode: 'CNBR', categoryId: 2, basePrice: 7900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 8 },
  { name: 'Baked burger', shortCode: 'BKBR', categoryId: 2, basePrice: 8900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 9 },
  { name: 'BKB Burger', shortCode: 'BBBR', categoryId: 2, basePrice: 8900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 10 },
  { name: 'BKB Cheese Burger', shortCode: 'BCBR', categoryId: 2, basePrice: 12900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 11 },
  { name: 'Paneer crispy burger', shortCode: 'PCBR', categoryId: 2, basePrice: 8900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 12 },
  // Veg Hot Dog (category 3)
  { name: 'Veg Treat Hot Dog', shortCode: 'VTHD', categoryId: 3, basePrice: 5900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 1 },
  { name: 'Veg spicy Hot Dog', shortCode: 'VSHD', categoryId: 3, basePrice: 5900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 2 },
  { name: 'Veg Schezwan Hot Dog', shortCode: 'VSZH', categoryId: 3, basePrice: 6900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 3 },
  { name: 'Veg cheesy Hot Dog', shortCode: 'VCHD', categoryId: 3, basePrice: 8900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 4 },
  { name: 'Veg cheesy Schezwan Hot Dog', shortCode: 'VCSH', categoryId: 3, basePrice: 8900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 5 },
  // Maggi (category 4)
  { name: 'Masala maggi', shortCode: 'MSMG', categoryId: 4, basePrice: 6900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 1 },
  { name: 'Masala Cheese maggi', shortCode: 'MCMG', categoryId: 4, basePrice: 8900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 2 },
  { name: 'Schezwan maggi', shortCode: 'SZMG', categoryId: 4, basePrice: 7900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 3 },
  { name: 'Mexican maggi', shortCode: 'MXMG', categoryId: 4, basePrice: 6900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 4 },
  { name: 'Italian maggi', shortCode: 'ITMG', categoryId: 4, basePrice: 8900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 5 },
  // Fries (category 5)
  { name: 'Fries', shortCode: 'FRIS', categoryId: 5, basePrice: 7900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 1 },
  { name: 'Fries wit piri piri', shortCode: 'FPPP', categoryId: 5, basePrice: 8900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 2 },
  { name: 'Fries with meyo', shortCode: 'FWMY', categoryId: 5, basePrice: 9900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 3 },
  { name: 'Fries with cheese', shortCode: 'FWCH', categoryId: 5, basePrice: 11900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 4 },
  { name: 'Meyo cheesy fries', shortCode: 'MCFR', categoryId: 5, basePrice: 9900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 5 },
  { name: 'Cheese nachos', shortCode: 'CHNS', categoryId: 5, basePrice: 11900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 6 },
  { name: 'Mexican nachos', shortCode: 'MXNS', categoryId: 5, basePrice: 10900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 7 },
  // Pasta (category 6)
  { name: 'White sause pasta', shortCode: 'WSPA', categoryId: 6, basePrice: 10900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 1 },
  { name: 'Arabiata pasta (red pasta)', shortCode: 'ARPA', categoryId: 6, basePrice: 10900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 2 },
  { name: 'Pink pasta (red&white)', shortCode: 'PKPA', categoryId: 6, basePrice: 10900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 3 },
  { name: 'Exotic pasta', shortCode: 'EXPA', categoryId: 6, basePrice: 11900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 4 },
  // Sandwich (category 7)
  { name: 'Bread Butter Cheese Sandwich', shortCode: 'BBCS', categoryId: 7, basePrice: 4900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 1 },
  { name: 'Bread butter jam (3 layer)', shortCode: 'BBJS', categoryId: 7, basePrice: 4900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 2 },
  { name: 'Schezwan meyo grill Sandwich', shortCode: 'SMGS', categoryId: 7, basePrice: 5900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 3 },
  { name: 'White cheese grill Sandwich', shortCode: 'WCGS', categoryId: 7, basePrice: 8900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 4 },
  { name: 'Exotic grill Sandwich', shortCode: 'EXGS', categoryId: 7, basePrice: 6900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 5 },
  { name: 'Chilly grill Sandwich', shortCode: 'CHGS', categoryId: 7, basePrice: 6900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 6 },
  { name: 'Cheesy corn Sandwich', shortCode: 'CCNS', categoryId: 7, basePrice: 7900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 7 },
  { name: 'Pasta sandwich', shortCode: 'PSAS', categoryId: 7, basePrice: 7900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 8 },
  { name: 'Paneer chilly grill Sandwich', shortCode: 'PCGS', categoryId: 7, basePrice: 8900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 9 },
  { name: 'Schezwan meyo cheese grill Sandwich', shortCode: 'SMCG', categoryId: 7, basePrice: 7900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 10 },
  { name: 'Tandoori paneer Sandwich', shortCode: 'TDPS', categoryId: 7, basePrice: 8900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 11 },
  { name: 'Chocolate grill Sandwich', shortCode: 'CGSS', categoryId: 7, basePrice: 7900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 12 },
  { name: 'Cheesy club Sandwich', shortCode: 'CCLS', categoryId: 7, basePrice: 9900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 13 },
  { name: 'Chesse bake Sandwich', shortCode: 'CBKS', categoryId: 7, basePrice: 9900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 14 },
  // Waffle (category 8)
  { name: 'Chocolate Waffle', shortCode: 'CHWF', categoryId: 8, basePrice: 7900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 1, variations: [{ name: '2 Pieces', price: 7900 }, { name: '4 Pieces', price: 13900 }] },
  { name: 'Butter scotch Waffle', shortCode: 'BSWF', categoryId: 8, basePrice: 7900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 2, variations: [{ name: '2 Pieces', price: 7900 }, { name: '4 Pieces', price: 13900 }] },
  { name: 'Chocolate kit-kat Waffle', shortCode: 'KKWF', categoryId: 8, basePrice: 10900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 3, variations: [{ name: '2 Pieces', price: 10900 }, { name: '4 Pieces', price: 19900 }] },
  { name: 'Double delight Waffle', shortCode: 'DDWF', categoryId: 8, basePrice: 10900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 4, variations: [{ name: '2 Pieces', price: 10900 }, { name: '4 Pieces', price: 19900 }] },
  { name: 'Chocolate Oreo Waffle', shortCode: 'ORWF', categoryId: 8, basePrice: 10900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 5, variations: [{ name: '2 Pieces', price: 10900 }, { name: '4 Pieces', price: 19900 }] },
  { name: 'Nutella Chocolate Waffle', shortCode: 'NTWF', categoryId: 8, basePrice: 12900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 6, variations: [{ name: '2 Pieces', price: 12900 }, { name: '4 Pieces', price: 23900 }] },
  // Pizza (category 9)
  { name: 'Margarita Pizza', shortCode: 'MGPZ', categoryId: 9, basePrice: 9900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 1, variations: [{ name: 'Regular', price: 9900 }, { name: 'Medium', price: 15900 }] },
  { name: 'Fresh farm pizza', shortCode: 'FFPZ', categoryId: 9, basePrice: 11900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 2, variations: [{ name: 'Regular', price: 11900 }, { name: 'Medium', price: 16900 }] },
  { name: 'Veg Supremo Pizza', shortCode: 'VSPZ', categoryId: 9, basePrice: 13900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 3, variations: [{ name: 'Regular', price: 13900 }, { name: 'Medium', price: 18900 }] },
  { name: 'Mexican pizza', shortCode: 'MXPZ', categoryId: 9, basePrice: 13900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 4, variations: [{ name: 'Regular', price: 13900 }, { name: 'Medium', price: 18900 }] },
  { name: 'Indian spicy Pizza', shortCode: 'ISPZ', categoryId: 9, basePrice: 13900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 5, variations: [{ name: 'Regular', price: 13900 }, { name: 'Medium', price: 18900 }] },
  { name: 'Masala paneer pizza', shortCode: 'MPPZ', categoryId: 9, basePrice: 15900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 6, variations: [{ name: 'Regular', price: 15900 }, { name: 'Medium', price: 20900 }] },
  { name: 'Corn delight Pizza', shortCode: 'CDPZ', categoryId: 9, basePrice: 12900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 7, variations: [{ name: 'Regular', price: 12900 }, { name: 'Medium', price: 17900 }] },
  { name: 'Veggie triangle Pizza', shortCode: 'VTPZ', categoryId: 9, basePrice: 12900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 8, variations: [{ name: 'Regular', price: 12900 }, { name: 'Medium', price: 17900 }] },
  { name: 'Triple Spicy pizza', shortCode: 'TSPZ', categoryId: 9, basePrice: 13900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 9, variations: [{ name: 'Regular', price: 13900 }, { name: 'Medium', price: 18900 }] },
  { name: 'Fries pizza', shortCode: 'FRPZ', categoryId: 9, basePrice: 11900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 10, variations: [{ name: 'Regular', price: 11900 }, { name: 'Medium', price: 16900 }] },
  { name: 'Tandoori paneer pizza', shortCode: 'TPPZ', categoryId: 9, basePrice: 15900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 11, variations: [{ name: 'Regular', price: 15900 }, { name: 'Medium', price: 20900 }] },
  { name: 'Crowded pizza', shortCode: 'CRPZ', categoryId: 9, basePrice: 15900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 12, variations: [{ name: 'Regular', price: 15900 }, { name: 'Medium', price: 20900 }] },
  { name: 'Veggie Americano Pizza', shortCode: 'VAPZ', categoryId: 9, basePrice: 15900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 13, variations: [{ name: 'Regular', price: 15900 }, { name: 'Medium', price: 20900 }] },
  { name: 'Pasta Pizza', shortCode: 'PAPZ', categoryId: 9, basePrice: 15900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 14, variations: [{ name: 'Regular', price: 15900 }, { name: 'Medium', price: 20900 }] },
  // Garlic Bread (category 10)
  { name: 'Cheese garlic bread', shortCode: 'CGGB', categoryId: 10, basePrice: 7900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 1, variations: [{ name: 'Regular', price: 7900 }, { name: 'Medium', price: 10900 }] },
  { name: 'Onion chilly garlic bread', shortCode: 'OCGB', categoryId: 10, basePrice: 8900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 2, variations: [{ name: 'Regular', price: 8900 }, { name: 'Medium', price: 11900 }] },
  { name: 'Tomato chilly garlic bread', shortCode: 'TCGB', categoryId: 10, basePrice: 8900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 3, variations: [{ name: 'Regular', price: 8900 }, { name: 'Medium', price: 11900 }] },
  { name: 'Sweet corn garlic bread', shortCode: 'SCGB', categoryId: 10, basePrice: 8900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 4, variations: [{ name: 'Regular', price: 8900 }, { name: 'Medium', price: 11900 }] },
  { name: 'Jalapeno garlic bread', shortCode: 'JPGB', categoryId: 10, basePrice: 8900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 5, variations: [{ name: 'Regular', price: 8900 }, { name: 'Medium', price: 11900 }] },
  { name: 'Supremo garlic bread', shortCode: 'SMGB', categoryId: 10, basePrice: 8900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 6, variations: [{ name: 'Regular', price: 8900 }, { name: 'Medium', price: 11900 }] },
  { name: 'Triple spice garlic bread', shortCode: 'TSGB', categoryId: 10, basePrice: 9900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 7, variations: [{ name: 'Regular', price: 9900 }, { name: 'Medium', price: 13900 }] },
  { name: 'Peri Peri paneer garlic bread', shortCode: 'PPGB', categoryId: 10, basePrice: 10900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 8, variations: [{ name: 'Regular', price: 10900 }, { name: 'Medium', price: 14900 }] },
  // Milk Shake (category 11)
  { name: 'Vanilla shake', shortCode: 'VNSK', categoryId: 11, basePrice: 7900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 1 },
  { name: 'Strawberry shake', shortCode: 'STSK', categoryId: 11, basePrice: 7900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 2 },
  { name: 'Butter scotch shake', shortCode: 'BSSK', categoryId: 11, basePrice: 9900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 3 },
  { name: 'Kit-kat caramal shake', shortCode: 'KKSK', categoryId: 11, basePrice: 11900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 4 },
  { name: 'Chocolate shake', shortCode: 'CHSK', categoryId: 11, basePrice: 9900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 5 },
  { name: 'Brownie shake', shortCode: 'BRSK', categoryId: 11, basePrice: 10900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 6 },
  { name: 'Oreo shake', shortCode: 'ORSK', categoryId: 11, basePrice: 10900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 7 },
  { name: 'Nutella shake', shortCode: 'NUSK', categoryId: 11, basePrice: 13900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 8 },
  // Brownie (category 12)
  { name: 'Brownie with ice cream', shortCode: 'BWIC', categoryId: 12, basePrice: 7900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 1 },
  { name: 'Sizzling brownie', shortCode: 'SLBR', categoryId: 12, basePrice: 10900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 2 },
  // Mocktail (category 13)
  { name: 'Virgin mojito', shortCode: 'VRMJ', categoryId: 13, basePrice: 6900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 1 },
  { name: 'Blue ice mojito', shortCode: 'BIMJ', categoryId: 13, basePrice: 6900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 2 },
  { name: 'Cool blue mocktail', shortCode: 'CBMK', categoryId: 13, basePrice: 6900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 3 },
  { name: 'Italian Mojito', shortCode: 'ITMJ', categoryId: 13, basePrice: 6900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 4 },
  { name: 'Nature kiwi cold mocktail', shortCode: 'NKMK', categoryId: 13, basePrice: 6900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 5 },
  { name: 'Green apple mocktail', shortCode: 'GAMK', categoryId: 13, basePrice: 7900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 6 },
  { name: 'Strawberry mojito', shortCode: 'STMJ', categoryId: 13, basePrice: 6900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 7 },
  { name: 'Sunrise orange mocktail', shortCode: 'SOMK', categoryId: 13, basePrice: 6900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 8 },
  // Wrap (category 14)
  { name: 'Veg Wrap', shortCode: 'VGWP', categoryId: 14, basePrice: 7900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 1 },
  { name: 'Veg cheese wrap', shortCode: 'VCWP', categoryId: 14, basePrice: 8900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 2 },
  { name: 'Mexican wrap', shortCode: 'MXWP', categoryId: 14, basePrice: 8900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 3 },
  { name: 'Paneer masala wrap', shortCode: 'PMWP', categoryId: 14, basePrice: 11900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 4 },
  // Chinese (category 15)
  { name: 'Manchurian dry', shortCode: 'MNDR', categoryId: 15, basePrice: 7900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 1 },
  { name: 'Steam momos', shortCode: 'STMO', categoryId: 15, basePrice: 6900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 2 },
  { name: 'Fried momos', shortCode: 'FRMO', categoryId: 15, basePrice: 7900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 3 },
  { name: 'Hakka noodles', shortCode: 'HKNO', categoryId: 15, basePrice: 7900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 4 },
  { name: 'Schezwan noodles', shortCode: 'SZNO', categoryId: 15, basePrice: 8900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 5 },
  { name: 'Garlic Chowmein', shortCode: 'GACH', categoryId: 15, basePrice: 8900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 6 },
  { name: 'Potato chilly', shortCode: 'PTCH', categoryId: 15, basePrice: 11900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 7 },
  { name: 'Paneer chilly', shortCode: 'PNCH', categoryId: 15, basePrice: 12900, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 8 },
  // Hot & Cold (category 16)
  { name: 'Tea', shortCode: 'HTEA', categoryId: 16, basePrice: 3500, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 1 },
  { name: 'Coffee', shortCode: 'HCFF', categoryId: 16, basePrice: 4000, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 2 },
  { name: 'Cold Drink', shortCode: 'CDRK', categoryId: 16, basePrice: 4000, taxRate: 5, isVeg: true, isAvailable: true, sortOrder: 3 },
];

const ADDON_GROUPS: SeedAddonGroup[] = [
  {
    name: 'Cold Coffee Add-ons', categoryId: 1, minSelect: 0, maxSelect: 2,
    addons: [
      { name: 'Ice Cream', price: 3900 },
      { name: 'Choco Chips', price: 1900 },
    ],
  },
  {
    name: 'Hot Dog Add-ons', categoryId: 3, minSelect: 0, maxSelect: 1,
    addons: [{ name: 'Extra Cheese', price: 3000 }],
  },
  {
    name: 'Maggi Add-ons', categoryId: 4, minSelect: 0, maxSelect: 1,
    addons: [{ name: 'Extra Cheese', price: 4900 }],
  },
  {
    name: 'Fries Add-ons', categoryId: 5, minSelect: 0, maxSelect: 3,
    addons: [
      { name: 'Extra Cheese', price: 4900 },
      { name: 'Extra Meyo/Cheese Dip', price: 3000 },
      { name: 'Schezwan/Spicy Meyo', price: 3000 },
    ],
  },
  {
    name: 'Sandwich Add-ons', categoryId: 7, minSelect: 0, maxSelect: 1,
    addons: [{ name: 'Extra Cheese', price: 3900 }],
  },
  {
    name: 'Waffle Toppings', categoryId: 8, minSelect: 0, maxSelect: 1,
    addons: [{
      name: 'Ice Cream', price: 3900,
      variationPrices: [
        { variationName: '2 Pieces', price: 3900 },
        { variationName: '4 Pieces', price: 5900 },
      ],
    }],
  },
  {
    name: 'Pizza Crust Options', categoryId: 9, minSelect: 0, maxSelect: 1,
    addons: [
      {
        name: 'Cheese Burst', price: 4900,
        variationPrices: [
          { variationName: 'Regular', price: 4900 },
          { variationName: 'Medium', price: 7900 },
        ],
      },
      {
        name: 'Thin Crust', price: 2000,
        variationPrices: [
          { variationName: 'Regular', price: 2000 },
          { variationName: 'Medium', price: 4000 },
        ],
      },
    ],
  },
  {
    name: 'Wrap Add-ons', categoryId: 14, minSelect: 0, maxSelect: 1,
    addons: [{ name: 'Extra Cheese', price: 4900 }],
  },
];

export function seedDatabase(db: Database.Database): void {
  const existing = db.prepare('SELECT COUNT(*) as count FROM restaurant').get() as { count: number };
  if (existing.count > 0) {
    return;
  }

  console.log('Seeding database with initial data...');

  const seed = db.transaction(() => {
    db.prepare(`
      INSERT INTO restaurant (id, name, address, phone)
      VALUES (1, '9tiz Cafe', '123 Main Street', '8955099299')
    `).run();

    const insertRole = db.prepare('INSERT INTO roles (name, permissions) VALUES (?, ?)');
    insertRole.run('admin', JSON.stringify(['*']));
    insertRole.run('manager', JSON.stringify([
      'orders.*', 'menu.*', 'staff.view', 'reports.*', 'inventory.*',
      'tables.*', 'customers.*', 'payments.*', 'day_session.*', 'settings.view'
    ]));
    insertRole.run('cashier', JSON.stringify([
      'orders.*', 'payments.*', 'customers.*', 'tables.view',
      'menu.view', 'day_session.open', 'day_session.close'
    ]));
    insertRole.run('waiter', JSON.stringify([
      'orders.create', 'orders.update', 'orders.view',
      'tables.view', 'tables.update', 'menu.view', 'customers.view'
    ]));
    insertRole.run('chef', JSON.stringify([
      'orders.view', 'kots.view', 'kots.update', 'menu.view', 'inventory.view'
    ]));

    const pinHash = bcrypt.hashSync('1234', 10);
    db.prepare(`
      INSERT INTO staff (name, phone, pin_hash, role_id, is_active)
      VALUES ('Admin', '+91-0000000000', ?, 1, 1)
    `).run(pinHash);

    db.prepare("INSERT INTO floors (name) VALUES ('Ground Floor')").run();

    const insertTable = db.prepare(
      'INSERT INTO tables (floor_id, name, capacity, pos_x, pos_y, shape, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    for (let i = 0; i < 10; i++) {
      const row = Math.floor(i / 5);
      const col = i % 5;
      insertTable.run(1, `T${i + 1}`, 4, col * 120, row * 120, 'rect', 'free');
    }

    const insertCategory = db.prepare(
      'INSERT INTO menu_categories (name, sort_order, is_active) VALUES (?, ?, 1)'
    );
    for (const cat of CATEGORIES) {
      insertCategory.run(cat.name, cat.sortOrder);
    }

    const insertItem = db.prepare(`
      INSERT INTO menu_items (name, short_code, category_id, base_price, tax_rate, is_veg, is_available, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `);
    const insertVariation = db.prepare(`
      INSERT INTO item_variations (menu_item_id, name, price_delta, is_default)
      VALUES (?, ?, ?, ?)
    `);

    for (const item of ITEMS) {
      const result = insertItem.run(
        item.name, item.shortCode, item.categoryId,
        item.basePrice, item.taxRate, item.isVeg ? 1 : 0, item.sortOrder
      );
      const menuItemId = result.lastInsertRowid;

      if (item.variations) {
        item.variations.forEach((v, idx) => {
          const priceDelta = v.price - item.basePrice;
          insertVariation.run(menuItemId, v.name, priceDelta, idx === 0 ? 1 : 0);
        });
      }
    }

    // Seed addon groups, addons, and link them to menu items by category
    const insertAddonGroup = db.prepare(
      'INSERT INTO addon_groups (name, min_select, max_select, is_required) VALUES (?, ?, ?, 0)'
    );
    const insertAddon = db.prepare(
      'INSERT INTO addons (addon_group_id, name, price) VALUES (?, ?, ?)'
    );
    const linkAddonToItem = db.prepare(
      'INSERT OR IGNORE INTO menu_item_addon_groups (menu_item_id, addon_group_id) VALUES (?, ?)'
    );
    const getItemsByCategory = db.prepare('SELECT id FROM menu_items WHERE category_id = ?');

    const insertAddonVarPrice = db.prepare(
      'INSERT INTO addon_variation_prices (addon_id, variation_name, price) VALUES (?, ?, ?)'
    );

    for (const group of ADDON_GROUPS) {
      const groupResult = insertAddonGroup.run(group.name, group.minSelect, group.maxSelect);
      const groupId = groupResult.lastInsertRowid;
      for (const addon of group.addons) {
        const addonResult = insertAddon.run(groupId, addon.name, addon.price);
        if (addon.variationPrices) {
          const addonId = addonResult.lastInsertRowid;
          for (const vp of addon.variationPrices) {
            insertAddonVarPrice.run(addonId, vp.variationName, vp.price);
          }
        }
      }
      const categoryItems = getItemsByCategory.all(group.categoryId) as { id: number }[];
      for (const item of categoryItems) {
        linkAddonToItem.run(item.id, groupId);
      }
    }

    // Seed 10 random favorites
    const allItemIds = (db.prepare('SELECT id FROM menu_items ORDER BY RANDOM() LIMIT 10').all() as { id: number }[]);
    const insertFav = db.prepare('INSERT OR IGNORE INTO favorites (menu_item_id) VALUES (?)');
    for (const row of allItemIds) {
      insertFav.run(row.id);
    }

    const insertSetting = db.prepare(
      'INSERT INTO settings (key, value, category) VALUES (?, ?, ?)'
    );
    insertSetting.run('tax_inclusive', 'false', 'billing');
    insertSetting.run('bill_prefix', 'ORD', 'billing');
    insertSetting.run('kot_prefix', 'KOT', 'billing');
    insertSetting.run('currency', 'INR', 'general');
  });

  seed();

  console.log('Database seeded successfully');
}
