import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { DoctorsApi } from '../../core/doctors.api';
import { AppointmentsApi } from '../../core/appointments.api';
import { Appointment, DoctorDetails } from '../../core/model';
import { apiErrorMessage } from '../../core/api-error';
import { SlotPicker } from '../../shared/slot-picker';

@Component({
  selector: 'app-book',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, CurrencyPipe, SlotPicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (booked(); as a) {
      <section class="card success-card">
        <h1>Your visit is booked</h1>
        <dl class="details">
          <dt>Doctor</dt><dd>Dr. {{ a.doctorName }} · {{ a.specialization }}</dd>
          <dt>Service</dt><dd>{{ a.serviceName }}</dd>
          <dt>When</dt><dd>{{ a.startDateTime | date: 'EEEE, d MMMM y, HH:mm' }}</dd>
          <dt>Price</dt><dd>{{ a.price | currency: 'GEL' : 'symbol-narrow' }}</dd>
        </dl>
        <p class="muted">You will get a reminder before the visit.</p>
        <div class="card-actions">
          <a class="btn primary" routerLink="/appointments">My appointments</a>
          <a class="btn" routerLink="/doctors">Back to doctors</a>
        </div>
      </section>
    } @else {
      <a class="back" [routerLink]="['/doctors', doctorId]">← Doctor profile</a>
      <h1>Book a visit</h1>

      @if (error()) {
        <p class="alert error" role="alert">{{ error() }}</p>
      }

      @if (doctor(); as d) {
        <p class="lead">Dr. {{ d.firstName }} {{ d.lastName }} · <span class="spec">{{ d.specialization }}</span></p>

        <ol class="steps">
          <li class="card">
            <h3>1. Choose a service</h3>
            @if (d.services.length === 0) {
              <p class="muted">This doctor has no services yet.</p>
            }
            <div class="choice-list" role="radiogroup">
              @for (s of d.services; track s.serviceId) {
                <label class="choice" [class.selected]="serviceId() === s.serviceId">
                  <input type="radio" name="service" [checked]="serviceId() === s.serviceId" (change)="serviceId.set(s.serviceId)" />
                  <span class="choice-name">{{ s.name }}</span>
                  <span class="muted">{{ s.durationMinutes }} min</span>
                  <strong>{{ s.price | currency: 'GEL' : 'symbol-narrow' }}</strong>
                </label>
              }
            </div>
          </li>

          <li class="card">
            <h3>2. Choose a day and time</h3>
            <app-slot-picker [doctorId]="doctorId" [serviceId]="serviceId()" (picked)="start.set($event)" />
          </li>

          <li class="card">
            <h3>3. Confirm</h3>
            @if (isStaff()) {
              <div class="field">
                <label for="patientId">Patient ID</label>
                <input id="patientId" type="number" min="1" [formControl]="patientId" />
                <small class="muted">The patient this visit is for.</small>
              </div>
            }
            <div class="field">
              <label for="reason">Reason for the visit (optional)</label>
              <textarea id="reason" rows="3" maxlength="500" [formControl]="reason" placeholder="For example: toothache for 3 days"></textarea>
            </div>

            @if (start(); as s) {
              <p class="summary-line">
                <strong>{{ selectedService()?.name }}</strong> on
                <strong>{{ s | date: 'EEEE, d MMMM, HH:mm' }}</strong>
              </p>
            }

            <button class="btn primary" type="button" (click)="book()" [disabled]="!canBook() || saving()">
              {{ saving() ? 'Booking...' : 'Book this visit' }}
            </button>
          </li>
        </ol>
      } @else if (!error()) {
        <p class="muted">Loading...</p>
      }
    }
  `
})
export class BookPage {
  private readonly route = inject(ActivatedRoute);
  private readonly doctorsApi = inject(DoctorsApi);
  private readonly appointmentsApi = inject(AppointmentsApi);
  private readonly auth = inject(AuthService);

  protected readonly doctorId = Number(this.route.snapshot.paramMap.get('doctorId'));

  protected readonly doctor = signal<DoctorDetails | null>(null);
  protected readonly serviceId = signal<number | null>(null);
  protected readonly start = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly booked = signal<Appointment | null>(null);

  protected readonly reason = new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] });
  protected readonly patientId = new FormControl<number | null>(null);

  protected readonly isStaff = computed(() => this.auth.hasRole('Admin', 'Receptionist'));
  protected readonly selectedService = computed(() =>
    this.doctor()?.services.find(s => s.serviceId === this.serviceId()) ?? null);
  protected readonly canBook = computed(() => this.serviceId() !== null && this.start() !== null);

  constructor() {
    this.doctorsApi.get(this.doctorId).subscribe({
      next: d => {
        this.doctor.set(d);
        const wanted = Number(this.route.snapshot.queryParamMap.get('serviceId'));
        const preselected = d.services.find(s => s.serviceId === wanted) ?? (d.services.length === 1 ? d.services[0] : null);
        if (preselected) this.serviceId.set(preselected.serviceId);
      },
      error: err => this.error.set(apiErrorMessage(err))
    });
  }

  protected book(): void {
    const serviceId = this.serviceId();
    const start = this.start();
    if (serviceId === null || start === null) return;

    if (this.isStaff() && !this.patientId.value) {
      this.error.set('Enter the patient ID.');
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    this.appointmentsApi
      .book({
        doctorId: this.doctorId,
        serviceId,
        startDateTime: start,
        reason: this.reason.value.trim() || null,
        patientId: this.isStaff() ? this.patientId.value : null
      })
      .subscribe({
        next: appointment => {
          this.saving.set(false);
          this.booked.set(appointment);
        },
        error: err => {
          this.saving.set(false);
          this.error.set(apiErrorMessage(err));
        }
      });
  }
}