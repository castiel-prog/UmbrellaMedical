import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MedicalApi } from '../core/medical.api';
import { AppointmentsApi } from '../core/appointments.api';
import { Appointment, Diagnosis, MedicalRecord, MedicalRecordRequest, PagedResult, ToothCondition, ToothRecord, VitalSigns } from '../core/model';
import { apiErrorMessage } from '../core/api-error';
import { orNull, splitWords } from '../core/util';
import { Pager } from './pager';

const TOOTH_CONDITIONS: ToothCondition[] = ['Healthy', 'Cavity', 'Filled', 'Crown', 'RootCanal', 'Implant', 'Missing'];

interface RecordForm {
  appointmentId: number | null;
  diagnosis: Diagnosis | null;
  complaints: string;
  diagnosisDetails: string;
  treatment: string;
  recommendations: string;
  notes: string;
  vitals: VitalSigns;
  teeth: ToothRecord[];
}

function emptyVitals(): VitalSigns {
  return { heightCm: null, weightKg: null, systolicBp: null, diastolicBp: null, heartRate: null, temperatureC: null };
}

@Component({
  selector: 'app-records-panel',
  imports: [FormsModule, DatePipe, Pager],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (canWrite() && !form()) {
      <div class="toolbar">
        <button class="btn primary small" type="button" (click)="startNew()">New medical record</button>
      </div>
    }

    @if (message()) { <p class="alert success" role="status">{{ message() }}</p> }
    @if (error()) { <p class="alert error" role="alert">{{ error() }}</p> }

    @if (form(); as f) {
      <form class="card form-card" (ngSubmit)="save()">
        <h3>{{ editingId() ? 'Edit medical record' : 'New medical record' }}</h3>

        @if (!editingId()) {
          <div class="field">
            <label for="rec-appt">Visit (optional)</label>
            <select id="rec-appt" name="appointmentId" [(ngModel)]="f.appointmentId">
              <option [ngValue]="null">Not linked to a visit</option>
              @for (a of appointments(); track a.id) {
                <option [ngValue]="a.id">{{ a.startDateTime | date: 'd MMM y, HH:mm' }} · {{ a.serviceName }} ({{ a.status }})</option>
              }
            </select>
          </div>
        }

        <div class="field">
          <label for="rec-dx">Diagnosis (ICD-10)</label>
          @if (f.diagnosis; as d) {
            <div class="picked">
              <span><strong>{{ d.code }}</strong> {{ d.name }}</span>
              <button class="btn small" type="button" (click)="f.diagnosis = null">Remove</button>
            </div>
          } @else {
            <input id="rec-dx" type="search" placeholder="Search by code or name" autocomplete="off"
              [ngModel]="dxTerm()" name="dxTerm" (ngModelChange)="searchDiagnoses($event)" />
            @if (dxResults().length > 0) {
              <ul class="pick-list">
                @for (d of dxResults(); track d.id) {
                  <li><button type="button" (click)="f.diagnosis = d; dxResults.set([])"><strong>{{ d.code }}</strong> {{ d.name }}</button></li>
                }
              </ul>
            }
          }
        </div>

        <div class="form-grid">
          <div class="field">
            <label for="rec-complaints">Complaints</label>
            <textarea id="rec-complaints" name="complaints" rows="3" maxlength="2000" [(ngModel)]="f.complaints"></textarea>
          </div>
          <div class="field">
            <label for="rec-details">Diagnosis details</label>
            <textarea id="rec-details" name="diagnosisDetails" rows="3" maxlength="2000" [(ngModel)]="f.diagnosisDetails"></textarea>
          </div>
          <div class="field">
            <label for="rec-treatment">Treatment</label>
            <textarea id="rec-treatment" name="treatment" rows="3" maxlength="2000" [(ngModel)]="f.treatment"></textarea>
          </div>
          <div class="field">
            <label for="rec-recs">Recommendations</label>
            <textarea id="rec-recs" name="recommendations" rows="3" maxlength="2000" [(ngModel)]="f.recommendations"></textarea>
          </div>
        </div>
        <div class="field">
          <label for="rec-notes">Notes</label>
          <textarea id="rec-notes" name="notes" rows="2" maxlength="4000" [(ngModel)]="f.notes"></textarea>
        </div>

        <fieldset class="fieldset">
          <legend>Vital signs (optional)</legend>
          <div class="vitals-grid">
            <div class="field"><label for="v-h">Height, cm</label><input id="v-h" name="h" type="number" min="30" max="250" step="0.1" [(ngModel)]="f.vitals.heightCm" /></div>
            <div class="field"><label for="v-w">Weight, kg</label><input id="v-w" name="w" type="number" min="1" max="400" step="0.1" [(ngModel)]="f.vitals.weightKg" /></div>
            <div class="field"><label for="v-s">Systolic BP</label><input id="v-s" name="s" type="number" min="50" max="300" [(ngModel)]="f.vitals.systolicBp" /></div>
            <div class="field"><label for="v-d">Diastolic BP</label><input id="v-d" name="d" type="number" min="30" max="200" [(ngModel)]="f.vitals.diastolicBp" /></div>
            <div class="field"><label for="v-hr">Heart rate</label><input id="v-hr" name="hr" type="number" min="20" max="300" [(ngModel)]="f.vitals.heartRate" /></div>
            <div class="field"><label for="v-t">Temperature, °C</label><input id="v-t" name="t" type="number" min="30" max="45" step="0.1" [(ngModel)]="f.vitals.temperatureC" /></div>
          </div>
        </fieldset>

        <fieldset class="fieldset">
          <legend>Tooth chart (dentists)</legend>
          @for (t of f.teeth; track $index; let i = $index) {
            <div class="tooth-row">
              <div class="field"><label [for]="'t-n' + i">Tooth</label><input [id]="'t-n' + i" [name]="'tn' + i" type="number" min="1" max="32" [(ngModel)]="t.toothNumber" /></div>
              <div class="field">
                <label [for]="'t-c' + i">Condition</label>
                <select [id]="'t-c' + i" [name]="'tc' + i" [(ngModel)]="t.condition">
                  @for (c of conditions; track c) { <option [value]="c">{{ words(c) }}</option> }
                </select>
              </div>
              <div class="field"><label [for]="'t-t' + i">Treatment</label><input [id]="'t-t' + i" [name]="'tt' + i" maxlength="500" [(ngModel)]="t.treatment" /></div>
              <button class="btn small danger" type="button" (click)="f.teeth.splice(i, 1)" aria-label="Remove tooth">✕</button>
            </div>
          }
          <button class="btn small" type="button" (click)="f.teeth.push({ toothNumber: 1, condition: 'Healthy', treatment: null, notes: null })">Add tooth</button>
        </fieldset>

        <div class="card-actions">
          <button class="btn primary" type="submit" [disabled]="busy()">{{ busy() ? 'Saving...' : 'Save record' }}</button>
          <button class="btn" type="button" (click)="form.set(null)">Cancel</button>
        </div>
      </form>
    }

    @if (loading() && !result()) { <p class="muted">Loading...</p> }

    @if (result(); as data) {
      @if (data.items.length === 0) {
        <p class="empty card muted">No medical records yet.</p>
      }
      <ul class="stack" [class.dim]="loading()">
        @for (r of data.items; track r.id) {
          <li class="card">
            <div class="row-head">
              <div>
                <h3>
                  @if (r.diagnosisCode) { <span class="code">{{ r.diagnosisCode }}</span> }
                  {{ r.diagnosisName ?? 'Visit record' }}
                </h3>
                <p class="muted">{{ r.recordDate | date: 'd MMMM y, HH:mm' }} · Dr. {{ r.doctorName }} · {{ r.specialization }}</p>
              </div>
              <div class="card-actions tight">
                <button class="btn small" type="button" (click)="toggle(r.id)">{{ expanded() === r.id ? 'Hide' : 'Details' }}</button>
                @if (canWrite()) {
                  <button class="btn small" type="button" (click)="startEdit(r)">Edit</button>
                }
              </div>
            </div>

            @if (expanded() === r.id) {
              <dl class="details">
                @if (r.complaints) { <dt>Complaints</dt><dd class="pre-line">{{ r.complaints }}</dd> }
                @if (r.diagnosisDetails) { <dt>Diagnosis</dt><dd class="pre-line">{{ r.diagnosisDetails }}</dd> }
                @if (r.treatment) { <dt>Treatment</dt><dd class="pre-line">{{ r.treatment }}</dd> }
                @if (r.recommendations) { <dt>Recommendations</dt><dd class="pre-line">{{ r.recommendations }}</dd> }
                @if (r.notes) { <dt>Notes</dt><dd class="pre-line">{{ r.notes }}</dd> }
                @if (r.vitalSigns; as v) {
                  <dt>Vital signs</dt>
                  <dd>
                    @if (v.heightCm) { <span class="chip">{{ v.heightCm }} cm</span> }
                    @if (v.weightKg) { <span class="chip">{{ v.weightKg }} kg</span> }
                    @if (v.systolicBp && v.diastolicBp) { <span class="chip">BP {{ v.systolicBp }}/{{ v.diastolicBp }}</span> }
                    @if (v.heartRate) { <span class="chip">HR {{ v.heartRate }}</span> }
                    @if (v.temperatureC) { <span class="chip">{{ v.temperatureC }} °C</span> }
                  </dd>
                }
                @if (r.toothRecords.length > 0) {
                  <dt>Teeth</dt>
                  <dd>
                    @for (t of r.toothRecords; track t.toothNumber) {
                      <span class="chip">#{{ t.toothNumber }} {{ words(t.condition) }}@if (t.treatment) { · {{ t.treatment }} }</span>
                    }
                  </dd>
                }
                @if (r.prescriptionIds.length > 0) { <dt>Prescriptions</dt><dd>{{ r.prescriptionIds.length }} linked</dd> }
                @if (r.documentIds.length > 0) { <dt>Documents</dt><dd>{{ r.documentIds.length }} linked</dd> }
              </dl>
            }
          </li>
        }
      </ul>
      <app-pager [page]="page()" [pageSize]="pageSize" [totalCount]="data.totalCount" [disabled]="loading()" (pageChange)="page.set($event); load()" />
    }
  `
})
export class RecordsPanel {
  private readonly api = inject(MedicalApi);
  private readonly appointmentsApi = inject(AppointmentsApi);

  readonly patientId = input.required<number>();
  readonly canWrite = input(false);

  protected readonly conditions = TOOTH_CONDITIONS;
  protected readonly words = splitWords;
  protected readonly pageSize = 10;
  protected readonly page = signal(1);
  protected readonly result = signal<PagedResult<MedicalRecord> | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);
  protected readonly expanded = signal<number | null>(null);

  protected readonly form = signal<RecordForm | null>(null);
  protected readonly editingId = signal<number | null>(null);
  protected readonly appointments = signal<Appointment[]>([]);
  protected readonly dxTerm = signal('');
  protected readonly dxResults = signal<Diagnosis[]>([]);
  private dxTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      this.patientId();
      untracked(() => {
        this.page.set(1);
        this.load();
      });
    });
  }

  protected toggle(id: number): void {
    this.expanded.set(this.expanded() === id ? null : id);
  }

  protected startNew(): void {
    this.message.set(null);
    this.error.set(null);
    this.editingId.set(null);
    this.dxTerm.set('');
    this.dxResults.set([]);
    this.form.set({
      appointmentId: null, diagnosis: null, complaints: '', diagnosisDetails: '', treatment: '',
      recommendations: '', notes: '', vitals: emptyVitals(), teeth: []
    });

    this.appointmentsApi.list({ patientId: this.patientId(), pageSize: 20 }).subscribe({
      next: r => this.appointments.set(r.items.filter(a => a.status !== 'Cancelled')),
      error: () => this.appointments.set([])
    });
  }

  protected startEdit(r: MedicalRecord): void {
    this.message.set(null);
    this.error.set(null);
    this.editingId.set(r.id);
    this.dxTerm.set('');
    this.dxResults.set([]);
    this.form.set({
      appointmentId: r.appointmentId,
      diagnosis: null,
      complaints: r.complaints ?? '',
      diagnosisDetails: r.diagnosisDetails ?? '',
      treatment: r.treatment ?? '',
      recommendations: r.recommendations ?? '',
      notes: r.notes ?? '',
      vitals: r.vitalSigns ? { ...r.vitalSigns } : emptyVitals(),
      teeth: r.toothRecords.map(t => ({ ...t }))
    });

    // The record only carries the diagnosis code, so look up its id to keep it on save.
    if (r.diagnosisCode) {
      this.api.diagnoses(r.diagnosisCode).subscribe(list => {
        const match = list.find(d => d.code === r.diagnosisCode);
        const current = this.form();
        if (match && current) this.form.set({ ...current, diagnosis: match });
      });
    }
  }

  protected searchDiagnoses(term: string): void {
    this.dxTerm.set(term);
    if (this.dxTimer) clearTimeout(this.dxTimer);
    if (term.trim().length < 2) {
      this.dxResults.set([]);
      return;
    }
    this.dxTimer = setTimeout(() => {
      this.api.diagnoses(term.trim()).subscribe({ next: list => this.dxResults.set(list.slice(0, 10)) });
    }, 250);
  }

  protected save(): void {
    const f = this.form();
    if (!f) return;

    const vitals = Object.values(f.vitals).some(v => v !== null && v !== undefined) ? f.vitals : null;
    const request: MedicalRecordRequest = {
      diagnosisId: f.diagnosis?.id ?? null,
      complaints: orNull(f.complaints),
      diagnosisDetails: orNull(f.diagnosisDetails),
      treatment: orNull(f.treatment),
      recommendations: orNull(f.recommendations),
      notes: orNull(f.notes),
      vitalSigns: vitals,
      toothRecords: f.teeth.map(t => ({ ...t, treatment: orNull(t.treatment), notes: orNull(t.notes) }))
    };

    const id = this.editingId();
    const call = id
      ? this.api.updateRecord(id, request)
      : this.api.createRecord(this.patientId(), { ...request, appointmentId: f.appointmentId });

    this.busy.set(true);
    this.error.set(null);
    call.subscribe({
      next: saved => {
        this.busy.set(false);
        this.form.set(null);
        this.expanded.set(saved.id);
        this.message.set(id ? 'The record was updated.' : 'The record was saved.');
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
    this.api.records(this.patientId(), this.page(), this.pageSize).subscribe({
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
