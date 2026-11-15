import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { PagedResult } from '../../core/model';
import { apiErrorMessage } from '../../core/api-error';
import { LocalDatePipe } from '../../core/i18n';

interface ContactMessage {
  id: number; name: string; email: string; phone: string; topic: string; message: string;
  isHandled: boolean; createdAt: string; handledAt: string | null;
}

/** Messages from the public contact form: read, reply by email or phone, mark as handled. */
@Component({
  selector: 'app-admin-messages',
  imports: [FormsModule, LocalDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar">
      <div class="field">
        <label for="msg-filter">Show</label>
        <select id="msg-filter" [ngModel]="filter()" (ngModelChange)="filter.set($event); page.set(1); load()">
          <option value="open">Open messages</option>
          <option value="handled">Handled</option>
          <option value="all">All</option>
        </select>
      </div>
      <span class="muted small">{{ total() }} message(s)</span>
    </div>

    @if (error()) { <p class="alert error" role="alert">{{ error() }}</p> }
    @if (!loading() && items().length === 0) { <p class="empty card muted">No messages here.</p> }

    <ul class="message-list">
      @for (m of items(); track m.id) {
        <li class="card message-item" [class.handled]="m.isHandled">
          <div class="message-head">
            <div>
              <strong>{{ m.name }}</strong> <span class="badge">{{ m.topic }}</span>
              <div class="muted small">{{ m.createdAt + 'Z' | ldate: 'mediumTime' }}</div>
            </div>
            <div class="message-actions">
              <a class="btn small" [href]="'mailto:' + m.email + '?subject=' + encode('Re: ' + m.topic + ' — Umbrella Medical Center')">Reply by email</a>
              <a class="btn small" [href]="'tel:' + m.phone">Call</a>
              <button class="btn small" [class.primary]="!m.isHandled" type="button" (click)="toggle(m)">
                {{ m.isHandled ? 'Reopen' : 'Mark handled' }}
              </button>
            </div>
          </div>
          <p class="pre-line">{{ m.message }}</p>
          <p class="muted small">{{ m.email }} · {{ m.phone }}@if (m.handledAt) { · handled {{ m.handledAt + 'Z' | ldate: 'mediumTime' }} }</p>
        </li>
      }
    </ul>

    @if (total() > pageSize) {
      <nav class="pager" aria-label="Pages">
        <button class="btn small" type="button" (click)="page.set(page() - 1); load()" [disabled]="page() <= 1">Previous</button>
        <span>Page {{ page() }}</span>
        <button class="btn small" type="button" (click)="page.set(page() + 1); load()" [disabled]="page() * pageSize >= total()">Next</button>
      </nav>
    }
  `
})
export class AdminMessagesTab {
  private readonly http = inject(HttpClient);

  protected readonly pageSize = 20;
  protected readonly items = signal<ContactMessage[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly filter = signal<'open' | 'handled' | 'all'>('open');
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.load();
  }

  protected load(): void {
    const handled = this.filter() === 'all' ? '' : `&handled=${this.filter() === 'handled'}`;
    this.loading.set(true);
    this.http.get<PagedResult<ContactMessage>>(`/api/admin/contact-messages?page=${this.page()}&pageSize=${this.pageSize}${handled}`).subscribe({
      next: r => { this.items.set(r.items); this.total.set(r.totalCount); this.loading.set(false); },
      error: err => { this.error.set(apiErrorMessage(err)); this.loading.set(false); }
    });
  }

  protected toggle(m: ContactMessage): void {
    this.http.put(`/api/admin/contact-messages/${m.id}/handled?value=${!m.isHandled}`, {}).subscribe({
      next: () => this.load(),
      error: err => this.error.set(apiErrorMessage(err))
    });
  }

  protected encode(s: string): string {
    return encodeURIComponent(s);
  }
}
