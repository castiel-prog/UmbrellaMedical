import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/guards';

const title = (page: string) => `${page} | Umbrella Medical Center`;

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Umbrella Medical Center',
    loadComponent: () => import('./pages/home/home.page').then(m => m.HomePage)
  },
  {
    path: 'doctors',
    title: title('Doctors'),
    loadComponent: () => import('./pages/doctors/doctors.page').then(m => m.DoctorsPage)
  },
  {
    path: 'doctors/:id',
    title: title('Doctor'),
    loadComponent: () => import('./pages/doctor-profile/doctor-profile.page').then(m => m.DoctorProfilePage)
  },
  {
    path: 'contact',
    title: title('Contact'),
    loadComponent: () => import('./pages/contact/contact.page').then(m => m.ContactPage)
  },
  {
    path: 'services',
    title: title('Services and prices'),
    loadComponent: () => import('./pages/services/services.page').then(m => m.ServicesPage)
  },
  {
    path: 'book/:doctorId',
    title: title('Book a visit'),
    canActivate: [roleGuard('Patient', 'Receptionist', 'Admin')],
    loadComponent: () => import('./pages/book/book.page').then(m => m.BookPage)
  },

  // Patient
  {
    path: 'appointments',
    title: title('My appointments'),
    canActivate: [roleGuard('Patient')],
    loadComponent: () => import('./pages/my-appointments/my-appointments.page').then(m => m.MyAppointmentsPage)
  },
  {
    path: 'health',
    title: title('My health'),
    canActivate: [roleGuard('Patient')],
    loadComponent: () => import('./pages/my-health/my-health.page').then(m => m.MyHealthPage)
  },

  // Billing
  {
    path: 'invoices',
    title: title('Invoices'),
    canActivate: [roleGuard('Patient', 'Receptionist', 'Admin')],
    loadComponent: () => import('./pages/invoices/invoices.page').then(m => m.InvoicesPage)
  },
  {
    path: 'invoices/:id',
    title: title('Invoice'),
    canActivate: [roleGuard('Patient', 'Receptionist', 'Admin')],
    loadComponent: () => import('./pages/invoices/invoice-detail.page').then(m => m.InvoiceDetailPage)
  },

  // Staff
  {
    path: 'desk',
    title: title('Appointments'),
    canActivate: [roleGuard('Doctor', 'Receptionist', 'Admin')],
    loadComponent: () => import('./pages/appointments-desk/appointments-desk.page').then(m => m.AppointmentsDeskPage)
  },
  {
    path: 'patients',
    title: title('Patients'),
    canActivate: [roleGuard('Doctor', 'Receptionist', 'Admin')],
    loadComponent: () => import('./pages/patients/patients.page').then(m => m.PatientsPage)
  },
  {
    path: 'patients/:id',
    title: title('Patient'),
    canActivate: [roleGuard('Doctor', 'Receptionist', 'Admin')],
    loadComponent: () => import('./pages/patients/patient-chart.page').then(m => m.PatientChartPage)
  },
  {
    path: 'working-hours',
    title: title('Working hours'),
    canActivate: [roleGuard('Doctor', 'Admin')],
    loadComponent: () => import('./pages/working-hours/working-hours.page').then(m => m.WorkingHoursPage)
  },
  {
    path: 'time-off',
    title: title('Time off'),
    canActivate: [roleGuard('Doctor', 'Admin')],
    loadComponent: () => import('./pages/time-off/time-off.page').then(m => m.TimeOffPage)
  },
  {
    path: 'staff-schedule',
    title: title('Staff schedule'),
    canActivate: [roleGuard('Receptionist', 'Admin')],
    loadComponent: () => import('./pages/staff-schedule/staff-schedule.page').then(m => m.StaffSchedulePage)
  },

  // Pharmacy (it used to be called the store; old links still work)
  { path: 'store', redirectTo: 'pharmacy', pathMatch: 'full' },
  { path: 'store/checkout', redirectTo: 'pharmacy/checkout' },
  { path: 'store-orders', redirectTo: 'pharmacy-orders' },
  {
    path: 'pharmacy',
    title: title('Pharmacy'),
    loadComponent: () => import('./pages/store/store.page').then(m => m.StorePage)
  },
  {
    path: 'pharmacy/checkout',
    title: title('Checkout'),
    canActivate: [authGuard],
    loadComponent: () => import('./pages/store/checkout.page').then(m => m.CheckoutPage)
  },
  {
    // One product: photo, price, prescription and delivery details (after 'pharmacy/checkout', so that wins).
    path: 'pharmacy/:id',
    title: title('Pharmacy'),
    loadComponent: () => import('./pages/store/product.page').then(m => m.ProductPage)
  },
  {
    path: 'orders',
    title: title('My orders'),
    canActivate: [roleGuard('Patient')],
    loadComponent: () => import('./pages/store/orders.page').then(m => m.OrdersPage)
  },
  {
    path: 'pharmacy-orders',
    title: title('Pharmacy orders'),
    canActivate: [roleGuard('Receptionist', 'Admin')],
    loadComponent: () => import('./pages/store/orders.page').then(m => m.OrdersPage)
  },
  {
    path: 'prescriptions',
    title: title('Prescriptions'),
    canActivate: [roleGuard('Doctor', 'Receptionist', 'Admin')],
    loadComponent: () => import('./pages/prescriptions/prescriptions.page').then(m => m.PrescriptionsPage)
  },

  // Support chat between people and the clinic's admins
  {
    path: 'support',
    title: title('Support chat'),
    canActivate: [authGuard],
    loadComponent: () => import('./pages/support/support.page').then(m => m.SupportPage)
  },

  // Admin
  {
    path: 'admin',
    title: title('Administration'),
    canActivate: [roleGuard('Admin')],
    loadComponent: () => import('./pages/admin/admin.page').then(m => m.AdminPage),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'users' },
      { path: 'users', loadComponent: () => import('./pages/admin/users.tab').then(m => m.AdminUsersTab) },
      { path: 'staff', loadComponent: () => import('./pages/admin/staff.tab').then(m => m.AdminStaffTab) },
      { path: 'messages', loadComponent: () => import('./pages/admin/messages.tab').then(m => m.AdminMessagesTab) },
      { path: 'services', loadComponent: () => import('./pages/admin/services.tab').then(m => m.AdminServicesTab) },
      { path: 'store', loadComponent: () => import('./pages/admin/products.tab').then(m => m.AdminProductsTab) },
      { path: 'departments', loadComponent: () => import('./pages/admin/departments.tab').then(m => m.AdminDepartmentsTab) },
      { path: 'insurers', loadComponent: () => import('./pages/admin/insurers.tab').then(m => m.AdminInsurersTab) },
      { path: 'reviews', loadComponent: () => import('./pages/admin/reviews.tab').then(m => m.AdminReviewsTab) }
    ]
  },
  {
    path: 'reports',
    title: title('Reports'),
    canActivate: [roleGuard('Admin')],
    loadComponent: () => import('./pages/reports/reports.page').then(m => m.ReportsPage)
  },

  // Account
  {
    path: 'login',
    title: title('Log in'),
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login/login.page').then(m => m.LoginPage)
  },
  {
    path: 'register',
    title: title('Register'),
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/register/register.page').then(m => m.RegisterPage)
  },
  {
    path: 'forgot-password',
    title: title('Reset password'),
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/forgot-password/forgot-password.page').then(m => m.ForgotPasswordPage)
  },
  {
    path: 'account',
    title: title('My profile'),
    canActivate: [authGuard],
    loadComponent: () => import('./pages/account/account.page').then(m => m.AccountPage)
  },
  {
    path: 'notifications',
    title: title('Notifications'),
    canActivate: [authGuard],
    loadComponent: () => import('./pages/notifications/notifications.page').then(m => m.NotificationsPage)
  },
  { path: '**', redirectTo: '' }
];
