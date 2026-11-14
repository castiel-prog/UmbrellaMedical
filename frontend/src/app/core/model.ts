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

export type AppointmentStatus = 'Scheduled' | 'Completed' | 'Cancelled' | 'NoShow';

export interface Education {
  institution: string;
  degree: string;
  startYear: number;
  graduationYear: number;
}

export interface Experience {
  workplace: string;
  position: string;
  startDate: string;
  endDate: string | null;
  description: string | null;
}

export interface DoctorService {
  serviceId: number;
  name: string;
  price: number;
  durationMinutes: number;
}

export interface DoctorDetails extends DoctorListItem {
  bio: string | null;
  educations: Education[];
  experiences: Experience[];
  services: DoctorService[];
}

export interface Review {
  id: number;
  rating: number;
  comment: string | null;
  createdAt: string;
  authorName: string;
}

export interface ReviewSummary {
  averageRating: number;
  reviewCount: number;
  stars: number;
  distribution: { rating: number; count: number }[];
}

export interface DoctorReviews {
  summary: ReviewSummary;
  reviews: PagedResult<Review>;
}

export interface Slot {
  start: string;
  end: string;
}

export interface SlotsResponse {
  date: string;
  doctorId: number;
  serviceId: number;
  durationMinutes: number;
  slots: Slot[];
}

export interface Appointment {
  id: number;
  startDateTime: string;
  endDateTime: string;
  status: AppointmentStatus;
  reason: string | null;
  notes: string | null;
  cancellationReason: string | null;
  patientId: number;
  patientName: string;
  doctorId: number;
  doctorName: string;
  specialization: string;
  serviceId: number;
  serviceName: string;
  price: number;
  durationMinutes: number;
}

export interface CreateAppointmentRequest {
  doctorId: number;
  serviceId: number;
  startDateTime: string;
  reason: string | null;
  patientId?: number | null;
}