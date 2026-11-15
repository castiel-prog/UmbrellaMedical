import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { apiErrorMessage } from '../../core/api-error';
import { Gender } from '../../core/model';
import { PHONE_PATTERN, toDateInput } from '../../core/util';
import { DatePicker } from '../../shared/date-picker';
import { TranslatePipe } from '../../core/i18n';

const MINIMUM_AGE = 18;

/** Date of birth must be a real past date, and the person at least 18 today (their 18th birthday counts). */
const adultDateOfBirth: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = control.value as string;
  if (!value) return null;

  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return { invalidDate: true };

  const today = new Date();
  const todayKey = toKey(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const birthKey = toKey(year, month, day);

  if (birthKey > todayKey) return { future: true };
  if (year < today.getFullYear() - 120) return { invalidDate: true };
  // Same rule as the server: someone born on 29 February counts from 28 February in non-leap years.
  const adultYear = year + MINIMUM_AGE;
  const adultDay = month === 2 && day === 29 && !isLeapYear(adultYear) ? 28 : day;
  if (toKey(adultYear, month, adultDay) > todayKey) return { underage: true };
  return null;
};

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function toKey(year: number, month: number, day: number): number {
  return year * 10000 + month * 100 + day;
}

const passwordsMatch: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const password = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return password && confirm && password !== confirm ? { mismatch: true } : null;
};

@Component({
  selector: 'app-register',
  imports: [TranslatePipe, ReactiveFormsModule, RouterLink, DatePicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="auth-card wide">
      <h1>{{ 'Create your account' | t }}</h1>
      <p class="muted">
        {{ 'Patients aged 18 or over can register themselves. Children are registered by a parent or guardian at the reception desk. Doctors and staff accounts are created by the clinic.' | t }}
      </p>

      @if (error()) {
        <p class="alert error" role="alert">{{ error() | t }}</p>
      }

      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="form-grid">
          <div class="field">
            <label for="firstName">{{ 'First name' | t }}</label>
            <input id="firstName" type="text" formControlName="firstName" autocomplete="given-name" />
            @if (invalid('firstName')) {
              <p class="field-error">{{ 'First name is required.' | t }}</p>
            }
          </div>
          <div class="field">
            <label for="lastName">{{ 'Last name' | t }}</label>
            <input id="lastName" type="text" formControlName="lastName" autocomplete="family-name" />
            @if (invalid('lastName')) {
              <p class="field-error">{{ 'Last name is required.' | t }}</p>
            }
          </div>
        </div>

        <div class="form-grid">
          <div class="field">
            <label for="personalNumber">{{ 'Personal number' | t }}</label>
            <input id="personalNumber" type="text" formControlName="personalNumber" autocomplete="off" />
            @if (invalid('personalNumber')) {
              <p class="field-error">{{ 'Enter 5 to 20 characters.' | t }}</p>
            }
          </div>
          <div class="field">
            <label for="dateOfBirth">{{ 'Date of birth' | t }}</label>
            <app-date-picker inputId="dateOfBirth" formControlName="dateOfBirth" placeholder="Select your date of birth"
              [max]="today" [min]="oldest" startAt="1995-06-15" startView="years" [showAge]="true"
              [invalid]="invalid('dateOfBirth')" describedBy="dob-error" />
            @if (invalid('dateOfBirth')) {
              <p class="field-error" id="dob-error" role="alert">
                @switch (true) {
                  @case (dateError('underage')) {
                    {{ 'You must be at least 18 years old to create an account. A parent or guardian can register a child at the clinic\\'s reception desk.' | t }}
                  }
                  @case (dateError('future')) { {{ 'The date of birth cannot be in the future.' | t }} }
                  @case (dateError('required')) { {{ 'Date of birth is required.' | t }} }
                  @default { {{ 'Please check the date of birth.' | t }} }
                }
              </p>
            }
          </div>
        </div>

        <div class="form-grid">
          <div class="field">
            <label for="gender">{{ 'Gender' | t }}</label>
            <select id="gender" formControlName="gender">
              <option value="">{{ 'Choose...' | t }}</option>
              <option value="Female">{{ 'Female' | t }}</option>
              <option value="Male">{{ 'Male' | t }}</option>
              <option value="Other">{{ 'Other' | t }}</option>
            </select>
            @if (invalid('gender')) {
              <p class="field-error">{{ 'Please choose one.' | t }}</p>
            }
          </div>
          <div class="field">
            <label for="phone">{{ 'Phone' | t }}</label>
            <input id="phone" type="tel" formControlName="phone" autocomplete="tel" placeholder="+995 5XX XX XX XX" />
            @if (invalid('phone')) {
              <p class="field-error">{{ 'Enter a valid phone number, for example +995 555 12 34 56.' | t }}</p>
            }
          </div>
        </div>

        <div class="field">
          <label for="email">{{ 'Email' | t }}</label>
          <input id="email" type="email" formControlName="email" autocomplete="email" />
          @if (invalid('email')) {
            <p class="field-error">{{ 'Enter a valid email address.' | t }}</p>
          }
        </div>

        <div class="form-grid">
          <div class="field">
            <label for="password">{{ 'Password' | t }}</label>
            <input id="password" type="password" formControlName="password" autocomplete="new-password" />
            @if (invalid('password')) {
              <p class="field-error">{{ 'Use at least 8 characters.' | t }}</p>
            }
          </div>
          <div class="field">
            <label for="confirmPassword">{{ 'Repeat password' | t }}</label>
            <input id="confirmPassword" type="password" formControlName="confirmPassword" autocomplete="new-password" />
            @if (form.controls.confirmPassword.touched && form.errors?.['mismatch']) {
              <p class="field-error">{{ 'The passwords do not match.' | t }}</p>
            }
          </div>
        </div>

        <button class="btn primary block" type="submit" [disabled]="submitting()">
          {{ (submitting() ? 'Creating account...' : 'Create account') | t }}
        </button>
      </form>

      <p class="switch">{{ 'Already registered?' | t }} <a routerLink="/login">{{ 'Log in' | t }}</a></p>
    </section>
  `
})
export class RegisterPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group(
    {
      firstName: ['', [Validators.required, Validators.maxLength(100)]],
      lastName: ['', [Validators.required, Validators.maxLength(100)]],
      personalNumber: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(20)]],
      dateOfBirth: ['', [Validators.required, adultDateOfBirth]],
      gender: ['' as Gender | '', Validators.required],
      phone: ['', [Validators.required, Validators.pattern(PHONE_PATTERN)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(256)]],
      password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(100)]],
      confirmPassword: ['', Validators.required]
    },
    { validators: passwordsMatch }
  );

  protected readonly today = toDateInput(new Date());
  protected readonly oldest = `${new Date().getFullYear() - 120}-01-01`;

  protected dateError(code: string): boolean {
    return this.form.controls.dateOfBirth.hasError(code);
  }

  protected invalid(name: string): boolean {
    const control = this.form.get(name);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();

    this.submitting.set(true);
    this.error.set(null);

    this.auth
      .register({
        firstName: value.firstName.trim(),
        lastName: value.lastName.trim(),
        personalNumber: value.personalNumber.trim(),
        dateOfBirth: value.dateOfBirth,
        gender: value.gender as Gender,
        phone: value.phone.trim(),
        email: value.email.trim(),
        password: value.password
      })
      .subscribe({
        next: () => void this.router.navigateByUrl('/account'),
        error: err => {
          this.error.set(apiErrorMessage(err));
          this.submitting.set(false);
        }
      });
  }
}