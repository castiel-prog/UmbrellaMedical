import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BillingApi } from '../../core/billing.api';
import { InsuranceCompany } from '../../core/model';
import { apiErrorMessage } from '../../core/api-error';
import { orNull } from '../../core/util';

type CompanyForm = Omit<InsuranceCompany, 'id'>;

@Component({
  selector: 'app-admin-insurers',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar">
      <p class="muted grow">Companies that patient policies can be linked to.</p>
      <button class="btn primary small" type="button" (click)="edit(null)">Add a company</button>
    </div>

    @if (message()) { <p class="alert success" role="status">{{ message() }}</p> }
    @if (error()) { <p class="alert error" role="alert">{{ error() }}</p> }

    @if (form(); as f) {
      <form class="card form-card" (ngSubmit)="save()">
        <div class="form-grid">
          <div class="field"><label for="ic-name">Name</label><input id="ic-name" name="name" maxlength="150" [(ngModel)]="f.name" /></div>
          <div class="field"><label for="ic-phone">Phone</label><input id="ic-phone" name="phone" type="tel" maxlength="30" [(ngModel)]="f.phone" /></div>
          <div class="field"><label for="ic-email">Email</label><input id="ic-email" name="email" type="email" maxlength="256" [(ngModel)]="f.email" /></div>
        </div>
        <label class="check"><input type="checkbox" name="active" [(ngModel)]="f.isActive" /> Active (accepted for new invoices)</label>
        <div class="card-actions">
          <button class="btn primary small" type="submit" [disabled]="busy()">Save</button>
          <button class="btn small" type="button" (click)="form.set(null)">Cancel</button>
        </div>
      </form>
    }

    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Company</th><th>Phone</th><th>Email</th><th>Status</th><th></th></tr></thead>
        <tbody>
          @for (c of companies(); track c.id) {
            <tr>
              <td>{{ c.name }}</td>
              <td>{{ c.phone ?? '—' }}</td>
              <td>{{ c.email ?? '—' }}</td>
              <td><span class="badge" [class.ok]="c.isActive" [class.muted-badge]="!c.isActive">{{ c.isActive ? 'Active' : 'Inactive' }}</span></td>
              <td class="right"><button class="btn small" type="button" (click)="edit(c)">Edit</button></td>
            </tr>
          } @empty {
            <tr><td colspan="5" class="muted">No insurance companies.</td></tr>
          }
        </tbody>
      </table>
    </div>
  `
})
export class AdminInsurersTab {
  private readonly api = inject(BillingApi);

  protected readonly companies = signal<InsuranceCompany[]>([]);
  protected readonly form = signal<CompanyForm | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);
  private editingId: number | null = null;

  constructor() {
    this.load();
  }

  protected edit(c: InsuranceCompany | null): void {
    this.message.set(null);
    this.error.set(null);
    this.editingId = c?.id ?? null;
    this.form.set({ name: c?.name ?? '', phone: c?.phone ?? '', email: c?.email ?? '', isActive: c?.isActive ?? true });
  }

  protected save(): void {
    const f = this.form();
    if (!f?.name.trim()) {
      this.error.set('Enter a name.');
      return;
    }
    const request: CompanyForm = { name: f.name.trim(), phone: orNull(f.phone), email: orNull(f.email), isActive: f.isActive };
    this.busy.set(true);
    this.error.set(null);
    (this.editingId ? this.api.updateInsuranceCompany(this.editingId, request) : this.api.createInsuranceCompany(request)).subscribe({
      next: () => {
        this.busy.set(false);
        this.form.set(null);
        this.message.set('The company was saved.');
        this.load();
      },
      error: err => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(err));
      }
    });
  }

  private load(): void {
    this.api.insuranceCompanies().subscribe({ next: list => this.companies.set(list), error: err => this.error.set(apiErrorMessage(err)) });
  }
}
