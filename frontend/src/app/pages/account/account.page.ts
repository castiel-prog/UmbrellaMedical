import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { AccountApi } from '../../core/account.api';
import { AuthService } from '../../core/auth.service';
import { AccountInfo, AccountPreferences } from '../../core/model';
import { apiErrorMessage } from '../../core/api-error';
import { ProfileService } from '../../core/profile.service';
import { I18n, LANGUAGES, Lang, TranslatePipe } from '../../core/i18n';
import { Theme, ThemeService } from '../../core/theme.service';
import { PHONE_PATTERN } from '../../core/util';
import { PhotoUploader } from '../../shared/photo-uploader';
import { DoctorProfileEditor } from '../../shared/doctor-profile-editor';

type Section = 'password' | 'email' | null;

/** The logged-in person's profile: picture, personal details, preferences, email settings and account security. */
@Component({
  selector: 'app-account',
  imports: [ReactiveFormsModule, FormsModule, PhotoUploader, DoctorProfileEditor, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card profile-card">
      <h1>{{ 'My profile' | t }}</h1>
      <div class="profile-identity">
        <app-photo-uploader />
        <div>
          <p class="profile-name">{{ profile.me()?.displayName ?? info()?.email }}</p>
          <p class="muted">{{ (info()?.role ?? '') | t }}</p>
        </div>
      </div>
    </section>

    @if (info()?.role === 'Doctor') {
      <section class="card profile-card">
        <h2 class="no-rule">{{ 'Public profile' | t }}</h2>
        <app-doctor-profile-editor />
      </section>
    }

    @if (info(); as account) {
      <!-- Personal details (everyone except the admin account, which has no personal record) -->
      @if (account.firstName !== null) {
        <section class="card profile-card">
          <h2 class="no-rule">{{ 'Personal details' | t }}</h2>
          @if (detailsMessage()) { <p class="alert success" role="status">{{ detailsMessage() }}</p> }
          @if (detailsError()) { <p class="alert error" role="alert">{{ detailsError() }}</p> }
          <form (ngSubmit)="saveDetails()" novalidate>
            <div class="form-grid">
              <div class="field">
                <label for="pd-first">{{ 'First name' | t }}</label>
                <input id="pd-first" name="firstName" autocomplete="given-name" maxlength="100" [(ngModel)]="details.firstName" />
              </div>
              <div class="field">
                <label for="pd-last">{{ 'Last name' | t }}</label>
                <input id="pd-last" name="lastName" autocomplete="family-name" maxlength="100" [(ngModel)]="details.lastName" />
              </div>
            </div>
            <div class="field">
              <label for="pd-phone">{{ 'Phone' | t }}</label>
              <input id="pd-phone" name="phone" type="tel" autocomplete="tel" maxlength="30" placeholder="+995 5XX XX XX XX" [(ngModel)]="details.phone" />
            </div>
            @if (account.role === 'Patient') {
              <div class="field">
                <label for="pd-address">{{ 'Address' | t }}</label>
                <input id="pd-address" name="address" autocomplete="street-address" maxlength="300" [(ngModel)]="details.address" />
              </div>
            }
            <p class="muted small">{{ 'You log in with your name, so after changing it use the new name the next time you log in.' | t }}</p>
            <button class="btn primary" type="submit" [disabled]="detailsBusy()">{{ (detailsBusy() ? 'Saving...' : 'Save details') | t }}</button>
          </form>
        </section>
      }

      <!-- Preferences: saved on the account, so they follow the person to any device -->
      <section class="card profile-card">
        <h2 class="no-rule">{{ 'Preferences' | t }}</h2>
        <p class="muted small">{{ 'Saved to your account and used on every device you log in from.' | t }}</p>
        <div class="pref-grid">
          <div class="field">
            <label for="pref-lang">{{ 'Language' | t }}</label>
            <select id="pref-lang" [ngModel]="i18n.lang()" (ngModelChange)="setLanguage($event)">
              @for (l of languages; track l.code) { <option [value]="l.code">{{ l.name }}</option> }
            </select>
          </div>
          <fieldset class="field pref-theme">
            <legend>{{ 'Theme' | t }}</legend>
            <div class="segmented" role="radiogroup">
              <label [class.on]="theme.theme() === 'light'"><input type="radio" name="theme" value="light" [checked]="theme.theme() === 'light'" (change)="setTheme('light')" /> ☀ {{ 'Light' | t }}</label>
              <label [class.on]="theme.theme() === 'dark'"><input type="radio" name="theme" value="dark" [checked]="theme.theme() === 'dark'" (change)="setTheme('dark')" /> ☾ {{ 'Dark' | t }}</label>
            </div>
          </fieldset>
        </div>
      </section>

      <!-- Which emails the person gets -->
      <section class="card profile-card">
        <h2 class="no-rule">{{ 'Email notifications' | t }}</h2>
        <p class="muted small">{{ 'Choose which emails we send to {email}. Security emails, such as login codes, are always sent.' | t: { email: account.email } }}</p>
        <label class="switch-row">
          <input type="checkbox" role="switch" [checked]="account.emailReminders" (change)="setEmail('emailReminders', $any($event.target).checked)" />
          <span><strong>{{ 'Appointment reminders' | t }}</strong><br /><span class="muted small">{{ 'An email the day before each visit.' | t }}</span></span>
        </label>
        <label class="switch-row">
          <input type="checkbox" role="switch" [checked]="account.emailNotifications" (change)="setEmail('emailNotifications', $any($event.target).checked)" />
          <span><strong>{{ 'Email me my notifications' | t }}</strong><br /><span class="muted small">{{ 'A copy of every notification by email: orders, prescriptions and changes to your visits.' | t }}</span></span>
        </label>
      </section>
    }

    @if (prefsStatus()) { <p class="pref-toast" role="status">{{ prefsStatus() }}</p> }

    <section class="card profile-card">
      <h2 class="no-rule">{{ 'Account' | t }}</h2>

      @if (message()) { <p class="alert success" role="status">{{ message() }}</p> }
      @if (error()) { <p class="alert error" role="alert">{{ error() }}</p> }

      @if (info(); as account) {
        <dl class="details">
          <dt>{{ 'Email' | t }}</dt>
          <dd>{{ account.email }}</dd>
          <dt>{{ 'Role' | t }}</dt>
          <dd>{{ account.role | t }}</dd>
          <dt>{{ 'Email status' | t }}</dt>
          <dd>
            @if (account.emailConfirmed) {
              <span class="badge ok">{{ 'Confirmed' | t }}</span>
            } @else {
              <span class="badge warn">{{ 'Not confirmed' | t }}</span>
            }
          </dd>
        </dl>

        @if (!account.emailConfirmed) {
          <h2>{{ 'Confirm your email' | t }}</h2>
          <p class="muted">{{ 'We send a 6-digit code to your email address. It works for 10 minutes.' | t }}</p>
          <button class="btn" type="button" (click)="sendCode()" [disabled]="sending()">{{ (sending() ? 'Sending...' : 'Send me a code') | t }}</button>
          <div class="field code-field">
            <label for="code">{{ 'Code' | t }}</label>
            <input id="code" type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code" [formControl]="code" />
          </div>
          <button class="btn primary" type="button" (click)="verify()" [disabled]="verifying() || code.invalid">{{ (verifying() ? 'Checking...' : 'Confirm email') | t }}</button>
        }

        <h2>{{ 'Security' | t }}</h2>
        <div class="card-actions">
          <button class="btn" type="button" [class.primary]="section() === 'password'" (click)="open('password')">{{ 'Change password' | t }}</button>
          <button class="btn" type="button" [class.primary]="section() === 'email'" (click)="open('email')">{{ 'Change email' | t }}</button>
        </div>

        @if (section() === 'password') {
          <form class="inline-panel" [formGroup]="passwordForm" (ngSubmit)="changePassword()" novalidate>
            <div class="field">
              <label for="cur-pass">{{ 'Current password' | t }}</label>
              <input id="cur-pass" type="password" autocomplete="current-password" formControlName="currentPassword" />
            </div>
            <div class="form-grid">
              <div class="field">
                <label for="new-pass">{{ 'New password' | t }}</label>
                <input id="new-pass" type="password" autocomplete="new-password" formControlName="newPassword" />
              </div>
              <div class="field">
                <label for="new-pass2">{{ 'Repeat new password' | t }}</label>
                <input id="new-pass2" type="password" autocomplete="new-password" formControlName="repeat" />
              </div>
            </div>
            <p class="muted">{{ 'At least 8 characters.' | t }}</p>
            <button class="btn primary" type="submit" [disabled]="busy() || passwordForm.invalid">{{ 'Change password' | t }}</button>
          </form>
        }

        @if (section() === 'email') {
          <div class="inline-panel">
            @if (!emailCodeSent()) {
              <form [formGroup]="emailForm" (ngSubmit)="requestEmailChange()" novalidate>
                <div class="field">
                  <label for="new-email">{{ 'New email' | t }}</label>
                  <input id="new-email" type="email" autocomplete="email" formControlName="newEmail" />
                </div>
                <div class="field">
                  <label for="email-pass">{{ 'Current password' | t }}</label>
                  <input id="email-pass" type="password" autocomplete="current-password" formControlName="currentPassword" />
                </div>
                <button class="btn primary" type="submit" [disabled]="busy() || emailForm.invalid">{{ 'Send code to the new email' | t }}</button>
              </form>
            } @else {
              <p class="muted">{{ 'Enter the 6-digit code we sent to {email}.' | t: { email: emailForm.getRawValue().newEmail } }}</p>
              <div class="field code-field">
                <label for="email-code">{{ 'Code' | t }}</label>
                <input id="email-code" type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code" [formControl]="emailCode" />
              </div>
              <div class="card-actions">
                <button class="btn primary" type="button" (click)="confirmEmailChange()" [disabled]="busy() || emailCode.invalid">{{ 'Confirm new email' | t }}</button>
                <button class="btn" type="button" (click)="emailCodeSent.set(false)">{{ 'Back' | t }}</button>
              </div>
            }
          </div>
        }
      } @else if (loading()) {
        <p class="muted">{{ 'Loading...' | t }}</p>
      }
    </section>
  `
})
export class AccountPage {
  private readonly api = inject(AccountApi);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  protected readonly profile = inject(ProfileService);
  protected readonly i18n = inject(I18n);
  protected readonly theme = inject(ThemeService);

  protected readonly languages = LANGUAGES;
  protected readonly info = signal<AccountInfo | null>(null);
  protected readonly loading = signal(true);
  protected readonly sending = signal(false);
  protected readonly verifying = signal(false);
  protected readonly busy = signal(false);
  protected readonly message = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly section = signal<Section>(null);
  protected readonly emailCodeSent = signal(false);

  protected details = { firstName: '', lastName: '', phone: '', address: '' };
  protected readonly detailsBusy = signal(false);
  protected readonly detailsMessage = signal<string | null>(null);
  protected readonly detailsError = signal<string | null>(null);
  protected readonly prefsStatus = signal<string | null>(null);
  private statusTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly code = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^\d{6}$/)] });
  protected readonly emailCode = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^\d{6}$/)] });

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
        this.show(account);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(apiErrorMessage(err));
        this.loading.set(false);
      }
    });
  }

  // ---------- personal details

  protected saveDetails(): void {
    const d = { firstName: this.details.firstName.trim(), lastName: this.details.lastName.trim(), phone: this.details.phone.trim(), address: this.details.address.trim() };
    this.detailsMessage.set(null);
    this.detailsError.set(null);
    if (!d.firstName || !d.lastName) { this.detailsError.set(this.i18n.t('First and last name are required.')); return; }
    if (this.info()?.role === 'Patient' && !d.phone) { this.detailsError.set(this.i18n.t('Phone number is required.')); return; }
    if (d.phone && !PHONE_PATTERN.test(d.phone)) { this.detailsError.set(this.i18n.t('Enter a valid phone number.')); return; }

    this.detailsBusy.set(true);
    this.api.updateDetails({ firstName: d.firstName, lastName: d.lastName, phone: d.phone || null, address: d.address || null }).subscribe({
      next: info => {
        this.detailsBusy.set(false);
        this.show(info);
        this.profile.set(info);
        this.detailsMessage.set(this.i18n.t('Your details were saved.'));
      },
      error: err => {
        this.detailsBusy.set(false);
        this.detailsError.set(apiErrorMessage(err));
      }
    });
  }

  // ---------- preferences and emails (saved immediately)

  protected setLanguage(lang: Lang): void {
    void this.i18n.use(lang).then(() => this.savePrefs({ language: lang }));
  }

  protected setTheme(theme: Theme): void {
    this.theme.set(theme);
    this.savePrefs({ theme });
  }

  protected setEmail(key: 'emailReminders' | 'emailNotifications', value: boolean): void {
    this.savePrefs({ [key]: value });
  }

  private savePrefs(change: Partial<AccountPreferences>): void {
    this.profile.savePreferences(change).subscribe({
      next: info => {
        this.info.set(info);
        this.flash(this.i18n.t('Saved'));
      },
      error: err => this.flash(apiErrorMessage(err))
    });
  }

  private flash(text: string): void {
    this.prefsStatus.set(text);
    clearTimeout(this.statusTimer);
    this.statusTimer = setTimeout(() => this.prefsStatus.set(null), 2500);
  }

  private show(account: AccountInfo): void {
    this.info.set(account);
    this.details = { firstName: account.firstName ?? '', lastName: account.lastName ?? '', phone: account.phone ?? '', address: account.address ?? '' };
  }

  // ---------- account security

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
        this.message.set(this.i18n.t(response.message));
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
        this.show(account);
        this.code.reset('');
        this.message.set(this.i18n.t('Your email is confirmed.'));
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
      this.error.set(this.i18n.t('The new passwords do not match.'));
      return;
    }
    this.run(this.api.changePassword(currentPassword, newPassword), () => {
      this.passwordForm.reset();
      this.section.set(null);
      this.message.set(this.i18n.t('Your password was changed.'));
    });
  }

  protected requestEmailChange(): void {
    const { newEmail, currentPassword } = this.emailForm.getRawValue();
    this.run(this.api.requestEmailChange(newEmail, currentPassword), r => {
      this.emailCodeSent.set(true);
      this.message.set(this.i18n.t((r as { message?: string } | null)?.message ?? 'We sent a code to the new email.'));
    });
  }

  protected confirmEmailChange(): void {
    this.run(this.api.confirmEmailChange(this.emailCode.value), account => {
      const info = account as AccountInfo;
      this.show(info);
      this.auth.updateEmail(info.email);
      this.profile.set(info);
      this.emailCode.reset('');
      this.emailForm.reset();
      this.emailCodeSent.set(false);
      this.section.set(null);
      this.message.set(this.i18n.t('Your email was changed.'));
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
