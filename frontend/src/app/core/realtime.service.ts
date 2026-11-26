import { Injectable, effect, inject, signal } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { Observable, Subject, filter, map } from 'rxjs';
import { AuthService } from './auth.service';

/** Events the server pushes (see RealtimeEvents in the API). */
export interface RealtimeEventMap {
  'support:message': { conversationId: number; message: { id: number; fromStaff: boolean; senderName: string; body: string; sentAt: string; seen: boolean } };
  'support:read': { conversationId: number; byStaff: boolean };
  'support:changed': { conversationId: number };
  'support:typing': { conversationId: number; fromStaff: boolean };
  'presence': { userId: number; status: 'Online' | 'Away' | 'Offline'; isStaff: boolean };
  'notification': Record<string, never>;
}
type EventName = keyof RealtimeEventMap;
const EVENTS: EventName[] = ['support:message', 'support:read', 'support:changed', 'support:typing', 'presence', 'notification'];

/**
 * One live SignalR connection (WebSockets) per tab while logged in. The server pushes support messages, "seen" receipts,
 * typing, presence and notifications through it. When it is down, the services fall back to polling, so nothing breaks.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly auth = inject(AuthService);
  private readonly events = new Subject<{ name: EventName; data: unknown }>();
  private connection: HubConnection | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;

  /** True while the live connection is up. */
  readonly connected = signal(false);

  constructor() {
    // Connect when someone logs in, with their token; disconnect on logout.
    effect(() => {
      const token = this.auth.isLoggedIn() ? this.auth.token : null;
      void this.stop().then(() => { if (token) void this.start(); });
    });
  }

  /** Listen to one kind of pushed event. */
  on<K extends EventName>(name: K): Observable<RealtimeEventMap[K]> {
    return this.events.pipe(filter(e => e.name === name), map(e => e.data as RealtimeEventMap[K]));
  }

  /** Call a hub method (Heartbeat, Typing); false when there is no live connection. */
  async invoke(method: string, ...args: unknown[]): Promise<boolean> {
    if (this.connection?.state !== HubConnectionState.Connected) return false;
    try { await this.connection.invoke(method, ...args); return true; } catch { return false; }
  }

  private async start(): Promise<void> {
    const connection = new HubConnectionBuilder()
      .withUrl('/api/hubs/realtime', { accessTokenFactory: () => this.auth.token ?? '' })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(LogLevel.Warning)
      .build();

    for (const name of EVENTS) connection.on(name, data => this.events.next({ name, data }));
    connection.onreconnecting(() => this.connected.set(false));
    connection.onreconnected(() => this.connected.set(true));
    connection.onclose(() => {
      this.connected.set(false);
      // Gave up reconnecting (e.g. the server restarted): try again in a while if still logged in.
      if (this.connection === connection && this.auth.isLoggedIn()) this.retry = setTimeout(() => void this.start(), 30_000);
    });

    this.connection = connection;
    try {
      await connection.start();
      this.connected.set(true);
    } catch {
      this.connected.set(false);
      if (this.connection === connection && this.auth.isLoggedIn()) this.retry = setTimeout(() => void this.start(), 15_000);
    }
  }

  private async stop(): Promise<void> {
    if (this.retry) { clearTimeout(this.retry); this.retry = null; }
    const old = this.connection;
    this.connection = null;
    this.connected.set(false);
    if (old) { try { await old.stop(); } catch { /* already closed */ } }
  }
}
