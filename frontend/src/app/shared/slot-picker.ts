import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, map, of, switchMap, tap } from 'rxjs';
import { DoctorsApi } from '../core/doctors.api';
import { Slot } from '../core/model';
import { apiErrorMessage } from '../core/api-error';
import { addDays, toDateInput } from '../core/util';

@Component({
  selector: 'app-slot-picker',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="day-strip" role="group" aria-label="Choose a day">
      @for (day of days; track day.value) {
        <button
          type="button"
          class="day"
          [class.selected]="day.value === date()"
          (click)="date.set(day.value)">
          <small>{{ day.date | date: 'EEE' }}</small>
          <strong>{{ day.date | date: 'd' }}</strong>
          <small>{{ day.date | date: 'MMM' }}</small>
        </button>
      }
    </div>

    <div class="field other-date">
      <label for="slot-date">Or pick another date</label>
      <input id="slot-date" type="date" [min]="today" [max]="maxDate" [value]="date()" (change)="onDate($event)" />
    </div>

    @if (!serviceId()) {
      <p class="muted">Choose a service first.</p>
    } @else if (loading()) {
      <p class="muted">Looking for free times...</p>
    } @else if (error()) {
      <p class="alert error" role="alert">{{ error() }}</p>
    } @else if (slots().length === 0) {
      <p class="muted">No free times on this day. Try another day.</p>
    } @else {
      <div class="slots" role="group" aria-label="Free times">
        @for (slot of slots(); track slot.start) {
          <button
            type="button"
            class="slot"
            [class.selected]="slot.start === selected()"
            [attr.aria-pressed]="slot.start === selected()"
            (click)="choose(slot)">{{ slot.start | date: 'HH:mm' }}</button>
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

  protected onDate(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (value) this.date.set(value);
  }

  protected choose(slot: Slot): void {
    this.selected.set(slot.start);
    this.picked.emit(slot.start);
  }
}