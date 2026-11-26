import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { I18n, LocalDatePipe, TranslatePipe } from '../../core/i18n';
import { FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { DoctorsApi } from '../../core/doctors.api';
import { AppointmentsApi } from '../../core/appointments.api';
import { PatientsApi } from '../../core/patients.api';
import { Appointment, BookingQuote, DoctorDetails, PatientListItem } from '../../core/model';
import { apiErrorMessage } from '../../core/api-error';
import { SlotPicker } from '../../shared/slot-picker';
import { PatientPicker } from '../../shared/patient-picker';

interface CardForm { holderName: string; number: string; expiry: string; cvc: string; }

import { ConfirmEmail } from '../../shared/confirm-email';
import { EmailStatusService } from '../../core/email-status.service';

@Component({
  selector: 'app-book',
  imports: [ReactiveFormsModule, FormsModule, RouterLink, LocalDatePipe, TranslatePipe, CurrencyPipe, SlotPicker, PatientPicker, ConfirmEmail],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (booked(); as a) {
      <section class="card success-card">
        <h1>{{ 'Your visit is booked' | t }}</h1>
        <dl class="details">
          <dt>{{ 'Doctor' | t }}</dt><dd>{{ 'Dr. {name}' | t: { name: a.doctorName } }} · {{ a.specialization | t }}</dd>
          <dt>{{ 'Service' | t }}</dt><dd>{{ a.serviceName }}</dd>
          <dt>{{ 'When' | t }}</dt><dd>{{ a.startDateTime | ldate: 'full' }}</dd>
          <dt>{{ 'Price' | t }}</dt><dd>{{ a.price | currency: 'GEL' : 'symbol-narrow' }}</dd>
          @if (!isStaff()) {
            <dt>{{ 'Paid' | t }}</dt>
            <dd>
              <span class="badge ok">✓ {{ a.amountPaid | currency: 'GEL' : 'symbol-narrow' }}</span>
              @if (a.amountPaid < a.price) { <span class="muted"> · {{ 'the rest is covered by your insurance' | t }}</span> }
            </dd>
          }
        </dl>
        <p class="muted">
          {{ 'You will get a reminder before the visit.' | t }}
          @if (!isStaff()) { {{ 'If you cancel at least 2 hours before, the payment is refunded to your card automatically.' | t }} }
        </p>
        <div class="card-actions">
          @if (isStaff()) {
            <a class="btn primary" [routerLink]="['/patients', a.patientId]">{{ 'Patient chart' | t }}</a>
            <a class="btn" routerLink="/desk">{{ 'Appointments' | t }}</a>
          } @else {
            <a class="btn primary" routerLink="/appointments">{{ 'My appointments' | t }}</a>
            @if (a.invoiceId) { <a class="btn" [routerLink]="['/invoices', a.invoiceId]">{{ 'Receipt' | t }}</a> }
            <a class="btn" routerLink="/doctors">{{ 'Back to doctors' | t }}</a>
          }
        </div>
      </section>
    } @else {
      <a class="back" [routerLink]="['/doctors', doctorId]">← {{ 'Doctor profile' | t }}</a>
      <h1>{{ 'Book a visit' | t }}</h1>

      @if (doctor(); as d) {
        <p class="lead">{{ 'Dr. {name}' | t: { name: d.firstName + ' ' + d.lastName } }} · <span class="spec">{{ d.specialization | t }}</span></p>

        <ol class="steps">
          <li class="card">
            <h3>1. {{ 'Choose a service' | t }}</h3>
            @if (d.services.length === 0) {
              <p class="muted">{{ 'This doctor has no services yet.' | t }}</p>
            }
            <div class="choice-list" role="radiogroup">
              @for (s of d.services; track s.serviceId) {
                <label class="choice" [class.selected]="serviceId() === s.serviceId">
                  <input type="radio" name="service" [checked]="serviceId() === s.serviceId" (change)="serviceId.set(s.serviceId)" />
                  <span class="choice-name">{{ s.name }}</span>
                  <span class="muted">{{ '{n} min' | t: { n: s.durationMinutes } }}</span>
                  <strong>{{ s.price | currency: 'GEL' : 'symbol-narrow' }}</strong>
                </label>
              }
            </div>
          </li>

          <li class="card">
            <h3>2. {{ 'Choose a day and time' | t }}</h3>
            <app-slot-picker [doctorId]="doctorId" [serviceId]="serviceId()" (picked)="start.set($event)" />
          </li>

          <li class="card">
            <h3>3. {{ (isStaff() ? 'Confirm' : 'Details') | t }}</h3>
            @if (isStaff()) {
              <app-patient-picker [label]="'Patient this visit is for' | t" [(selected)]="patient" />
            }
            <div class="field">
              <label for="reason">{{ 'Reason for the visit (optional)' | t }}</label>
              <textarea id="reason" rows="3" maxlength="500" [formControl]="reason" [placeholder]="'For example: toothache for 3 days' | t"></textarea>
            </div>

            @if (start(); as s) {
              <p class="summary-line">
                <strong>{{ selectedService()?.name }}</strong> · 
                <strong>{{ s | ldate: 'dayTime' }}</strong>
              </p>
            }

            @if (isStaff()) {
              @if (error()) { <p class="alert error" role="alert">{{ error() | t }}</p> }
              <p class="muted small">{{ 'Visits booked by the clinic are paid at the desk.' | t }}</p>
              <button class="btn primary" type="button" (click)="book()" [disabled]="!canBook() || saving()">
                {{ (saving() ? 'Booking...' : 'Book this visit') | t }}
              </button>
            }
          </li>

          @if (!isStaff()) {
            <li class="card pay-step">
              <h3>4. {{ 'Pay and confirm' | t }}</h3>

              @if (!canBook()) {
                <p class="muted">{{ 'Choose a service and a time first.' | t }}</p>
              } @else if (quoteLoading()) {
                <p class="muted">{{ 'Working out the price...' | t }}</p>
              } @else if (quote(); as q) {
                <dl class="price-lines">
                  <dt>{{ selectedService()?.name }}</dt><dd>{{ q.price | currency: 'GEL' : 'symbol-narrow' }}</dd>
                  @if (q.insuranceCoverage > 0) {
                    <dt>{{ 'Insurance' | t }} – {{ q.insuranceCompany }} ({{ q.coveragePercent }}%)</dt>
                    <dd>−{{ q.insuranceCoverage | currency: 'GEL' : 'symbol-narrow' }}</dd>
                  }
                  <dt class="total">{{ 'You pay now' | t }}</dt><dd class="total">{{ q.amountDue | currency: 'GEL' : 'symbol-narrow' }}</dd>
                </dl>

                @if (emailStatus.needsConfirmation()) {
                  <app-confirm-email purpose="book" />
                } @else if (q.paymentRequired) {
                  <form class="card-form" (ngSubmit)="book()" autocomplete="on">
                    <div class="field">
                      <label for="cc-name">{{ 'Name on card' | t }}</label>
                      <input id="cc-name" name="ccname" autocomplete="cc-name" maxlength="100" [(ngModel)]="card.holderName" />
                    </div>
                    <div class="field">
                      <label for="cc-number">{{ 'Card number' | t }}</label>
                      <input id="cc-number" name="cardnumber" autocomplete="cc-number" inputmode="numeric" maxlength="23"
                        placeholder="1234 5678 9012 3456" [ngModel]="card.number" (ngModelChange)="card.number = formatNumber($event)" />
                    </div>
                    <div class="form-grid">
                      <div class="field">
                        <label for="cc-exp">{{ 'Expiry (MM/YY)' | t }}</label>
                        <input id="cc-exp" name="cc-exp" autocomplete="cc-exp" inputmode="numeric" maxlength="5" placeholder="MM/YY"
                          [ngModel]="card.expiry" (ngModelChange)="card.expiry = formatExpiry($event)" />
                      </div>
                      <div class="field">
                        <label for="cc-cvc">{{ 'CVC' | t }}</label>
                        <input id="cc-cvc" name="cvc" autocomplete="cc-csc" inputmode="numeric" maxlength="4" placeholder="123" [(ngModel)]="card.cvc" />
                      </div>
                    </div>

                    @if (error()) { <p class="alert error" role="alert">{{ error() | t }}</p> }

                    <button class="btn primary block" type="submit" [disabled]="saving()">
                      {{ saving() ? ('Processing payment...' | t) : ('Pay {amount} and book' | t: { amount: (q.amountDue | currency: 'GEL' : 'symbol-narrow') }) }}
                    </button>
                    <p class="muted small center">🔒 {{ 'Your card details are sent securely and never stored. Free cancellation up to 2 hours before the visit.' | t }}</p>
                  </form>
                } @else {
                  <p class="muted">{{ 'Your insurance covers this visit in full. Nothing to pay.' | t }}</p>
                  @if (error()) { <p class="alert error" role="alert">{{ error() | t }}</p> }
                  <button class="btn primary" type="button" (click)="book()" [disabled]="saving()">
                    {{ (saving() ? 'Booking...' : 'Book this visit') | t }}
                  </button>
                }
              } @else if (error()) {
                <p class="alert error" role="alert">{{ error() | t }}</p>
              }
            </li>
          }
        </ol>
      } @else if (error()) {
        <p class="alert error" role="alert">{{ error() | t }}</p>
      } @else {
        <p class="muted">{{ 'Loading...' | t }}</p>
      }
    }
  `
})
export class BookPage {
  /** Patients must confirm their e-mail before booking. */
  protected readonly emailStatus = inject(EmailStatusService);

  protected readonly i18n = inject(I18n);
  private readonly route = inject(ActivatedRoute);
  private readonly doctorsApi = inject(DoctorsApi);
  private readonly appointmentsApi = inject(AppointmentsApi);
  private readonly auth = inject(AuthService);
  private readonly patientsApi = inject(PatientsApi);

  protected readonly doctorId = Number(this.route.snapshot.paramMap.get('doctorId'));

  protected readonly doctor = signal<DoctorDetails | null>(null);
  protected readonly serviceId = signal<number | null>(null);
  protected readonly start = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly booked = signal<Appointment | null>(null);
  protected readonly quote = signal<BookingQuote | null>(null);
  protected readonly quoteLoading = signal(false);

  protected readonly reason = new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] });
  protected readonly patient = signal<PatientListItem | null>(null);
  protected card: CardForm = { holderName: '', number: '', expiry: '', cvc: '' };

  protected readonly isStaff = computed(() => this.auth.hasRole('Admin', 'Receptionist'));
  protected readonly selectedService = computed(() =>
    this.doctor()?.services.find(s => s.serviceId === this.serviceId()) ?? null);
  protected readonly canBook = computed(() => this.serviceId() !== null && this.start() !== null);

  constructor() {
    this.emailStatus.refresh();
    this.doctorsApi.get(this.doctorId).subscribe({
      next: d => {
        this.doctor.set(d);
        const wanted = Number(this.route.snapshot.queryParamMap.get('serviceId'));
        const preselected = d.services.find(s => s.serviceId === wanted) ?? (d.services.length === 1 ? d.services[0] : null);
        if (preselected) this.serviceId.set(preselected.serviceId);
      },
      error: err => this.error.set(apiErrorMessage(err))
    });

    // Coming from a patient chart: preselect that patient.
    const patientId = Number(this.route.snapshot.queryParamMap.get('patientId'));
    if (this.isStaff() && patientId > 0) {
      this.patientsApi.get(patientId).subscribe({ next: p => this.patient.set(p) });
    }

    // Patients: refresh the price whenever the service or time changes (insurance depends on the visit date).
    effect(() => {
      const serviceId = this.serviceId();
      const start = this.start();
      untracked(() => {
        this.quote.set(null);
        if (this.isStaff() || serviceId === null || start === null) return;
        this.quoteLoading.set(true);
        this.appointmentsApi.quote(serviceId, start).subscribe({
          next: q => {
            this.quote.set(q);
            this.quoteLoading.set(false);
          },
          error: err => {
            this.quoteLoading.set(false);
            this.error.set(apiErrorMessage(err));
          }
        });
      });
    });
  }

  protected formatNumber(value: string): string {
    return value.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');
  }

  protected formatExpiry(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
  }

  protected book(): void {
    const serviceId = this.serviceId();
    const start = this.start();
    if (serviceId === null || start === null) return;

    if (this.isStaff() && !this.patient()) {
      this.error.set(this.i18n.t('Choose the patient this visit is for.'));
      return;
    }

    let card = null;
    if (!this.isStaff() && this.quote()?.paymentRequired) {
      const problem = this.checkCard();
      if (problem) {
        this.error.set(problem);
        return;
      }
      const [month, year] = this.card.expiry.split('/').map(Number);
      card = {
        holderName: this.card.holderName.trim(),
        number: this.card.number.replace(/\s/g, ''),
        expiryMonth: month,
        expiryYear: 2000 + year,
        cvc: this.card.cvc.trim()
      };
    }

    this.saving.set(true);
    this.error.set(null);

    this.appointmentsApi
      .book({
        doctorId: this.doctorId,
        serviceId,
        startDateTime: start,
        reason: this.reason.value.trim() || null,
        patientId: this.isStaff() ? this.patient()?.id ?? null : null,
        card
      })
      .subscribe({
        next: appointment => {
          this.saving.set(false);
          this.card = { holderName: '', number: '', expiry: '', cvc: '' };
          this.booked.set(appointment);
          window.scrollTo({ top: 0 });
        },
        error: err => {
          this.saving.set(false);
          this.error.set(apiErrorMessage(err));
        }
      });
  }

  /** Quick checks before sending; the server checks the card again. */
  private checkCard(): string | null {
    if (!this.card.holderName.trim()) return 'Enter the name on the card.';
    const digits = this.card.number.replace(/\D/g, '');
    if (digits.length < 12 || !luhn(digits)) return 'The card number is not valid.';
    const match = /^(\d{2})\/(\d{2})$/.exec(this.card.expiry);
    if (!match) return 'Enter the expiry date as MM/YY.';
    const month = Number(match[1]);
    const year = 2000 + Number(match[2]);
    const now = new Date();
    if (month < 1 || month > 12) return 'The expiry month is not valid.';
    if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) return 'The card has expired.';
    if (!/^\d{3,4}$/.test(this.card.cvc.trim())) return 'The CVC is the 3 or 4 digits on the back of the card.';
    return null;
  }
}

function luhn(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}
