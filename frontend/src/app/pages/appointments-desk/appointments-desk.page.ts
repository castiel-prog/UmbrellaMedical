import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { AppointmentsApi } from '../../core/appointments.api';
import { BillingApi } from '../../core/billing.api';
import { DoctorsApi } from '../../core/doctors.api';
import { AuthService } from '../../core/auth.service';
import { Appointment, AppointmentStatus, DoctorListItem, PagedResult } from '../../core/model';
import { apiErrorMessage } from '../../core/api-error';
import { addDays, orNull, toDateInput } from '../../core/util';
import { Pager } from '../../shared/pager';
import { I18n, LocalDatePipe, TranslatePipe } from '../../core/i18n';
import { SlotPicker } from '../../shared/slot-picker';

type Mode = 'complete' | 'cancel' | 'reschedule' | 'invoice';
type Preset = 'upcoming' | 'today' | 'tomorrow' | 'week' | 'past';
interface ExtraItem { description: string; quantity: number; unitPrice: number; }

@Component({
  selector: 'app-appointments-desk',
  imports: [LocalDatePipe, TranslatePipe, FormsModule, RouterLink, CurrencyPipe, Pager, SlotPicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <h1>{{ (isDoctor() ? 'My schedule' : 'Appointments') | t }}</h1>
      @if (canBook()) {
        <a class="btn primary" routerLink="/doctors">{{ 'Book a visit' | t }}</a>
      }
    </div>

    <div class="toolbar">
      <div class="card-actions tight" role="group" [attr.aria-label]="'Quick date ranges' | t">
        @for (p of presets; track p.id) {
          <button class="btn small" type="button" [class.primary]="activePreset() === p.id"
            [attr.aria-pressed]="activePreset() === p.id" (click)="preset(p.id)">{{ p.label | t }}</button>
        }
      </div>
    </div>

    <div class="filters">
      <div class="field"><label for="ad-from">{{ 'From' | t }}</label><input id="ad-from" type="date" [(ngModel)]="from" (change)="customRange()" /></div>
      <div class="field"><label for="ad-to">{{ 'To (empty = no end)' | t }}</label><input id="ad-to" type="date" [(ngModel)]="to" (change)="customRange()" /></div>
      <div class="field">
        <label for="ad-status">{{ 'Status' | t }}</label>
        <select id="ad-status" [(ngModel)]="status" (ngModelChange)="reload()">
          <option [ngValue]="null">{{ 'All' | t }}</option>
          <option value="Scheduled">{{ 'Scheduled' | t }}</option>
          <option value="Completed">{{ 'Completed' | t }}</option>
          @if (isAdmin()) { <option value="Cancelled">{{ 'Cancelled' | t }}</option> }
          <option value="NoShow">{{ 'Missed' | t }}</option>
        </select>
      </div>
      @if (!isDoctor()) {
        <div class="field">
          <label for="ad-doctor">{{ 'Doctor' | t }}</label>
          <select id="ad-doctor" [(ngModel)]="doctorId" (ngModelChange)="reload()">
            <option [ngValue]="null">{{ 'All doctors' | t }}</option>
            @for (d of doctors(); track d.id) { <option [ngValue]="d.id">{{ 'Dr. {p0} {p1}' | t: { p0: (d.firstName), p1: (d.lastName) } }}</option> }
          </select>
        </div>
      }
    </div>

    @if (message()) { <p class="alert success" role="status">{{ message() }}</p> }
    @if (error()) { <p class="alert error" role="alert">{{ error() }}</p> }
    @if (loading() && !result()) { <p class="muted">{{ 'Loading...' | t }}</p> }

    @if (result(); as data) {
      @if (data.items.length === 0) {
        <p class="empty card muted">
          {{ 'No appointments in this period.' | t }}
          @if (activePreset() !== 'upcoming') { <button class="btn small" type="button" (click)="preset('upcoming')">{{ 'Show all upcoming' | t }}</button> }
        </p>
      }
      <ul class="appt-list" [class.dim]="loading()">
        @for (a of data.items; track a.id) {
          <li class="card appt">
            <div class="appt-date">
              <strong>{{ a.startDateTime | ldate: 'day' }}</strong>
              <span>{{ a.startDateTime | ldate: 'month' }}</span>
              <small>{{ a.startDateTime | ldate: 'time' }}</small>
            </div>
            <div class="appt-body">
              <div class="appt-title">
                <h3><a class="plain" [routerLink]="['/patients', a.patientId]">{{ a.patientName }}</a></h3>
                <span [class]="'badge status-' + a.status.toLowerCase()">{{ (a.status === 'NoShow' ? 'Missed' : a.status) | t }}</span>
              </div>
              <p>
                {{ a.serviceName }}
                @if (!isDoctor()) { {{ '· Dr. {p0}' | t: { p0: (a.doctorName) } }} <span class="muted">({{ a.specialization | t }})</span> }
              </p>
              <p class="muted">
                {{ a.startDateTime | ldate: 'weekdayDayMonth' }}, {{ a.startDateTime | ldate: 'time' }}–{{ a.endDateTime | ldate: 'time' }}
                · {{ a.price | currency: 'GEL' : 'symbol-narrow' }}
                @if (a.amountPaid > 0 && a.status !== 'Cancelled') { · <span class="badge ok">{{ 'Paid' | t }} {{ a.amountPaid | currency: 'GEL' : 'symbol-narrow' }}</span> }
              </p>
              @if (a.reason) { <p><span class="muted">{{ 'Reason:' | t }}</span> {{ a.reason }}</p> }
              @if (a.notes) { <p class="pre-line"><span class="muted">{{ 'Notes:' | t }}</span> {{ a.notes }}</p> }
              @if (a.cancellationReason) { <p><span class="muted">{{ 'Cancelled:' | t }}</span> {{ a.cancellationReason }}</p> }

              @if (!isOpen(a.id)) {
                <div class="card-actions">
                  @if (a.status === 'Scheduled') {
                    @if (canComplete()) { <button class="btn small primary" type="button" (click)="open(a, 'complete')">{{ 'Complete' | t }}</button> }
                    <button class="btn small" type="button" (click)="noShow(a)" [disabled]="busy()">{{ 'Mark missed' | t }}</button>
                    @if (canBook()) { <button class="btn small" type="button" (click)="open(a, 'reschedule')">{{ 'Reschedule' | t }}</button> }
                    <button class="btn small danger" type="button" (click)="open(a, 'cancel')">{{ 'Cancel' | t }}</button>
                  }
                  @if (isDoctor() && a.status !== 'Cancelled') {
                    <a class="btn small" [routerLink]="['/patients', a.patientId]" [queryParams]="{ tab: 'records' }">{{ 'Medical record' | t }}</a>
                  }
                  @if (canBill() && a.invoiceId) {
                    <a class="btn small" [routerLink]="['/invoices', a.invoiceId]">{{ 'View invoice' | t }}</a>
                  } @else if (canBill() && a.status === 'Completed') {
                    <button class="btn small primary" type="button" (click)="open(a, 'invoice')">{{ 'Create invoice' | t }}</button>
                  }
                </div>
              }

              @if (isOpen(a.id, 'complete')) {
                <div class="inline-panel">
                  <div class="field">
                    <label [for]="'notes-' + a.id">{{ 'Visit notes (optional)' | t }}</label>
                    <textarea [id]="'notes-' + a.id" rows="3" maxlength="4000" [(ngModel)]="text"></textarea>
                  </div>
                  <div class="card-actions">
                    <button class="btn small primary" type="button" (click)="complete(a)" [disabled]="busy()">{{ 'Mark as completed' | t }}</button>
                    <button class="btn small" type="button" (click)="close()">{{ 'Back' | t }}</button>
                  </div>
                </div>
              }

              @if (isOpen(a.id, 'cancel')) {
                <div class="inline-panel">
                  <div class="field">
                    <label [for]="'cancel-' + a.id">{{ 'Reason (optional)' | t }}</label>
                    <textarea [id]="'cancel-' + a.id" rows="2" maxlength="500" [(ngModel)]="text"></textarea>
                  </div>
                  <div class="card-actions">
                    <button class="btn small danger" type="button" (click)="cancel(a)" [disabled]="busy()">{{ 'Cancel the visit' | t }}</button>
                    <button class="btn small" type="button" (click)="close()">{{ 'Keep it' | t }}</button>
                  </div>
                </div>
              }

              @if (isOpen(a.id, 'reschedule')) {
                <div class="inline-panel">
                  <app-slot-picker [doctorId]="a.doctorId" [serviceId]="a.serviceId" (picked)="newStart.set($event)" />
                  <div class="card-actions">
                    <button class="btn small primary" type="button" (click)="reschedule(a)" [disabled]="!newStart() || busy()">{{ 'Move the visit' | t }}</button>
                    <button class="btn small" type="button" (click)="close()">{{ 'Back' | t }}</button>
                  </div>
                </div>
              }

              @if (isOpen(a.id, 'invoice')) {
                <div class="inline-panel">
                  <label class="check">
                    <input type="checkbox" [(ngModel)]="useInsurance" /> {{ 'Apply the patient\\'s valid insurance (if any)' | t }}
                  </label>
                  <p class="muted">{{ 'The visit\\'s service (' | t }}{{ a.serviceName }}, {{ a.price | currency: 'GEL' : 'symbol-narrow' }}{{ ') is added automatically. Extra items:' | t }}</p>
                  @for (x of extras(); track $index; let i = $index) {
                    <div class="tooth-row">
                      <div class="field"><label [for]="'x-d' + i">{{ 'Description' | t }}</label><input [id]="'x-d' + i" maxlength="200" [(ngModel)]="x.description" /></div>
                      <div class="field"><label [for]="'x-q' + i">{{ 'Qty' | t }}</label><input [id]="'x-q' + i" type="number" min="1" max="100" [(ngModel)]="x.quantity" /></div>
                      <div class="field"><label [for]="'x-p' + i">{{ 'Unit price' | t }}</label><input [id]="'x-p' + i" type="number" min="0.01" step="0.01" [(ngModel)]="x.unitPrice" /></div>
                      <button class="btn small danger" type="button" [attr.aria-label]="'Remove item' | t" (click)="removeExtra(i)">✕</button>
                    </div>
                  }
                  <div class="card-actions">
                    <button class="btn small" type="button" (click)="extras.set([...extras(), { description: '', quantity: 1, unitPrice: 0 }])">{{ 'Add item' | t }}</button>
                    <button class="btn small primary" type="button" (click)="invoice(a)" [disabled]="busy()">{{ 'Create invoice' | t }}</button>
                    <button class="btn small" type="button" (click)="close()">{{ 'Back' | t }}</button>
                  </div>
                </div>
              }
            </div>
          </li>
        }
      </ul>
      <app-pager [page]="page()" [pageSize]="pageSize" [totalCount]="data.totalCount" [disabled]="loading()" (pageChange)="page.set($event); load()" />
    }
  `
})
export class AppointmentsDeskPage {
  protected readonly i18n = inject(I18n);
  private readonly api = inject(AppointmentsApi);
  private readonly billing = inject(BillingApi);
  private readonly doctorsApi = inject(DoctorsApi);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly isDoctor = computed(() => this.auth.hasRole('Doctor'));
  protected readonly isAdmin = computed(() => this.auth.hasRole('Admin'));
  protected readonly canComplete = computed(() => this.auth.hasRole('Doctor', 'Admin'));
  protected readonly canBook = computed(() => this.auth.hasRole('Receptionist', 'Admin'));
  protected readonly canBill = computed(() => this.auth.hasRole('Receptionist', 'Admin'));

  protected readonly pageSize = 20;
  protected readonly page = signal(1);
  protected readonly result = signal<PagedResult<Appointment> | null>(null);
  protected readonly doctors = signal<DoctorListItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);
  protected readonly openState = signal<{ id: number; mode: Mode } | null>(null);
  protected readonly newStart = signal<string | null>(null);
  protected readonly extras = signal<ExtraItem[]>([]);

  protected readonly presets: { id: Preset; label: string }[] = [
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'today', label: 'Today' },
    { id: 'tomorrow', label: 'Tomorrow' },
    { id: 'week', label: 'Next 7 days' },
    { id: 'past', label: 'Past 7 days' }
  ];
  protected readonly activePreset = signal<Preset | null>('upcoming');

  // Default: everything from today on, soonest first, so new bookings are never hidden.
  protected from = toDateInput(new Date());
  protected to = '';
  protected status: AppointmentStatus | null = null;
  protected doctorId: number | null = null;
  protected text = '';
  protected useInsurance = true;

  constructor() {
    this.load();
    if (!this.isDoctor()) {
      this.doctorsApi.list({ pageSize: 100 }).subscribe({ next: r => this.doctors.set(r.items) });
    }
  }

  protected preset(id: Preset): void {
    const day = (offset: number) => toDateInput(addDays(new Date(), offset));
    const ranges: Record<Preset, [string, string]> = {
      upcoming: [day(0), ''],
      today: [day(0), day(0)],
      tomorrow: [day(1), day(1)],
      week: [day(0), day(6)],
      past: [day(-7), day(-1)]
    };
    [this.from, this.to] = ranges[id];
    this.activePreset.set(id);
    this.reload();
  }

  protected customRange(): void {
    this.activePreset.set(null);
    this.reload();
  }

  protected reload(): void {
    this.page.set(1);
    this.load();
  }

  protected isOpen(id: number, mode?: Mode): boolean {
    const s = this.openState();
    return s !== null && s.id === id && (mode === undefined || s.mode === mode);
  }

  protected open(a: Appointment, mode: Mode): void {
    this.openState.set({ id: a.id, mode });
    this.text = '';
    this.newStart.set(null);
    this.useInsurance = true;
    this.extras.set([]);
    this.error.set(null);
    this.message.set(null);
  }

  protected close(): void {
    this.openState.set(null);
  }

  protected removeExtra(index: number): void {
    this.extras.set(this.extras().filter((_, i) => i !== index));
  }

  protected complete(a: Appointment): void {
    this.run(this.api.complete(a.id, orNull(this.text)), 'The visit was marked as completed.');
  }

  protected noShow(a: Appointment): void {
    this.message.set(null);
    this.run(this.api.noShow(a.id), 'The visit was marked as missed.');
  }

  protected cancel(a: Appointment): void {
    this.run(this.api.cancel(a.id, orNull(this.text)), 'The visit was cancelled.');
  }

  protected reschedule(a: Appointment): void {
    const start = this.newStart();
    if (start) this.run(this.api.reschedule(a.id, start), 'The visit was moved.');
  }

  protected invoice(a: Appointment): void {
    const extras = this.extras();
    if (extras.some(x => !x.description.trim() || !(Number(x.unitPrice) > 0) || !(Number(x.quantity) >= 1))) {
      this.error.set(this.i18n.t('Each extra item needs a description, a quantity and a price.'));
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.billing.createInvoice({
      appointmentId: a.id,
      useInsurance: this.useInsurance,
      patientInsuranceId: null,
      extraItems: extras.length
        ? extras.map(x => ({ description: x.description.trim(), quantity: Number(x.quantity), unitPrice: Number(x.unitPrice) }))
        : null
    }).subscribe({
      next: inv => {
        this.busy.set(false);
        void this.router.navigate(['/invoices', inv.id]);
      },
      error: err => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(err));
      }
    });
  }

  private run(request: Observable<unknown>, success: string): void {
    this.busy.set(true);
    this.error.set(null);
    request.subscribe({
      next: () => {
        this.busy.set(false);
        this.close();
        this.message.set(success);
        this.load();
      },
      error: err => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(err));
      }
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.api.list({
      from: this.from || null,
      to: this.to || null,
      status: this.status,
      doctorId: this.doctorId,
      page: this.page(),
      pageSize: this.pageSize
    }).subscribe({
      next: r => {
        this.result.set(r);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(apiErrorMessage(err));
        this.loading.set(false);
      }
    });
  }
}
