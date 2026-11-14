import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminApi } from '../../core/admin.api';
import { PagedResult, Role, UserListItem } from '../../core/model';
import { apiErrorMessage } from '../../core/api-error';
import { orNull } from '../../core/util';
import { Pager } from '../../shared/pager';

@Component({
  selector: 'app-admin-users',
  imports: [FormsModule, DatePipe, Pager],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="filters" (ngSubmit)="reload()">
      <div class="field"><label for="u-search">Search</label><input id="u-search" name="search" type="search" placeholder="Email or name" [(ngModel)]="search" /></div>
      <div class="field">
        <label for="u-role">Role</label>
        <select id="u-role" name="role" [(ngModel)]="role" (ngModelChange)="reload()">
          <option [ngValue]="null">All</option>
          <option value="Patient">Patient</option>
          <option value="Doctor">Doctor</option>
          <option value="Receptionist">Receptionist</option>
          <option value="Admin">Admin</option>
        </select>
      </div>
      <div class="field">
        <label for="u-active">Status</label>
        <select id="u-active" name="active" [(ngModel)]="isActive" (ngModelChange)="reload()">
          <option [ngValue]="null">All</option>
          <option [ngValue]="true">Active</option>
          <option [ngValue]="false">Deactivated</option>
        </select>
      </div>
    </form>

    @if (message()) { <p class="alert success" role="status">{{ message() }}</p> }
    @if (error()) { <p class="alert error" role="alert">{{ error() }}</p> }

    @if (result(); as data) {
      <div class="table-wrap" [class.dim]="loading()">
        <table class="table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th>Status</th><th></th></tr></thead>
          <tbody>
            @for (u of data.items; track u.id) {
              <tr>
                <td>{{ u.fullName ?? '—' }}</td>
                <td>{{ u.email }} @if (!u.emailConfirmed) { <span class="badge warn">unconfirmed</span> }</td>
                <td>{{ u.role }}</td>
                <td>{{ u.createdAt | date: 'd MMM y' }}</td>
                <td><span class="badge" [class.ok]="u.isActive" [class.muted-badge]="!u.isActive">{{ u.isActive ? 'Active' : 'Deactivated' }}</span></td>
                <td class="right">
                  @if (u.isActive) {
                    <button class="btn small danger" type="button" (click)="openId.set(u.id); reason = ''">Deactivate</button>
                  } @else {
                    <button class="btn small" type="button" (click)="setStatus(u, true)" [disabled]="busy()">Activate</button>
                  }
                </td>
              </tr>
              @if (openId() === u.id) {
                <tr>
                  <td colspan="6">
                    <div class="inline-panel">
                      <div class="field">
                        <label [for]="'deact-' + u.id">Reason (optional, logged)</label>
                        <input [id]="'deact-' + u.id" maxlength="500" [(ngModel)]="reason" />
                      </div>
                      <div class="card-actions">
                        <button class="btn small danger" type="button" (click)="setStatus(u, false)" [disabled]="busy()">Deactivate {{ u.email }}</button>
                        <button class="btn small" type="button" (click)="openId.set(null)">Back</button>
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
      <p class="muted">Loading...</p>
    }
  `
})
export class AdminUsersTab {
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
  protected reason = '';

  constructor() {
    this.load();
  }

  protected reload(): void {
    this.page.set(1);
    this.load();
  }

  protected setStatus(u: UserListItem, isActive: boolean): void {
    this.busy.set(true);
    this.error.set(null);
    this.message.set(null);
    this.api.setUserStatus(u.id, isActive, isActive ? null : orNull(this.reason)).subscribe({
      next: () => {
        this.busy.set(false);
        this.openId.set(null);
        this.message.set(`${u.email} was ${isActive ? 'activated' : 'deactivated'}.`);
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
