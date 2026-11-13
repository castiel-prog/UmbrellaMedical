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

const notInFuture: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = control.value as string;
  if (!value) return null;
  return value > new Date().toISOString().slice(0, 10) ? { future: true } : null;
};

const passwordsMatch: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const password = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return password && confirm && password !== confirm ? { mismatch: true } : null;
};

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="auth-card wide">
      <h1>Create your account</h1>
      <p class="muted">Patients can register themselves. Doctors and staff accounts are created by the clinic.</p>

      @if (error()) {
        <p class="alert error" role="alert">{{ error() }}</p>
      }

      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="form-grid">
          <div class="field">
            <label for="firstName">First name</label>
            <input id="firstName" type="text" formControlName="firstName" autocomplete="given-name" />
            @if (invalid('firstName')) {
              <p class="field-error">First name is required.</p>
            }
          </div>
          <div class="field">
            <label for="lastName">Last name</label>
            <input id="lastName" type="text" formControlName="lastName" autocomplete="family-name" />
            @if (invalid('lastName')) {
              <p class="field-error">Last name is required.</p>
            }
          </div>
        </div>

        <div class="form-grid">
          <div class="field">
            <label for="personalNumber">Personal number</label>
            <input id="personalNumber" type="text" formControlName="personalNumber" autocomplete="off" />
            @if (invalid('personalNumber')) {
              <p class="field-error">Enter 5 to 20 characters.</p>
            }
          </div>
          <div class="field">
            <label for="dateOfBirth">Date of birth</label>
            <input id="dateOfBirth" type="date" formControlName="dateOfBirth" autocomplete="bday" />
            @if (invalid('dateOfBirth')) {
              <p class="field-error">Choose a valid date of birth in the past.</p>
            }
          </div>
        </div>

        <div class="form-grid">
          <div class="field">
            <label for="gender">Gender</label>
            <select id="gender" formControlName="gender">
              <option value="">Choose...</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Other">Other</option>
            </select>
            @if (invalid('gender')) {
              <p class="field-error">Please choose one.</p>
            }
          </div>
          <div class="field">
            <label for="phone">Phone (optional)</label>
            <input id="phone" type="tel" formControlName="phone" autocomplete="tel" />
            @if (invalid('phone')) {
              <p class="field-error">The phone number is too long.</p>
            }
          </div>
        </div>

        <div class="field">
          <label for="email">Email</label>
          <input id="email" type="email" formControlName="email" autocomplete="email" />
          @if (invalid('email')) {
            <p class="field-error">Enter a valid email address.</p>
          }
        </div>

        <div class="form-grid">
          <div class="field">
            <label for="password">Password</label>
            <input id="password" type="password" formControlName="password" autocomplete="new-password" />
            @if (invalid('password')) {
              <p class="field-error">Use at least 8 characters.</p>
            }
          </div>
          <div class="field">
            <label for="confirmPassword">Repeat password</label>
            <input id="confirmPassword" type="password" formControlName="confirmPassword" autocomplete="new-password" />
            @if (form.controls.confirmPassword.touched && form.errors?.['mismatch']) {
              <p class="field-error">The passwords do not match.</p>
            }
          </div>
        </div>

        <button class="btn primary block" type="submit" [disabled]="submitting()">
          {{ submitting() ? 'Creating account...' : 'Create account' }}
        </button>
      </form>

      <p class="switch">Already registered? <a routerLink="/login">Log in</a></p>
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
      dateOfBirth: ['', [Validators.required, notInFuture]],
      gender: ['' as Gender | '', Validators.required],
      phone: ['', Validators.maxLength(30)],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(256)]],
      password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(100)]],
      confirmPassword: ['', Validators.required]
    },
    { validators: passwordsMatch }
  );

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
        phone: value.phone.trim() === '' ? null : value.phone.trim(),
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