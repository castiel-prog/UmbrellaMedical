import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PatientsApi } from '../core/patients.api';
import { BillingApi } from '../core/billing.api';
import { InsuranceCompany, PatientInsurance } from '../core/model';
import { apiErrorMessage } from '../core/api-error';
import { addDays, toDateInput } from '../core/util';

interface PolicyForm {
  id: number | null;
  insuranceCompanyId: number | null;
  policyNumber: string;
  coveragePercent: number;
  validFrom: string;
  validTo: string;
}

@Component({
  selector: 'app-insurance-panel',
  imports: [FormsModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (message()) { <p class="alert success" role="status">{{ message() }}</p> }
    @if (error()) { <p class="alert error" role="alert">{{ error() }}</p> }

    @if (canManage() && !form()) {
      <div class="toolbar"><button class="btn primary small" type="button" (click)="startNew()">Add a policy</button></div>
    }

    @if (form(); as f) {
      <form class="card form-card" (ngSubmit)="save()">
        <h3>{{ f.id ? 'Edit policy' : 'Add a policy' }}</h3>
        <div class="form-grid">
          @if (!f.id) {
            <div class="field">
              <label for="ins-co">Insurance company</label>
              <select id="ins-co" name="company" [(ngModel)]="f.insuranceCompanyId">
                <option [ngValue]="null" disabled>Choose</option>
                @for (c of companies(); track c.id) { <option [ngValue]="c.id" [disabled]="!c.isActive">{{ c.name }}</option> }
              </select>
            </div>
            <div class="field">
              <label for="ins-no">Policy number</label>
              <input id="ins-no" name="policy" maxlength="50" [(ngModel)]="f.policyNumber" />
            </div>
          }
          <div class="field">
            <label for="ins-cov">Coverage, %</label>
            <input id="ins-cov" name="coverage" type="number" min="0" max="100" step="0.01" [(ngModel)]="f.coveragePercent" />
          </div>
          <div class="field">
            <label for="ins-from">Valid from</label>
            <input id="ins-from" name="from" type="date" [(ngModel)]="f.validFrom" />
          </div>
          <div class="field">
            <label for="ins-to">Valid to</label>
            <input id="ins-to" name="to" type="date" [(ngModel)]="f.validTo" />
          </div>
        </div>
        <div class="card-actions">
          <button class="btn primary" type="submit" [disabled]="busy()">Save</button>
          <button class="btn" type="button" (click)="form.set(null)">Cancel</button>
        </div>
      </form>
    }

    @if (loading()) {
      <p class="muted">Loading...</p>
    } @else if (policies().length === 0) {
      <p class="empty card muted">No insurance policies on file.</p>
    } @else {
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Company</th><th>Policy</th><th>Coverage</th><th>Valid</th><th>Status</th>@if (canManage()) { <th></th> }</tr></thead>
          <tbody>
            @for (p of policies(); track p.id) {
              <tr>
                <td>{{ p.insuranceCompany }}</td>
                <td>{{ p.policyNumber }}</td>
                <td>{{ p.coveragePercent }}%</td>
                <td>{{ p.validFrom | date: 'd MMM y' }} – {{ p.validTo | date: 'd MMM y' }}</td>
                <td><span class="badge" [class.ok]="p.isCurrent" [class.muted-badge]="!p.isCurrent">{{ p.isCurrent ? 'Current' : 'Not current' }}</span></td>
                @if (canManage()) {
                  <td class="right"><button class="btn small" type="button" (click)="startEdit(p)">Edit</button></td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `
})
export class InsurancePanel {
  private readonly patients = inject(PatientsApi);
  private readonly billing = inject(BillingApi);

  readonly patientId = input.required<number>();
  readonly canManage = input(false);

  protected readonly policies = signal<PatientInsurance[]>([]);
  protected readonly companies = signal<InsuranceCompany[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);
  protected readonly form = signal<PolicyForm | null>(null);

  constructor() {
    effect(() => {
      this.patientId();
      untracked(() => this.load());
    });
  }

  protected startNew(): void {
    this.message.set(null);
    this.error.set(null);
    const today = new Date();
    this.form.set({
      id: null, insuranceCompanyId: null, policyNumber: '', coveragePercent: 80,
      validFrom: toDateInput(today), validTo: toDateInput(addDays(today, 365))
    });
    if (this.companies().length === 0) {
      this.billing.insuranceCompanies().subscribe({ next: list => this.companies.set(list), error: err => this.error.set(apiErrorMessage(err)) });
    }
  }

  protected startEdit(p: PatientInsurance): void {
    this.message.set(null);
    this.error.set(null);
    this.form.set({
      id: p.id, insuranceCompanyId: p.insuranceCompanyId, policyNumber: p.policyNumber,
      coveragePercent: p.coveragePercent, validFrom: p.validFrom, validTo: p.validTo
    });
  }

  protected save(): void {
    const f = this.form();
    if (!f) return;
    if (!f.id && (!f.insuranceCompanyId || !f.policyNumber.trim())) {
      this.error.set('Choose a company and enter the policy number.');
      return;
    }
    if (f.validFrom > f.validTo) {
      this.error.set('"Valid from" must be before "Valid to".');
      return;
    }

    const dates = { coveragePercent: Number(f.coveragePercent), validFrom: f.validFrom, validTo: f.validTo };
    const call = f.id
      ? this.patients.updateInsurance(this.patientId(), f.id, dates)
      : this.patients.addInsurance(this.patientId(), { ...dates, insuranceCompanyId: f.insuranceCompanyId!, policyNumber: f.policyNumber.trim() });

    this.busy.set(true);
    this.error.set(null);
    call.subscribe({
      next: () => {
        this.busy.set(false);
        this.form.set(null);
        this.message.set('The policy was saved.');
        this.load();
      },
      error: err => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(err));
      }
    });
  }

  private load(): void {
    this.loading.set(true);
    this.patients.insurances(this.patientId()).subscribe({
      next: list => {
        this.policies.set(list);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(apiErrorMessage(err));
        this.loading.set(false);
      }
    });
  }
}
