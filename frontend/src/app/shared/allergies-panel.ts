import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MedicalApi } from '../core/medical.api';
import { PatientsApi } from '../core/patients.api';
import { Allergy, AllergySeverity, PatientAllergy } from '../core/model';
import { apiErrorMessage } from '../core/api-error';
import { orNull } from '../core/util';

interface Row { allergyId: number | null; severity: AllergySeverity; notes: string; }

@Component({
  selector: 'app-allergies-panel',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (error()) { <p class="alert error" role="alert">{{ error() }}</p> }

    @if (!editing()) {
      @if (allergies().length === 0) {
        <p class="muted">No known allergies.</p>
      } @else {
        <ul class="chips">
          @for (a of allergies(); track a.allergyId) {
            <li [class]="'chip sev-' + a.severity.toLowerCase()" [title]="a.notes ?? ''">
              {{ a.name }} · {{ a.severity }}@if (a.notes) { · {{ a.notes }} }
            </li>
          }
        </ul>
      }
      @if (canEdit()) {
        <button class="btn small" type="button" (click)="startEdit()">Edit allergies</button>
      }
    } @else {
      @for (row of rows(); track $index; let i = $index) {
        <div class="allergy-row">
          <select [attr.aria-label]="'Allergy ' + (i + 1)" [(ngModel)]="row.allergyId">
            <option [ngValue]="null" disabled>Choose an allergy</option>
            @for (a of catalog(); track a.id) { <option [ngValue]="a.id">{{ a.name }}</option> }
          </select>
          <select [attr.aria-label]="'Severity ' + (i + 1)" [(ngModel)]="row.severity">
            <option value="Mild">Mild</option>
            <option value="Moderate">Moderate</option>
            <option value="Severe">Severe</option>
          </select>
          <input [attr.aria-label]="'Notes ' + (i + 1)" placeholder="Notes" maxlength="500" [(ngModel)]="row.notes" />
          <button class="btn small danger" type="button" aria-label="Remove" (click)="rows.set(removeAt(i))">✕</button>
        </div>
      }
      <div class="card-actions">
        <button class="btn small" type="button" (click)="rows.set([...rows(), { allergyId: null, severity: 'Mild', notes: '' }])">Add allergy</button>
        <button class="btn small primary" type="button" (click)="save()" [disabled]="busy()">Save</button>
        <button class="btn small" type="button" (click)="editing.set(false)">Cancel</button>
      </div>
    }
  `
})
export class AllergiesPanel {
  private readonly medical = inject(MedicalApi);
  private readonly patients = inject(PatientsApi);

  readonly patientId = input.required<number>();
  readonly allergies = input.required<PatientAllergy[]>();
  readonly canEdit = input(false);
  readonly changed = output<PatientAllergy[]>();

  protected readonly editing = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly catalog = signal<Allergy[]>([]);
  protected readonly rows = signal<Row[]>([]);

  protected startEdit(): void {
    this.error.set(null);
    this.rows.set(this.allergies().map(a => ({ allergyId: a.allergyId, severity: a.severity, notes: a.notes ?? '' })));
    this.editing.set(true);
    if (this.catalog().length === 0) {
      this.medical.allergies().subscribe({ next: list => this.catalog.set(list), error: err => this.error.set(apiErrorMessage(err)) });
    }
  }

  protected removeAt(index: number): Row[] {
    return this.rows().filter((_, i) => i !== index);
  }

  protected save(): void {
    const rows = this.rows().filter(r => r.allergyId !== null);
    const ids = rows.map(r => r.allergyId);
    if (new Set(ids).size !== ids.length) {
      this.error.set('Each allergy can be listed only once.');
      return;
    }

    this.busy.set(true);
    this.error.set(null);
    this.patients.replaceAllergies(this.patientId(), rows.map(r => ({
      allergyId: r.allergyId!, severity: r.severity, notes: orNull(r.notes)
    }))).subscribe({
      next: list => {
        this.busy.set(false);
        this.editing.set(false);
        this.changed.emit(list);
      },
      error: err => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(err));
      }
    });
  }
}
