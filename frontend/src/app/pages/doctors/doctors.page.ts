import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap, tap } from 'rxjs';
import { DoctorsApi } from '../../core/doctors.api';
import { DoctorListItem, PagedResult, Specialization } from '../../core/model';
import { apiErrorMessage } from '../../core/api-error';
import { DoctorCard } from '../../core/doctor-card';

@Component({
  selector: 'app-doctors',
  imports: [ReactiveFormsModule, DoctorCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Our doctors</h1>

    <div class="filters">
      <div class="field">
        <label for="search">Search by name</label>
        <input id="search" type="search" [formControl]="search" placeholder="For example: Kapanadze" />
      </div>
      <div class="field">
        <label for="specialization">Specialization</label>
        <select id="specialization" [formControl]="specializationId">
          <option [ngValue]="null">All specializations</option>
          @for (item of specializations(); track item.id) {
            <option [ngValue]="item.id">{{ item.name }}</option>
          }
        </select>
      </div>
    </div>

    @if (error()) {
      <p class="alert error" role="alert">{{ error() }}</p>
    }

    @if (loading() && !result()) {
      <p class="muted">Loading doctors...</p>
    }

    @if (result(); as data) {
      @if (data.items.length === 0) {
        <p class="muted">No doctors match your search.</p>
      } @else {
        <p class="muted">{{ data.totalCount }} doctor(s) found</p>
        <div class="grid" [class.dim]="loading()">
          @for (doctor of data.items; track doctor.id) {
            <app-doctor-card [doctor]="doctor" />
          }
        </div>

        <nav class="pager" aria-label="Pages">
          <button class="btn small" type="button" (click)="goToPage(page() - 1)" [disabled]="page() <= 1 || loading()">Previous</button>
          <span>Page {{ page() }} of {{ totalPages() }}</span>
          <button class="btn small" type="button" (click)="goToPage(page() + 1)" [disabled]="page() >= totalPages() || loading()">Next</button>
        </nav>
      }
    }
  `
})
export class DoctorsPage {
  private readonly api = inject(DoctorsApi);
  private readonly reload$ = new Subject<void>();
  private readonly pageSize = 12;

  protected readonly search = new FormControl('', { nonNullable: true });
  protected readonly specializationId = new FormControl<number | null>(null);

  protected readonly specializations = signal<Specialization[]>([]);
  protected readonly result = signal<PagedResult<DoctorListItem> | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly page = signal(1);

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil((this.result()?.totalCount ?? 0) / this.pageSize)));

  constructor() {
    this.api.specializations().subscribe({
      next: items => this.specializations.set(items),
      error: () => this.specializations.set([])
    });

    this.reload$
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap(() =>
          this.api
            .list({
              search: this.search.value.trim(),
              specializationId: this.specializationId.value,
              page: this.page(),
              pageSize: this.pageSize
            })
            .pipe(
              catchError(err => {
                this.error.set(apiErrorMessage(err));
                return of(null);
              })
            )),
        takeUntilDestroyed()
      )
      .subscribe(data => {
        if (data) this.result.set(data);
        this.loading.set(false);
      });

    this.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.goToPage(1));

    this.specializationId.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.goToPage(1));

    this.reload$.next();
  }

  protected goToPage(page: number): void {
    this.page.set(page);
    this.reload$.next();
  }
}