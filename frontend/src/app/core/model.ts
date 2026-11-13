export type Role = 'Admin' | 'Doctor' | 'Receptionist' | 'Patient';
export type Gender = 'Male' | 'Female' | 'Other';

export interface AuthResponse {
  token: string;
  email: string;
  role: Role;
}

export interface LoginRequest {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  personalNumber: string;
  dateOfBirth: string;
  gender: Gender;
  phone: string | null;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface DoctorListItem {
  id: number;
  firstName: string;
  lastName: string;
  specializationId: number;
  specialization: string;
  photoUrl: string | null;
  yearsOfExperience: number;
  averageRating: number;
  reviewCount: number;
}

export interface Specialization {
  id: number;
  name: string;
  description: string | null;
}

export interface AccountInfo {
  email: string;
  emailConfirmed: boolean;
  role: Role;
}

export interface MessageResponse {
  message: string;
}