import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MedicalApi } from '../core/medical.api';
import { DocumentType, MedicalDocument } from '../core/model';
import { apiErrorMessage } from '../core/api-error';
import { orNull, saveDownload, splitWords } from '../core/util';

const MAX_BYTES = 10 * 1024 * 1024;
const TYPES: DocumentType[] = ['LabResult', 'XRay', 'Ultrasound', 'Other'];

@Component({
  selector: 'app-documents-panel',
  imports: [FormsModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (message()) { <p class="alert success" role="status">{{ message() }}</p> }
    @if (error()) { <p class="alert error" role="alert">{{ error() }}</p> }

    @if (canUpload()) {
      <form class="card form-card" (ngSubmit)="upload()">
        <h3>Upload a document</h3>
        <div class="form-grid">
          <div class="field">
            <label for="doc-file">File (PDF, PNG or JPG)</label>
            <input #fileInput id="doc-file" type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" (change)="pick($event)" />
          </div>
          <div class="field">
            <label for="doc-type">Type</label>
            <select id="doc-type" name="type" [(ngModel)]="type">
              @for (t of types; track t) { <option [value]="t">{{ words(t) }}</option> }
            </select>
          </div>
        </div>
        <div class="field">
          <label for="doc-desc">Description (optional)</label>
          <input id="doc-desc" name="description" maxlength="500" [(ngModel)]="description" />
        </div>
        <button class="btn primary" type="submit" [disabled]="!file() || busy()">{{ busy() ? 'Uploading...' : 'Upload' }}</button>
      </form>
    }

    @if (loading()) {
      <p class="muted">Loading...</p>
    } @else if (documents().length === 0) {
      <p class="empty card muted">No documents yet.</p>
    } @else {
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>File</th><th>Type</th><th>Description</th><th>Uploaded</th><th></th></tr></thead>
          <tbody>
            @for (d of documents(); track d.id) {
              <tr>
                <td>{{ d.fileName }}</td>
                <td>{{ words(d.type) }}</td>
                <td>{{ d.description ?? '—' }}</td>
                <td>{{ d.uploadedAt | date: 'd MMM y' }}</td>
                <td class="right"><button class="btn small" type="button" (click)="download(d)" [disabled]="downloading() === d.id">Download</button></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `
})
export class DocumentsPanel {
  private readonly api = inject(MedicalApi);

  readonly patientId = input.required<number>();
  readonly canUpload = input(false);

  protected readonly types = TYPES;
  protected readonly words = splitWords;
  protected readonly documents = signal<MedicalDocument[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly downloading = signal<number | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);
  protected readonly file = signal<File | null>(null);
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');
  protected type: DocumentType = 'LabResult';
  protected description = '';

  constructor() {
    effect(() => {
      this.patientId();
      untracked(() => this.load());
    });
  }

  protected pick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.error.set(null);
    if (file && file.size > MAX_BYTES) {
      this.error.set('The file is larger than 10 MB.');
      input.value = '';
      this.file.set(null);
      return;
    }
    this.file.set(file);
  }

  protected upload(): void {
    const file = this.file();
    if (!file) return;
    this.busy.set(true);
    this.error.set(null);
    this.message.set(null);
    this.api.upload(this.patientId(), file, this.type, orNull(this.description), null).subscribe({
      next: () => {
        this.busy.set(false);
        this.file.set(null);
        this.description = '';
        const input = this.fileInput()?.nativeElement;
        if (input) input.value = '';
        this.message.set('The document was uploaded.');
        this.load();
      },
      error: err => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(err));
      }
    });
  }

  protected download(d: MedicalDocument): void {
    this.downloading.set(d.id);
    this.api.download(d.id).subscribe({
      next: response => {
        this.downloading.set(null);
        saveDownload(response, d.fileName);
      },
      error: err => {
        this.downloading.set(null);
        this.error.set(apiErrorMessage(err));
      }
    });
  }

  private load(): void {
    this.loading.set(true);
    this.api.documents(this.patientId()).subscribe({
      next: list => {
        this.documents.set(list);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(apiErrorMessage(err));
        this.loading.set(false);
      }
    });
  }
}
