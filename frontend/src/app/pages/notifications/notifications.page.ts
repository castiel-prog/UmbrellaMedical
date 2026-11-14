import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NotificationsService } from '../../core/notifications.service';
import { AuthService } from '../../core/auth.service';
import { AppNotification, PagedResult } from '../../core/model';
import { apiErrorMessage } from '../../core/api-error';
import { Pager } from '../../shared/pager';

@Component({
  selector: 'app-notifications',
  imports: [DatePipe, RouterLink, Pager],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <h1>Notifications</h1>
      <button class="btn small" type="button" (click)="markAll()" [disabled]="notifications.unread() === 0 || busy()">Mark all as read</button>
    </div>

    <div class="tabs" role="tablist">
      <button type="button" role="tab" [class.active]="!unreadOnly()" [attr.aria-selected]="!unreadOnly()" (click)="filter(false)">All</button>
      <button type="button" role="tab" [class.active]="unreadOnly()" [attr.aria-selected]="unreadOnly()" (click)="filter(true)">
        Unread @if (notifications.unread() > 0) { <span class="count-pill">{{ notifications.unread() }}</span> }
      </button>
    </div>

    @if (error()) { <p class="alert error" role="alert">{{ error() }}</p> }
    @if (loading() && !result()) { <p class="muted">Loading...</p> }

    @if (result(); as data) {
      @if (data.items.length === 0) {
        <p class="empty card muted">{{ unreadOnly() ? 'You are all caught up.' : 'No notifications yet.' }}</p>
      }
      <ul class="stack" [class.dim]="loading()">
        @for (n of data.items; track n.id) {
          <li class="card notification" [class.unread]="!n.isRead">
            <div class="row-head">
              <div>
                <h3>{{ n.title }}</h3>
                <p class="muted">{{ n.createdAt | date: 'd MMM y, HH:mm' }}</p>
              </div>
              @if (!n.isRead) {
                <button class="btn small" type="button" (click)="markRead(n)">Mark as read</button>
              }
            </div>
            <p class="pre-line">{{ n.message }}</p>
            @if (n.appointmentId) {
              @if (isPatient()) {
                <a routerLink="/appointments">View my appointments</a>
              } @else if (isStaff()) {
                <a routerLink="/desk">{{ isDoctor() ? 'Open my schedule' : 'Open appointments' }}</a>
              }
            }
          </li>
        }
      </ul>
      <app-pager [page]="page()" [pageSize]="pageSize" [totalCount]="data.totalCount" [disabled]="loading()" (pageChange)="page.set($event); load()" />
    }
  `
})
export class NotificationsPage {
  protected readonly notifications = inject(NotificationsService);
  private readonly auth = inject(AuthService);

  protected readonly pageSize = 15;
  protected readonly page = signal(1);
  protected readonly unreadOnly = signal(false);
  protected readonly result = signal<PagedResult<AppNotification> | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.load();
  }

  protected isPatient(): boolean {
    return this.auth.hasRole('Patient');
  }

  protected isDoctor(): boolean {
    return this.auth.hasRole('Doctor');
  }

  protected isStaff(): boolean {
    return this.auth.hasRole('Doctor', 'Receptionist', 'Admin');
  }

  protected filter(unreadOnly: boolean): void {
    this.unreadOnly.set(unreadOnly);
    this.page.set(1);
    this.load();
  }

  protected markRead(n: AppNotification): void {
    this.notifications.markRead(n.id).subscribe({
      next: () => this.load(),
      error: err => this.error.set(apiErrorMessage(err))
    });
  }

  protected markAll(): void {
    this.busy.set(true);
    this.notifications.markAllRead().subscribe({
      next: () => {
        this.busy.set(false);
        this.load();
      },
      error: err => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(err));
      }
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.notifications.list(this.unreadOnly(), this.page(), this.pageSize).subscribe({
      next: r => {
        this.result.set(r);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(apiErrorMessage(err));
        this.loading.set(false);
      }
    });
  }
}
