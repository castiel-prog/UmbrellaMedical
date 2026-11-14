import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { AccountApi } from '../../core/account.api';
import { AuthService } from '../../core/auth.service';
import { AccountInfo } from '../../core/model';
import { apiErrorMessage } from '../../core/api-error';

type Section = 'password' | 'email' | null;

@Component({
  selector: 'app-account',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="auth-card wide">
      <h1>My account</h1>

      @if (message()) {
        <p class="alert success" role="status">{{ message() }}</p>
      }
      @if (error()) {
        <p class="alert error" role="alert">{{ error() }}</p>
      }

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

        <h2>Security</h2>
        <div class="card-actions">
          <button class="btn" type="button" [class.primary]="section() === 'password'" (click)="open('password')">Change password</button>
          <button class="btn" type="button" [class.primary]="section() === 'email'" (click)="open('email')">Change email</button>
        </div>

        @if (section() === 'password') {
          <form class="inline-panel" [formGroup]="passwordForm" (ngSubmit)="changePassword()" novalidate>
            <div class="field">
              <label for="cur-pass">Current password</label>
              <input id="cur-pass" type="password" autocomplete="current-password" formControlName="currentPassword" />
            </div>
            <div class="form-grid">
              <div class="field">
                <label for="new-pass">New password</label>
                <input id="new-pass" type="password" autocomplete="new-password" formControlName="newPassword" />
              </div>
              <div class="field">
                <label for="new-pass2">Repeat new password</label>
                <input id="new-pass2" type="password" autocomplete="new-password" formControlName="repeat" />
              </div>
            </div>
            <p class="muted">At least 8 characters.</p>
            <button class="btn primary" type="submit" [disabled]="busy() || passwordForm.invalid">Change password</button>
          </form>
        }

        @if (section() === 'email') {
          <div class="inline-panel">
            @if (!emailCodeSent()) {
              <form [formGroup]="emailForm" (ngSubmit)="requestEmailChange()" novalidate>
                <div class="field">
                  <label for="new-email">New email</label>
                  <input id="new-email" type="email" autocomplete="email" formControlName="newEmail" />
                </div>
                <div class="field">
                  <label for="email-pass">Current password</label>
                  <input id="email-pass" type="password" autocomplete="current-password" formControlName="currentPassword" />
                </div>
                <button class="btn primary" type="submit" [disabled]="busy() || emailForm.invalid">Send code to the new email</button>
              </form>
            } @else {
              <p class="muted">Enter the 6-digit code we sent to {{ emailForm.getRawValue().newEmail }}.</p>
              <div class="field code-field">
                <label for="email-code">Code</label>
                <input id="email-code" type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code" [formControl]="emailCode" />
              </div>
              <div class="card-actions">
                <button class="btn primary" type="button" (click)="confirmEmailChange()" [disabled]="busy() || emailCode.invalid">Confirm new email</button>
                <button class="btn" type="button" (click)="emailCodeSent.set(false)">Back</button>
              </div>
            }
          </div>
        }
      } @else if (loading()) {
        <p class="muted">Loading...</p>
      }
    </section>
  `
})
export class AccountPage {
  private readonly api = inject(AccountApi);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  protected readonly info = signal<AccountInfo | null>(null);
  protected readonly loading = signal(true);
  protected readonly sending = signal(false);
  protected readonly verifying = signal(false);
  protected readonly busy = signal(false);
  protected readonly message = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly section = signal<Section>(null);
  protected readonly emailCodeSent = signal(false);

  protected readonly code = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/^\d{6}$/)]
  });

  protected readonly emailCode = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/^\d{6}$/)]
  });

  protected readonly passwordForm = this.fb.nonNullable.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
    repeat: ['', Validators.required]
  });

  protected readonly emailForm = this.fb.nonNullable.group({
    newEmail: ['', [Validators.required, Validators.email]],
    currentPassword: ['', Validators.required]
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

  protected open(section: Section): void {
    this.section.set(this.section() === section ? null : section);
    this.message.set(null);
    this.error.set(null);
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

  protected changePassword(): void {
    const { currentPassword, newPassword, repeat } = this.passwordForm.getRawValue();
    if (newPassword !== repeat) {
      this.error.set('The new passwords do not match.');
      return;
    }
    this.run(this.api.changePassword(currentPassword, newPassword), () => {
      this.passwordForm.reset();
      this.section.set(null);
      this.message.set('Your password was changed.');
    });
  }

  protected requestEmailChange(): void {
    const { newEmail, currentPassword } = this.emailForm.getRawValue();
    this.run(this.api.requestEmailChange(newEmail, currentPassword), r => {
      this.emailCodeSent.set(true);
      this.message.set((r as { message?: string } | null)?.message ?? 'We sent a code to the new email.');
    });
  }

  protected confirmEmailChange(): void {
    this.run(this.api.confirmEmailChange(this.emailCode.value), account => {
      const info = account as AccountInfo;
      this.info.set(info);
      this.auth.updateEmail(info.email);
      this.emailCode.reset('');
      this.emailForm.reset();
      this.emailCodeSent.set(false);
      this.section.set(null);
      this.message.set('Your email was changed.');
    });
  }

  private run(request: Observable<unknown>, done: (result: unknown) => void): void {
    this.busy.set(true);
    this.message.set(null);
    this.error.set(null);
    request.subscribe({
      next: result => {
        this.busy.set(false);
        done(result);
      },
      error: err => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(err));
      }
    });
  }
}
