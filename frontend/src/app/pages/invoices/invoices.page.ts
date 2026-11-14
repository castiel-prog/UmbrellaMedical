import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { InvoiceList } from '../../shared/invoice-list';

@Component({
  selector: 'app-invoices',
  imports: [InvoiceList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <h1>{{ isStaff() ? 'Invoices' : 'My bills' }}</h1>
    </div>
    @if (isStaff()) {
      <p class="muted">To bill a visit, open a completed appointment in <strong>Appointments</strong> and choose “Create invoice”.</p>
    }
    <app-invoice-list [filters]="isStaff()" [showPatient]="isStaff()" />
  `
})
export class InvoicesPage {
  private readonly auth = inject(AuthService);
  protected readonly isStaff = computed(() => this.auth.hasRole('Admin', 'Receptionist'));
}
