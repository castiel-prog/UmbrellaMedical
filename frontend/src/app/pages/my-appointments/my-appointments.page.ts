import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { AppointmentsApi } from '../../core/appointments.api';
import { Appointment, PagedResult } from '../../core/model';
import { apiErrorMessage } from '../../core/api-error';
import { toDateInput } from '../../core/util';
import { SlotPicker } from '../../shared/slot-picker';

type Tab = 'upcoming' | 'history';
type Mode = 'cancel' | 'reschedule' | 'review';

@Component({
  selector: 'app-my-appointments',
  imports: [FormsModule, RouterLink, DatePipe, CurrencyPipe, SlotPicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <h1>My appointments</h1>
      <a class="btn primary" routerLink="/doctors">Book a new visit</a>
    </div>

    <div class="tabs" role="tablist">
      <button type="button" role="tab" [class.active]="tab() === 'upcoming'" [attr.aria-selected]="tab() === 'upcoming'" (click)="switchTab('upcoming')">Upcoming</button>
      <button type="button" role="tab" [class.active]="tab() === 'history'" [attr.aria-selected]="tab() === 'history'" (click)="switchTab('history')">History</button>
    </div>

    @if (message()) {
      <p class="alert success" role="status">{{ message() }}</p>
    }
    @if (error()) {
      <p class="alert error" role="alert">{{ error() }}</p>
    }

    @if (loading() && !result()) {
      <p class="muted">Loading...</p>
    }

    @if (result(); as data) {
      @if (items().length === 0) {
        <div class="empty card">
          <p>{{ tab() === 'upcoming' ? 'You have no upcoming visits.' : 'No past visits yet.' }}</p>
          <a class="btn primary small" routerLink="/doctors">Find a doctor</a>
        </div>
      }

      <ul class="appt-list" [class.dim]="loading()">
        @for (a of items(); track a.id) {
          <li class="card appt">
            <div class="appt-date">
              <strong>{{ a.startDateTime | date: 'd' }}</strong>
              <span>{{ a.startDateTime | date: 'MMM' }}</span>
              <small>{{ a.startDateTime | date: 'HH:mm' }}</small>
            </div>

            <div class="appt-body">
              <div class="appt-title">
                <h3>{{ a.serviceName }}</h3>
                <span [class]="'badge status-' + a.status.toLowerCase()">{{ statusLabel(a.status) }}</span>
              </div>
              <p>
                <a [routerLink]="['/doctors', a.doctorId]">Dr. {{ a.doctorName }}</a>
                · <span class="muted">{{ a.specialization }}</span>
              </p>
              <p class="muted">
                {{ a.startDateTime | date: 'EEEE, d MMMM y' }}, {{ a.startDateTime | date: 'HH:mm' }}–{{ a.endDateTime | date: 'HH:mm' }}
                · {{ a.price | currency: 'GEL' : 'symbol-narrow' }}
              </p>
              @if (a.reason) {
                <p><span class="muted">Reason:</span> {{ a.reason }}</p>
              }
              @if (a.status === 'Cancelled' && a.cancellationReason) {
                <p><span class="muted">Cancelled:</span> {{ a.cancellationReason }}</p>
              }

              @if (a.status === 'Scheduled' && !isOpen(a.id)) {
                <div class="card-actions">
                  <button class="btn small" type="button" (click)="open(a.id, 'reschedule')">Reschedule</button>
                  <button class="btn small danger" type="button" (click)="open(a.id, 'cancel')">Cancel</button>
                </div>
              }
              @if (a.status === 'Completed' && !isOpen(a.id) && !reviewed().has(a.id)) {
                <div class="card-actions">
                  <button class="btn small primary" type="button" (click)="open(a.id, 'review')">Rate this visit</button>
                </div>
              }
              @if (reviewed().has(a.id)) {
                <p class="muted">Thank you for your review.</p>
              }

              @if (isOpen(a.id, 'cancel')) {
                <div class="inline-panel">
                  <div class="field">
                    <label [for]="'cancel-' + a.id">Why are you cancelling? (optional)</label>
                    <textarea [id]="'cancel-' + a.id" rows="2" maxlength="500" [(ngModel)]="cancelReason"></textarea>
                  </div>
                  <div class="card-actions">
                    <button class="btn small danger" type="button" (click)="cancel(a)" [disabled]="busy()">Yes, cancel the visit</button>
                    <button class="btn small" type="button" (click)="close()">Keep it</button>
                  </div>
                </div>
              }

              @if (isOpen(a.id, 'reschedule')) {
                <div class="inline-panel">
                  <app-slot-picker [doctorId]="a.doctorId" [serviceId]="a.serviceId" (picked)="newStart.set($event)" />
                  <div class="card-actions">
                    <button class="btn small primary" type="button" (click)="reschedule(a)" [disabled]="!newStart() || busy()">Move the visit</button>
                    <button class="btn small" type="button" (click)="close()">Back</button>
                  </div>
                </div>
              }

              @if (isOpen(a.id, 'review')) {
                <div class="inline-panel">
                  <div class="rate" role="radiogroup" aria-label="Rating">
                    @for (n of [1, 2, 3, 4, 5]; track n) {
                      <button
                        type="button"
                        class="rate-star"
                        [class.on]="n <= rating()"
                        [attr.aria-label]="n + ' stars'"
                        (click)="rating.set(n)">★</button>
                    }
                  </div>
                  <div class="field">
                    <label [for]="'review-' + a.id">Comment (optional)</label>
                    <textarea [id]="'review-' + a.id" rows="3" maxlength="1000" [(ngModel)]="reviewComment"></textarea>
                  </div>
                  <div class="card-actions">
                    <button class="btn small primary" type="button" (click)="review(a)" [disabled]="rating() === 0 || busy()">Send review</button>
                    <button class="btn small" type="button" (click)="close()">Back</button>
                  </div>
                </div>
              }
            </div>
          </li>
        }
      </ul>

      @if (totalPages() > 1) {
        <nav class="pager" aria-label="Pages">
          <button class="btn small" type="button" (click)="goToPage(page() - 1)" [disabled]="page() <= 1 || loading()">Previous</button>
          <span>Page {{ page() }} of {{ totalPages() }}</span>
          <button class="btn small" type="button" (click)="goToPage(page() + 1)" [disabled]="page() >= totalPages() || loading()">Next</button>
        </nav>
      }
    }
  `
})
export class MyAppointmentsPage {
  private readonly api = inject(AppointmentsApi);
  private readonly pageSize = 10;

  protected readonly tab = signal<Tab>('upcoming');
  protected readonly page = signal(1);
  protected readonly result = signal<PagedResult<Appointment> | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);

  protected readonly openState = signal<{ id: number; mode: Mode } | null>(null);
  protected readonly newStart = signal<string | null>(null);
  protected readonly rating = signal(0);
  protected readonly reviewed = signal(new Set<number>());
  protected cancelReason = '';
  protected reviewComment = '';

  protected readonly items = computed(() => {
    const list = this.result()?.items ?? [];
    return this.tab() === 'history' ? [...list].reverse() : list;
  });

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil((this.result()?.totalCount ?? 0) / this.pageSize)));

  constructor() {
    this.load();
  }

  protected switchTab(tab: Tab): void {
    this.tab.set(tab);
    this.page.set(1);
    this.result.set(null);
    this.message.set(null);
    this.close();
    this.load();
  }

  protected goToPage(page: number): void {
    this.page.set(page);
    this.load();
  }

  protected statusLabel(status: string): string {
    return status === 'NoShow' ? 'Missed' : status;
  }

  protected isOpen(id: number, mode?: Mode): boolean {
    const state = this.openState();
    return state !== null && state.id === id && (mode === undefined || state.mode === mode);
  }

  protected open(id: number, mode: Mode): void {
    this.openState.set({ id, mode });
    this.newStart.set(null);
    this.rating.set(0);
    this.cancelReason = '';
    this.reviewComment = '';
    this.error.set(null);
    this.message.set(null);
  }

  protected close(): void {
    this.openState.set(null);
  }

  protected cancel(a: Appointment): void {
    this.run(this.api.cancel(a.id, this.cancelReason.trim() || null), 'The visit was cancelled.');
  }

  protected reschedule(a: Appointment): void {
    const start = this.newStart();
    if (!start) return;
    this.run(this.api.reschedule(a.id, start), 'The visit was moved to the new time.');
  }

  protected review(a: Appointment): void {
    this.busy.set(true);
    this.api.review(a.doctorId, a.id, this.rating(), this.reviewComment.trim() || null).subscribe({
      next: () => {
        this.busy.set(false);
        this.reviewed.update(set => new Set(set).add(a.id));
        this.close();
        this.message.set('Thank you! Your review was published.');
      },
      error: err => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(err));
      }
    });
  }

  private run(request: Observable<unknown>, success: string): void {
    this.busy.set(true);
    this.error.set(null);
    request.subscribe({
      next: () => {
        this.busy.set(false);
        this.close();
        this.message.set(success);
        this.load();
      },
      error: err => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(err));
      }
    });
  }

  private load(): void {
    this.loading.set(true);
    const today = toDateInput(new Date());
    const query = this.tab() === 'upcoming'
      ? { status: 'Scheduled' as const, from: today }
      : { to: today };

    this.api.list({ ...query, page: this.page(), pageSize: this.pageSize }).subscribe({
      next: data => {
        this.result.set(data);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(apiErrorMessage(err));
        this.loading.set(false);
      }
    });
  }
}