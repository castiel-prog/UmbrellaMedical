import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { PatientsApi } from '../../core/patients.api';
import { PatientDetails } from '../../core/model';
import { apiErrorMessage } from '../../core/api-error';
import { orNull } from '../../core/util';
import { AllergiesPanel } from '../../shared/allergies-panel';
import { RecordsPanel } from '../../shared/records-panel';
import { PrescriptionsPanel } from '../../shared/prescriptions-panel';
import { DocumentsPanel } from '../../shared/documents-panel';
import { InsurancePanel } from '../../shared/insurance-panel';
import { PrescriptionRequests } from '../../shared/prescription-requests';

type Tab = 'profile' | 'records' | 'prescriptions' | 'documents' | 'insurance';
const TABS: { id: Tab; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'records', label: 'Medical records' },
  { id: 'prescriptions', label: 'Prescriptions' },
  { id: 'documents', label: 'Documents' },
  { id: 'insurance', label: 'Insurance' }
];

@Component({
  selector: 'app-my-health',
  imports: [FormsModule, DatePipe, AllergiesPanel, RecordsPanel, PrescriptionsPanel, DocumentsPanel, InsurancePanel, PrescriptionRequests],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>My health</h1>

    <div class="tabs scroll" role="tablist">
      @for (t of tabs; track t.id) {
        <button type="button" role="tab" [class.active]="tab() === t.id" [attr.aria-selected]="tab() === t.id" (click)="select(t.id)">{{ t.label }}</button>
      }
    </div>

    @if (error()) { <p class="alert error" role="alert">{{ error() }}</p> }

    @if (patient(); as p) {
      @switch (tab()) {
        @case ('profile') {
          @if (message()) { <p class="alert success" role="status">{{ message() }}</p> }
          <div class="two-col">
            <section class="card">
              <h3>Personal details</h3>
              <dl class="details">
                <dt>Name</dt><dd>{{ p.firstName }} {{ p.lastName }}</dd>
                <dt>Personal number</dt><dd>{{ p.personalNumber }}</dd>
                <dt>Date of birth</dt><dd>{{ p.dateOfBirth | date: 'd MMMM y' }}</dd>
                <dt>Gender</dt><dd>{{ p.gender }}</dd>
              </dl>
              <p class="muted small">To change these details, please contact the reception.</p>
            </section>

            <section class="card">
              <h3>Contact</h3>
              @if (!editing()) {
                <dl class="details">
                  <dt>Phone</dt><dd>{{ p.phone ?? '—' }}</dd>
                  <dt>Email</dt><dd>{{ p.email ?? '—' }}</dd>
                  <dt>Address</dt><dd>{{ p.address ?? '—' }}</dd>
                </dl>
                <button class="btn small" type="button" (click)="startEdit(p)">Edit contact details</button>
              } @else {
                <form (ngSubmit)="saveContact()">
                  <div class="field"><label for="c-phone">Phone</label><input id="c-phone" name="phone" type="tel" maxlength="30" [(ngModel)]="contact.phone" /></div>
                  <div class="field"><label for="c-email">Email</label><input id="c-email" name="email" type="email" maxlength="256" [(ngModel)]="contact.email" /></div>
                  <div class="field"><label for="c-address">Address</label><input id="c-address" name="address" maxlength="300" [(ngModel)]="contact.address" /></div>
                  <div class="card-actions">
                    <button class="btn primary small" type="submit" [disabled]="busy()">Save</button>
                    <button class="btn small" type="button" (click)="editing.set(false)">Cancel</button>
                  </div>
                </form>
              }
            </section>
          </div>

          <section class="card section-gap">
            <h3>Allergies</h3>
            <app-allergies-panel [patientId]="p.id" [allergies]="p.allergies" [canEdit]="true" (changed)="patient.set({ ...p, allergies: $event })" />
          </section>

          @if (p.medicalHistory) {
            <section class="card section-gap">
              <h3>Medical history</h3>
              <p class="pre-line">{{ p.medicalHistory }}</p>
            </section>
          }
        }
        @case ('records') { <app-records-panel [patientId]="p.id" /> }
        @case ('prescriptions') {
          <app-prescription-requests />
          <h3 class="section-gap">Your prescriptions</h3>
          <app-prescriptions-panel [patientId]="p.id" />
        }
        @case ('documents') { <app-documents-panel [patientId]="p.id" [canUpload]="true" /> }
        @case ('insurance') { <app-insurance-panel [patientId]="p.id" /> }
      }
    } @else if (!error()) {
      <p class="muted">Loading...</p>
    }
  `
})
export class MyHealthPage {
  private readonly api = inject(PatientsApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly tabs = TABS;
  protected readonly tab = signal<Tab>(this.initialTab());
  protected readonly patient = signal<PatientDetails | null>(null);
  protected readonly editing = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);
  protected contact = { phone: '', email: '', address: '' };

  constructor() {
    this.api.me().subscribe({
      next: p => this.patient.set(p),
      error: err => this.error.set(apiErrorMessage(err))
    });
  }

  protected select(tab: Tab): void {
    this.tab.set(tab);
    void this.router.navigate([], { queryParams: { tab }, replaceUrl: true });
  }

  protected startEdit(p: PatientDetails): void {
    this.message.set(null);
    this.contact = { phone: p.phone ?? '', email: p.email ?? '', address: p.address ?? '' };
    this.editing.set(true);
  }

  protected saveContact(): void {
    this.busy.set(true);
    this.error.set(null);
    this.api.updateMyContact({
      phone: orNull(this.contact.phone),
      email: orNull(this.contact.email),
      address: orNull(this.contact.address)
    }).subscribe({
      next: p => {
        this.busy.set(false);
        this.editing.set(false);
        this.patient.set(p);
        this.message.set('Your contact details were saved.');
      },
      error: err => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(err));
      }
    });
  }

  private initialTab(): Tab {
    const wanted = this.route.snapshot.queryParamMap.get('tab') as Tab | null;
    return TABS.some(t => t.id === wanted) ? wanted! : 'profile';
  }
}
