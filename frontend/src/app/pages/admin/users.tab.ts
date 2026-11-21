import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApi } from '../../core/admin.api';
import { PagedResult, Role, UserListItem } from '../../core/model';
import { apiErrorMessage } from '../../core/api-error';
import { orNull } from '../../core/util';
import { I18n, LocalDatePipe, TranslatePipe } from '../../core/i18n';
import { Pager } from '../../shared/pager';

@Component({
  selector: 'app-admin-users',
  imports: [LocalDatePipe, TranslatePipe, FormsModule, Pager],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="filters" (ngSubmit)="reload()">
      <div class="field"><label for="u-search">{{ 'Search' | t }}</label><input id="u-search" name="search" type="search" [placeholder]="'Email or name' | t" [(ngModel)]="search" /></div>
      <div class="field">
        <label for="u-role">{{ 'Role' | t }}</label>
        <select id="u-role" name="role" [(ngModel)]="role" (ngModelChange)="reload()">
          <option [ngValue]="null">{{ 'All' | t }}</option>
          <option value="Patient">{{ 'Patient' | t }}</option>
          <option value="Doctor">{{ 'Doctor' | t }}</option>
          <option value="Receptionist">{{ 'Receptionist' | t }}</option>
          <option value="Admin">{{ 'Admin' | t }}</option>
        </select>
      </div>
      <div class="field">
        <label for="u-active">{{ 'Status' | t }}</label>
        <select id="u-active" name="active" [(ngModel)]="isActive" (ngModelChange)="reload()">
          <option [ngValue]="null">{{ 'All' | t }}</option>
          <option [ngValue]="true">{{ 'Active' | t }}</option>
          <option [ngValue]="false">{{ 'Deactivated' | t }}</option>
        </select>
      </div>
    </form>

    @if (message()) { <p class="alert success" role="status">{{ message() }}</p> }
    @if (error()) { <p class="alert error" role="alert">{{ error() }}</p> }

    @if (result(); as data) {
      <div class="table-wrap" [class.dim]="loading()">
        <table class="table">
          <thead><tr><th>{{ 'Name' | t }}</th><th>{{ 'Email' | t }}</th><th>{{ 'Role' | t }}</th><th>{{ 'Joined' | t }}</th><th>{{ 'Status' | t }}</th><th></th></tr></thead>
          <tbody>
            @for (u of data.items; track u.id) {
              <tr>
                <td>{{ u.fullName ?? '—' }}</td>
                <td>{{ u.email }} @if (!u.emailConfirmed) { <span class="badge warn">{{ 'unconfirmed' | t }}</span> }</td>
                <td>{{ u.role | t }}</td>
                <td>{{ u.createdAt | ldate: 'medium' }}</td>
                <td><span class="badge" [class.ok]="u.isActive" [class.muted-badge]="!u.isActive">{{ (u.isActive ? 'Active' : 'Deactivated') | t }}</span></td>
                <td class="right">
                  @if (u.isActive) {
                    <button class="btn small danger" type="button" (click)="startDeactivate(u)">{{ 'Deactivate' | t }}</button>
                  } @else {
                    <button class="btn small" type="button" (click)="setStatus(u, true)" [disabled]="busy()">{{ 'Activate' | t }}</button>
                  }
                </td>
              </tr>
              @if (openId() === u.id) {
                <tr>
                  <td colspan="6">
                    <div class="inline-panel">
                      <p><strong>{{ 'Deactivate {p0}' | t: { p0: (u.fullName ?? u.email) } }}</strong> ({{ u.role | t }})</p>
                      <p class="muted small">
                        {{ 'They will be logged out and can no longer sign in. They receive an email with the reason below, asking them to visit or contact the clinic for a review. Their records are kept.' | t }}
                      </p>
                      <div class="form-grid">
                        <div class="field">
                          <label [for]="'cause-' + u.id">{{ 'Probable cause' | t }}</label>
                          <select [id]="'cause-' + u.id" [(ngModel)]="cause">
                            <option value="" disabled>{{ 'Choose a reason' | t }}</option>
                            @for (c of causes; track c) { <option [value]="c">{{ c }}</option> }
                          </select>
                        </div>
                        <div class="field">
                          <label [for]="'details-' + u.id">{{ 'Details (sent to the account holder)' | t }}</label>
                          <textarea [id]="'details-' + u.id" rows="2" maxlength="400" [(ngModel)]="details"
                            [placeholder]="'For example: three missed appointments in October without cancelling.' | t"></textarea>
                        </div>
                      </div>
                      @if (fullReason(); as r) {
                        <p class="muted small">{{ 'Email will say:' | t }} <em>{{ 'Reason: {p0}' | t: { p0: (r) } }}</em></p>
                      }
                      <div class="card-actions">
                        <button class="btn small danger" type="button" (click)="setStatus(u, false)" [disabled]="busy() || !canDeactivate()">
                          {{ 'Deactivate and send email' | t }}
                        </button>
                        <button class="btn small" type="button" (click)="openId.set(null)">{{ 'Cancel' | t }}</button>
                      </div>
                    </div>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
      <app-pager [page]="page()" [pageSize]="pageSize" [totalCount]="data.totalCount" [disabled]="loading()" (pageChange)="page.set($event); load()" />
    } @else if (loading()) {
      <p class="muted">{{ 'Loading...' | t }}</p>
    }
  `
})
export class AdminUsersTab {
  protected readonly i18n = inject(I18n);
  private readonly api = inject(AdminApi);

  protected readonly pageSize = 20;
  protected readonly page = signal(1);
  protected readonly result = signal<PagedResult<UserListItem> | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);
  protected readonly openId = signal<number | null>(null);
  protected search = '';
  protected role: Role | null = null;
  protected isActive: boolean | null = null;

  protected readonly causes = [
    'Suspected false or fraudulent registration details',
    'Abusive or threatening behaviour towards staff or patients',
    'Repeated missed appointments without cancelling',
    'Misuse of online booking or payments',
    'Duplicate account',
    'Requested by the account holder',
    'Other'
  ];
  private readonly causeSignal = signal('');
  private readonly detailsSignal = signal('');

  // Two-way bindings for the form, kept as signals so the preview updates as the admin types.
  protected get cause(): string { return this.causeSignal(); }
  protected set cause(value: string) { this.causeSignal.set(value); }
  protected get details(): string { return this.detailsSignal(); }
  protected set details(value: string) { this.detailsSignal.set(value); }

  protected readonly fullReason = computed(() => {
    const cause = this.causeSignal();
    const details = this.detailsSignal().trim();
    if (!cause) return null;
    if (cause === 'Other') return details || null;
    return details ? `${cause}. ${details}` : cause;
  });

  protected readonly canDeactivate = computed(() => {
    const reason = this.fullReason();
    return !!reason && reason.length >= 10 && this.detailsSignal().trim().length >= 5;
  });

  constructor() {
    this.load();
  }

  protected reload(): void {
    this.page.set(1);
    this.load();
  }

  protected startDeactivate(u: UserListItem): void {
    this.cause = '';
    this.details = '';
    this.error.set(null);
    this.message.set(null);
    this.openId.set(u.id);
  }

  protected setStatus(u: UserListItem, isActive: boolean): void {
    const reason = isActive ? null : orNull(this.fullReason());
    if (!isActive && !this.canDeactivate()) {
      this.error.set(this.i18n.t('Choose a probable cause and describe it in a few words.'));
      return;
    }

    this.busy.set(true);
    this.error.set(null);
    this.message.set(null);
    this.api.setUserStatus(u.id, isActive, reason).subscribe({
      next: result => {
        this.busy.set(false);
        this.openId.set(null);
        const who = u.fullName ?? u.email;
        const parts = [`${who} was ${isActive ? 'reactivated' : 'deactivated'}.`];
        if (result.emailSent === true) parts.push(`An email was sent to ${u.email}.`);
        if (result.emailSent === false) parts.push(`The email to ${u.email} could not be sent; please contact them another way.`);
        if (!isActive && result.futureAppointments > 0)
          parts.push(`They still have ${result.futureAppointments} upcoming visit(s); review them on the Appointments page.`);
        this.message.set(parts.join(' '));
        this.load();
      },
      error: err => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(err));
      }
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.api.users({ search: this.search.trim() || null, role: this.role, isActive: this.isActive, page: this.page(), pageSize: this.pageSize }).subscribe({
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
