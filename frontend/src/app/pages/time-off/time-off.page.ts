import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { StaffApi } from '../../core/staff.api';
import { AuthService } from '../../core/auth.service';
import { ConflictingAppointment, PagedResult, TimeOff, TimeOffStatus, TimeOffType } from '../../core/model';
import { apiErrorMessage } from '../../core/api-error';
import { orNull, splitWords, toDateInput } from '../../core/util';
import { I18n, LocalDatePipe, TranslatePipe } from '../../core/i18n';
import { Pager } from '../../shared/pager';

type Mode = 'approve' | 'decline';

@Component({
  selector: 'app-time-off',
  imports: [LocalDatePipe, TranslatePipe, FormsModule, Pager],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <h1>{{ 'Time off' | t }}</h1>
      @if (isDoctor() && !requesting()) {
        <button class="btn primary" type="button" (click)="startRequest()">{{ 'Request time off' | t }}</button>
      }
    </div>

    @if (message()) { <p class="alert success" role="status">{{ message() }}</p> }
    @if (error()) { <p class="alert error" role="alert">{{ error() }}</p> }

    @if (requesting()) {
      <form class="card form-card" (ngSubmit)="request()">
        <h3>{{ 'Request time off' | t }}</h3>
        <div class="form-grid">
          <div class="field">
            <label for="to-type">{{ 'Type' | t }}</label>
            <select id="to-type" name="type" [(ngModel)]="form.type">
              <option value="Vacation">{{ 'Vacation' | t }}</option>
              <option value="SickLeave">{{ 'Sick leave' | t }}</option>
              <option value="DayOff">{{ 'Day off' | t }}</option>
              <option value="Conference">{{ 'Conference' | t }}</option>
            </select>
          </div>
          <div></div>
          <div class="field"><label for="to-from">{{ 'From' | t }}</label><input id="to-from" name="from" type="datetime-local" [(ngModel)]="form.start" /></div>
          <div class="field"><label for="to-to">{{ 'To' | t }}</label><input id="to-to" name="to" type="datetime-local" [(ngModel)]="form.end" /></div>
        </div>
        <div class="field">
          <label for="to-reason">{{ 'Reason (optional)' | t }}</label>
          <textarea id="to-reason" name="reason" rows="2" maxlength="500" [(ngModel)]="form.reason"></textarea>
        </div>
        <p class="muted">{{ 'An admin reviews the request. Patients booked in this period will be told if their visit has to move.' | t }}</p>
        <div class="card-actions">
          <button class="btn primary" type="submit" [disabled]="busy()">{{ 'Send request' | t }}</button>
          <button class="btn" type="button" (click)="requesting.set(false)">{{ 'Cancel' | t }}</button>
        </div>
      </form>
    }

    <div class="tabs" role="tablist">
      @for (s of filters; track s.label) {
        <button type="button" role="tab" [class.active]="status() === s.value" [attr.aria-selected]="status() === s.value" (click)="status.set(s.value); page.set(1); load()">{{ s.label | t }}</button>
      }
    </div>

    @if (loading() && !result()) { <p class="muted">{{ 'Loading...' | t }}</p> }

    @if (result(); as data) {
      @if (data.items.length === 0) {
        <p class="empty card muted">{{ 'No requests.' | t }}</p>
      }
      <ul class="stack" [class.dim]="loading()">
        @for (t of data.items; track t.id) {
          <li class="card">
            <div class="row-head">
              <div>
                <h3>
                  {{ words(t.type) | t }}
                  @if (!isDoctor()) { {{ '· Dr. {p0}' | t: { p0: (t.doctorName) } }} <span class="muted">({{ t.specialization | t }})</span> }
                </h3>
                <p>{{ t.startDateTime | ldate: 'weekdayMediumTime' }} → {{ t.endDateTime | ldate: 'weekdayMediumTime' }}</p>
                @if (t.reason) { <p class="muted">“{{ t.reason }}”</p> }
                @if (t.declineReason) { <p><span class="muted">{{ 'Declined:' | t }}</span> {{ t.declineReason }}</p> }
                @if (t.status === 'Pending' && t.conflictingAppointments > 0) {
                  <p class="warn-text">{{ '{p0} booked visit(s) fall in this period.' | t: { p0: (t.conflictingAppointments) } }}</p>
                }
              </div>
              <span [class]="'badge to-' + t.status.toLowerCase()">{{ t.status | t }}</span>
            </div>

            @if (t.status === 'Pending' && openId() !== t.id) {
              <div class="card-actions">
                @if (isAdmin()) {
                  <button class="btn small primary" type="button" (click)="open(t, 'approve')">{{ 'Approve…' | t }}</button>
                  <button class="btn small danger" type="button" (click)="open(t, 'decline')">{{ 'Decline…' | t }}</button>
                }
                @if (isDoctor()) {
                  <button class="btn small danger" type="button" (click)="withdraw(t)" [disabled]="busy()">{{ 'Withdraw' | t }}</button>
                }
              </div>
            }

            @if (openId() === t.id && mode() === 'approve') {
              <div class="inline-panel">
                @if (conflicts() === null) {
                  <p class="muted">{{ 'Checking booked visits…' | t }}</p>
                } @else if (conflicts()!.length === 0) {
                  <p>{{ 'No booked visits in this period.' | t }}</p>
                } @else {
                  <p><strong>{{ 'Booked visits in this period:' | t }}</strong></p>
                  <ul>
                    @for (c of conflicts(); track c.id) {
                      <li>{{ c.startDateTime | ldate: 'dayMonthTime' }} · {{ c.patientName }} · {{ c.serviceName }}</li>
                    }
                  </ul>
                  <label class="check"><input type="checkbox" [(ngModel)]="cancelConflicts" /> {{ 'Cancel these visits and notify the patients' | t }}</label>
                }
                <div class="card-actions">
                  <button class="btn small primary" type="button" (click)="approve(t)" [disabled]="busy() || conflicts() === null">{{ 'Approve' | t }}</button>
                  <button class="btn small" type="button" (click)="openId.set(null)">{{ 'Back' | t }}</button>
                </div>
              </div>
            }

            @if (openId() === t.id && mode() === 'decline') {
              <div class="inline-panel">
                <div class="field">
                  <label [for]="'decline-' + t.id">{{ 'Reason (required)' | t }}</label>
                  <textarea [id]="'decline-' + t.id" rows="2" maxlength="500" [(ngModel)]="declineReason"></textarea>
                </div>
                <div class="card-actions">
                  <button class="btn small danger" type="button" (click)="decline(t)" [disabled]="busy() || declineReason.trim().length < 3">{{ 'Decline' | t }}</button>
                  <button class="btn small" type="button" (click)="openId.set(null)">{{ 'Back' | t }}</button>
                </div>
              </div>
            }
          </li>
        }
      </ul>
      <app-pager [page]="page()" [pageSize]="pageSize" [totalCount]="data.totalCount" [disabled]="loading()" (pageChange)="page.set($event); load()" />
    }
  `
})
export class TimeOffPage {
  protected readonly i18n = inject(I18n);
  private readonly api = inject(StaffApi);
  private readonly auth = inject(AuthService);

  protected readonly words = splitWords;
  protected readonly isDoctor = computed(() => this.auth.hasRole('Doctor'));
  protected readonly isAdmin = computed(() => this.auth.hasRole('Admin'));
  protected readonly filters: { label: string; value: TimeOffStatus | null }[] = [
    { label: 'Pending', value: 'Pending' },
    { label: 'Approved', value: 'Approved' },
    { label: 'Declined', value: 'Declined' },
    { label: 'All', value: null }
  ];

  protected readonly pageSize = 15;
  protected readonly page = signal(1);
  protected readonly status = signal<TimeOffStatus | null>(this.isAdmin() ? 'Pending' : null);
  protected readonly result = signal<PagedResult<TimeOff> | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);
  protected readonly requesting = signal(false);
  protected readonly openId = signal<number | null>(null);
  protected readonly mode = signal<Mode>('approve');
  protected readonly conflicts = signal<ConflictingAppointment[] | null>(null);

  protected form = { type: 'Vacation' as TimeOffType, start: '', end: '', reason: '' };
  protected cancelConflicts = false;
  protected declineReason = '';

  constructor() {
    this.load();
  }

  protected startRequest(): void {
    const tomorrow = toDateInput(new Date(Date.now() + 86_400_000));
    this.form = { type: 'Vacation', start: `${tomorrow}T00:00`, end: `${tomorrow}T23:59`, reason: '' };
    this.message.set(null);
    this.error.set(null);
    this.requesting.set(true);
  }

  protected request(): void {
    if (!this.form.start || !this.form.end || this.form.start >= this.form.end) {
      this.error.set(this.i18n.t('The start must be before the end.'));
      return;
    }
    this.run(this.api.requestTimeOff({
      type: this.form.type,
      startDateTime: `${this.form.start}:00`,
      endDateTime: `${this.form.end}:00`,
      reason: orNull(this.form.reason)
    }), 'Your request was sent.', () => this.requesting.set(false));
  }

  protected open(t: TimeOff, mode: Mode): void {
    this.openId.set(t.id);
    this.mode.set(mode);
    this.declineReason = '';
    this.cancelConflicts = false;
    this.message.set(null);
    this.error.set(null);
    if (mode === 'approve') {
      this.conflicts.set(null);
      this.api.conflicts(t.id).subscribe({
        next: list => this.conflicts.set(list),
        error: err => {
          this.conflicts.set([]);
          this.error.set(apiErrorMessage(err));
        }
      });
    }
  }

  protected approve(t: TimeOff): void {
    this.run(this.api.approveTimeOff(t.id, this.cancelConflicts), 'The request was approved.');
  }

  protected decline(t: TimeOff): void {
    this.run(this.api.declineTimeOff(t.id, this.declineReason.trim()), 'The request was declined.');
  }

  protected withdraw(t: TimeOff): void {
    this.run(this.api.withdrawTimeOff(t.id), 'The request was withdrawn.');
  }

  private run(request: Observable<unknown>, success: string, after?: () => void): void {
    this.busy.set(true);
    this.error.set(null);
    request.subscribe({
      next: () => {
        this.busy.set(false);
        this.openId.set(null);
        this.message.set(success);
        after?.();
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
    this.api.timeOff({ status: this.status(), page: this.page(), pageSize: this.pageSize }).subscribe({
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
