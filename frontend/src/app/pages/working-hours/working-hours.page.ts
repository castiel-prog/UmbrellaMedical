import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { StaffApi } from '../../core/staff.api';
import { DoctorsApi } from '../../core/doctors.api';
import { AuthService } from '../../core/auth.service';
import { DayOfWeekName, DoctorListItem, ScheduleItem } from '../../core/model';
import { apiErrorMessage } from '../../core/api-error';
import { I18n, TranslatePipe } from '../../core/i18n';
import { DAYS_OF_WEEK } from '../../core/util';

interface Shift { start: string; end: string; isActive: boolean; }
type Week = Record<DayOfWeekName, Shift[]>;

function emptyWeek(): Week {
  return { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: [] };
}

@Component({
  selector: 'app-working-hours',
  imports: [TranslatePipe, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <h1>{{ 'Working hours' | t }}</h1>
      @if (doctorId()) {
        <button class="btn primary" type="button" (click)="save()" [disabled]="busy()">{{ (busy() ? 'Saving...' : 'Save hours') | t }}</button>
      }
    </div>

    @if (isAdmin()) {
      <div class="field narrow">
        <label for="wh-doctor">{{ 'Doctor' | t }}</label>
        <select id="wh-doctor" [ngModel]="doctorId()" (ngModelChange)="chooseDoctor($event)">
          <option [ngValue]="null" disabled>{{ 'Choose a doctor' | t }}</option>
          @for (d of doctors(); track d.id) { <option [ngValue]="d.id">{{ 'Dr. {p0} {p1} · {p2}' | t: { p0: (d.firstName), p1: (d.lastName), p2: (d.specialization | t) } }}</option> }
        </select>
      </div>
    } @else {
      <p class="muted">{{ 'These hours decide when patients can book you. Visits already booked are not moved.' | t }}</p>
    }

    @if (message()) { <p class="alert success" role="status">{{ message() }}</p> }
    @if (error()) { <p class="alert error" role="alert">{{ error() }}</p> }

    @if (loading()) {
      <p class="muted">{{ 'Loading...' | t }}</p>
    } @else if (doctorId()) {
      <div class="week">
        @for (day of days; track day) {
          <section class="card day-card">
            <div class="row-head">
              <h3>{{ day | t }}</h3>
              <button class="btn small" type="button" (click)="addShift(day)">{{ 'Add hours' | t }}</button>
            </div>
            @if (week()[day].length === 0) {
              <p class="muted">{{ 'Day off' | t }}</p>
            }
            @for (s of week()[day]; track $index; let i = $index) {
              <div class="shift" [class.dim]="!s.isActive">
                <input type="time" step="900" [attr.aria-label]="day + ' start ' + (i + 1)" [(ngModel)]="s.start" />
                <span>–</span>
                <input type="time" step="900" [attr.aria-label]="day + ' end ' + (i + 1)" [(ngModel)]="s.end" />
                <label class="check"><input type="checkbox" [(ngModel)]="s.isActive" /> {{ 'Active' | t }}</label>
                <button class="btn small danger" type="button" [attr.aria-label]="'Remove hours' | t" (click)="removeShift(day, i)">✕</button>
              </div>
            }
          </section>
        }
      </div>
    }
  `
})
export class WorkingHoursPage {
  protected readonly i18n = inject(I18n);
  private readonly api = inject(StaffApi);
  private readonly doctorsApi = inject(DoctorsApi);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly days = DAYS_OF_WEEK;
  protected readonly isAdmin = computed(() => this.auth.hasRole('Admin'));
  protected readonly doctors = signal<DoctorListItem[]>([]);
  protected readonly doctorId = signal<number | null>(null);
  protected readonly week = signal<Week>(emptyWeek());
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);

  constructor() {
    if (this.isAdmin()) {
      this.doctorsApi.list({ pageSize: 100 }).subscribe({ next: r => this.doctors.set(r.items) });
      const id = Number(this.route.snapshot.queryParamMap.get('doctorId'));
      if (id > 0) this.chooseDoctor(id);
      else this.loading.set(false);
    } else {
      this.api.myDoctorProfile().subscribe({
        next: d => {
          this.doctorId.set(d.id);
          this.load();
        },
        error: err => {
          this.error.set(apiErrorMessage(err));
          this.loading.set(false);
        }
      });
    }
  }

  protected chooseDoctor(id: number): void {
    this.doctorId.set(id);
    this.message.set(null);
    void this.router.navigate([], { queryParams: { doctorId: id }, replaceUrl: true });
    this.load();
  }

  protected addShift(day: DayOfWeekName): void {
    const week = this.week();
    week[day] = [...week[day], { start: '09:00', end: '17:00', isActive: true }];
    this.week.set({ ...week });
  }

  protected removeShift(day: DayOfWeekName, index: number): void {
    const week = this.week();
    week[day] = week[day].filter((_, i) => i !== index);
    this.week.set({ ...week });
  }

  protected save(): void {
    const id = this.doctorId();
    if (!id) return;

    const items: ScheduleItem[] = [];
    for (const day of DAYS_OF_WEEK) {
      for (const s of this.week()[day]) {
        if (!s.start || !s.end || s.start >= s.end) {
          this.error.set(`${day}: the start time must be before the end time.`);
          return;
        }
        items.push({ dayOfWeek: day, startTime: `${s.start}:00`, endTime: `${s.end}:00`, isActive: s.isActive });
      }
    }

    this.busy.set(true);
    this.error.set(null);
    this.message.set(null);
    this.api.updateSchedule(id, items).subscribe({
      next: saved => {
        this.busy.set(false);
        this.apply(saved);
        this.message.set(this.i18n.t('Working hours saved.'));
      },
      error: err => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(err));
      }
    });
  }

  private load(): void {
    const id = this.doctorId();
    if (!id) return;
    this.loading.set(true);
    this.error.set(null);
    this.api.schedule(id).subscribe({
      next: items => {
        this.apply(items);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(apiErrorMessage(err));
        this.loading.set(false);
      }
    });
  }

  private apply(items: ScheduleItem[]): void {
    const week = emptyWeek();
    for (const item of items) {
      week[item.dayOfWeek].push({ start: item.startTime.slice(0, 5), end: item.endTime.slice(0, 5), isActive: item.isActive });
    }
    for (const day of DAYS_OF_WEEK) week[day].sort((a, b) => a.start.localeCompare(b.start));
    this.week.set(week);
  }
}
