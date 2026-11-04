import { Slot } from 'expo-router';

import { AdminGate, AdminSessionProvider } from '@/components/admin/session';
import { AdminShell } from '@/components/admin/shell';

/** The company's admin dashboard (web, desktop-first): sign-in gate, sidebar shell, pages. */
export default function AdminLayout() {
  return (
    <AdminSessionProvider>
      <AdminGate>
        <AdminShell>
          <Slot />
        </AdminShell>
      </AdminGate>
    </AdminSessionProvider>
  );
}
