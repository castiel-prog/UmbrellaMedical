import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { AccountApi } from '../../core/account.api';
import { AccountInfo } from '../../core/model';
import { apiErrorMessage } from '../../core/api-error';

@Component({
  selector: 'app-account',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="auth-card wide">
      <h1>My account</h1>

      @if (info(); as account) {
        <dl class="details">
          <dt>Email</dt>
          <dd>{{ account.email }}</dd>
          <dt>Role</dt>
          <dd>{{ account.role }}</dd>
          <dt>Email status</dt>
          <dd>
            @if (account.emailConfirmed) {
              <span class="badge ok">Confirmed</span>
            } @else {
              <span class="badge warn">Not confirmed</span>
            }
          </dd>
        </dl>

        @if (!account.emailConfirmed) {
          <h2>Confirm your email</h2>
          <p class="muted">We send a 6-digit code to your email address. It works for 10 minutes.</p>

          <button class="btn" type="button" (click)="sendCode()" [disabled]="sending()">
            {{ sending() ? 'Sending...' : 'Send me a code' }}
          </button>

          <div class="field code-field">
            <label for="code">Code</label>
            <input id="code" type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code" [formControl]="code" />
          </div>

          <button class="btn primary" type="button" (click)="verify()" [disabled]="verifying() || code.invalid">
            {{ verifying() ? 'Checking...' : 'Confirm email' }}
          </button>
        }
      } @else if (loading()) {
        <p class="muted">Loading...</p>
      }

      @if (message()) {
        <p class="alert success" role="status">{{ message() }}</p>
      }
      @if (error()) {
        <p class="alert error" role="alert">{{ error() }}</p>
      }
    </section>
  `
})
export class AccountPage {
  private readonly api = inject(AccountApi);

  protected readonly info = signal<AccountInfo | null>(null);
  protected readonly loading = signal(true);
  protected readonly sending = signal(false);
  protected readonly verifying = signal(false);
  protected readonly message = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly code = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/^\d{6}$/)]
  });

  constructor() {
    this.api.get().subscribe({
      next: account => {
        this.info.set(account);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(apiErrorMessage(err));
        this.loading.set(false);
      }
    });
  }

  protected sendCode(): void {
    this.sending.set(true);
    this.message.set(null);
    this.error.set(null);

    this.api.sendVerification().subscribe({
      next: response => {
        this.message.set(response.message);
        this.sending.set(false);
      },
      error: err => {
        this.error.set(apiErrorMessage(err));
        this.sending.set(false);
      }
    });
  }

  protected verify(): void {
    this.verifying.set(true);
    this.message.set(null);
    this.error.set(null);

    this.api.verifyEmail(this.code.value).subscribe({
      next: account => {
        this.info.set(account);
        this.code.reset('');
        this.message.set('Your email is confirmed.');
        this.verifying.set(false);
      },
      error: err => {
        this.error.set(apiErrorMessage(err));
        this.verifying.set(false);
      }
    });
  }
}