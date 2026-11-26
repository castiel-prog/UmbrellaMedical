import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { AccountApi } from './account.api';
import { AuthService } from './auth.service';

/**
 * Whether the logged-in patient has confirmed their e-mail address.
 * Patients must confirm it before they can book a visit or buy something (the API enforces this too).
 */
@Injectable({ providedIn: 'root' })
export class EmailStatusService {
  private readonly auth = inject(AuthService);
  private readonly account = inject(AccountApi);

  /** null = not known yet (or not a patient). */
  readonly confirmed = signal<boolean | null>(null);
  readonly email = signal<string | null>(null);

  /** True when a patient still has to confirm their e-mail. */
  readonly needsConfirmation = computed(() => this.auth.hasRole('Patient') && this.confirmed() === false);

  constructor() {
    effect(() => {
      const loggedIn = this.auth.isLoggedIn() ? this.auth.token : null;
      untracked(() => {
        this.confirmed.set(null);
        this.email.set(null);
        if (loggedIn && this.auth.hasRole('Patient')) this.refresh();
      });
    });
  }

  refresh(): void {
    if (!this.auth.hasRole('Patient')) return;
    this.account.get().subscribe({
      next: info => { this.confirmed.set(info.emailConfirmed); this.email.set(info.email); },
      error: () => { /* the API still checks it */ }
    });
  }

  markConfirmed(): void {
    this.confirmed.set(true);
  }
}
