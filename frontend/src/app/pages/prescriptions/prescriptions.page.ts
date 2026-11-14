import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { StoreApi } from '../../core/store.api';
import { MedicalApi } from '../../core/medical.api';
import { AuthService } from '../../core/auth.service';
import { Medication, PagedResult, Prescription, PrescriptionRequestItem, PrescriptionRequestStatus } from '../../core/model';
import { apiErrorMessage } from '../../core/api-error';
import { orNull } from '../../core/util';
import { Pager } from '../../shared/pager';

type Tab = 'requests' | 'history';

interface ApproveForm { medication: Medication | null; term: string; results: Medication[]; dosage: string; frequency: string; days: number; validDays: number; instructions: string; }

/** Staff view of prescription requests and the full prescription history. */
@Component({
  selector: 'app-prescriptions',
  imports: [FormsModule, RouterLink, DatePipe, Pager],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Prescriptions</h1>

    <div class="tabs" role="tablist">
      <button type="button" role="tab" [class.active]="tab() === 'requests'" [attr.aria-selected]="tab() === 'requests'" (click)="select('requests')">
        Requests @if (pendingCount() > 0) { <span class="count-pill">{{ pendingCount() }}</span> }
      </button>
      <button type="button" role="tab" [class.active]="tab() === 'history'" [attr.aria-selected]="tab() === 'history'" (click)="select('history')">History</button>
    </div>

    @if (message()) { <p class="alert success" role="status">{{ message() }}</p> }
    @if (error()) { <p class="alert error" role="alert">{{ error() }}</p> }

    @if (tab() === 'requests') {
      <div class="toolbar">
        <p class="muted grow">{{ isDoctor() ? 'Patients who asked you for a prescription.' : 'All prescription requests sent to doctors.' }}</p>
        <select [ngModel]="requestStatus()" (ngModelChange)="requestStatus.set($event); requestPage.set(1); loadRequests()" aria-label="Show">
          <option [ngValue]="'Pending'">Waiting for an answer</option>
          <option [ngValue]="'Approved'">Approved</option>
          <option [ngValue]="'Declined'">Declined</option>
          <option [ngValue]="null">All</option>
        </select>
      </div>

      @if (requests(); as data) {
        @if (data.items.length === 0) { <p class="empty card muted">No requests here.</p> }
        <ul class="stack">
          @for (r of data.items; track r.id) {
            <li class="card">
              <div class="row-head">
                <div>
                  <h3><a class="plain" [routerLink]="['/patients', r.patientId]" [queryParams]="{ tab: 'prescriptions' }">{{ r.patientName }}</a>
                    @if (r.medicationName) { <span class="muted"> · {{ r.medicationName }}</span> }</h3>
                  <p class="muted">
                    {{ r.createdAt | date: 'd MMM y, HH:mm' }}
                    @if (!isDoctor()) { · to Dr. {{ r.doctorName }} ({{ r.specialization }}) }
                    @if (r.appointmentDate) { · about the visit on {{ r.appointmentDate | date: 'd MMM y' }} ({{ r.appointmentService }}) }
                  </p>
                </div>
                <span [class]="'badge rq-' + r.status.toLowerCase()">{{ r.status === 'Pending' ? 'Waiting' : r.status }}</span>
              </div>
              <p class="pre-line">“{{ r.message }}”</p>
              @if (r.prescriptionCode) { <p class="small">Issued prescription <strong class="code-text">{{ r.prescriptionCode }}</strong></p> }
              @if (r.status === 'Declined' && r.decisionNote) { <p class="small"><span class="muted">Reason:</span> {{ r.decisionNote }}</p> }

              @if (isDoctor() && r.status === 'Pending') {
                @if (openId() !== r.id) {
                  <div class="card-actions">
                    <button class="btn small primary" type="button" (click)="startApprove(r)">Approve and prescribe…</button>
                    <button class="btn small danger" type="button" (click)="startDecline(r)">Decline…</button>
                  </div>
                } @else if (approve(); as f) {
                  <div class="inline-panel">
                    <div class="field">
                      <label for="ap-med">Medication</label>
                      @if (f.medication; as m) {
                        <div class="picked"><span><strong>{{ m.name }}</strong> {{ m.strength }} {{ m.form }}</span>
                          <button class="btn small" type="button" (click)="f.medication = null">Change</button></div>
                      } @else {
                        <input id="ap-med" type="search" placeholder="Search medications" autocomplete="off" [ngModel]="f.term" (ngModelChange)="searchMedication($event)" />
                        @if (f.results.length > 0) {
                          <ul class="pick-list">
                            @for (m of f.results; track m.id) {
                              <li><button type="button" (click)="f.medication = m; f.results = []"><strong>{{ m.name }}</strong> <span class="muted">{{ m.strength }} {{ m.form }}</span></button></li>
                            }
                          </ul>
                        }
                      }
                    </div>
                    <div class="form-grid three">
                      <div class="field"><label for="ap-dose">Dosage</label><input id="ap-dose" maxlength="100" placeholder="1 tablet" [(ngModel)]="f.dosage" /></div>
                      <div class="field"><label for="ap-freq">Frequency</label><input id="ap-freq" maxlength="100" placeholder="once a day" [(ngModel)]="f.frequency" /></div>
                      <div class="field"><label for="ap-days">For (days)</label><input id="ap-days" type="number" min="1" max="365" [(ngModel)]="f.days" /></div>
                    </div>
                    <div class="form-grid">
                      <div class="field"><label for="ap-valid">Valid for (days)</label><input id="ap-valid" type="number" min="1" max="365" [(ngModel)]="f.validDays" /></div>
                      <div class="field"><label for="ap-instr">Instructions (optional)</label><input id="ap-instr" maxlength="2000" [(ngModel)]="f.instructions" /></div>
                    </div>
                    <p class="muted small">The patient gets a prescription code to buy the medicine in the store.</p>
                    <div class="card-actions">
                      <button class="btn small primary" type="button" (click)="submitApprove(r)" [disabled]="busy()">Issue prescription</button>
                      <button class="btn small" type="button" (click)="openId.set(null)">Back</button>
                    </div>
                  </div>
                } @else {
                  <div class="inline-panel">
                    <div class="field"><label for="dc-reason">Reason (sent to the patient)</label>
                      <input id="dc-reason" maxlength="500" placeholder="For example: I need to see you first; please book a visit." [(ngModel)]="declineReason" /></div>
                    <div class="card-actions">
                      <button class="btn small danger" type="button" (click)="submitDecline(r)" [disabled]="busy() || declineReason.trim().length < 5">Decline</button>
                      <button class="btn small" type="button" (click)="openId.set(null)">Back</button>
                    </div>
                  </div>
                }
              }
            </li>
          }
        </ul>
        <app-pager [page]="requestPage()" [pageSize]="pageSize" [totalCount]="data.totalCount" (pageChange)="requestPage.set($event); loadRequests()" />
      } @else { <p class="muted">Loading...</p> }
    } @else {
      <form class="toolbar" (ngSubmit)="historyPage.set(1); loadHistory()">
        <div class="field grow"><label for="h-search" class="sr-only">Search</label>
          <input id="h-search" name="search" type="search" placeholder="Patient name, personal number or prescription code" [(ngModel)]="search" /></div>
        <label class="check"><input type="checkbox" name="active" [(ngModel)]="activeOnly" (ngModelChange)="historyPage.set(1); loadHistory()" /> Valid only</label>
        <button class="btn small" type="submit">Search</button>
      </form>
      <p class="muted small">{{ isDoctor() ? 'Prescriptions you wrote and those of your patients.' : 'Every prescription issued at the clinic.' }}</p>

      @if (history(); as data) {
        @if (data.items.length === 0) {
          <p class="empty card muted">No prescriptions found.</p>
        } @else {
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Code</th><th>Patient</th><th>Medicines</th><th>Doctor</th><th>Issued</th><th>Valid until</th><th>Store</th></tr></thead>
              <tbody>
                @for (p of data.items; track p.id) {
                  <tr>
                    <td class="nowrap"><span class="code-text">{{ p.code ?? '—' }}</span></td>
                    <td><a [routerLink]="['/patients', p.patientId]" [queryParams]="{ tab: 'prescriptions' }">{{ p.patientName }}</a></td>
                    <td>@for (i of p.items; track $index) { <div>{{ i.medicationName }} {{ i.strength }} <span class="muted small">· {{ i.dosage }}, {{ i.frequency }}, {{ i.durationDays }} d</span></div> }</td>
                    <td>Dr. {{ p.doctorName }}</td>
                    <td class="nowrap">{{ p.issuedDate | date: 'd MMM y' }}</td>
                    <td class="nowrap"><span class="badge" [class.ok]="p.isActive" [class.muted-badge]="!p.isActive">{{ p.expiryDate | date: 'd MMM y' }}</span></td>
                    <td>{{ p.usedFor.length > 0 ? 'Bought: ' + p.usedFor.join(', ') : '—' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
        <app-pager [page]="historyPage()" [pageSize]="pageSize" [totalCount]="data.totalCount" (pageChange)="historyPage.set($event); loadHistory()" />
      } @else { <p class="muted">Loading...</p> }
    }
  `
})
export class PrescriptionsPage {
  private readonly api = inject(StoreApi);
  private readonly medical = inject(MedicalApi);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly isDoctor = computed(() => this.auth.hasRole('Doctor'));
  protected readonly pageSize = 15;
  protected readonly tab = signal<Tab>(this.route.snapshot.queryParamMap.get('tab') === 'history' ? 'history' : 'requests');
  protected readonly requests = signal<PagedResult<PrescriptionRequestItem> | null>(null);
  protected readonly history = signal<PagedResult<Prescription> | null>(null);
  protected readonly requestStatus = signal<PrescriptionRequestStatus | null>('Pending');
  protected readonly requestPage = signal(1);
  protected readonly historyPage = signal(1);
  protected readonly pendingCount = signal(0);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);
  protected readonly openId = signal<number | null>(null);
  protected readonly approve = signal<ApproveForm | null>(null);
  protected search = '';
  protected activeOnly = false;
  protected declineReason = '';
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.loadRequests();
    this.loadHistory();
  }

  protected select(tab: Tab): void {
    this.tab.set(tab);
    this.message.set(null);
    void this.router.navigate([], { queryParams: { tab }, replaceUrl: true });
  }

  protected startApprove(r: PrescriptionRequestItem): void {
    this.openId.set(r.id);
    this.error.set(null);
    this.message.set(null);
    this.approve.set({ medication: null, term: '', results: [], dosage: '', frequency: '', days: 30, validDays: 30, instructions: '' });
    // Pre-fill the medicine the patient asked for.
    if (r.medicationId && r.medicationName) {
      this.medical.medications(r.medicationName.split(' ')[0]).subscribe(list => {
        const match = list.find(m => m.id === r.medicationId);
        const f = this.approve();
        if (match && f) this.approve.set({ ...f, medication: match });
      });
    }
  }

  protected startDecline(r: PrescriptionRequestItem): void {
    this.openId.set(r.id);
    this.approve.set(null);
    this.declineReason = '';
    this.error.set(null);
    this.message.set(null);
  }

  protected searchMedication(term: string): void {
    const f = this.approve();
    if (!f) return;
    f.term = term;
    if (this.searchTimer) clearTimeout(this.searchTimer);
    if (term.trim().length < 2) {
      this.approve.set({ ...f, results: [] });
      return;
    }
    this.searchTimer = setTimeout(() => {
      this.medical.medications(term.trim()).subscribe(list => {
        const current = this.approve();
        if (current) this.approve.set({ ...current, results: list.slice(0, 10) });
      });
    }, 250);
  }

  protected submitApprove(r: PrescriptionRequestItem): void {
    const f = this.approve();
    if (!f) return;
    if (!f.medication || !f.dosage.trim() || !f.frequency.trim() || !(f.days > 0) || !(f.validDays > 0)) {
      this.error.set('Choose the medication and fill in dosage, frequency and days.');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.api.approveRequest(r.id, {
      medicationId: f.medication.id, dosage: f.dosage.trim(), frequency: f.frequency.trim(),
      durationDays: Number(f.days), validDays: Number(f.validDays), instructions: orNull(f.instructions)
    }).subscribe({
      next: res => {
        this.busy.set(false);
        this.openId.set(null);
        this.message.set(`Prescription ${res.prescriptionCode} was issued. ${r.patientName} has been notified.`);
        this.loadRequests();
        this.loadHistory();
      },
      error: err => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(err));
      }
    });
  }

  protected submitDecline(r: PrescriptionRequestItem): void {
    this.busy.set(true);
    this.error.set(null);
    this.api.declineRequest(r.id, this.declineReason.trim()).subscribe({
      next: () => {
        this.busy.set(false);
        this.openId.set(null);
        this.message.set(`The request was declined. ${r.patientName} has been notified.`);
        this.loadRequests();
      },
      error: err => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(err));
      }
    });
  }

  protected loadRequests(): void {
    this.api.requests(this.requestStatus(), this.requestPage(), this.pageSize).subscribe({
      next: r => this.requests.set(r),
      error: err => this.error.set(apiErrorMessage(err))
    });
    this.api.requests('Pending', 1, 1).subscribe({ next: r => this.pendingCount.set(r.totalCount) });
  }

  protected loadHistory(): void {
    this.api.prescriptions(this.search.trim() || null, this.activeOnly || null, this.historyPage(), this.pageSize).subscribe({
      next: r => this.history.set(r),
      error: err => this.error.set(apiErrorMessage(err))
    });
  }
}
