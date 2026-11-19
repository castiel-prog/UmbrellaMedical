import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { StoreApi } from '../core/store.api';
import { DoctorsApi } from '../core/doctors.api';
import { AppointmentsApi } from '../core/appointments.api';
import { MedicalApi } from '../core/medical.api';
import { Appointment, DoctorListItem, Medication, PrescriptionRequestItem } from '../core/model';
import { apiErrorMessage } from '../core/api-error';

/** Patients: ask a doctor for a prescription and follow the answers. */
@Component({
  selector: 'app-prescription-requests',
  imports: [FormsModule, RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card rx-request-card">
      <div class="row-head">
        <div>
          <h3>Need a prescription?</h3>
          <p class="muted small">Ask a doctor. When they approve, you get a prescription code to buy the medicine in our pharmacy.</p>
        </div>
        @if (!formOpen()) { <button class="btn primary small" type="button" (click)="openForm()">Request a prescription</button> }
      </div>

      @if (message()) { <p class="alert success" role="status">{{ message() }}</p> }
      @if (error()) { <p class="alert error" role="alert">{{ error() }}</p> }

      @if (formOpen()) {
        <form class="section-gap" (ngSubmit)="submit()">
          <div class="form-grid">
            <div class="field">
              <label for="rq-doctor">Doctor</label>
              <select id="rq-doctor" name="doctor" [ngModel]="doctorId()" (ngModelChange)="chooseDoctor($event)">
                <option [ngValue]="null" disabled>Choose a doctor</option>
                @for (d of doctors(); track d.id) { <option [ngValue]="d.id">Dr. {{ d.firstName }} {{ d.lastName }} · {{ d.specialization }}</option> }
              </select>
            </div>
            <div class="field">
              <label for="rq-visit">About a visit (optional)</label>
              <select id="rq-visit" name="visit" [(ngModel)]="appointmentId" [disabled]="visits().length === 0">
                <option [ngValue]="null">{{ visits().length === 0 ? 'No visits with this doctor' : 'Not about a specific visit' }}</option>
                @for (a of visits(); track a.id) { <option [ngValue]="a.id">{{ a.startDateTime | date: 'd MMM y' }} · {{ a.serviceName }}</option> }
              </select>
            </div>
          </div>

          <div class="field">
            <label for="rq-med">Medicine (optional)</label>
            @if (medication(); as m) {
              <div class="picked"><span><strong>{{ m.name }}</strong> {{ m.strength }} {{ m.form }}</span>
                <button class="btn small" type="button" (click)="medication.set(null)">Change</button></div>
            } @else {
              <input id="rq-med" name="med" type="search" autocomplete="off" placeholder="Search medicines" [ngModel]="medTerm()" (ngModelChange)="searchMedication($event)" />
              @if (medResults().length > 0) {
                <ul class="pick-list">
                  @for (m of medResults(); track m.id) {
                    <li><button type="button" (click)="medication.set(m); medResults.set([])"><strong>{{ m.name }}</strong> <span class="muted">{{ m.strength }} {{ m.form }}</span></button></li>
                  }
                </ul>
              }
            }
          </div>

          <div class="field">
            <label for="rq-msg">Message to the doctor</label>
            <textarea id="rq-msg" name="msg" rows="3" maxlength="1000" [(ngModel)]="text"
              placeholder="For example: I take this medicine every day and my last prescription has run out."></textarea>
          </div>
          <p class="muted small">Don't use this for urgent problems. In an emergency call 112.</p>
          <div class="card-actions">
            <button class="btn primary" type="submit" [disabled]="busy()">{{ busy() ? 'Sending...' : 'Send request' }}</button>
            <button class="btn" type="button" (click)="formOpen.set(false)">Cancel</button>
          </div>
        </form>
      }

      @if (requests().length > 0) {
        <h4 class="section-gap">Your requests</h4>
        <ul class="request-list">
          @for (r of requests(); track r.id) {
            <li>
              <div class="row-head">
                <div>
                  <strong>Dr. {{ r.doctorName }}</strong>
                  @if (r.medicationName) { <span class="muted"> · {{ r.medicationName }}</span> }
                  <div class="muted small">{{ r.createdAt | date: 'd MMM y' }}</div>
                </div>
                <span [class]="'badge rq-' + r.status.toLowerCase()">{{ r.status === 'Pending' ? 'Waiting for the doctor' : r.status }}</span>
              </div>
              @if (r.status === 'Approved' && r.prescriptionCode) {
                <p class="small">✓ Your code: <strong class="code-text">{{ r.prescriptionCode }}</strong> · <a routerLink="/pharmacy">use it in the pharmacy</a></p>
              }
              @if (r.status === 'Declined' && r.decisionNote) { <p class="small"><span class="muted">Doctor's reply:</span> {{ r.decisionNote }}</p> }
              @if (r.status === 'Pending') {
                <button class="link-like small" type="button" (click)="withdraw(r)">Withdraw</button>
              }
            </li>
          }
        </ul>
      }
    </section>
  `
})
export class PrescriptionRequests {
  private readonly api = inject(StoreApi);
  private readonly doctorsApi = inject(DoctorsApi);
  private readonly appointmentsApi = inject(AppointmentsApi);
  private readonly medical = inject(MedicalApi);
  private readonly route = inject(ActivatedRoute);

  protected readonly formOpen = signal(false);
  protected readonly doctors = signal<DoctorListItem[]>([]);
  protected readonly doctorId = signal<number | null>(null);
  protected readonly visits = signal<Appointment[]>([]);
  protected readonly medication = signal<Medication | null>(null);
  protected readonly medTerm = signal('');
  protected readonly medResults = signal<Medication[]>([]);
  protected readonly requests = signal<PrescriptionRequestItem[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);
  protected appointmentId: number | null = null;
  protected text = '';
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.loadRequests();

    // Opened from a visit, a doctor's page or the store: pre-fill the form.
    const q = this.route.snapshot.queryParamMap;
    if (q.get('request') === '1') {
      this.openForm(Number(q.get('doctorId')) || null, Number(q.get('appointmentId')) || null, Number(q.get('medicationId')) || null);
    }
  }

  protected openForm(doctorId: number | null = null, appointmentId: number | null = null, medicationId: number | null = null): void {
    this.formOpen.set(true);
    this.message.set(null);
    this.error.set(null);
    this.text = '';
    this.medication.set(null);
    this.medResults.set([]);
    this.medTerm.set('');

    if (this.doctors().length === 0)
      this.doctorsApi.list({ pageSize: 100 }).subscribe({ next: r => this.doctors.set(r.items) });
    if (doctorId) this.chooseDoctor(doctorId, appointmentId);
    if (medicationId) {
      this.medical.medications(null).subscribe(list => this.medication.set(list.find(m => m.id === medicationId) ?? null));
    }
  }

  protected chooseDoctor(id: number, appointmentId: number | null = null): void {
    this.doctorId.set(id);
    this.appointmentId = appointmentId;
    this.visits.set([]);
    this.appointmentsApi.list({ doctorId: id, pageSize: 50 }).subscribe({
      next: r => this.visits.set(r.items.filter(a => a.doctorId === id && a.status !== 'Cancelled')),
      error: () => this.visits.set([])
    });
  }

  protected searchMedication(term: string): void {
    this.medTerm.set(term);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    if (term.trim().length < 2) {
      this.medResults.set([]);
      return;
    }
    this.searchTimer = setTimeout(() => this.medical.medications(term.trim()).subscribe(list => this.medResults.set(list.slice(0, 8))), 250);
  }

  protected submit(): void {
    const doctorId = this.doctorId();
    if (!doctorId) {
      this.error.set('Choose the doctor to ask.');
      return;
    }
    if (this.text.trim().length < 10) {
      this.error.set('Tell the doctor what you need (at least 10 characters).');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.api.requestPrescription({
      doctorId, appointmentId: this.appointmentId, medicationId: this.medication()?.id ?? null, message: this.text.trim()
    }).subscribe({
      next: r => {
        this.busy.set(false);
        this.formOpen.set(false);
        this.message.set(`Your request was sent to Dr. ${r.doctorName}. You'll get a notification when they answer.`);
        this.loadRequests();
      },
      error: err => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(err));
      }
    });
  }

  protected withdraw(r: PrescriptionRequestItem): void {
    this.api.withdrawRequest(r.id).subscribe({
      next: () => this.loadRequests(),
      error: err => this.error.set(apiErrorMessage(err))
    });
  }

  private loadRequests(): void {
    this.api.requests(null, 1, 20).subscribe({
      next: r => this.requests.set(r.items.filter(x => x.status !== 'Withdrawn')),
      error: () => this.requests.set([])
    });
  }
}
