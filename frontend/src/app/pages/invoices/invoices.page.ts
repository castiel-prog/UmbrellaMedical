import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { TranslatePipe } from '../../core/i18n';
import { InvoiceList } from '../../shared/invoice-list';

@Component({
  selector: 'app-invoices',
  imports: [TranslatePipe, InvoiceList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <h1>{{ (isStaff() ? 'Invoices' : 'My bills') | t }}</h1>
    </div>
    @if (isStaff()) {
      <p class="muted">{{ 'To bill a visit, open a completed appointment in' | t }} <strong>{{ 'Appointments' | t }}</strong> {{ 'and choose “Create invoice”.' | t }}</p>
    }
    <app-invoice-list [filters]="isStaff()" [showPatient]="isStaff()" />
  `
})
export class InvoicesPage {
  private readonly auth = inject(AuthService);
  protected readonly isStaff = computed(() => this.auth.hasRole('Admin', 'Receptionist'));
}
