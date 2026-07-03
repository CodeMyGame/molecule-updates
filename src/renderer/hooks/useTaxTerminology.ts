import { useTranslation } from 'react-i18next';
import { getTaxTerminology, type TaxTerminology } from '../lib/taxTerminology';

export function useTaxTerminology(): TaxTerminology {
  const { i18n } = useTranslation();
  return getTaxTerminology(i18n.language || 'en');
}
