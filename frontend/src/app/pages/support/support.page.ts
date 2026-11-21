import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { SupportConversation, SupportMessage, SupportService } from '../../core/support.service';
import { apiErrorMessage } from '../../core/api-error';
import { I18n, LocalDatePipe, TranslatePipe } from '../../core/i18n';

const MESSAGES_MS = 3000;
const LIST_MS = 10000;

/** Support chat: admins talk with patients (and other users); everyone sees whether the other side is online. */
@Component({
  selector: 'app-support',
  imports: [FormsModule, TranslatePipe, LocalDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <div>
        <h1>{{ 'Support chat' | t }}</h1>
        <p class="muted">{{ (isStaff() ? 'Chat with patients who contacted the clinic.' : 'Write to the clinic team. We usually answer within the hour.') | t }}</p>
      </div>
      @if (!isStaff()) {
        <button class="btn primary" type="button" (click)="startNew()">{{ 'New conversation' | t }}</button>
      }
    </div>

    @if (error()) { <p class="alert error" role="alert">{{ error() }}</p> }

    <div class="support-layout" [class.has-open]="openId() !== null || composing()">
      <!-- conversation list -->
      <section class="card support-list" [attr.aria-label]="'Conversations' | t">
        @if (loading()) { <p class="muted">{{ 'Loading...' | t }}</p> }
        @else if (conversations().length === 0) {
          <p class="muted support-empty">{{ (isStaff() ? 'No conversations yet. Start one from a contact message under Administration → Messages.' : 'No conversations yet.') | t }}</p>
        }
        <ul>
          @for (c of conversations(); track c.id) {
            <li>
              <button type="button" class="conv" [class.active]="c.id === openId()" [class.closed]="c.isClosed" (click)="open(c.id)">
                <span class="presence-dot" [attr.data-status]="c.otherStatus" [title]="c.otherStatus | t"></span>
                <span class="conv-main">
                  <span class="conv-top">
                    <strong>{{ isStaff() ? c.userName : ('Umbrella support' | t) }}</strong>
                    <span class="muted small">{{ c.lastMessageAt + 'Z' | ldate: 'dayMonthTime' }}</span>
                  </span>
                  <span class="conv-subject small">{{ c.subject | t }}@if (c.isClosed) { · {{ 'Closed' | t }} }</span>
                  <span class="conv-preview muted small">@if (c.lastFromStaff) { {{ (isStaff() ? 'You:' : 'Support:') | t }} }{{ c.lastMessage }}</span>
                </span>
                @if (c.unread > 0) { <span class="count-pill">{{ c.unread }}</span> }
              </button>
            </li>
          }
        </ul>
      </section>

      <!-- open conversation, or the new-conversation form -->
      <section class="card support-thread">
        @if (composing()) {
          <button class="link-like back-link" type="button" (click)="composing.set(false)">← {{ 'Back' | t }}</button>
          <h2 class="no-rule">{{ 'New conversation' | t }}</h2>
          <form (ngSubmit)="create()" novalidate>
            <div class="field">
              <label for="sc-subject">{{ 'Subject' | t }}</label>
              <input id="sc-subject" name="subject" maxlength="120" [(ngModel)]="newSubject" [placeholder]="'For example: question about my invoice' | t" />
            </div>
            <div class="field">
              <label for="sc-message">{{ 'Message' | t }}</label>
              <textarea id="sc-message" name="message" rows="5" maxlength="2000" [(ngModel)]="newMessage"></textarea>
            </div>
            <p class="muted small">{{ 'Don\\'t use this for urgent problems. In an emergency call 112.' | t }}</p>
            <button class="btn primary" type="submit" [disabled]="busy()">{{ 'Send' | t }}</button>
          </form>
        } @else if (current(); as c) {
          <header class="thread-head">
            <button class="link-like back-link only-narrow" type="button" (click)="close()">← {{ 'Conversations' | t }}</button>
            <div class="thread-who">
              <span class="presence-dot big" [attr.data-status]="c.otherStatus"></span>
              <div>
                <strong>{{ isStaff() ? c.userName : ('Umbrella support' | t) }}</strong>
                <span class="presence-label" [attr.data-status]="c.otherStatus">
                  {{ c.otherStatus | t }}
                  @if (c.otherStatus === 'Offline' && c.otherLastSeen) { · {{ 'last seen {time}' | t: { time: (c.otherLastSeen + 'Z' | ldate: 'dayMonthTime') } }} }
                </span>
                @if (isStaff()) { <span class="muted small">{{ c.userEmail }} · {{ c.userRole | t }}</span> }
              </div>
            </div>
            <div class="thread-actions">
              <span class="chip">{{ c.subject | t }}</span>
              @if (isStaff()) {
                <button class="btn small" type="button" (click)="toggleClosed(c)">{{ (c.isClosed ? 'Reopen' : 'Close') | t }}</button>
              }
            </div>
          </header>

          <div class="thread-body" #body>
            @for (m of messages(); track m.id; let last = $last) {
              <div class="bubble-row" [class.mine]="m.fromStaff === isStaff()">
                <div class="chat-bubble">
                  <p>{{ m.body }}</p>
                  <span class="bubble-meta">
                    {{ m.sentAt + 'Z' | ldate: 'dayMonthTime' }}
                    @if (m.fromStaff === isStaff() && m.seen) { · ✓✓ {{ 'Seen' | t }} }
                  </span>
                </div>
              </div>
            }
          </div>

          @if (c.isClosed && !isStaff()) {
            <p class="muted small center">{{ 'This conversation was closed. Start a new one if you need more help.' | t }}</p>
          } @else {
            <form class="composer" (ngSubmit)="send()">
              <label for="sc-input" class="sr-only">{{ 'Message' | t }}</label>
              <textarea id="sc-input" name="text" rows="2" maxlength="2000" [placeholder]="'Write a message…' | t"
                [(ngModel)]="text" (keydown.enter)="onEnter($event)"></textarea>
              <button class="btn primary" type="submit" [disabled]="busy() || !text.trim()">{{ 'Send' | t }}</button>
            </form>
          }
        } @else {
          <div class="thread-placeholder muted">{{ 'Choose a conversation.' | t }}</div>
        }
      </section>
    </div>
  `
})
export class SupportPage {
  private readonly support = inject(SupportService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18n);
  private readonly body = viewChild<ElementRef<HTMLElement>>('body');

  protected readonly isStaff = computed(() => this.auth.hasRole('Admin'));
  protected readonly conversations = signal<SupportConversation[]>([]);
  protected readonly current = signal<SupportConversation | null>(null);
  protected readonly messages = signal<SupportMessage[]>([]);
  protected readonly openId = signal<number | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly composing = signal(false);
  protected text = '';
  protected newSubject = '';
  protected newMessage = '';

  constructor() {
    this.loadList();
    const id = Number(this.route.snapshot.queryParamMap.get('c'));
    if (id > 0) this.open(id);

    const timers = [
      setInterval(() => this.pollMessages(), MESSAGES_MS),
      setInterval(() => { this.loadList(); this.refreshCurrent(); }, LIST_MS)
    ];
    inject(DestroyRef).onDestroy(() => timers.forEach(clearInterval));
  }

  protected open(id: number): void {
    this.composing.set(false);
    this.openId.set(id);
    this.messages.set([]);
    this.error.set(null);
    void this.router.navigate([], { queryParams: { c: id }, replaceUrl: true });
    this.refreshCurrent();
    this.support.messages(id).subscribe({
      next: list => { this.messages.set(list); this.scrollDown(); this.markRead(); },
      error: err => this.error.set(apiErrorMessage(err))
    });
  }

  protected close(): void {
    this.openId.set(null);
    this.current.set(null);
    void this.router.navigate([], { queryParams: { c: null }, replaceUrl: true });
  }

  protected startNew(): void {
    this.close();
    this.composing.set(true);
  }

  protected create(): void {
    if (!this.newSubject.trim() || !this.newMessage.trim()) { this.error.set(this.i18n.t('Write a subject and a message.')); return; }
    this.busy.set(true);
    this.support.start(this.newSubject.trim(), this.newMessage.trim()).subscribe({
      next: c => { this.busy.set(false); this.newSubject = ''; this.newMessage = ''; this.loadList(); this.open(c.id); },
      error: err => { this.busy.set(false); this.error.set(apiErrorMessage(err)); }
    });
  }

  protected onEnter(event: Event): void {
    const e = event as KeyboardEvent;
    if (e.shiftKey) return;           // Shift+Enter: new line
    e.preventDefault();
    this.send();
  }

  protected send(): void {
    const id = this.openId(), body = this.text.trim();
    if (!id || !body || this.busy()) return;
    this.busy.set(true);
    this.support.send(id, body).subscribe({
      next: m => {
        this.busy.set(false);
        this.text = '';
        if (!this.messages().some(x => x.id === m.id)) this.messages.set([...this.messages(), m]);
        this.scrollDown();
        this.loadList();
      },
      error: err => { this.busy.set(false); this.error.set(apiErrorMessage(err)); }
    });
  }

  protected toggleClosed(c: SupportConversation): void {
    this.support.close(c.id, !c.isClosed).subscribe({ next: updated => { this.current.set(updated); this.loadList(); } });
  }

  private loadList(): void {
    this.support.conversations().subscribe({
      next: list => { this.conversations.set(list); this.loading.set(false); },
      error: err => { this.loading.set(false); this.error.set(apiErrorMessage(err)); }
    });
  }

  private refreshCurrent(): void {
    const id = this.openId();
    if (id) this.support.conversation(id).subscribe({ next: c => this.current.set(c), error: () => { /* keep */ } });
  }

  /** New messages since the last one shown. */
  private pollMessages(): void {
    const id = this.openId();
    if (!id || document.hidden) return;
    const last = this.messages().at(-1)?.id ?? 0;
    this.support.messages(id, last).subscribe({
      next: fresh => {
        if (fresh.length === 0) return;
        const known = new Set(this.messages().map(m => m.id));
        this.messages.set([...this.messages(), ...fresh.filter(m => !known.has(m.id))]);
        this.scrollDown();
        this.markRead();
      }
    });
    // "Seen" ticks on my messages change when the other side reads them.
    if (this.messages().some(m => m.fromStaff === this.isStaff() && !m.seen)) {
      this.support.messages(id).subscribe({ next: all => { if (all.length >= this.messages().length) this.messages.set(all); } });
    }
  }

  private markRead(): void {
    const id = this.openId();
    if (id && !document.hidden) this.support.markRead(id).subscribe({ next: () => this.loadList() });
  }

  private scrollDown(): void {
    setTimeout(() => { const el = this.body()?.nativeElement; if (el) el.scrollTop = el.scrollHeight; });
  }
}
