import { Role } from './model';

export interface NavItem {
  label: string;
  path: string;
  roles?: Role[];
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Doctors', path: '/doctors' },
  { label: 'My account', path: '/account', roles: ['Admin', 'Doctor', 'Receptionist', 'Patient'] }
];