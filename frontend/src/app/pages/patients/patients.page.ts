import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { PatientsApi } from '../../core/patients.api';
import { AuthService } from '../../core/auth.service';
import { PagedResult, PatientDetails, PatientListItem } from '../../core/model';
import { apiErrorMessage } from '../../core/api-error';
import { Pager } from '../../shared/pager';
import { LocalDatePipe, TranslatePipe } from '../../core/i18n';
import { PatientForm } from '../../shared/patient-form';

@Component({
  selector: 'app-patients',
  imports: [LocalDatePipe, TranslatePipe, FormsModule, RouterLink, Pager, PatientForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <h1>{{ (isDoctor() ? 'My patients' : 'Patients') | t }}</h1>
      @if (canCreate() && !creating()) {
        <button class="btn primary" type="button" (click)="creating.set(true)">{{ 'Register a patient' | t }}</button>
      }
    </div>

    @if (creating()) {
      <app-patient-form (saved)="created($event)" (cancelled)="creating.set(false)" />
    }

    <form class="filters" (ngSubmit)="page.set(1); load()">
      <div class="field">
        <label for="p-search">{{ 'Search' | t }}</label>
        <input id="p-search" name="search" type="search" [placeholder]="'Name or personal number' | t" [(ngModel)]="search" />
      </div>
      <div class="field align-end"><button class="btn" type="submit">{{ 'Search' | t }}</button></div>
    </form>

    @if (error()) { <p class="alert error" role="alert">{{ error() }}</p> }
    @if (loading() && !result()) { <p class="muted">{{ 'Loading...' | t }}</p> }

    @if (result(); as data) {
      @if (data.items.length === 0) {
        <p class="empty card muted">{{ 'No patients found.' | t }}</p>
      } @else {
        <div class="table-wrap" [class.dim]="loading()">
          <table class="table">
            <thead><tr><th>{{ 'Name' | t }}</th><th>{{ 'Personal number' | t }}</th><th>{{ 'Born' | t }}</th><th>{{ 'Gender' | t }}</th><th>{{ 'Phone' | t }}</th></tr></thead>
            <tbody>
              @for (p of data.items; track p.id) {
                <tr>
                  <td><a [routerLink]="['/patients', p.id]">{{ p.lastName }}, {{ p.firstName }}</a></td>
                  <td>{{ p.personalNumber }}</td>
                  <td>{{ p.dateOfBirth | ldate: 'medium' }}</td>
                  <td>{{ p.gender | t }}</td>
                  <td>{{ p.phone ?? '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
      <app-pager [page]="page()" [pageSize]="pageSize" [totalCount]="data.totalCount" [disabled]="loading()" (pageChange)="page.set($event); load()" />
    }
  `
})
export class PatientsPage {
  private readonly api = inject(PatientsApi);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly isDoctor = computed(() => this.auth.hasRole('Doctor'));
  protected readonly canCreate = computed(() => this.auth.hasRole('Admin', 'Receptionist'));
  protected readonly pageSize = 20;
  protected readonly page = signal(1);
  protected readonly result = signal<PagedResult<PatientListItem> | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly creating = signal(false);
  protected search = '';

  constructor() {
    this.load();
  }

  protected created(p: PatientDetails): void {
    void this.router.navigate(['/patients', p.id]);
  }

  protected load(): void {
    this.loading.set(true);
    this.api.list(this.search.trim() || null, this.page(), this.pageSize).subscribe({
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
