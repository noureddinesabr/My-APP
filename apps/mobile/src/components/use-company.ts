import { useDoc } from '@/backend';
import { withDefaults } from '@/constants/company';

/** The operating company's settings (identity, app share, invoice terms), live. */
export function useCompany() {
  const doc = useDoc('settings', 'company');
  return { company: withDefaults(doc), loaded: doc !== undefined };
}
