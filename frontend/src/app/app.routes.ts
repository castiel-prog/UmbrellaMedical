import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/guards';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Umbrella Medical Center',
    loadComponent: () => import('./pages/home/home.page').then(m => m.HomePage)
  },
  {
    path: 'doctors',
    title: 'Doctors | Umbrella Medical Center',
    loadComponent: () => import('./pages/doctors/doctors.page').then(m => m.DoctorsPage)
  },
  {
    path: 'doctors/:id',
    title: 'Doctor | Umbrella Medical Center',
    loadComponent: () => import('./pages/doctor-profile/doctor-profile.page').then(m => m.DoctorProfilePage)
  },
  {
    path: 'book/:doctorId',
    title: 'Book a visit | Umbrella Medical Center',
    canActivate: [roleGuard('Patient', 'Receptionist', 'Admin')],
    loadComponent: () => import('./pages/book/book.page').then(m => m.BookPage)
  },
  {
    path: 'appointments',
    title: 'My appointments | Umbrella Medical Center',
    canActivate: [roleGuard('Patient')],
    loadComponent: () => import('./pages/my-appointments/my-appointments.page').then(m => m.MyAppointmentsPage)
  },
  {
    path: 'login',
    title: 'Log in | Umbrella Medical Center',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login/login.page').then(m => m.LoginPage)
  },
  {
    path: 'register',
    title: 'Register | Umbrella Medical Center',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/register/register.page').then(m => m.RegisterPage)
  },
  {
    path: 'account',
    title: 'My account | Umbrella Medical Center',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/account/account.page').then(m => m.AccountPage)
  },
  { path: '**', redirectTo: '' }
];