import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MedicalApi } from '../core/medical.api';
import { MedicalRecord, Medication, PagedResult, Prescription } from '../core/model';
import { apiErrorMessage } from '../core/api-error';
import { orNull } from '../core/util';
import { I18n, LocalDatePipe, TranslatePipe } from '../core/i18n';
import { Pager } from './pager';

interface ItemForm {
  medication: Medication | null;
  term: string;
  results: Medication[];
  dosage: string;
  frequency: string;
  durationDays: number;
}

function emptyItem(): ItemForm {
  return { medication: null, term: '', results: [], dosage: '', frequency: '', durationDays: 7 };
}

@Component({
  selector: 'app-prescriptions-panel',
  imports: [LocalDatePipe, TranslatePipe, FormsModule, Pager],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar">
      <label class="check">
        <input type="checkbox" [checked]="activeOnly()" (change)="activeOnly.set($any($event.target).checked); page.set(1); load()" />
        {{ 'Active only' | t }}
      </label>
      @if (canWrite() && !writing()) {
        <button class="btn primary small" type="button" (click)="startNew()">{{ 'New prescription' | t }}</button>
      }
    </div>

    @if (message()) { <p class="alert success" role="status">{{ message() }}</p> }
    @if (warnings().length > 0) {
      <div class="alert warn" role="alert">
        <strong>{{ 'Allergy warning' | t }}</strong>
        <ul>@for (w of warnings(); track w) { <li>{{ w }}</li> }</ul>
      </div>
    }
    @if (error()) { <p class="alert error" role="alert">{{ error() }}</p> }

    @if (writing()) {
      <form class="card form-card" (ngSubmit)="save()">
        <h3>{{ 'New prescription' | t }}</h3>

        @for (item of items(); track $index; let i = $index) {
          <fieldset class="fieldset">
            <legend>{{ 'Medication {p0}' | t: { p0: (i + 1) } }}</legend>
            <div class="field">
              <label [for]="'med-' + i">{{ 'Medication' | t }}</label>
              @if (item.medication; as m) {
                <div class="picked">
                  <span><strong>{{ m.name }}</strong> {{ m.strength }} {{ m.form }}</span>
                  <button class="btn small" type="button" (click)="item.medication = null">{{ 'Change' | t }}</button>
                </div>
              } @else {
                <input [id]="'med-' + i" [name]="'medTerm' + i" type="search" autocomplete="off" [placeholder]="'Search medications' | t"
                  [ngModel]="item.term" (ngModelChange)="searchMedication(item, $event)" />
                @if (item.results.length > 0) {
                  <ul class="pick-list">
                    @for (m of item.results; track m.id) {
                      <li><button type="button" (click)="item.medication = m; item.results = []">
                        <strong>{{ m.name }}</strong> <span class="muted">{{ m.genericName }} {{ m.strength }} {{ m.form }}</span>
                      </button></li>
                    }
                  </ul>
                }
              }
            </div>
            <div class="form-grid three">
              <div class="field"><label [for]="'dose-' + i">{{ 'Dosage' | t }}</label><input [id]="'dose-' + i" [name]="'dose' + i" maxlength="100" [placeholder]="'1 tablet' | t" [(ngModel)]="item.dosage" /></div>
              <div class="field"><label [for]="'freq-' + i">{{ 'Frequency' | t }}</label><input [id]="'freq-' + i" [name]="'freq' + i" maxlength="100" [placeholder]="'twice a day' | t" [(ngModel)]="item.frequency" /></div>
              <div class="field"><label [for]="'days-' + i">{{ 'Days' | t }}</label><input [id]="'days-' + i" [name]="'days' + i" type="number" min="1" max="365" [(ngModel)]="item.durationDays" /></div>
            </div>
            @if (items().length > 1) {
              <button class="btn small danger" type="button" (click)="removeItem(i)">{{ 'Remove' | t }}</button>
            }
          </fieldset>
        }
        <button class="btn small" type="button" (click)="items.set([...items(), newItem()])">{{ 'Add another medication' | t }}</button>

        <div class="form-grid">
          <div class="field">
            <label for="rx-record">{{ 'Medical record (optional)' | t }}</label>
            <select id="rx-record" name="record" [(ngModel)]="recordId">
              <option [ngValue]="null">{{ 'None' | t }}</option>
              @for (r of records(); track r.id) {
                <option [ngValue]="r.id">{{ r.recordDate | ldate: 'medium' }} · {{ (r.diagnosisName ?? 'Visit record') | t }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label for="rx-expiry">{{ 'Expires (optional)' | t }}</label>
            <input id="rx-expiry" name="expiry" type="date" [(ngModel)]="expiry" />
          </div>
        </div>
        <div class="field">
          <label for="rx-instr">{{ 'Instructions' | t }}</label>
          <textarea id="rx-instr" name="instructions" rows="2" maxlength="2000" [(ngModel)]="instructions"></textarea>
        </div>

        <div class="card-actions">
          <button class="btn primary" type="submit" [disabled]="busy()">{{ (busy() ? 'Saving...' : 'Issue prescription') | t }}</button>
          <button class="btn" type="button" (click)="writing.set(false)">{{ 'Cancel' | t }}</button>
        </div>
      </form>
    }

    @if (loading() && !result()) { <p class="muted">{{ 'Loading...' | t }}</p> }

    @if (result(); as data) {
      @if (data.items.length === 0) {
        <p class="empty card muted">{{ 'No prescriptions.' | t }}</p>
      }
      <ul class="stack" [class.dim]="loading()">
        @for (p of data.items; track p.id) {
          <li class="card">
            <div class="row-head">
              <div>
                <h3>{{ 'Prescription #{p0}' | t: { p0: (p.id) } }}</h3>
                <p class="muted">
                  {{ 'Issued' | t }} {{ p.issuedDate | ldate: 'medium' }} {{ '· valid until' | t }} {{ p.expiryDate | ldate: 'medium' }}
                  {{ '· Dr.' | t }} {{ p.doctorName }}
                  @if (showPatient()) { · {{ p.patientName }} }
                </p>
              </div>
              <span class="badge" [class.ok]="p.isActive" [class.muted-badge]="!p.isActive">{{ (p.isActive ? 'Active' : 'Expired') | t }}</span>
            </div>
            <ul class="rx-items">
              @for (i of p.items; track $index) {
                <li><strong>{{ i.medicationName }}</strong> {{ i.strength }} {{ i.form }} — {{ i.dosage }}, {{ i.frequency }}, {{ i.durationDays }} {{ 'days' | t }}</li>
              }
            </ul>
            @if (p.code) {
              <p class="small">
                {{ 'Pharmacy code:' | t }} <strong class="code-text">{{ p.code }}</strong>
                @if (p.usedFor.length > 0) { <span class="muted"> {{ '· already used for {p0}' | t: { p0: (p.usedFor.join(', ')) } }}</span> }
                @else if (p.isActive && !showPatient()) { <span class="muted"> {{ '· use it to buy this medicine in the pharmacy' | t }}</span> }
              </p>
            }
            @if (p.instructions) { <p class="pre-line"><span class="muted">{{ 'Instructions:' | t }}</span> {{ p.instructions }}</p> }
            @for (w of p.warnings; track w) { <p class="alert warn small-alert">{{ w }}</p> }
          </li>
        }
      </ul>
      <app-pager [page]="page()" [pageSize]="pageSize" [totalCount]="data.totalCount" [disabled]="loading()" (pageChange)="page.set($event); load()" />
    }
  `
})
export class PrescriptionsPanel {
  protected readonly i18n = inject(I18n);
  private readonly api = inject(MedicalApi);

  /** The patient whose prescriptions to show; null shows the logged-in patient's own list. */
  readonly patientId = input<number | null>(null);
  readonly canWrite = input(false);
  readonly showPatient = input(false);

  protected readonly pageSize = 10;
  protected readonly page = signal(1);
  protected readonly activeOnly = signal(false);
  protected readonly result = signal<PagedResult<Prescription> | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);
  protected readonly warnings = signal<string[]>([]);

  protected readonly writing = signal(false);
  protected readonly items = signal<ItemForm[]>([emptyItem()]);
  protected readonly records = signal<MedicalRecord[]>([]);
  protected recordId: number | null = null;
  protected expiry = '';
  protected instructions = '';
  protected readonly newItem = emptyItem;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      this.patientId();
      untracked(() => {
        this.page.set(1);
        this.load();
      });
    });
  }

  protected startNew(): void {
    const patientId = this.patientId();
    if (!patientId) return;
    this.writing.set(true);
    this.items.set([emptyItem()]);
    this.recordId = null;
    this.expiry = '';
    this.instructions = '';
    this.message.set(null);
    this.warnings.set([]);
    this.error.set(null);
    this.api.records(patientId, 1, 20).subscribe({ next: r => this.records.set(r.items), error: () => this.records.set([]) });
  }

  protected removeItem(index: number): void {
    this.items.set(this.items().filter((_, i) => i !== index));
  }

  protected searchMedication(item: ItemForm, term: string): void {
    item.term = term;
    if (this.searchTimer) clearTimeout(this.searchTimer);
    if (term.trim().length < 2) {
      item.results = [];
      return;
    }
    this.searchTimer = setTimeout(() => {
      this.api.medications(term.trim()).subscribe(list => {
        item.results = list.slice(0, 10);
        this.items.set([...this.items()]);
      });
    }, 250);
  }

  protected save(): void {
    const patientId = this.patientId();
    if (!patientId) return;

    const items = this.items();
    if (items.some(i => !i.medication || !i.dosage.trim() || !i.frequency.trim() || !i.durationDays)) {
      this.error.set(this.i18n.t('Choose a medication and fill in dosage, frequency and days for each line.'));
      return;
    }

    this.busy.set(true);
    this.error.set(null);
    this.api.createPrescription({
      patientId,
      medicalRecordId: this.recordId,
      expiryDate: this.expiry ? `${this.expiry}T23:59:00` : null,
      instructions: orNull(this.instructions),
      items: items.map(i => ({
        medicationId: i.medication!.id,
        dosage: i.dosage.trim(),
        frequency: i.frequency.trim(),
        durationDays: Number(i.durationDays)
      }))
    }).subscribe({
      next: p => {
        this.busy.set(false);
        this.writing.set(false);
        this.warnings.set(p.warnings);
        this.message.set(this.i18n.t('The prescription was issued.'));
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
    const patientId = this.patientId();
    const activeOnly = this.activeOnly() || null;
    const request = patientId
      ? this.api.prescriptions(patientId, activeOnly, this.page(), this.pageSize)
      : this.api.myPrescriptions(activeOnly, this.page(), this.pageSize);

    request.subscribe({
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
