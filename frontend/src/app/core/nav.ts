import { Role } from './model';

/** Labels are English source texts; templates translate them with the t pipe. */
export interface NavItem {
  label: string;
  path: string;
  icon: string;
  roles?: Role[];
}

/** Public links shown in the header bar for everyone. */
export const MAIN_NAV: NavItem[] = [
  { label: 'Doctors', path: '/doctors', icon: 'stethoscope' },
  { label: 'Services', path: '/services', icon: 'receipt' },
  { label: 'Store', path: '/store', icon: 'bag' },
  { label: 'Contact', path: '/contact', icon: 'mail' }
];

/** Each role's own pages, grouped in one header menu. Shown in this order. */
export const WORK_NAV: NavItem[] = [
  { label: 'My appointments', path: '/appointments', icon: 'calendar', roles: ['Patient'] },
  { label: 'My health', path: '/health', icon: 'heart', roles: ['Patient'] },
  { label: 'My orders', path: '/orders', icon: 'bag', roles: ['Patient'] },
  { label: 'My bills', path: '/invoices', icon: 'card', roles: ['Patient'] },
  { label: 'Appointments', path: '/desk', icon: 'calendar', roles: ['Doctor', 'Receptionist', 'Admin'] },
  { label: 'Patients', path: '/patients', icon: 'users', roles: ['Doctor', 'Receptionist', 'Admin'] },
  { label: 'Prescriptions', path: '/prescriptions', icon: 'pill', roles: ['Doctor', 'Receptionist', 'Admin'] },
  { label: 'Store orders', path: '/store-orders', icon: 'clipboard', roles: ['Receptionist', 'Admin'] },
  { label: 'Invoices', path: '/invoices', icon: 'card', roles: ['Receptionist', 'Admin'] },
  { label: 'Working hours', path: '/working-hours', icon: 'clock', roles: ['Doctor'] },
  { label: 'Time off', path: '/time-off', icon: 'umbrella', roles: ['Doctor', 'Admin'] },
  { label: 'Staff schedule', path: '/staff-schedule', icon: 'calendar', roles: ['Receptionist', 'Admin'] },
  { label: 'Reports', path: '/reports', icon: 'chart', roles: ['Admin'] },
  { label: 'Administration', path: '/admin', icon: 'settings', roles: ['Admin'] }
];

/** The name of the role menu in the header. */
export const WORK_MENU_LABEL: Record<Role, string> = {
  Patient: 'My care',
  Doctor: 'My work',
  Receptionist: 'Front desk',
  Admin: 'Clinic'
};
