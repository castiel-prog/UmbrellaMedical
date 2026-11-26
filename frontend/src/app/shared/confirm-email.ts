import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccountApi } from '../core/account.api';
import { EmailStatusService } from '../core/email-status.service';
import { apiErrorMessage } from '../core/api-error';
import { I18n, TranslatePipe } from '../core/i18n';

/**
 * Shown instead of the pay button while a patient hasn't confirmed their e-mail:
 * enter the 6-digit code from the e-mail right here (or ask for a new one) and carry on.
 */
@Component({
  selector: 'app-confirm-email',
  imports: [FormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="confirm-email" role="region" [attr.aria-label]="'Confirm your email' | t">
      <div class="confirm-email-head">
        <span class="confirm-email-icon" aria-hidden="true">✉️</span>
        <div>
          <h4>{{ 'Confirm your email first' | t }}</h4>
          <p class="small">
            {{ (purpose() === 'buy' ? 'To place an order, confirm your email address.' : 'To book a visit, confirm your email address.') | t }}
            @if (status.email(); as email) {
              {{ 'We sent a 6-digit code to {email}.' | t: { email: email } }}
            }
          </p>
        </div>
      </div>

      <form class="confirm-email-form" (ngSubmit)="verify()" novalidate>
        <label for="ce-code" class="sr-only">{{ 'Confirmation code' | t }}</label>
        <input id="ce-code" name="code" class="code-input" inputmode="numeric" autocomplete="one-time-code" maxlength="6"
          placeholder="••••••" [(ngModel)]="code" />
        <button class="btn primary" type="submit" [disabled]="busy() || code.trim().length < 6">{{ 'Confirm' | t }}</button>
      </form>

      @if (error()) { <p class="alert error small" role="alert">{{ error() }}</p> }
      @if (message()) { <p class="alert success small" role="status">{{ message() }}</p> }

      <p class="small muted">
        {{ 'No email? Check the spam folder, or' | t }}
        <button type="button" class="link-like" (click)="resend()" [disabled]="busy()">{{ 'send a new code' | t }}</button>
      </p>
    </section>
  `
})
export class ConfirmEmail {
  private readonly account = inject(AccountApi);
  private readonly i18n = inject(I18n);
  protected readonly status = inject(EmailStatusService);

  /** What the person is trying to do: book a visit or buy something. */
  readonly purpose = input<'book' | 'buy'>('book');

  protected code = '';
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);

  protected verify(): void {
    const code = this.code.replace(/\D/g, '');
    if (code.length !== 6) { this.error.set(this.i18n.t('Enter the 6-digit code from the email.')); return; }
    this.busy.set(true);
    this.error.set(null);
    this.account.verifyEmail(code).subscribe({
      next: info => {
        this.busy.set(false);
        if (info.emailConfirmed) this.status.markConfirmed();
      },
      error: err => { this.busy.set(false); this.error.set(apiErrorMessage(err)); }
    });
  }

  protected resend(): void {
    this.busy.set(true);
    this.error.set(null);
    this.message.set(null);
    this.account.sendVerification().subscribe({
      next: () => { this.busy.set(false); this.message.set(this.i18n.t('A new code is on its way. It is valid for 10 minutes.')); },
      error: err => {
        this.busy.set(false);
        // Already confirmed in another tab: just carry on.
        if (err?.status === 409) { this.status.refresh(); return; }
        this.error.set(apiErrorMessage(err));
      }
    });
  }
}
