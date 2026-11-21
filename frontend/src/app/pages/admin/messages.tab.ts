import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { PagedResult } from '../../core/model';
import { apiErrorMessage } from '../../core/api-error';
import { LocalDatePipe, TranslatePipe } from '../../core/i18n';

interface ContactMessage {
  id: number; name: string; email: string; phone: string; topic: string; message: string;
  isHandled: boolean; createdAt: string; handledAt: string | null;
}

/** Messages from the public contact form: read, reply by email or phone, mark as handled. */
import { Router } from '@angular/router';
import { SupportService } from '../../core/support.service';

@Component({
  selector: 'app-admin-messages',
  imports: [TranslatePipe, FormsModule, LocalDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar">
      <div class="field">
        <label for="msg-filter">{{ 'Show' | t }}</label>
        <select id="msg-filter" [ngModel]="filter()" (ngModelChange)="filter.set($event); page.set(1); load()">
          <option value="open">{{ 'Open messages' | t }}</option>
          <option value="handled">{{ 'Handled' | t }}</option>
          <option value="all">{{ 'All' | t }}</option>
        </select>
      </div>
      <span class="muted small">{{ '{p0} message(s)' | t: { p0: (total()) } }}</span>
    </div>

    @if (error()) { <p class="alert error" role="alert">{{ error() }}</p> }
    @if (!loading() && items().length === 0) { <p class="empty card muted">{{ 'No messages here.' | t }}</p> }

    <ul class="message-list">
      @for (m of items(); track m.id) {
        <li class="card message-item" [class.handled]="m.isHandled">
          <div class="message-head">
            <div>
              <strong>{{ m.name }}</strong> <span class="badge">{{ m.topic }}</span>
              <div class="muted small">{{ m.createdAt + 'Z' | ldate: 'mediumTime' }}</div>
            </div>
            <div class="message-actions">
              <a class="btn small" [href]="'mailto:' + m.email + '?subject=' + encode('Re: ' + m.topic + ' — Umbrella Medical Center')">{{ 'Reply by email' | t }}</a>
              <button class="btn small" type="button" (click)="chat(m)" [disabled]="chatBusy() === m.id">💬 {{ 'Reply in chat' | t }}</button>
              <button class="btn small" [class.primary]="!m.isHandled" type="button" (click)="toggle(m)">
                {{ (m.isHandled ? 'Reopen' : 'Mark handled') | t }}
              </button>
            </div>
          </div>
          <p class="pre-line">{{ m.message }}</p>
          <p class="muted small">{{ m.email }} · {{ m.phone }}@if (m.handledAt) { {{ '· handled' | t }} {{ m.handledAt + 'Z' | ldate: 'mediumTime' }} }</p>
        </li>
      }
    </ul>

    @if (total() > pageSize) {
      <nav class="pager" [attr.aria-label]="'Pages' | t">
        <button class="btn small" type="button" (click)="page.set(page() - 1); load()" [disabled]="page() <= 1">{{ 'Previous' | t }}</button>
        <span>{{ 'Page {p0}' | t: { p0: (page()) } }}</span>
        <button class="btn small" type="button" (click)="page.set(page() + 1); load()" [disabled]="page() * pageSize >= total()">{{ 'Next' | t }}</button>
      </nav>
    }
  `
})
export class AdminMessagesTab {
  private readonly http = inject(HttpClient);
  private readonly support = inject(SupportService);
  private readonly router = inject(Router);
  protected readonly chatBusy = signal<number | null>(null);

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

  /** Opens (or reuses) a support chat with the person who sent this message. */
  protected chat(m: ContactMessage): void {
    this.chatBusy.set(m.id);
    this.error.set(null);
    this.support.startFromContact(m.id).subscribe({
      next: c => { this.chatBusy.set(null); void this.router.navigate(['/support'], { queryParams: { c: c.id } }); },
      error: err => { this.chatBusy.set(null); this.error.set(apiErrorMessage(err)); }
    });
  }
}