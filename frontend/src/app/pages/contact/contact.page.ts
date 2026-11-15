import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ProfileService } from '../../core/profile.service';
import { apiErrorMessage } from '../../core/api-error';
import { PHONE_PATTERN } from '../../core/util';
import { ALWAYS_OPEN, CLINIC, OPENING_HOURS, hhmm, openStatus } from '../../core/clinic';
import { I18n, TranslatePipe } from '../../core/i18n';
import { Icon } from '../../shared/icon';

const TOPICS = ['Appointments', 'Billing and payments', 'Prescriptions', 'Store orders', 'Feedback', 'Other'];

/** Contact details, live opening hours, a map and a contact form that reaches the front desk. */
@Component({
  selector: 'app-contact',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <div>
        <p class="eyebrow">{{ 'Contact' | t }}</p>
        <h1>{{ 'We are here to help' | t }}</h1>
        <p class="muted">{{ 'Call us, visit us or send a message. The front desk replies within one working day.' | t }}</p>
      </div>
    </div>

    <div class="contact-grid">
      <div class="contact-side">
        <section class="card contact-card">
          <ul class="contact-list">
            <li>
              <span class="contact-icon"><app-icon name="pin" [size]="20" /></span>
              <div><strong>{{ 'Address' | t }}</strong><span>{{ clinic.address }}</span><span>{{ clinic.city | t }}</span>
                <a [href]="clinic.mapLink" target="_blank" rel="noopener">{{ 'Open in maps' | t }} ↗</a></div>
            </li>
            <li>
              <span class="contact-icon"><app-icon name="phone" [size]="20" /></span>
              <div><strong>{{ 'Front desk' | t }}</strong><a [href]="'tel:' + clinic.phoneHref">{{ clinic.phone }}</a>
                <span class="muted small">{{ (alwaysOpen ? 'Around the clock, every day' : 'During opening hours') | t }}</span></div>
            </li>
            <li class="emergency">
              <span class="contact-icon"><app-icon name="heart" [size]="20" /></span>
              <div><strong>{{ 'Emergency' | t }}</strong><a href="tel:112">112</a>
                <span class="muted small">{{ 'Online booking and this form are not for emergencies.' | t }}</span></div>
            </li>
          </ul>
        </section>

        <section class="card hours-card">
          <div class="hours-head">
            <h2 class="no-rule">{{ 'Opening hours' | t }}</h2>
            <span class="open-badge" [class.open]="alwaysOpen || status.open">
              <span class="status-dot"></span>{{ (alwaysOpen ? 'Open 24/7' : status.open ? 'Open now' : 'Closed now') | t }}
            </span>
          </div>
          <table class="hours-table">
            <tbody>
              @for (row of hours(); track row.day) {
                <tr [class.today]="row.today">
                  <th scope="row">{{ row.name }}</th>
                  <td>{{ row.text }}</td>
                </tr>
              }
            </tbody>
          </table>
          <p class="muted small">{{ (alwaysOpen ? 'Open every day, including weekends and public holidays. Each doctor sets their own visit hours.' : 'Times are Tbilisi time (GMT+4). Online booking is open 24/7.') | t }}</p>
        </section>
      </div>

      <section class="card contact-form-card">
        <h2 class="no-rule">{{ 'Send us a message' | t }}</h2>
        @if (sent()) {
          <div class="sent-box" role="status">
            <span class="sent-icon"><app-icon name="check" [size]="30" /></span>
            <strong>{{ 'Thank you! Your message was sent.' | t }}</strong>
            <p class="muted">{{ 'We will reply within one working day. A confirmation is on its way to your email.' | t }}</p>
            <button class="btn" type="button" (click)="newMessage()">{{ 'Send another message' | t }}</button>
          </div>
        } @else {
          @if (error()) { <p class="alert error" role="alert">{{ error() | t }}</p> }
          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <div class="form-grid">
              <div class="field">
                <label for="ct-name">{{ 'Your name' | t }}</label>
                <input id="ct-name" formControlName="name" autocomplete="name" maxlength="100" />
                @if (invalid('name')) { <p class="field-error">{{ 'Please enter your name.' | t }}</p> }
              </div>
              <div class="field">
                <label for="ct-topic">{{ 'Topic' | t }}</label>
                <select id="ct-topic" formControlName="topic">
                  @for (topic of topics; track topic) { <option [value]="topic">{{ topic | t }}</option> }
                </select>
              </div>
            </div>
            <div class="form-grid">
              <div class="field">
                <label for="ct-email">{{ 'Email' | t }}</label>
                <input id="ct-email" type="email" formControlName="email" autocomplete="email" maxlength="256" />
                @if (invalid('email')) { <p class="field-error">{{ 'Enter a valid email address.' | t }}</p> }
              </div>
              <div class="field">
                <label for="ct-phone">{{ 'Phone' | t }}</label>
                <input id="ct-phone" type="tel" formControlName="phone" autocomplete="tel" maxlength="30" placeholder="+995 5XX XX XX XX" />
                @if (invalid('phone')) { <p class="field-error">{{ 'Enter a valid phone number, for example +995 555 12 34 56.' | t }}</p> }
              </div>
            </div>
            <div class="field">
              <label for="ct-message">{{ 'Message' | t }}</label>
              <textarea id="ct-message" rows="6" formControlName="message" maxlength="2000"
                [placeholder]="'How can we help? Please do not include sensitive medical details.' | t"></textarea>
              <div class="field-foot">
                @if (invalid('message')) { <p class="field-error">{{ 'Please write at least 10 characters.' | t }}</p> } @else { <span></span> }
                <span class="muted small">{{ form.controls.message.value.length }}/2000</span>
              </div>
            </div>
            <button class="btn primary block" type="submit" [disabled]="busy()">
              <app-icon name="send" [size]="18" /> {{ (busy() ? 'Sending...' : 'Send message') | t }}
            </button>
            <p class="muted small center">{{ 'Patients with an account can also manage visits under' | t }} <a routerLink="/appointments">{{ 'My appointments' | t }}</a>.</p>
          </form>
        }
      </section>
    </div>

    <section class="card map-card">
      <iframe [src]="mapUrl" [title]="'Map showing the clinic location' | t" loading="lazy" referrerpolicy="no-referrer"></iframe>
    </section>
  `
})
export class ContactPage {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  private readonly i18n = inject(I18n);
  private readonly auth = inject(AuthService);
  private readonly profile = inject(ProfileService);

  protected readonly clinic = CLINIC;
  protected readonly alwaysOpen = ALWAYS_OPEN;
  protected readonly topics = TOPICS;
  protected readonly status = openStatus();
  protected readonly mapUrl = inject(DomSanitizer).bypassSecurityTrustResourceUrl(CLINIC.mapUrl);
  protected readonly busy = signal(false);
  protected readonly sent = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    name: [this.profile.me()?.displayName ?? '', [Validators.required, Validators.maxLength(100)]],
    email: [this.auth.email() ?? '', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.pattern(PHONE_PATTERN)]],
    topic: ['Appointments', Validators.required],
    message: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(2000)]]
  });

  /** Weekly hours starting Monday, in the chosen language, with today highlighted. */
  protected readonly hours = computed(() => {
    const names = new Intl.DateTimeFormat(this.i18n.locale(), { weekday: 'long' });
    const today = new Date().getDay();
    return [1, 2, 3, 4, 5, 6, 0].map(day => {
      const h = OPENING_HOURS[day];
      const name = names.format(new Date(2023, 0, 1 + day));
      return {
        day, today: day === today,
        name: name.charAt(0).toLocaleUpperCase() + name.slice(1),
        text: !h ? this.i18n.t('Closed') : h.open === 0 && h.close === 24 * 60 ? this.i18n.t('Open 24 hours') : `${hhmm(h.open)} – ${hhmm(h.close)}`
      };
    });
  });

  protected invalid(name: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || c.dirty);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    const v = this.form.getRawValue();
    this.http.post('/api/contact', { ...v, name: v.name.trim(), email: v.email.trim(), phone: v.phone.trim(), message: v.message.trim() }).subscribe({
      next: () => {
        this.busy.set(false);
        this.sent.set(true);
      },
      error: err => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(err));
      }
    });
  }

  protected newMessage(): void {
    this.form.controls.message.reset('');
    this.sent.set(false);
  }
}
