import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { StaffApi } from '../../core/staff.api';
import { DoctorsApi } from '../../core/doctors.api';
import { AdminApi } from '../../core/admin.api';
import { AdminService, CreateDoctorRequest, DoctorListItem, Receptionist, Specialization } from '../../core/model';
import { apiErrorMessage } from '../../core/api-error';
import { orNull } from '../../core/util';

type Panel = 'doctor' | 'receptionist' | { services: number } | null;

@Component({
  selector: 'app-admin-staff',
  imports: [FormsModule, RouterLink, CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (message()) { <p class="alert success" role="status">{{ message() }}</p> }
    @if (error()) { <p class="alert error" role="alert">{{ error() }}</p> }

    <div class="page-head">
      <h2>Doctors</h2>
      <button class="btn primary small" type="button" (click)="open('doctor')">Add a doctor</button>
    </div>

    @if (panel() === 'doctor') {
      <form class="card form-card" (ngSubmit)="createDoctor()">
        <h3>New doctor</h3>
        <div class="form-grid">
          <div class="field"><label for="d-first">First name</label><input id="d-first" name="first" maxlength="100" [(ngModel)]="doctor.firstName" /></div>
          <div class="field"><label for="d-last">Last name</label><input id="d-last" name="last" maxlength="100" [(ngModel)]="doctor.lastName" /></div>
          <div class="field"><label for="d-email">Email (login)</label><input id="d-email" name="email" type="email" maxlength="256" [(ngModel)]="doctor.email" /></div>
          <div class="field"><label for="d-pass">Temporary password</label><input id="d-pass" name="pass" type="password" autocomplete="new-password" minlength="8" [(ngModel)]="doctor.password" /></div>
          <div class="field"><label for="d-lic">License number</label><input id="d-lic" name="lic" maxlength="50" [(ngModel)]="doctor.licenseNumber" /></div>
          <div class="field">
            <label for="d-spec">Specialization</label>
            <select id="d-spec" name="spec" [(ngModel)]="doctor.specializationId">
              <option [ngValue]="0" disabled>Choose</option>
              @for (s of specializations(); track s.id) { <option [ngValue]="s.id">{{ s.name }}</option> }
            </select>
          </div>
          <div class="field"><label for="d-phone">Phone</label><input id="d-phone" name="phone" type="tel" maxlength="30" [(ngModel)]="doctor.phone" /></div>
          <div class="field"><label for="d-years">Years of experience</label><input id="d-years" name="years" type="number" min="0" max="60" [(ngModel)]="doctor.yearsOfExperience" /></div>
        </div>
        <div class="field"><label for="d-bio">Bio</label><textarea id="d-bio" name="bio" rows="3" maxlength="2000" [(ngModel)]="doctor.bio"></textarea></div>
        <p class="muted">The doctor logs in with this email, their first and last name, and the password.</p>
        <div class="card-actions">
          <button class="btn primary" type="submit" [disabled]="busy()">Create doctor</button>
          <button class="btn" type="button" (click)="panel.set(null)">Cancel</button>
        </div>
      </form>
    }

    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Doctor</th><th>Specialization</th><th>Experience</th><th></th></tr></thead>
        <tbody>
          @for (d of doctors(); track d.id) {
            <tr>
              <td><a [routerLink]="['/doctors', d.id]">Dr. {{ d.firstName }} {{ d.lastName }}</a></td>
              <td>{{ d.specialization }}</td>
              <td>{{ d.yearsOfExperience }} years</td>
              <td class="right nowrap">
                <button class="btn small" type="button" (click)="openServices(d)">Services</button>
                <a class="btn small" routerLink="/working-hours" [queryParams]="{ doctorId: d.id }">Hours</a>
              </td>
            </tr>
            @if (servicesFor() === d.id) {
              <tr>
                <td colspan="4">
                  <div class="inline-panel">
                    <p><strong>Services Dr. {{ d.lastName }} offers</strong></p>
                    @if (allServices().length === 0) { <p class="muted">Loading services…</p> }
                    <div class="check-grid">
                      @for (s of allServices(); track s.id) {
                        <label class="check">
                          <input type="checkbox" [checked]="chosen().has(s.id)" (change)="toggleService(s.id)" [disabled]="!s.isActive" />
                          {{ s.name }} <span class="muted">· {{ s.price | currency: 'GEL' : 'symbol-narrow' }}@if (!s.isActive) { · inactive }</span>
                        </label>
                      }
                    </div>
                    <div class="card-actions">
                      <button class="btn small primary" type="button" (click)="saveServices(d)" [disabled]="busy()">Save services</button>
                      <button class="btn small" type="button" (click)="panel.set(null)">Cancel</button>
                    </div>
                  </div>
                </td>
              </tr>
            }
          }
        </tbody>
      </table>
    </div>

    <div class="page-head section-gap">
      <h2>Receptionists</h2>
      <button class="btn primary small" type="button" (click)="open('receptionist')">Add a receptionist</button>
    </div>

    @if (panel() === 'receptionist') {
      <form class="card form-card" (ngSubmit)="createReceptionist()">
        <h3>New receptionist</h3>
        <div class="form-grid">
          <div class="field"><label for="r-first">First name</label><input id="r-first" name="first" maxlength="100" [(ngModel)]="receptionist.firstName" /></div>
          <div class="field"><label for="r-last">Last name</label><input id="r-last" name="last" maxlength="100" [(ngModel)]="receptionist.lastName" /></div>
          <div class="field"><label for="r-email">Email (login)</label><input id="r-email" name="email" type="email" maxlength="256" [(ngModel)]="receptionist.email" /></div>
          <div class="field"><label for="r-pass">Temporary password</label><input id="r-pass" name="pass" type="password" autocomplete="new-password" minlength="8" [(ngModel)]="receptionist.password" /></div>
          <div class="field"><label for="r-phone">Phone</label><input id="r-phone" name="phone" type="tel" maxlength="30" [(ngModel)]="receptionist.phone" /></div>
        </div>
        <div class="card-actions">
          <button class="btn primary" type="submit" [disabled]="busy()">Create receptionist</button>
          <button class="btn" type="button" (click)="panel.set(null)">Cancel</button>
        </div>
      </form>
    }

    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Status</th></tr></thead>
        <tbody>
          @for (r of receptionists(); track r.id) {
            <tr>
              <td>{{ r.firstName }} {{ r.lastName }}</td>
              <td>{{ r.email }}</td>
              <td>{{ r.phone ?? '—' }}</td>
              <td><span class="badge" [class.ok]="r.isActive" [class.muted-badge]="!r.isActive">{{ r.isActive ? 'Active' : 'Deactivated' }}</span></td>
            </tr>
          } @empty {
            <tr><td colspan="4" class="muted">No receptionists yet.</td></tr>
          }
        </tbody>
      </table>
    </div>
  `
})
export class AdminStaffTab {
  private readonly staff = inject(StaffApi);
  private readonly doctorsApi = inject(DoctorsApi);
  private readonly admin = inject(AdminApi);

  protected readonly doctors = signal<DoctorListItem[]>([]);
  protected readonly receptionists = signal<Receptionist[]>([]);
  protected readonly specializations = signal<Specialization[]>([]);
  protected readonly allServices = signal<AdminService[]>([]);
  protected readonly chosen = signal(new Set<number>());
  protected readonly panel = signal<Panel>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);

  protected doctor: CreateDoctorRequest = this.emptyDoctor();
  protected receptionist = { firstName: '', lastName: '', email: '', password: '', phone: '' };

  constructor() {
    this.loadDoctors();
    this.loadReceptionists();
    this.doctorsApi.specializations().subscribe({ next: list => this.specializations.set(list) });
  }

  protected servicesFor(): number | null {
    const p = this.panel();
    return p && typeof p === 'object' ? p.services : null;
  }

  protected open(panel: Panel): void {
    this.panel.set(panel);
    this.error.set(null);
    this.message.set(null);
    if (panel === 'doctor') this.doctor = this.emptyDoctor();
    if (panel === 'receptionist') this.receptionist = { firstName: '', lastName: '', email: '', password: '', phone: '' };
  }

  protected openServices(d: DoctorListItem): void {
    this.open({ services: d.id });
    this.chosen.set(new Set());
    forkJoin([this.admin.services(), this.doctorsApi.get(d.id)]).subscribe({
      next: ([services, details]) => {
        this.allServices.set(services);
        this.chosen.set(new Set(details.services.map(s => s.serviceId)));
      },
      error: err => this.error.set(apiErrorMessage(err))
    });
  }

  protected toggleService(id: number): void {
    const next = new Set(this.chosen());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.chosen.set(next);
  }

  protected saveServices(d: DoctorListItem): void {
    this.busy.set(true);
    this.staff.assignServices(d.id, [...this.chosen()]).subscribe({
      next: () => {
        this.busy.set(false);
        this.panel.set(null);
        this.message.set(`Services for Dr. ${d.lastName} were saved.`);
      },
      error: err => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(err));
      }
    });
  }

  protected createDoctor(): void {
    const d = this.doctor;
    if (!d.firstName.trim() || !d.lastName.trim() || !d.email.trim() || d.password.length < 8 || !d.licenseNumber.trim() || !d.specializationId) {
      this.error.set('Fill in name, email, a password of 8+ characters, license number and specialization.');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.staff.createDoctor({
      ...d,
      firstName: d.firstName.trim(),
      lastName: d.lastName.trim(),
      email: d.email.trim(),
      licenseNumber: d.licenseNumber.trim(),
      phone: orNull(d.phone),
      bio: orNull(d.bio),
      yearsOfExperience: Number(d.yearsOfExperience) || 0
    }).subscribe({
      next: created => {
        this.busy.set(false);
        this.panel.set(null);
        this.message.set(`Dr. ${created.firstName} ${created.lastName} was added. Next, assign services and working hours.`);
        this.loadDoctors();
      },
      error: err => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(err));
      }
    });
  }

  protected createReceptionist(): void {
    const r = this.receptionist;
    if (!r.firstName.trim() || !r.lastName.trim() || !r.email.trim() || r.password.length < 8) {
      this.error.set('Fill in name, email and a password of 8+ characters.');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.staff.createReceptionist({
      firstName: r.firstName.trim(), lastName: r.lastName.trim(), email: r.email.trim(), password: r.password, phone: orNull(r.phone)
    }).subscribe({
      next: () => {
        this.busy.set(false);
        this.panel.set(null);
        this.message.set('The receptionist was added.');
        this.loadReceptionists();
      },
      error: err => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(err));
      }
    });
  }

  private emptyDoctor(): CreateDoctorRequest {
    return { email: '', password: '', firstName: '', lastName: '', licenseNumber: '', specializationId: 0, phone: '', bio: '', yearsOfExperience: 0 };
  }

  private loadDoctors(): void {
    this.doctorsApi.list({ pageSize: 100 }).subscribe({ next: r => this.doctors.set(r.items), error: err => this.error.set(apiErrorMessage(err)) });
  }

  private loadReceptionists(): void {
    this.staff.receptionists().subscribe({ next: list => this.receptionists.set(list), error: err => this.error.set(apiErrorMessage(err)) });
  }
}
