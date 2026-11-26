import { Injectable, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { AuthService } from './auth.service';
import { RealtimeService } from './realtime.service';
import { AppNotification, PagedResult } from './model';
import { queryParams } from './util';

const POLL_MS = 60_000;

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly realtime = inject(RealtimeService);
  private timer: ReturnType<typeof setInterval> | null = null;

  /** Unread notification count shown in the top bar. */
  readonly unread = signal(0);

  constructor() {
    // A new notification is pushed the moment it is created; polling is only the fallback.
    this.realtime.on('notification').subscribe(() => this.refreshCount());
    effect(() => {
      if (this.auth.isLoggedIn()) {
        this.refreshCount();
        this.timer ??= setInterval(() => { if (!this.realtime.connected()) this.refreshCount(); }, POLL_MS);
      } else {
        this.unread.set(0);
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
      }
    });
  }

  list(unreadOnly: boolean, page = 1, pageSize = 20): Observable<PagedResult<AppNotification>> {
    return this.http.get<PagedResult<AppNotification>>('/api/notifications', {
      params: queryParams({ unreadOnly: unreadOnly || null, page, pageSize })
    });
  }

  markRead(id: number): Observable<void> {
    return this.http.post<void>(`/api/notifications/${id}/read`, {}).pipe(tap(() => this.refreshCount()));
  }

  markAllRead(): Observable<{ count: number }> {
    return this.http.post<{ count: number }>('/api/notifications/read-all', {}).pipe(tap(r => this.unread.set(r.count)));
  }

  refreshCount(): void {
    if (!this.auth.isLoggedIn()) return;
    this.http.get<{ count: number }>('/api/notifications/unread-count').subscribe({
      next: r => this.unread.set(r.count),
      error: () => { /* the badge is not critical */ }
    });
  }
}
