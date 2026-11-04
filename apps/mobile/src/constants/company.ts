import type { CompanySettings } from '@/backend/types';
import { COMMISSION_RATE } from '@/lib/pricing';

/**
 * Starting values until the company admin fills in its details. Legal fields stay
 * empty on purpose: invoices show "not set yet" rather than made-up numbers.
 */
export const DEFAULT_COMPANY: CompanySettings = {
  id: 'company',
  legalName: '',
  tradeName: '',
  legalForm: '',
  ice: '',
  rc: '',
  taxId: '',
  address: '',
  city: '',
  phone: '',
  email: '',
  bankName: '',
  rib: '',
  payInstructions: '',
  commissionRate: COMMISSION_RATE,
  dueDays: 7,
  graceDays: 7,
  updatedAt: 0,
};

export function withDefaults(settings: Partial<CompanySettings> | null | undefined): CompanySettings {
  return { ...DEFAULT_COMPANY, ...(settings ?? {}), id: 'company' };
}

/** The details printed on an invoice. */
export function companyIdentity(settings: CompanySettings) {
  const { id: _id, commissionRate: _rate, dueDays: _due, graceDays: _grace, updatedAt: _at, ...identity } = settings;
  return identity;
}

/** Legal details an invoice needs before it can be treated as a real invoice. */
export function missingLegalDetails(identity: Pick<CompanySettings, 'legalName' | 'ice' | 'rc' | 'taxId' | 'address'>) {
  return (['legalName', 'ice', 'rc', 'taxId', 'address'] as const).filter((key) => !identity[key].trim());
}

/** True when drivers have at least one way to pay. */
export function canBePaid(identity: Pick<CompanySettings, 'rib' | 'payInstructions'>) {
  return !!identity.rib.trim() || !!identity.payInstructions.trim();
}
