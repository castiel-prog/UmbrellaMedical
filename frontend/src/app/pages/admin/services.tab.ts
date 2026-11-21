import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminApi, ServiceRequest } from '../../core/admin.api';
import { AdminService, Department } from '../../core/model';
import { apiErrorMessage } from '../../core/api-error';
import { I18n, TranslatePipe } from '../../core/i18n';
import { orNull } from '../../core/util';

@Component({
  selector: 'app-admin-services',
  imports: [TranslatePipe, FormsModule, CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar">
      <div class="field grow"><label for="s-search" class="sr-only">{{ 'Search' | t }}</label>
        <input id="s-search" type="search" [placeholder]="'Search services' | t" [(ngModel)]="search" (keyup.enter)="load()" />
      </div>
      <button class="btn primary small" type="button" (click)="edit(null)">{{ 'Add a service' | t }}</button>
    </div>

    @if (message()) { <p class="alert success" role="status">{{ message() }}</p> }
    @if (error()) { <p class="alert error" role="alert">{{ error() }}</p> }

    @if (form(); as f) {
      <form class="card form-card" (ngSubmit)="save()">
        <h3>{{ (editingId() ? 'Edit service' : 'New service') | t }}</h3>
        <div class="form-grid">
          <div class="field"><label for="sv-name">{{ 'Name' | t }}</label><input id="sv-name" name="name" maxlength="150" [(ngModel)]="f.name" /></div>
          <div class="field">
            <label for="sv-dept">{{ 'Department' | t }}</label>
            <select id="sv-dept" name="dept" [(ngModel)]="f.departmentId">
              <option [ngValue]="0" disabled>{{ 'Choose' | t }}</option>
              @for (d of departments(); track d.id) { <option [ngValue]="d.id">{{ d.name }}</option> }
            </select>
          </div>
          <div class="field"><label for="sv-price">{{ 'Price (GEL)' | t }}</label><input id="sv-price" name="price" type="number" min="0.01" step="0.01" [(ngModel)]="f.price" /></div>
          <div class="field"><label for="sv-dur">{{ 'Duration (minutes)' | t }}</label><input id="sv-dur" name="dur" type="number" min="5" max="480" step="5" [(ngModel)]="f.durationMinutes" /></div>
        </div>
        <div class="field"><label for="sv-desc">{{ 'Description' | t }}</label><textarea id="sv-desc" name="desc" rows="2" maxlength="1000" [(ngModel)]="f.description"></textarea></div>
        <label class="check"><input type="checkbox" name="active" [(ngModel)]="f.isActive" /> {{ 'Active (can be booked)' | t }}</label>
        <div class="card-actions">
          <button class="btn primary" type="submit" [disabled]="busy()">{{ 'Save' | t }}</button>
          <button class="btn" type="button" (click)="form.set(null)">{{ 'Cancel' | t }}</button>
        </div>
      </form>
    }

    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>{{ 'Service' | t }}</th><th>{{ 'Department' | t }}</th><th class="right">{{ 'Price' | t }}</th><th class="right">{{ 'Minutes' | t }}</th><th class="right">{{ 'Doctors' | t }}</th><th>{{ 'Status' | t }}</th><th></th></tr></thead>
        <tbody>
          @for (s of services(); track s.id) {
            <tr>
              <td>{{ s.name }}</td>
              <td>{{ s.department | t }}</td>
              <td class="right">{{ s.price | currency: 'GEL' : 'symbol-narrow' }}</td>
              <td class="right">{{ s.durationMinutes }}</td>
              <td class="right">{{ s.doctorCount }}</td>
              <td><span class="badge" [class.ok]="s.isActive" [class.muted-badge]="!s.isActive">{{ (s.isActive ? 'Active' : 'Inactive') | t }}</span></td>
              <td class="right"><button class="btn small" type="button" (click)="edit(s)">{{ 'Edit' | t }}</button></td>
            </tr>
          } @empty {
            <tr><td colspan="7" class="muted">{{ 'No services.' | t }}</td></tr>
          }
        </tbody>
      </table>
    </div>
  `
})
export class AdminServicesTab {
  protected readonly i18n = inject(I18n);
  private readonly api = inject(AdminApi);

  protected readonly services = signal<AdminService[]>([]);
  protected readonly departments = signal<Department[]>([]);
  protected readonly form = signal<ServiceRequest | null>(null);
  protected readonly editingId = signal<number | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);
  protected search = '';

  constructor() {
    this.load();
    this.api.departments().subscribe({ next: list => this.departments.set(list) });
  }

  protected edit(s: AdminService | null): void {
    this.message.set(null);
    this.error.set(null);
    this.editingId.set(s?.id ?? null);
    this.form.set(s
      ? { name: s.name, description: s.description, price: s.price, durationMinutes: s.durationMinutes, departmentId: s.departmentId, isActive: s.isActive }
      : { name: '', description: '', price: 50, durationMinutes: 30, departmentId: 0, isActive: true });
  }

  protected save(): void {
    const f = this.form();
    if (!f) return;
    if (!f.name.trim() || !f.departmentId) {
      this.error.set(this.i18n.t('Enter a name and choose a department.'));
      return;
    }
    const request: ServiceRequest = {
      ...f, name: f.name.trim(), description: orNull(f.description), price: Number(f.price), durationMinutes: Number(f.durationMinutes)
    };
    const id = this.editingId();
    this.busy.set(true);
    this.error.set(null);
    (id ? this.api.updateService(id, request) : this.api.createService(request)).subscribe({
      next: () => {
        this.busy.set(false);
        this.form.set(null);
        this.message.set(this.i18n.t('The service was saved.'));
        this.load();
      },
      error: err => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(err));
      }
    });
  }

  protected load(): void {
    this.api.services(this.search.trim() || null).subscribe({
      next: list => this.services.set(list),
      error: err => this.error.set(apiErrorMessage(err))
    });
  }
}
