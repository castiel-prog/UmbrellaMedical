import { ChangeDetectionStrategy, Component, inject, input, model, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { PatientsApi } from '../core/patients.api';
import { PatientListItem } from '../core/model';

/** Search box for staff to choose a patient by name or personal number. */
@Component({
  selector: 'app-patient-picker',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (selected(); as p) {
      <div class="picked">
        <span><strong>{{ p.firstName }} {{ p.lastName }}</strong> · <span class="muted">{{ p.personalNumber }}</span></span>
        <button class="btn small" type="button" (click)="selected.set(null)">Change</button>
      </div>
    } @else {
      <div class="field">
        <label [for]="inputId()">{{ label() }}</label>
        <input
          [id]="inputId()"
          type="search"
          placeholder="Name or personal number"
          autocomplete="off"
          [value]="term()"
          (input)="term.set($any($event.target).value)" />
      </div>
      @if (term().trim().length >= 2) {
        @if (results().length === 0) {
          <p class="muted">No patients found.</p>
        }
        <ul class="pick-list">
          @for (p of results(); track p.id) {
            <li>
              <button type="button" (click)="selected.set(p)">
                <strong>{{ p.firstName }} {{ p.lastName }}</strong>
                <span class="muted">{{ p.personalNumber }} · born {{ p.dateOfBirth | date: 'd MMM y' }}</span>
              </button>
            </li>
          }
        </ul>
      }
    }
  `
})
export class PatientPicker {
  private readonly api = inject(PatientsApi);

  readonly label = input('Patient');
  readonly inputId = input('patient-search');
  readonly selected = model<PatientListItem | null>(null);

  protected readonly term = signal('');
  protected readonly results = signal<PatientListItem[]>([]);

  constructor() {
    toObservable(this.term)
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap(term => term.trim().length < 2
          ? of([] as PatientListItem[])
          : this.api.list(term.trim(), 1, 8).pipe(map(r => r.items), catchError(() => of([] as PatientListItem[])))),
        takeUntilDestroyed()
      )
      .subscribe(items => this.results.set(items));
  }
}
