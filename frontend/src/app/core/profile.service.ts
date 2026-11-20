import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { AuthService } from './auth.service';
import { AccountApi } from './account.api';
import { AccountInfo, AccountPreferences, UpdateDoctorProfileRequest } from './model';
import { I18n, LANGUAGES, Lang } from './i18n';
import { ThemeService } from './theme.service';

/** The logged-in user's profile (name and picture), shared by the top bar and the account page. */
@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly account = inject(AccountApi);
  private readonly i18n = inject(I18n);
  private readonly theme = inject(ThemeService);

  readonly me = signal<AccountInfo | null>(null);

  constructor() {
    effect(() => {
      const email = this.auth.email();
      untracked(() => (email ? this.refresh() : this.me.set(null)));
    });
  }

  refresh(): void {
    this.account.get().subscribe({
      next: info => {
        this.me.set(info);
        this.applyPreferences(info);
      },
      error: () => this.me.set(null)
    });
  }

  /** Keeps the profile in sync when another page loaded a fresh copy. */
  set(info: AccountInfo): void {
    this.me.set(this.bust(info));
  }

  /** Saves the person's preferences (language, theme, emails) to their account. */
  savePreferences(change: Partial<AccountPreferences>): Observable<AccountInfo> {
    const me = this.me();
    const current: AccountPreferences = {
      language: me?.preferredLanguage ?? this.i18n.lang(),
      theme: me?.preferredTheme ?? this.theme.theme(),
      emailReminders: me?.emailReminders ?? true,
      emailNotifications: me?.emailNotifications ?? false
    };
    return this.account.updatePreferences({ ...current, ...change }).pipe(tap(info => this.set(info)));
  }

  /** Called when the language or theme is changed in the top bar: remembered on the account when logged in. */
  rememberLanguageAndTheme(): void {
    if (!this.me()) return;
    this.savePreferences({ language: this.i18n.lang(), theme: this.theme.theme() }).subscribe({ error: () => { /* the change still applies on this device */ } });
  }

  /** Language and theme saved on the account win over this device's own choice. */
  private applyPreferences(info: AccountInfo): void {
    const lang = info.preferredLanguage;
    if (lang && lang !== this.i18n.lang() && LANGUAGES.some(l => l.code === lang)) void this.i18n.use(lang as Lang);
    if (info.preferredTheme) this.theme.set(info.preferredTheme);
  }

  uploadPhoto(file: File): Observable<AccountInfo> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<AccountInfo>('/api/profile/photo', form).pipe(tap(info => this.set(info)));
  }

  deletePhoto(): Observable<AccountInfo> {
    return this.http.delete<AccountInfo>('/api/profile/photo').pipe(tap(info => this.set(info)));
  }

  updateDoctorProfile(request: UpdateDoctorProfileRequest): Observable<void> {
    return this.http.put<void>('/api/profile/doctor', request);
  }

  // The photo URL stays the same after a new upload, so add a version to make images reload.
  private bust(info: AccountInfo): AccountInfo {
    return info.photoUrl ? { ...info, photoUrl: `${info.photoUrl}?v=${Date.now()}` } : info;
  }
}
