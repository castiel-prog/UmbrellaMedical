import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LocalDatePipe, TranslatePipe } from '../core/i18n';
import { DatePicker } from './date-picker';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, map, of, switchMap, tap } from 'rxjs';
import { DoctorsApi } from '../core/doctors.api';
import { Slot } from '../core/model';
import { apiErrorMessage } from '../core/api-error';
import { addDays, toDateInput } from '../core/util';

@Component({
  selector: 'app-slot-picker',
  imports: [FormsModule, LocalDatePipe, TranslatePipe, DatePicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="day-strip" role="group" [attr.aria-label]="'Choose a day' | t">
      @for (day of days; track day.value) {
        <button
          type="button"
          class="day"
          [class.selected]="day.value === date()"
          (click)="date.set(day.value)">
          <small>{{ day.date | ldate: 'weekday' }}</small>
          <strong>{{ day.date | ldate: 'day' }}</strong>
          <small>{{ day.date | ldate: 'month' }}</small>
        </button>
      }
    </div>

    <div class="field other-date">
      <label for="slot-date">{{ 'Or pick another date' | t }}</label>
      <app-date-picker inputId="slot-date" [min]="today" [max]="maxDate" [ngModel]="date()" (ngModelChange)="pickDate($event)" />
    </div>

    @if (!serviceId()) {
      <p class="muted">{{ 'Choose a service first.' | t }}</p>
    } @else if (loading()) {
      <p class="muted">{{ 'Looking for free times...' | t }}</p>
    } @else if (error()) {
      <p class="alert error" role="alert">{{ error() | t }}</p>
    } @else if (slots().length === 0) {
      <p class="muted">{{ 'No free times on this day. Try another day.' | t }}</p>
    } @else {
      <div class="slots" role="group" [attr.aria-label]="'Free times' | t">
        @for (slot of slots(); track slot.start) {
          <button
            type="button"
            class="slot"
            [class.selected]="slot.start === selected()"
            [attr.aria-pressed]="slot.start === selected()"
            (click)="choose(slot)">{{ slot.start | ldate: 'time' }}</button>
        }
      </div>
    }
  `
})
export class SlotPicker {
  private readonly api = inject(DoctorsApi);

  readonly doctorId = input.required<number>();
  readonly serviceId = input<number | null>(null);
  readonly picked = output<string | null>();

  protected readonly today = toDateInput(new Date());
  protected readonly maxDate = toDateInput(addDays(new Date(), 90));
  protected readonly days = Array.from({ length: 14 }, (_, i) => {
    const date = addDays(new Date(), i);
    return { date, value: toDateInput(date) };
  });

  protected readonly date = signal(this.today);
  protected readonly slots = signal<Slot[]>([]);
  protected readonly selected = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  private readonly query = computed(() => ({
    doctorId: this.doctorId(),
    serviceId: this.serviceId(),
    date: this.date()
  }));

  constructor() {
    toObservable(this.query)
      .pipe(
        tap(() => {
          this.error.set(null);
          this.selected.set(null);
          this.picked.emit(null);
        }),
        switchMap(q => {
          if (!q.serviceId) return of([] as Slot[]);
          this.loading.set(true);
          return this.api.slots(q.doctorId, q.date, q.serviceId).pipe(
            map(response => response.slots),
            catchError(err => {
              this.error.set(apiErrorMessage(err));
              return of([] as Slot[]);
            })
          );
        }),
        takeUntilDestroyed()
      )
      .subscribe(slots => {
        this.slots.set(slots);
        this.loading.set(false);
      });
  }

  protected pickDate(value: string): void {
    if (value) this.date.set(value);
  }

  protected choose(slot: Slot): void {
    this.selected.set(slot.start);
    this.picked.emit(slot.start);
  }
}