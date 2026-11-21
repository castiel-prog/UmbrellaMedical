import { ChangeDetectionStrategy, Component, inject, input, OnInit, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PatientsApi } from '../core/patients.api';
import { Gender, PatientDetails, PatientRequest } from '../core/model';
import { apiErrorMessage } from '../core/api-error';
import { I18n, TranslatePipe } from '../core/i18n';
import { orNull, PHONE_PATTERN } from '../core/util';

/** Create or edit a patient (reception and admin). */
@Component({
  selector: 'app-patient-form',
  imports: [TranslatePipe, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="card form-card" [formGroup]="form" (ngSubmit)="save()" novalidate>
      <h3>{{ (patient() ? 'Edit patient' : 'Register a patient') | t }}</h3>
      @if (error()) { <p class="alert error" role="alert">{{ error() }}</p> }

      <div class="form-grid">
        <div class="field"><label for="pf-first">{{ 'First name' | t }}</label><input id="pf-first" formControlName="firstName" maxlength="100" /></div>
        <div class="field"><label for="pf-last">{{ 'Last name' | t }}</label><input id="pf-last" formControlName="lastName" maxlength="100" /></div>
        @if (!patient()) {
          <div class="field"><label for="pf-pn">{{ 'Personal number' | t }}</label><input id="pf-pn" formControlName="personalNumber" maxlength="20" /></div>
        }
        <div class="field"><label for="pf-dob">{{ 'Date of birth' | t }}</label><input id="pf-dob" type="date" formControlName="dateOfBirth" /></div>
        <div class="field">
          <label for="pf-gender">{{ 'Gender' | t }}</label>
          <select id="pf-gender" formControlName="gender">
            <option value="Male">{{ 'Male' | t }}</option>
            <option value="Female">{{ 'Female' | t }}</option>
            <option value="Other">{{ 'Other' | t }}</option>
          </select>
        </div>
        <div class="field"><label for="pf-phone">{{ 'Phone' | t }}</label><input id="pf-phone" type="tel" formControlName="phone" maxlength="30" autocomplete="tel" [placeholder]="'+995 5XX XX XX XX' | t" required /></div>
        <div class="field"><label for="pf-email">{{ 'Email' | t }}</label><input id="pf-email" type="email" formControlName="email" maxlength="256" /></div>
        <div class="field"><label for="pf-address">{{ 'Address' | t }}</label><input id="pf-address" formControlName="address" maxlength="300" /></div>
      </div>
      <div class="field">
        <label for="pf-history">{{ 'Medical history' | t }}</label>
        <textarea id="pf-history" rows="3" formControlName="medicalHistory" maxlength="4000"></textarea>
      </div>
      <div class="card-actions">
        <button class="btn primary" type="submit" [disabled]="busy()">{{ (busy() ? 'Saving...' : 'Save') | t }}</button>
        <button class="btn" type="button" (click)="cancelled.emit()">{{ 'Cancel' | t }}</button>
      </div>
    </form>
  `
})
export class PatientForm implements OnInit {
  protected readonly i18n = inject(I18n);
  private readonly api = inject(PatientsApi);
  private readonly fb = inject(FormBuilder);

  readonly patient = input<PatientDetails | null>(null);
  readonly saved = output<PatientDetails>();
  readonly cancelled = output<void>();

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    personalNumber: ['', [Validators.minLength(5)]],
    dateOfBirth: ['', Validators.required],
    gender: ['Male' as Gender, Validators.required],
    phone: ['', [Validators.required, Validators.pattern(PHONE_PATTERN)]],
    email: ['', Validators.email],
    address: [''],
    medicalHistory: ['']
  });

  ngOnInit(): void {
    const p = this.patient();
    if (p) {
      this.form.patchValue({
        firstName: p.firstName, lastName: p.lastName, personalNumber: p.personalNumber,
        dateOfBirth: p.dateOfBirth, gender: p.gender, phone: p.phone ?? '', email: p.email ?? '',
        address: p.address ?? '', medicalHistory: p.medicalHistory ?? ''
      });
    } else {
      this.form.controls.personalNumber.addValidators(Validators.required);
    }
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set(this.i18n.t('Fill in the name, personal number (new patients), date of birth, a valid phone number and a valid email if given.'));
      return;
    }
    const v = this.form.getRawValue();
    const request: PatientRequest = {
      firstName: v.firstName.trim(),
      lastName: v.lastName.trim(),
      dateOfBirth: v.dateOfBirth,
      gender: v.gender,
      phone: v.phone.trim(),
      email: orNull(v.email),
      address: orNull(v.address),
      medicalHistory: orNull(v.medicalHistory)
    };

    const existing = this.patient();
    const call = existing
      ? this.api.update(existing.id, request)
      : this.api.create({ ...request, personalNumber: v.personalNumber.trim() });

    this.busy.set(true);
    this.error.set(null);
    call.subscribe({
      next: p => {
        this.busy.set(false);
        this.saved.emit(p);
      },
      error: err => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(err));
      }
    });
  }
}
