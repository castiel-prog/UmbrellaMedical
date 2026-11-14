import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { AuthService } from './auth.service';
import { AccountApi } from './account.api';
import { AccountInfo, UpdateDoctorProfileRequest } from './model';

/** The logged-in user's profile (name and picture), shared by the top bar and the account page. */
@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly account = inject(AccountApi);

  readonly me = signal<AccountInfo | null>(null);

  constructor() {
    effect(() => {
      const email = this.auth.email();
      untracked(() => (email ? this.refresh() : this.me.set(null)));
    });
  }

  refresh(): void {
    this.account.get().subscribe({
      next: info => this.me.set(info),
      error: () => this.me.set(null)
    });
  }

  /** Keeps the profile in sync when another page loaded a fresh copy. */
  set(info: AccountInfo): void {
    this.me.set(this.bust(info));
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
