import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AccountApi } from '../../core/account.api';
import { apiErrorMessage } from '../../core/api-error';
import { TranslatePipe } from '../../core/i18n';

@Component({
  selector: 'app-forgot-password',
  imports: [TranslatePipe, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="auth-card">
      <h1>{{ 'Reset your password' | t }}</h1>

      @if (message()) { <p class="alert success" role="status">{{ message() | t }}</p> }
      @if (error()) { <p class="alert error" role="alert">{{ error() | t }}</p> }

      @if (done()) {
        <a class="btn primary block" routerLink="/login">{{ 'Log in' | t }}</a>
      } @else if (step() === 'email') {
        <p class="muted">{{ 'Enter your account email. We\\'ll send you a 6-digit code.' | t }}</p>
        <form [formGroup]="emailForm" (ngSubmit)="send()" novalidate>
          <div class="field">
            <label for="fp-email">{{ 'Email' | t }}</label>
            <input id="fp-email" type="email" formControlName="email" autocomplete="username" />
          </div>
          <button class="btn primary block" type="submit" [disabled]="busy() || emailForm.invalid">
            {{ (busy() ? 'Sending...' : 'Send code') | t }}
          </button>
        </form>
      } @else {
        <p class="muted">{{ 'Enter the code from the email and choose a new password (at least 8 characters).' | t }}</p>
        <form [formGroup]="resetForm" (ngSubmit)="reset()" novalidate>
          <div class="field code-field">
            <label for="fp-code">{{ 'Code' | t }}</label>
            <input id="fp-code" type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code" formControlName="code" />
          </div>
          <div class="field">
            <label for="fp-pass">{{ 'New password' | t }}</label>
            <input id="fp-pass" type="password" autocomplete="new-password" formControlName="newPassword" />
          </div>
          <div class="field">
            <label for="fp-pass2">{{ 'Repeat new password' | t }}</label>
            <input id="fp-pass2" type="password" autocomplete="new-password" formControlName="repeat" />
          </div>
          <button class="btn primary block" type="submit" [disabled]="busy() || resetForm.invalid">
            {{ (busy() ? 'Saving...' : 'Set new password') | t }}
          </button>
          <button class="btn block link-btn" type="button" (click)="step.set('email')">{{ 'Send a new code' | t }}</button>
        </form>
      }

      <p class="switch"><a routerLink="/login">{{ 'Back to log in' | t }}</a></p>
    </section>
  `
})
export class ForgotPasswordPage {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AccountApi);

  protected readonly step = signal<'email' | 'reset'>('email');
  protected readonly busy = signal(false);
  protected readonly done = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);

  protected readonly emailForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]]
  });

  protected readonly resetForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
    repeat: ['', Validators.required]
  });

  protected send(): void {
    this.busy.set(true);
    this.error.set(null);
    this.api.forgotPassword(this.emailForm.getRawValue().email).subscribe({
      next: r => {
        this.busy.set(false);
        this.message.set(r?.message ?? 'If the email is registered, a code is on its way.');
        this.step.set('reset');
      },
      error: err => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(err));
      }
    });
  }

  protected reset(): void {
    const { code, newPassword, repeat } = this.resetForm.getRawValue();
    if (newPassword !== repeat) {
      this.error.set('The passwords do not match.');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.message.set(null);
    this.api.resetPassword(this.emailForm.getRawValue().email, code, newPassword).subscribe({
      next: () => {
        this.busy.set(false);
        this.done.set(true);
        this.message.set('Your password was changed. You can log in now.');
      },
      error: err => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(err));
      }
    });
  }
}
