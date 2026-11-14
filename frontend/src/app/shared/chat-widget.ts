import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { ChatMessage } from '../core/model';
import { apiErrorMessage } from '../core/api-error';
import { Logo } from './logo';

const STORAGE_KEY = 'umbrella.chat';
const MAX_LENGTH = 2000;

const SUGGESTIONS = [
  'How do I book a visit?',
  'Which doctors treat skin problems?',
  'How much does an eye examination cost?',
  'Can I cancel and get a refund?'
];

type Segment = { text: string; link?: string };

/** Floating help chat answered by the AI assistant. */
@Component({
  selector: 'app-chat-widget',
  imports: [RouterLink, Logo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <section class="chat-panel" role="dialog" aria-label="Umbrella Assistant chat">
        <header class="chat-head">
          <app-logo [size]="30" />
          <div class="chat-title">
            <strong>Umbrella Assistant</strong>
            <span class="ai-badge" [title]="mode() === 'ai' ? 'Answers are written by AI' : 'Automatic answers from our help centre'">{{ mode() === 'ai' ? 'AI' : 'AUTO' }}</span>
          </div>
          @if (messages().length > 0) {
            <button class="chat-icon-btn" type="button" (click)="reset()" title="Start a new conversation" aria-label="Start a new conversation">⟲</button>
          }
          <button class="chat-icon-btn" type="button" (click)="open.set(false)" aria-label="Close chat">✕</button>
        </header>

        <div #scroller class="chat-body" aria-live="polite">
          <div class="bubble bot">
            Hi! I'm the Umbrella Assistant{{ mode() === 'ai' ? ', an AI helper' : ', an automated helper' }}.
            Ask me about our doctors, services, prices, booking, payments or how to use this site.
          </div>

          @if (messages().length === 0 && available() !== false) {
            <div class="chips">
              @for (s of suggestions; track s) {
                <button type="button" class="chip-btn" (click)="send(s)" [disabled]="sending()">{{ s }}</button>
              }
            </div>
          }

          @for (m of rendered(); track $index; let last = $last) {
            <div class="bubble" [class.user]="m.role === 'user'" [class.bot]="m.role === 'assistant'">
              @for (seg of m.segments; track $index) {
                @if (seg.link) {
                  <a [routerLink]="seg.link">{{ seg.text }}</a>
                } @else {
                  <span>{{ seg.text }}</span>
                }
              }
            </div>
            @if (last && m.suggestions.length > 0 && !sending()) {
              <div class="chips">
                @for (s of m.suggestions; track s) {
                  <button type="button" class="chip-btn" (click)="send(s)">{{ s }}</button>
                }
              </div>
            }
          }

          @if (sending()) {
            <div class="bubble bot typing" aria-label="The assistant is typing"><span></span><span></span><span></span></div>
          }

          @if (available() === false) {
            <p class="chat-note">The assistant isn't available right now. Please contact the reception desk.</p>
          }
          @if (error()) {
            <p class="chat-note error" role="alert">
              {{ error() }}
              <button type="button" class="link-like" (click)="retry()">Try again</button>
            </p>
          }
        </div>

        <form class="chat-input" (submit)="$event.preventDefault(); send(draft())">
          <label for="chat-text" class="sr-only">Your question</label>
          <textarea
            #input
            id="chat-text"
            rows="1"
            placeholder="Type your question..."
            [maxLength]="maxLength"
            [value]="draft()"
            [disabled]="available() === false"
            (input)="draft.set($any($event.target).value)"
            (keydown.enter)="onEnter($any($event))"></textarea>
          <button class="btn primary small" type="submit" [disabled]="!draft().trim() || sending() || available() === false" aria-label="Send">➤</button>
        </form>
        <p class="chat-disclaimer">
          {{ mode() === 'ai' ? 'AI answers can be wrong and are not medical advice.' : 'Automatic answers, not medical advice.' }}
          In an emergency call 112.
        </p>
      </section>
    }

    <button class="chat-launcher" type="button" [class.hidden]="open()" (click)="openChat()" aria-label="Open the help chat">
      <span aria-hidden="true">💬</span> Ask us
    </button>
  `
})
export class ChatWidget {
  private readonly http = inject(HttpClient);
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private readonly input = viewChild<ElementRef<HTMLTextAreaElement>>('input');

  protected readonly suggestions = SUGGESTIONS;
  protected readonly maxLength = MAX_LENGTH;
  protected readonly open = signal(false);
  protected readonly messages = signal<ChatMessage[]>(this.restore());
  protected readonly draft = signal('');
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly available = signal<boolean | null>(null);
  protected readonly mode = signal<'ai' | 'faq'>('faq');

  protected readonly rendered = computed(() =>
    this.messages().map(m => ({
      role: m.role,
      segments: m.role === 'assistant' ? linkify(m.content) : [{ text: m.content }],
      suggestions: m.suggestions ?? []
    })));

  protected openChat(): void {
    this.open.set(true);
    if (this.available() === null) {
      this.http.get<{ available: boolean; mode: 'ai' | 'faq' }>('/api/chat/status').subscribe({
        next: s => {
          this.available.set(s.available);
          this.mode.set(s.mode);
        },
        error: () => this.available.set(false)
      });
    }
    this.afterRender(() => this.input()?.nativeElement.focus());
  }

  protected onEnter(event: KeyboardEvent): void {
    if (event.shiftKey) return;
    event.preventDefault();
    this.send(this.draft());
  }

  protected send(text: string): void {
    const content = text.trim().slice(0, MAX_LENGTH);
    if (!content || this.sending()) return;

    this.draft.set('');
    this.error.set(null);
    this.messages.set([...this.messages(), { role: 'user', content }]);
    this.ask();
  }

  protected retry(): void {
    this.error.set(null);
    this.ask();
  }

  protected reset(): void {
    this.messages.set([]);
    this.error.set(null);
    this.save();
  }

  private ask(): void {
    this.sending.set(true);
    this.save();
    this.scrollToEnd();

    // Only role and text go to the server; suggestion buttons stay in the browser.
    const history = this.messages().map(m => ({ role: m.role, content: m.content }));
    this.http.post<{ reply: string; suggestions: string[] }>('/api/chat', { messages: history }).subscribe({
      next: r => {
        this.sending.set(false);
        this.messages.set([...this.messages(), { role: 'assistant', content: r.reply, suggestions: r.suggestions ?? [] }]);
        this.save();
        this.scrollToEnd();
      },
      error: err => {
        this.sending.set(false);
        this.error.set(apiErrorMessage(err));
        this.scrollToEnd();
      }
    });
  }

  private scrollToEnd(): void {
    this.afterRender(() => {
      const el = this.scroller()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  private afterRender(fn: () => void): void {
    setTimeout(fn);
  }

  // The conversation survives page changes and reloads for this browser tab only.
  private save(): void {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.messages().slice(-40)));
    } catch { /* storage may be unavailable */ }
  }

  private restore(): ChatMessage[] {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as ChatMessage[]) : [];
      // Drop a trailing unanswered question so the next send keeps user/assistant turns alternating.
      while (parsed.length > 0 && parsed[parsed.length - 1].role === 'user') parsed.pop();
      return parsed.filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string');
    } catch {
      return [];
    }
  }
}

/** Turns site paths such as (/doctors/12) in the assistant's reply into in-app links. */
function linkify(text: string): Segment[] {
  const pattern = /\(?(\/(?:doctors|appointments|health|invoices|account|notifications|register|login|forgot-password)(?:\/\d+)?)\)?/g;
  const segments: Segment[] = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) segments.push({ text: text.slice(last, index) });
    segments.push({ text: pageName(match[1]), link: match[1] });
    last = index + match[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last) });
  return segments;
}

function pageName(path: string): string {
  const names: Record<string, string> = {
    '/doctors': 'Doctors page', '/appointments': 'My appointments', '/health': 'My health', '/invoices': 'My bills',
    '/account': 'My profile', '/notifications': 'Notifications', '/register': 'Register', '/login': 'Log in',
    '/forgot-password': 'Reset password'
  };
  return names[path] ?? (path.startsWith('/doctors/') ? 'profile' : path);
}
