import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { AdminApi, DepartmentRequest, RoomRequest } from '../../core/admin.api';
import { Department, Room, RoomType } from '../../core/model';
import { apiErrorMessage } from '../../core/api-error';
import { orNull, splitWords } from '../../core/util';

const ROOM_TYPES: RoomType[] = ['Consultation', 'Surgery', 'Radiology', 'DentalChair', 'Laboratory'];

@Component({
  selector: 'app-admin-departments',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (message()) { <p class="alert success" role="status">{{ message() }}</p> }
    @if (error()) { <p class="alert error" role="alert">{{ error() }}</p> }

    <div class="page-head">
      <h2>Departments</h2>
      <button class="btn primary small" type="button" (click)="editDept(null)">Add a department</button>
    </div>

    @if (dept(); as f) {
      <form class="card form-card" (ngSubmit)="saveDept()">
        <div class="form-grid">
          <div class="field"><label for="dp-name">Name</label><input id="dp-name" name="name" maxlength="100" [(ngModel)]="f.name" /></div>
          <div class="field"><label for="dp-desc">Description</label><input id="dp-desc" name="desc" maxlength="500" [(ngModel)]="f.description" /></div>
        </div>
        <div class="card-actions">
          <button class="btn primary small" type="submit" [disabled]="busy()">Save</button>
          <button class="btn small" type="button" (click)="dept.set(null)">Cancel</button>
        </div>
      </form>
    }

    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Department</th><th>Description</th><th class="right">Rooms</th><th class="right">Services</th><th></th></tr></thead>
        <tbody>
          @for (d of departments(); track d.id) {
            <tr>
              <td>{{ d.name }}</td>
              <td>{{ d.description ?? '—' }}</td>
              <td class="right">{{ d.roomCount }}</td>
              <td class="right">{{ d.serviceCount }}</td>
              <td class="right nowrap">
                <button class="btn small" type="button" (click)="editDept(d)">Edit</button>
                @if (d.roomCount === 0 && d.serviceCount === 0) {
                  <button class="btn small danger" type="button" (click)="deleteDept(d)" [disabled]="busy()">Delete</button>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    <div class="page-head section-gap">
      <h2>Rooms</h2>
      <button class="btn primary small" type="button" (click)="editRoom(null)">Add a room</button>
    </div>

    @if (room(); as f) {
      <form class="card form-card" (ngSubmit)="saveRoom()">
        <div class="form-grid">
          <div class="field"><label for="rm-no">Room number</label><input id="rm-no" name="no" maxlength="30" [(ngModel)]="f.number" /></div>
          <div class="field"><label for="rm-floor">Floor</label><input id="rm-floor" name="floor" type="number" min="-5" max="100" [(ngModel)]="f.floor" /></div>
          <div class="field">
            <label for="rm-type">Type</label>
            <select id="rm-type" name="type" [(ngModel)]="f.type">
              @for (t of roomTypes; track t) { <option [value]="t">{{ words(t) }}</option> }
            </select>
          </div>
          <div class="field">
            <label for="rm-dept">Department</label>
            <select id="rm-dept" name="dept" [(ngModel)]="f.departmentId">
              <option [ngValue]="0" disabled>Choose</option>
              @for (d of departments(); track d.id) { <option [ngValue]="d.id">{{ d.name }}</option> }
            </select>
          </div>
        </div>
        <label class="check"><input type="checkbox" name="active" [(ngModel)]="f.isActive" /> In use</label>
        <div class="card-actions">
          <button class="btn primary small" type="submit" [disabled]="busy()">Save</button>
          <button class="btn small" type="button" (click)="room.set(null)">Cancel</button>
        </div>
      </form>
    }

    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Room</th><th>Floor</th><th>Type</th><th>Department</th><th>Status</th><th></th></tr></thead>
        <tbody>
          @for (r of rooms(); track r.id) {
            <tr>
              <td>{{ r.number }}</td>
              <td>{{ r.floor }}</td>
              <td>{{ words(r.type) }}</td>
              <td>{{ r.department }}</td>
              <td><span class="badge" [class.ok]="r.isActive" [class.muted-badge]="!r.isActive">{{ r.isActive ? 'In use' : 'Closed' }}</span></td>
              <td class="right"><button class="btn small" type="button" (click)="editRoom(r)">Edit</button></td>
            </tr>
          } @empty {
            <tr><td colspan="6" class="muted">No rooms.</td></tr>
          }
        </tbody>
      </table>
    </div>
  `
})
export class AdminDepartmentsTab {
  private readonly api = inject(AdminApi);

  protected readonly roomTypes = ROOM_TYPES;
  protected readonly words = splitWords;
  protected readonly departments = signal<Department[]>([]);
  protected readonly rooms = signal<Room[]>([]);
  protected readonly dept = signal<DepartmentRequest | null>(null);
  protected readonly room = signal<RoomRequest | null>(null);
  private deptId: number | null = null;
  private roomId: number | null = null;
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);

  constructor() {
    this.load();
  }

  protected editDept(d: Department | null): void {
    this.reset();
    this.deptId = d?.id ?? null;
    this.dept.set({ name: d?.name ?? '', description: d?.description ?? '' });
  }

  protected editRoom(r: Room | null): void {
    this.reset();
    this.roomId = r?.id ?? null;
    this.room.set(r
      ? { number: r.number, floor: r.floor, type: r.type, isActive: r.isActive, departmentId: r.departmentId }
      : { number: '', floor: 1, type: 'Consultation', isActive: true, departmentId: 0 });
  }

  protected saveDept(): void {
    const f = this.dept();
    if (!f?.name.trim()) {
      this.error.set('Enter a name.');
      return;
    }
    const request = { name: f.name.trim(), description: orNull(f.description) };
    this.run(this.deptId ? this.api.updateDepartment(this.deptId, request) : this.api.createDepartment(request), 'The department was saved.');
  }

  protected deleteDept(d: Department): void {
    this.reset();
    this.run(this.api.deleteDepartment(d.id), `${d.name} was deleted.`);
  }

  protected saveRoom(): void {
    const f = this.room();
    if (!f?.number.trim() || !f.departmentId) {
      this.error.set('Enter the room number and choose a department.');
      return;
    }
    const request = { ...f, number: f.number.trim(), floor: Number(f.floor) };
    this.run(this.roomId ? this.api.updateRoom(this.roomId, request) : this.api.createRoom(request), 'The room was saved.');
  }

  private reset(): void {
    this.dept.set(null);
    this.room.set(null);
    this.error.set(null);
    this.message.set(null);
  }

  private run(request: Observable<unknown>, success: string): void {
    this.busy.set(true);
    this.error.set(null);
    request.subscribe({
      next: () => {
        this.busy.set(false);
        this.dept.set(null);
        this.room.set(null);
        this.message.set(success);
        this.load();
      },
      error: err => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(err));
      }
    });
  }

  private load(): void {
    this.api.departments().subscribe({ next: list => this.departments.set(list), error: err => this.error.set(apiErrorMessage(err)) });
    this.api.rooms().subscribe({ next: list => this.rooms.set(list), error: err => this.error.set(apiErrorMessage(err)) });
  }
}
