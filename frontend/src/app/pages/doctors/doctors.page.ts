import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap, tap } from 'rxjs';
import { DoctorsApi } from '../../core/doctors.api';
import { DoctorListItem, PagedResult, Specialization } from '../../core/model';
import { apiErrorMessage } from '../../core/api-error';
import { DoctorCard } from '../../core/doctor-card';
import { SpecialtySelect } from '../../shared/specialty-select';
import { Icon } from '../../shared/icon';
import { TranslatePipe } from '../../core/i18n';

@Component({
  selector: 'app-doctors',
  imports: [TranslatePipe, ReactiveFormsModule, DoctorCard, SpecialtySelect, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <div>
        <p class="eyebrow">{{ 'Find a doctor' | t }}</p>
        <h1>{{ 'Our doctors' | t }}</h1>
      </div>
    </div>

    <div class="filter-bar card">
      <div class="field">
        <label for="search">{{ 'Search by name' | t }}</label>
        <div class="input-icon">
          <app-icon name="search" [size]="18" />
          <input id="search" type="search" [formControl]="search" [placeholder]="'For example: Beridze' | t" />
        </div>
      </div>
      <div class="field">
        <label for="specialization">{{ 'Specialization' | t }}</label>
        <app-specialty-select inputId="specialization" [specializations]="specializations()" [counts]="counts()"
          [value]="specializationId.value" (valueChange)="specializationId.setValue($event)" />
      </div>
    </div>

    @if (error()) {
      <p class="alert error" role="alert">{{ error() | t }}</p>
    }

    @if (loading() && !result()) {
      <p class="muted">{{ 'Loading doctors...' | t }}</p>
    }

    @if (result(); as data) {
      @if (data.items.length === 0) {
        <p class="muted">{{ 'No doctors match your search.' | t }}</p>
      } @else {
        <p class="muted">{{ (data.totalCount === 1 ? '1 doctor found' : '{n} doctors found') | t: { n: data.totalCount } }}</p>
        <div class="grid" [class.dim]="loading()">
          @for (doctor of data.items; track doctor.id) {
            <app-doctor-card [doctor]="doctor" />
          }
        </div>

        <nav class="pager" [attr.aria-label]="'Pages' | t">
          <button class="btn small" type="button" (click)="goToPage(page() - 1)" [disabled]="page() <= 1 || loading()">{{ 'Previous' | t }}</button>
          <span>{{ 'Page {page} of {total}' | t: { page: page(), total: totalPages() } }}</span>
          <button class="btn small" type="button" (click)="goToPage(page() + 1)" [disabled]="page() >= totalPages() || loading()">{{ 'Next' | t }}</button>
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
  protected readonly counts = signal<Record<number, number> | null>(null);
  protected readonly result = signal<PagedResult<DoctorListItem> | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly page = signal(1);

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil((this.result()?.totalCount ?? 0) / this.pageSize)));

  constructor() {
    // Links such as /doctors?specializationId=3 (from the home page) open the list already filtered.
    const params = inject(ActivatedRoute).snapshot.queryParamMap;
    const preset = Number(params.get('specializationId'));
    if (preset > 0) this.specializationId.setValue(preset, { emitEvent: false });
    const search = params.get('search');
    if (search) this.search.setValue(search, { emitEvent: false });

    this.api.specializations().subscribe({
      next: items => this.specializations.set(items),
      error: () => this.specializations.set([])
    });

    // How many doctors each specialty has, shown in the specialty picker.
    this.api.list({ pageSize: 100 }).subscribe({
      next: r => {
        const counts: Record<number, number> = {};
        for (const d of r.items) counts[d.specializationId] = (counts[d.specializationId] ?? 0) + 1;
        this.counts.set(counts);
      }
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