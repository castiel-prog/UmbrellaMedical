import { Injectable, NgZone, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { AuthService } from './auth.service';

export type PresenceStatus = 'Online' | 'Away' | 'Offline';

export interface SupportConversation {
  id: number;
  subject: string;
  userId: number;
  userName: string;
  userEmail: string;
  userRole: string;
  createdAt: string;
  lastMessageAt: string;
  lastMessage: string | null;
  lastFromStaff: boolean;
  isClosed: boolean;
  unread: number;
  otherStatus: PresenceStatus;
  otherLastSeen: string | null;
  contactMessageId: number | null;
}

export interface SupportMessage {
  id: number;
  fromStaff: boolean;
  senderName: string;
  body: string;
  sentAt: string;
  seen: boolean;
}

const HEARTBEAT_MS = 25_000;
const UNREAD_MS = 20_000;

/**
 * Support chat: API calls, the unread badge, and presence. While logged in, every open tab tells the server every
 * 25 seconds how long ago the person last clicked, typed or scrolled, so others see them as online, away or offline.
 */
@Injectable({ providedIn: 'root' })
export class SupportService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly zone = inject(NgZone);

  /** Unread support messages (badge in the top bar). */
  readonly unread = signal(0);

  private lastActivity = Date.now();
  private timers: ReturnType<typeof setInterval>[] = [];

  constructor() {
    // Any interaction counts as activity; listened to outside Angular so it never triggers change detection.
    this.zone.runOutsideAngular(() => {
      const mark = () => { this.lastActivity = Date.now(); };
      for (const e of ['pointerdown', 'keydown', 'scroll', 'wheel', 'touchstart', 'mousemove']) window.addEventListener(e, mark, { passive: true });
      document.addEventListener('visibilitychange', () => { if (!document.hidden) { mark(); this.beat(); } });
    });

    effect(() => {
      const loggedIn = this.auth.isLoggedIn();
      this.timers.forEach(clearInterval);
      this.timers = [];
      if (!loggedIn) { this.unread.set(0); return; }
      this.beat();
      this.refreshUnread();
      this.zone.runOutsideAngular(() => {
        this.timers.push(setInterval(() => this.beat(), HEARTBEAT_MS));
        this.timers.push(setInterval(() => this.zone.run(() => this.refreshUnread()), UNREAD_MS));
      });
    });
  }

  /** Seconds since the last click, key press or scroll on the site. */
  idleSeconds(): number {
    return Math.round((Date.now() - this.lastActivity) / 1000);
  }

  private beat(): void {
    if (!this.auth.isLoggedIn()) return;
    this.http.post('/api/presence', { idleSeconds: this.idleSeconds() }).subscribe({ error: () => { /* offline for a moment: fine */ } });
  }

  refreshUnread(): void {
    if (!this.auth.isLoggedIn()) return;
    this.http.get<{ count: number }>('/api/support/unread').subscribe({ next: r => this.unread.set(r.count), error: () => { /* keep the last value */ } });
  }

  conversations(): Observable<SupportConversation[]> {
    return this.http.get<SupportConversation[]>('/api/support/conversations');
  }

  conversation(id: number): Observable<SupportConversation> {
    return this.http.get<SupportConversation>(`/api/support/conversations/${id}`);
  }

  /** Staff: open (or reuse) the chat for a contact form message. */
  startFromContact(contactMessageId: number): Observable<SupportConversation> {
    return this.http.post<SupportConversation>('/api/support/conversations', { contactMessageId });
  }

  start(subject: string, message: string): Observable<SupportConversation> {
    return this.http.post<SupportConversation>('/api/support/conversations', { subject, message });
  }

  messages(id: number, afterId = 0): Observable<SupportMessage[]> {
    return this.http.get<SupportMessage[]>(`/api/support/conversations/${id}/messages`, { params: { afterId } });
  }

  send(id: number, body: string): Observable<SupportMessage> {
    this.lastActivity = Date.now();
    return this.http.post<SupportMessage>(`/api/support/conversations/${id}/messages`, { body });
  }

  markRead(id: number): Observable<void> {
    return this.http.post<void>(`/api/support/conversations/${id}/read`, {}).pipe(tap(() => this.refreshUnread()));
  }

  close(id: number, value: boolean): Observable<SupportConversation> {
    return this.http.post<SupportConversation>(`/api/support/conversations/${id}/close`, {}, { params: { value } });
  }
}
