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
  displayName: string | null;
  photoUrl: string | null;
  /** Personal details; null for the admin account, which has no personal record. */
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  address: string | null;
  preferredLanguage: string | null;
  preferredTheme: 'light' | 'dark' | null;
  emailReminders: boolean;
  emailNotifications: boolean;
}

export interface AccountPreferences {
  language: string | null;
  theme: 'light' | 'dark' | null;
  emailReminders: boolean;
  emailNotifications: boolean;
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
  licenseNumber: string;
  memberSince: string;
  /** Only filled for the doctor's own profile (GET /api/doctors/me). */
  phone?: string | null;
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
  /** The visit's active invoice, if any (prepaid online or billed at the desk). */
  invoiceId: number | null;
  amountPaid: number;
}

export interface PaymentCard {
  number: string;
  expiryMonth: number;
  expiryYear: number;
  cvc: string;
  holderName: string;
}

export interface CreateAppointmentRequest {
  doctorId: number;
  serviceId: number;
  startDateTime: string;
  reason: string | null;
  patientId?: number | null;
  card?: PaymentCard | null;
}

export interface BookingQuote {
  price: number;
  insuranceCoverage: number;
  amountDue: number;
  insuranceCompany: string | null;
  coveragePercent: number | null;
  paymentRequired: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  /** Follow-up questions offered as buttons under an assistant reply. */
  suggestions?: string[];
}

// ---------- Patients ----------
export type AllergySeverity = 'Mild' | 'Moderate' | 'Severe';

export interface PatientListItem {
  id: number;
  firstName: string;
  lastName: string;
  personalNumber: string;
  dateOfBirth: string;
  gender: Gender;
  phone: string | null;
}

export interface PatientAllergy {
  allergyId: number;
  name: string;
  severity: AllergySeverity;
  notes: string | null;
}

export interface PatientDetails extends PatientListItem {
  email: string | null;
  address: string | null;
  medicalHistory: string | null;
  createdAt: string;
  photoUrl: string | null;
  allergies: PatientAllergy[];
}

export interface UpdateDoctorProfileRequest {
  bio: string | null;
  phone: string | null;
  yearsOfExperience: number;
  educations: Education[];
  experiences: Experience[];
}

export interface PatientRequest {
  firstName: string;
  lastName: string;
  personalNumber?: string;
  dateOfBirth: string;
  gender: Gender;
  phone: string | null;
  email: string | null;
  address: string | null;
  medicalHistory: string | null;
}

export interface PatientContactRequest {
  phone: string | null;
  email: string | null;
  address: string | null;
}

export interface PatientAllergyInput {
  allergyId: number;
  severity: AllergySeverity;
  notes: string | null;
}

// ---------- Catalog ----------
export interface Diagnosis { id: number; code: string; name: string; }
export interface Medication { id: number; name: string; genericName: string | null; form: string | null; strength: string | null; }
export interface Allergy { id: number; name: string; }

// ---------- Medical records ----------
export type ToothCondition = 'Healthy' | 'Cavity' | 'Filled' | 'Crown' | 'RootCanal' | 'Implant' | 'Missing';

export interface VitalSigns {
  heightCm: number | null;
  weightKg: number | null;
  systolicBp: number | null;
  diastolicBp: number | null;
  heartRate: number | null;
  temperatureC: number | null;
}

export interface ToothRecord {
  toothNumber: number;
  condition: ToothCondition;
  treatment: string | null;
  notes: string | null;
}

export interface MedicalRecord {
  id: number;
  recordDate: string;
  patientId: number;
  patientName: string;
  doctorId: number;
  doctorName: string;
  specialization: string;
  appointmentId: number | null;
  diagnosisCode: string | null;
  diagnosisName: string | null;
  complaints: string | null;
  diagnosisDetails: string | null;
  treatment: string | null;
  recommendations: string | null;
  notes: string | null;
  vitalSigns: VitalSigns | null;
  toothRecords: ToothRecord[];
  prescriptionIds: number[];
  documentIds: number[];
}

export interface MedicalRecordRequest {
  appointmentId?: number | null;
  diagnosisId: number | null;
  complaints: string | null;
  diagnosisDetails: string | null;
  treatment: string | null;
  recommendations: string | null;
  notes: string | null;
  vitalSigns: VitalSigns | null;
  toothRecords: ToothRecord[] | null;
}

// ---------- Prescriptions ----------
export interface PrescriptionItem {
  medicationId: number;
  medicationName: string;
  strength: string | null;
  form: string | null;
  dosage: string;
  frequency: string;
  durationDays: number;
}

export interface Prescription {
  id: number;
  issuedDate: string;
  expiryDate: string;
  isActive: boolean;
  instructions: string | null;
  patientId: number;
  patientName: string;
  doctorId: number;
  doctorName: string;
  medicalRecordId: number | null;
  /** Code the patient enters in the store for prescription-only medicines. */
  code: string | null;
  /** Store products already bought with this prescription. */
  usedFor: string[];
  items: PrescriptionItem[];
  warnings: string[];
}

// ---------- Public services and prices ----------
export interface ClinicService {
  id: number;
  name: string;
  description: string | null;
  price: number;
  durationMinutes: number;
  departmentId: number;
  department: string;
  doctors: { id: number; name: string }[];
}

// ---------- Store ----------
export type ProductCategory = 'Medicines' | 'Vitamins' | 'PersonalCare' | 'Hygiene' | 'FirstAid' | 'Devices';
export type StoreOrderStatus = 'AwaitingReview' | 'ReadyForPickup' | 'Completed' | 'Rejected' | 'Cancelled';
export type PrescriptionRequestStatus = 'Pending' | 'Approved' | 'Declined' | 'Withdrawn';

export interface Product {
  id: number;
  name: string;
  description: string | null;
  unit: string | null;
  category: ProductCategory;
  price: number;
  stock: number;
  isActive: boolean;
  requiresPrescription: boolean;
  medicationId: number | null;
  medicationName: string | null;
  /** Uploaded product photo; null means the built-in illustration is shown. */
  imageUrl: string | null;
}

export interface ProductRequest {
  name: string;
  description: string | null;
  unit: string | null;
  category: ProductCategory;
  price: number;
  stock: number;
  isActive: boolean;
  requiresPrescription: boolean;
  medicationId: number | null;
}

export interface UsablePrescription {
  id: number;
  code: string;
  doctorName: string;
  issuedDate: string;
  expiryDate: string;
}

export interface StoreOrderItem {
  productId: number;
  productName: string;
  requiresPrescription: boolean;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  prescriptionCode: string | null;
}

export interface StoreOrder {
  id: number;
  orderNumber: string;
  status: StoreOrderStatus;
  total: number;
  createdAt: string;
  paidAt: string | null;
  paymentReference: string | null;
  refunded: boolean;
  /** Null for an order placed without a patient account; patientName then holds the buyer's name. */
  patientId: number | null;
  patientName: string;
  patientPersonalNumber: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  prescriptionDocumentId: number | null;
  prescriptionFileName: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  completedAt: string | null;
  items: StoreOrderItem[];
}

export interface CreateStoreOrder {
  items: { productId: number; quantity: number; prescriptionCode: string | null }[];
  prescriptionDocumentId: number | null;
  card: PaymentCard;
  /** Buyers without a patient account (visitors and staff). */
  customer?: { name: string; email: string; phone: string; personalNumber: string | null } | null;
}

export interface PrescriptionRequestItem {
  id: number;
  status: PrescriptionRequestStatus;
  message: string;
  decisionNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  patientId: number;
  patientName: string;
  doctorId: number;
  doctorName: string;
  specialization: string;
  appointmentId: number | null;
  appointmentDate: string | null;
  appointmentService: string | null;
  medicationId: number | null;
  medicationName: string | null;
  prescriptionId: number | null;
  prescriptionCode: string | null;
}

export interface CreatePrescriptionRequestBody {
  doctorId: number;
  appointmentId: number | null;
  medicationId: number | null;
  message: string;
}

export interface ApprovePrescriptionRequestBody {
  medicationId: number;
  dosage: string;
  frequency: string;
  durationDays: number;
  validDays: number;
  instructions: string | null;
}

export interface CreatePrescriptionRequest {
  patientId: number;
  medicalRecordId: number | null;
  expiryDate: string | null;
  instructions: string | null;
  items: { medicationId: number; dosage: string; frequency: string; durationDays: number }[];
}

// ---------- Documents ----------
export type DocumentType = 'LabResult' | 'XRay' | 'Ultrasound' | 'Other' | 'Prescription';

export interface MedicalDocument {
  id: number;
  type: DocumentType;
  fileName: string;
  contentType: string;
  description: string | null;
  patientId: number;
  medicalRecordId: number | null;
  uploadedByUserId: number;
  uploadedAt: string;
}

// ---------- Billing ----------
export type InvoiceStatus = 'Draft' | 'Issued' | 'PartiallyPaid' | 'Paid' | 'Cancelled';
export type PaymentMethod = 'Cash' | 'Card' | 'BankTransfer';
export type PaymentStatus = 'Pending' | 'Completed' | 'Failed' | 'Refunded';

export interface InvoiceItem {
  id: number;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  serviceId: number | null;
}

export interface Payment {
  id: number;
  invoiceId: number;
  invoiceNumber: string;
  patientId: number;
  patientName: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  paidAt: string | null;
  transactionReference: string | null;
  createdAt: string;
}

export interface InvoiceListItem {
  id: number;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string | null;
  status: InvoiceStatus;
  patientId: number;
  patientName: string;
  appointmentId: number | null;
  subtotal: number;
  insuranceCoverage: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
}

export interface Invoice extends InvoiceListItem {
  insuranceCompany: string | null;
  policyNumber: string | null;
  coveragePercent: number | null;
  items: InvoiceItem[];
  payments: Payment[];
}

export interface CreateInvoiceRequest {
  appointmentId: number;
  useInsurance: boolean;
  patientInsuranceId: number | null;
  extraItems: { description: string; quantity: number; unitPrice: number }[] | null;
}

export interface Receipt {
  receiptNumber: string;
  clinicName: string;
  paidAt: string | null;
  patientName: string;
  invoiceNumber: string;
  amount: number;
  method: PaymentMethod;
  transactionReference: string | null;
}

export interface InsuranceCompany {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  isActive: boolean;
}

export interface PatientInsurance {
  id: number;
  patientId: number;
  insuranceCompanyId: number;
  insuranceCompany: string;
  policyNumber: string;
  coveragePercent: number;
  validFrom: string;
  validTo: string;
  isCurrent: boolean;
}

// ---------- Notifications ----------
export interface AppNotification {
  id: number;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  appointmentId: number | null;
}

// ---------- Doctors: schedule & time off ----------
export type DayOfWeekName = 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
export type TimeOffType = 'Vacation' | 'SickLeave' | 'DayOff' | 'Conference';
export type TimeOffStatus = 'Pending' | 'Approved' | 'Declined';

export interface ScheduleItem {
  dayOfWeek: DayOfWeekName;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

export interface TimeOff {
  id: number;
  doctorId: number;
  doctorName: string;
  specialization: string;
  type: TimeOffType;
  startDateTime: string;
  endDateTime: string;
  reason: string | null;
  status: TimeOffStatus;
  declineReason: string | null;
  reviewedAt: string | null;
  conflictingAppointments: number;
}

export interface ConflictingAppointment {
  id: number;
  startDateTime: string;
  endDateTime: string;
  patientName: string;
  serviceName: string;
}

export interface CreateDoctorRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  licenseNumber: string;
  specializationId: number;
  phone: string | null;
  bio: string | null;
  yearsOfExperience: number;
}

export interface StaffScheduleDay {
  date: string;
  dayOfWeek: DayOfWeekName;
  shifts: string[];
  onLeave: boolean;
  scheduledAppointments: number;
}

export interface DoctorScheduleOverview {
  doctorId: number;
  doctorName: string;
  specialization: string;
  weeklyHours: ScheduleItem[];
  timeOff: { id: number; type: TimeOffType; startDateTime: string; endDateTime: string }[];
  days: StaffScheduleDay[];
}

// ---------- Admin ----------
export type RoomType = 'Consultation' | 'Surgery' | 'Radiology' | 'DentalChair' | 'Laboratory';

export interface Department { id: number; name: string; description: string | null; roomCount: number; serviceCount: number; }

export interface Room {
  id: number;
  number: string;
  floor: number;
  type: RoomType;
  isActive: boolean;
  departmentId: number;
  department: string;
}

export interface AdminService {
  id: number;
  name: string;
  description: string | null;
  price: number;
  durationMinutes: number;
  isActive: boolean;
  departmentId: number;
  department: string;
  doctorCount: number;
}

export interface UserListItem {
  id: number;
  email: string;
  role: Role;
  fullName: string | null;
  isActive: boolean;
  emailConfirmed: boolean;
  createdAt: string;
}

export interface Receptionist {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
}

export interface AdminReview {
  id: number;
  rating: number;
  comment: string | null;
  createdAt: string;
  isApproved: boolean;
  doctorId: number;
  doctorName: string;
  patientId: number;
  patientName: string;
}

// ---------- Reports ----------
export interface ReportSummary {
  from: string;
  to: string;
  appointments: { total: number; scheduled: number; completed: number; cancelled: number; noShow: number };
  newPatients: number;
  activeDoctors: number;
  averageDoctorRating: number;
  billed: number;
  insuranceShare: number;
  patientShare: number;
  collected: number;
  refunded: number;
  outstandingBalance: number;
}

export interface DoctorReportRow {
  doctorId: number;
  doctorName: string;
  specialization: string;
  total: number;
  scheduled: number;
  completed: number;
  cancelled: number;
  noShow: number;
  billed: number;
}

export interface ServiceReportRow { serviceId: number; serviceName: string; department: string; appointments: number; billed: number; }

export interface RevenueRow { period: string; invoices: number; billed: number; insuranceShare: number; patientShare: number; collected: number; }

export interface RevenueReport {
  from: string;
  to: string;
  groupBy: 'day' | 'month';
  rows: RevenueRow[];
  totals: RevenueRow;
  byMethod: { method: PaymentMethod; payments: number; amount: number }[];
}