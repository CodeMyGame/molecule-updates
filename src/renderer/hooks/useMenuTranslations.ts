import { useCallback } from 'react';
import type { MenuItem } from './useMenu';

/**
 * Menu item display names come from the database (`menu_items.name`).
 * Per-language menu names can be added later via locale files if needed.
 */
export function useMenuTranslations(_items: MenuItem[]) {
  const getName = useCallback((item: MenuItem): string => item.name, []);

  return { getName };
}
