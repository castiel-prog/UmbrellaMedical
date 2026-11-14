import { Role } from './model';

export interface NavItem {
  label: string;
  path: string;
  roles?: Role[];
}

// Shown in this order; each role sees only its own items.
export const NAV_ITEMS: NavItem[] = [
  { label: 'Doctors', path: '/doctors', roles: undefined },
  { label: 'Store', path: '/store', roles: undefined },
  { label: 'My appointments', path: '/appointments', roles: ['Patient'] },
  { label: 'My health', path: '/health', roles: ['Patient'] },
  { label: 'My orders', path: '/orders', roles: ['Patient'] },
  { label: 'My bills', path: '/invoices', roles: ['Patient'] },
  { label: 'Appointments', path: '/desk', roles: ['Doctor', 'Receptionist', 'Admin'] },
  { label: 'Patients', path: '/patients', roles: ['Doctor', 'Receptionist', 'Admin'] },
  { label: 'Prescriptions', path: '/prescriptions', roles: ['Doctor', 'Receptionist', 'Admin'] },
  { label: 'Store orders', path: '/store-orders', roles: ['Receptionist', 'Admin'] },
  { label: 'Invoices', path: '/invoices', roles: ['Receptionist', 'Admin'] },
  { label: 'Working hours', path: '/working-hours', roles: ['Doctor'] },
  { label: 'Time off', path: '/time-off', roles: ['Doctor', 'Admin'] },
  { label: 'Staff schedule', path: '/staff-schedule', roles: ['Receptionist', 'Admin'] },
  { label: 'Reports', path: '/reports', roles: ['Admin'] },
  { label: 'Admin', path: '/admin', roles: ['Admin'] }
  // "My profile" is reached through the picture and name at the right of the top bar.
];
