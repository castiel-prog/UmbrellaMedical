import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StaffApi } from '../../core/staff.api';
import { AuthService } from '../../core/auth.service';
import { DoctorScheduleOverview } from '../../core/model';
import { apiErrorMessage } from '../../core/api-error';
import { LocalDatePipe, TranslatePipe } from '../../core/i18n';
import { addDays, toDateInput } from '../../core/util';

/** Week grid of every doctor's shifts, leave and booked visits. */
@Component({
  selector: 'app-staff-schedule',
  imports: [LocalDatePipe, TranslatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <h1>{{ 'Staff schedule' | t }}</h1>
      <div class="card-actions tight">
        <button class="btn small" type="button" (click)="shift(-7)">{{ '← Previous week' | t }}</button>
        <button class="btn small" type="button" (click)="thisWeek()">{{ 'This week' | t }}</button>
        <button class="btn small" type="button" (click)="shift(7)">{{ 'Next week →' | t }}</button>
      </div>
    </div>
    <p class="muted">{{ start() | ldate: 'dayMonth' }} – {{ end() | ldate: 'medium' }}</p>

    @if (error()) { <p class="alert error" role="alert">{{ error() }}</p> }

    @if (loading()) {
      <p class="muted">{{ 'Loading...' | t }}</p>
    } @else if (rows().length === 0) {
      <p class="empty card muted">{{ 'No doctors.' | t }}</p>
    } @else {
      <div class="table-wrap">
        <table class="table schedule-table">
          <thead>
            <tr>
              <th>{{ 'Doctor' | t }}</th>
              @for (d of rows()[0].days; track d.date) {
                <th>{{ d.date | ldate: 'weekdayDay' }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (r of rows(); track r.doctorId) {
              <tr>
                <td>
                  <strong>{{ 'Dr. {p0}' | t: { p0: (r.doctorName) } }}</strong><br />
                  <span class="muted small">{{ r.specialization | t }}</span>
                  @if (isAdmin()) {
                    <br /><a class="small" routerLink="/working-hours" [queryParams]="{ doctorId: r.doctorId }">{{ 'Edit hours' | t }}</a>
                  }
                </td>
                @for (d of r.days; track d.date) {
                  <td [class.leave]="d.onLeave" [class.off]="!d.onLeave && d.shifts.length === 0">
                    @if (d.onLeave) {
                      <span class="badge warn">{{ 'On leave' | t }}</span>
                    } @else if (d.shifts.length === 0) {
                      <span class="muted">—</span>
                    } @else {
                      @for (s of d.shifts; track s) { <div class="small">{{ s }}</div> }
                    }
                    @if (d.scheduledAppointments > 0) {
                      <div class="count-pill">{{ '{p0} booked' | t: { p0: (d.scheduledAppointments) } }}</div>
                    }
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `
})
export class StaffSchedulePage {
  private readonly api = inject(StaffApi);
  private readonly auth = inject(AuthService);

  protected readonly isAdmin = computed(() => this.auth.hasRole('Admin'));
  protected readonly start = signal(this.monday(new Date()));
  protected readonly end = computed(() => addDays(this.start(), 6));
  protected readonly rows = signal<DoctorScheduleOverview[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.load();
  }

  protected monday(date: Date): Date {
    const offset = (date.getDay() + 6) % 7;
    return addDays(date, -offset);
  }

  protected thisWeek(): void {
    this.start.set(this.monday(new Date()));
    this.load();
  }

  protected shift(days: number): void {
    this.start.set(addDays(this.start(), days));
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.staffSchedule(toDateInput(this.start()), toDateInput(this.end()), null).subscribe({
      next: rows => {
        this.rows.set(rows);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(apiErrorMessage(err));
        this.loading.set(false);
      }
    });
  }
}
