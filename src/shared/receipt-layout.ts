/**
 * Shared receipt layout model for the Bill and KOT field editor.
 *
 * This module is pure (no electron / DOM imports) so it can be used from both
 * the main process and the renderer. It only describes WHICH fields exist, their
 * defaults, and how to merge a user-saved layout with the current field set.
 *
 * The actual rendering of a layout into receipt text lives in receipt-render.ts.
 *
 * NOTE: The layout only affects output when print_mode === 'raster'. Thermal
 * (ESC/POS) and HTML modes keep their fixed layouts.
 */

export interface ReceiptFieldConfig {
  /** Stable field identifier (matches a ReceiptFieldDef.id) */
  id: string;
  /** Whether the field is shown. Core fields are always treated as visible. */
  visible: boolean;
  /** Optional user label override. Empty/undefined means use the default label. */
  label?: string;
}

export type ReceiptLayout = ReceiptFieldConfig[];

export interface ReceiptFieldDef {
  id: string;
  /** Logical section used to decide where separator lines are drawn. */
  section: string;
  /** Core fields cannot be hidden. */
  core?: boolean;
  /** Whether the field's label can be renamed by the user. */
  renamable?: boolean;
  /** Whether the field can be reordered. Defaults to true when omitted. */
  reorderable?: boolean;
}

/** Bill field definitions in their default order. */
export const BILL_FIELD_DEFS: ReceiptFieldDef[] = [
  { id: 'logo', section: 'header', reorderable: false },
  { id: 'name', section: 'header', core: true },
  { id: 'address', section: 'header' },
  { id: 'phone', section: 'header', renamable: true },
  { id: 'gstin', section: 'header', renamable: true },
  { id: 'fssai', section: 'header', renamable: true },
  { id: 'orderNo', section: 'meta', renamable: true },
  { id: 'date', section: 'meta', renamable: true },
  { id: 'type', section: 'meta', renamable: true },
  { id: 'table', section: 'meta', renamable: true },
  { id: 'cashier', section: 'meta', renamable: true },
  { id: 'items', section: 'items', core: true },
  { id: 'subtotal', section: 'totals', renamable: true },
  { id: 'discount', section: 'totals', renamable: true },
  { id: 'tax', section: 'totals' },
  { id: 'roundOff', section: 'totals', renamable: true },
  { id: 'grandTotal', section: 'grand', core: true, renamable: true },
  { id: 'coins', section: 'coins' },
  { id: 'thankYou', section: 'footer', renamable: true },
];

/** KOT field definitions in their default order. */
export const KOT_FIELD_DEFS: ReceiptFieldDef[] = [
  { id: 'title', section: 'title', core: true, renamable: true },
  { id: 'location', section: 'info' },
  { id: 'kotCount', section: 'info', renamable: true },
  { id: 'date', section: 'info', renamable: true },
  { id: 'items', section: 'items', core: true },
  { id: 'itemNotes', section: 'items', reorderable: false },
  { id: 'totalItems', section: 'total', renamable: true },
];

export function getFieldDef(defs: ReceiptFieldDef[], id: string): ReceiptFieldDef | undefined {
  return defs.find((d) => d.id === id);
}

export function isReorderable(def: ReceiptFieldDef): boolean {
  return def.reorderable !== false;
}

/** Build the default layout (all fields visible, default order). */
export function defaultLayout(defs: ReceiptFieldDef[]): ReceiptLayout {
  return defs.map((d) => ({ id: d.id, visible: true }));
}

/**
 * Merge a saved layout (JSON string) with the current field definitions.
 * - keeps saved order, visibility, and label overrides for known fields
 * - forces core fields visible
 * - appends any newly-added fields (forward compatible)
 * - drops unknown fields
 * - pins non-reorderable fields to their default index (e.g. logo stays on top)
 */
export function mergeLayout(saved: string | null | undefined, defs: ReceiptFieldDef[]): ReceiptLayout {
  const defMap = new Map(defs.map((d) => [d.id, d]));

  let parsed: ReceiptFieldConfig[] = [];
  if (saved) {
    try {
      const p = JSON.parse(saved);
      if (Array.isArray(p)) parsed = p;
    } catch {
      parsed = [];
    }
  }

  const result: ReceiptLayout = [];
  const seen = new Set<string>();

  for (const cfg of parsed) {
    if (!cfg || typeof cfg.id !== 'string') continue;
    const def = defMap.get(cfg.id);
    if (!def || seen.has(cfg.id)) continue;
    seen.add(cfg.id);
    const label = typeof cfg.label === 'string' && cfg.label.trim() ? cfg.label : undefined;
    result.push({
      id: cfg.id,
      visible: def.core ? true : cfg.visible !== false,
      label,
    });
  }

  // Append any fields missing from the saved config, in default order.
  for (const d of defs) {
    if (!seen.has(d.id)) result.push({ id: d.id, visible: true });
  }

  // Re-pin non-reorderable fields to their default position so a hand-edited
  // config can never float the logo (or item-notes toggle) out of place.
  return repinNonReorderable(result, defs);
}

function repinNonReorderable(layout: ReceiptLayout, defs: ReceiptFieldDef[]): ReceiptLayout {
  const order = defs.map((d) => d.id);
  const fixed = defs.filter((d) => !isReorderable(d)).map((d) => d.id);
  if (fixed.length === 0) return layout;

  const byId = new Map(layout.map((c) => [c.id, c]));
  // Start from the current (movable) order with fixed ids removed.
  const movable = layout.filter((c) => !fixed.includes(c.id));

  // Insert each fixed id at the position implied by the default order relative
  // to the movable fields around it.
  const result = [...movable];
  for (const fixedId of fixed) {
    const cfg = byId.get(fixedId);
    if (!cfg) continue;
    const defIndex = order.indexOf(fixedId);
    // Find insertion point: before the first movable field whose default index
    // is greater than this fixed field's default index.
    let insertAt = result.length;
    for (let i = 0; i < result.length; i++) {
      if (order.indexOf(result[i].id) > defIndex) {
        insertAt = i;
        break;
      }
    }
    result.splice(insertAt, 0, cfg);
  }
  return result;
}

export function isFieldVisible(layout: ReceiptLayout, id: string): boolean {
  const cfg = layout.find((c) => c.id === id);
  return cfg ? cfg.visible : true;
}
