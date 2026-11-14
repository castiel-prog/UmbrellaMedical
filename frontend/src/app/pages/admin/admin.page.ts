import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AdminApi } from '../../core/admin.api';
import { apiErrorMessage } from '../../core/api-error';

const LINKS = [
  { path: 'users', label: 'Users' },
  { path: 'staff', label: 'Staff' },
  { path: 'services', label: 'Services' },
  { path: 'store', label: 'Store products' },
  { path: 'departments', label: 'Departments & rooms' },
  { path: 'insurers', label: 'Insurers' },
  { path: 'reviews', label: 'Reviews' }
];

@Component({
  selector: 'app-admin',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <h1>Administration</h1>
      <button class="btn small" type="button" (click)="runReminders()" [disabled]="running()"
        title="Send the 24-hour reminder emails now instead of waiting for the background job">
        {{ running() ? 'Sending...' : 'Send due reminders now' }}
      </button>
    </div>
    @if (message()) { <p class="alert success" role="status">{{ message() }}</p> }
    @if (error()) { <p class="alert error" role="alert">{{ error() }}</p> }

    <nav class="tabs scroll" aria-label="Admin sections">
      @for (l of links; track l.path) {
        <a class="tab-link" [routerLink]="l.path" routerLinkActive="active">{{ l.label }}</a>
      }
    </nav>

    <router-outlet />
  `
})
export class AdminPage {
  private readonly api = inject(AdminApi);

  protected readonly links = LINKS;
  protected readonly running = signal(false);
  protected readonly message = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected runReminders(): void {
    this.running.set(true);
    this.message.set(null);
    this.error.set(null);
    this.api.runReminders().subscribe({
      next: r => {
        this.running.set(false);
        this.message.set(r.remindersSent === 1 ? '1 reminder was sent.' : `${r.remindersSent} reminders were sent.`);
      },
      error: err => {
        this.running.set(false);
        this.error.set(apiErrorMessage(err));
      }
    });
  }
}
