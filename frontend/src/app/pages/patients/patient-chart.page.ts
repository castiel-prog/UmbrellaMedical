import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PatientsApi } from '../../core/patients.api';
import { AppointmentsApi } from '../../core/appointments.api';
import { DoctorsApi } from '../../core/doctors.api';
import { AuthService } from '../../core/auth.service';
import { Appointment, DoctorListItem, PatientDetails, Role } from '../../core/model';
import { apiErrorMessage } from '../../core/api-error';
import { AllergiesPanel } from '../../shared/allergies-panel';
import { RecordsPanel } from '../../shared/records-panel';
import { PrescriptionsPanel } from '../../shared/prescriptions-panel';
import { DocumentsPanel } from '../../shared/documents-panel';
import { InsurancePanel } from '../../shared/insurance-panel';
import { InvoiceList } from '../../shared/invoice-list';
import { PatientForm } from '../../shared/patient-form';

type Tab = 'overview' | 'appointments' | 'records' | 'prescriptions' | 'documents' | 'insurance' | 'invoices';

const TABS: { id: Tab; label: string; roles: Role[] }[] = [
  { id: 'overview', label: 'Overview', roles: ['Admin', 'Receptionist', 'Doctor'] },
  { id: 'appointments', label: 'Appointments', roles: ['Admin', 'Receptionist', 'Doctor'] },
  { id: 'records', label: 'Medical records', roles: ['Admin', 'Doctor'] },
  { id: 'prescriptions', label: 'Prescriptions', roles: ['Admin', 'Doctor'] },
  { id: 'documents', label: 'Documents', roles: ['Admin', 'Doctor'] },
  { id: 'insurance', label: 'Insurance', roles: ['Admin', 'Receptionist'] },
  { id: 'invoices', label: 'Invoices', roles: ['Admin', 'Receptionist'] }
];

@Component({
  selector: 'app-patient-chart',
  imports: [
    FormsModule, RouterLink, DatePipe, CurrencyPipe, AllergiesPanel, RecordsPanel, PrescriptionsPanel,
    DocumentsPanel, InsurancePanel, InvoiceList, PatientForm
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="back" routerLink="/patients">← Patients</a>

    @if (error()) { <p class="alert error" role="alert">{{ error() }}</p> }

    @if (patient(); as p) {
      <div class="page-head">
        <div class="profile-head">
          <div class="avatar big" aria-hidden="true">{{ p.firstName[0] }}{{ p.lastName[0] }}</div>
          <div>
            <h1>{{ p.firstName }} {{ p.lastName }}</h1>
            <p class="muted">{{ p.personalNumber }} · {{ p.gender }} · born {{ p.dateOfBirth | date: 'd MMM y' }} ({{ age(p.dateOfBirth) }} years)</p>
            @if (p.allergies.length > 0) {
              <p class="allergy-flag">⚠ Allergies: @for (a of p.allergies; track a.allergyId; let last = $last) { {{ a.name }} ({{ a.severity }})@if (!last) {, } }</p>
            }
          </div>
        </div>
        @if (canBook()) {
          <div class="booking-box">
            <label for="book-doctor" class="sr-only">Doctor</label>
            <select id="book-doctor" [(ngModel)]="bookDoctorId">
              <option [ngValue]="null">Book with doctor…</option>
              @for (d of doctors(); track d.id) { <option [ngValue]="d.id">Dr. {{ d.firstName }} {{ d.lastName }} · {{ d.specialization }}</option> }
            </select>
            <button class="btn primary small" type="button" [disabled]="!bookDoctorId" (click)="book(p)">Book</button>
          </div>
        }
      </div>

      <div class="tabs scroll" role="tablist">
        @for (t of tabs(); track t.id) {
          <button type="button" role="tab" [class.active]="tab() === t.id" [attr.aria-selected]="tab() === t.id" (click)="select(t.id)">{{ t.label }}</button>
        }
      </div>

      @switch (tab()) {
        @case ('overview') {
          @if (message()) { <p class="alert success" role="status">{{ message() }}</p> }
          @if (editing()) {
            <app-patient-form [patient]="p" (saved)="saved($event)" (cancelled)="editing.set(false)" />
          } @else {
            <div class="two-col">
              <section class="card">
                <h3>Contact</h3>
                <dl class="details">
                  <dt>Phone</dt><dd>{{ p.phone ?? '—' }}</dd>
                  <dt>Email</dt><dd>{{ p.email ?? '—' }}</dd>
                  <dt>Address</dt><dd>{{ p.address ?? '—' }}</dd>
                  <dt>Registered</dt><dd>{{ p.createdAt | date: 'd MMM y' }}</dd>
                </dl>
                @if (canEditPatient()) {
                  <button class="btn small" type="button" (click)="editing.set(true)">Edit details</button>
                }
              </section>
              <section class="card">
                <h3>Allergies</h3>
                <app-allergies-panel [patientId]="p.id" [allergies]="p.allergies" [canEdit]="canEditAllergies()" (changed)="patient.set({ ...p, allergies: $event })" />
              </section>
            </div>
            @if (p.medicalHistory) {
              <section class="card section-gap">
                <h3>Medical history</h3>
                <p class="pre-line">{{ p.medicalHistory }}</p>
              </section>
            }
          }
        }
        @case ('appointments') {
          @if (appointments() === null) {
            <p class="muted">Loading...</p>
          } @else if (appointments()!.length === 0) {
            <p class="empty card muted">No appointments.</p>
          } @else {
            <div class="table-wrap">
              <table class="table">
                <thead><tr><th>When</th><th>Doctor</th><th>Service</th><th class="right">Price</th><th>Status</th></tr></thead>
                <tbody>
                  @for (a of appointments(); track a.id) {
                    <tr>
                      <td>{{ a.startDateTime | date: 'd MMM y, HH:mm' }}</td>
                      <td>Dr. {{ a.doctorName }}</td>
                      <td>{{ a.serviceName }}</td>
                      <td class="right">{{ a.price | currency: 'GEL' : 'symbol-narrow' }}</td>
                      <td><span [class]="'badge status-' + a.status.toLowerCase()">{{ a.status === 'NoShow' ? 'Missed' : a.status }}</span></td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <p class="muted small">Showing the latest 50. Manage visits on the <a routerLink="/desk">Appointments</a> page.</p>
          }
        }
        @case ('records') { <app-records-panel [patientId]="p.id" [canWrite]="isDoctor()" /> }
        @case ('prescriptions') { <app-prescriptions-panel [patientId]="p.id" [canWrite]="isDoctor()" /> }
        @case ('documents') { <app-documents-panel [patientId]="p.id" [canUpload]="isDoctor()" /> }
        @case ('insurance') { <app-insurance-panel [patientId]="p.id" [canManage]="true" /> }
        @case ('invoices') { <app-invoice-list [patientId]="p.id" /> }
      }
    } @else if (!error()) {
      <p class="muted">Loading...</p>
    }
  `
})
export class PatientChartPage {
  private readonly api = inject(PatientsApi);
  private readonly appointmentsApi = inject(AppointmentsApi);
  private readonly doctorsApi = inject(DoctorsApi);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly isDoctor = computed(() => this.auth.hasRole('Doctor'));
  protected readonly canBook = computed(() => this.auth.hasRole('Admin', 'Receptionist'));
  protected readonly canEditPatient = computed(() => this.auth.hasRole('Admin', 'Receptionist'));
  protected readonly canEditAllergies = computed(() => this.auth.hasRole('Admin', 'Doctor'));
  protected readonly tabs = computed(() => {
    const role = this.auth.role();
    return TABS.filter(t => role !== null && t.roles.includes(role));
  });

  protected readonly patient = signal<PatientDetails | null>(null);
  protected readonly appointments = signal<Appointment[] | null>(null);
  protected readonly doctors = signal<DoctorListItem[]>([]);
  protected readonly tab = signal<Tab>('overview');
  protected readonly editing = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);
  protected bookDoctorId: number | null = null;

  constructor() {
    const wanted = this.route.snapshot.queryParamMap.get('tab') as Tab | null;
    if (wanted && this.tabs().some(t => t.id === wanted)) this.tab.set(wanted);

    // React to /patients/:id changing while the page stays open.
    this.route.paramMap.subscribe(params => {
      const id = Number(params.get('id'));
      this.patient.set(null);
      this.appointments.set(null);
      this.api.get(id).subscribe({
        next: p => {
          this.patient.set(p);
          if (this.tab() === 'appointments') this.loadAppointments();
        },
        error: err => this.error.set(apiErrorMessage(err))
      });
    });

    if (this.canBook()) {
      this.doctorsApi.list({ pageSize: 100 }).subscribe({ next: r => this.doctors.set(r.items) });
    }
  }

  protected select(tab: Tab): void {
    this.tab.set(tab);
    this.message.set(null);
    void this.router.navigate([], { queryParams: { tab }, replaceUrl: true });
    if (tab === 'appointments' && this.appointments() === null) this.loadAppointments();
  }

  protected saved(p: PatientDetails): void {
    this.patient.set(p);
    this.editing.set(false);
    this.message.set('The patient was updated.');
  }

  protected book(p: PatientDetails): void {
    if (this.bookDoctorId) void this.router.navigate(['/book', this.bookDoctorId], { queryParams: { patientId: p.id } });
  }

  protected age(dateOfBirth: string): number {
    const dob = new Date(dateOfBirth);
    const now = new Date();
    let years = now.getFullYear() - dob.getFullYear();
    if (now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())) years--;
    return years;
  }

  private loadAppointments(): void {
    const p = this.patient();
    if (!p) return;
    this.appointmentsApi.list({ patientId: p.id, pageSize: 50 }).subscribe({
      next: r => this.appointments.set([...r.items].sort((a, b) => b.startDateTime.localeCompare(a.startDateTime))),
      error: err => this.error.set(apiErrorMessage(err))
    });
  }
}
