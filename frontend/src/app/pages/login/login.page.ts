import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { apiErrorMessage } from '../../core/api-error';
import { safeReturnUrl } from '../../core/util';

type LoginField = 'email' | 'firstName' | 'lastName' | 'password';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="auth-card">
      <h1>Log in</h1>
      <p class="muted">Enter your email, your name as registered, and your password.</p>

      @if (error()) {
        <p class="alert error" role="alert">{{ error() }}</p>
      }

      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="field">
          <label for="email">Email</label>
          <input id="email" type="email" formControlName="email" autocomplete="username" />
          @if (invalid('email')) {
            <p class="field-error">Enter a valid email address.</p>
          }
        </div>

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

        <div class="field">
          <label for="password">Password</label>
          <input id="password" type="password" formControlName="password" autocomplete="current-password" />
          @if (invalid('password')) {
            <p class="field-error">Password is required.</p>
          }
        </div>

        <button class="btn primary block" type="submit" [disabled]="submitting()">
          {{ submitting() ? 'Logging in...' : 'Log in' }}
        </button>
      </form>

      <p class="switch"><a routerLink="/forgot-password">Forgot your password?</a></p>
      <p class="switch">New here? <a routerLink="/register">Create an account</a></p>
    </section>
  `
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    password: ['', Validators.required]
  });

  protected invalid(name: LoginField): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        void this.router.navigateByUrl(safeReturnUrl(returnUrl));
      },
      error: err => {
        this.error.set(apiErrorMessage(err));
        this.submitting.set(false);
      }
    });
  }
}