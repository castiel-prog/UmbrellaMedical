import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ConflictingAppointment, CreateDoctorRequest, DoctorDetails, DoctorScheduleOverview, PagedResult,
  Receptionist, ScheduleItem, TimeOff, TimeOffStatus, TimeOffType
} from './model';
import { queryParams } from './util';

@Injectable({ providedIn: 'root' })
export class StaffApi {
  private readonly http = inject(HttpClient);

  // Doctors
  myDoctorProfile(): Observable<DoctorDetails> {
    return this.http.get<DoctorDetails>('/api/doctors/me');
  }

  createDoctor(request: CreateDoctorRequest): Observable<DoctorDetails> {
    return this.http.post<DoctorDetails>('/api/doctors', request);
  }

  schedule(doctorId: number): Observable<ScheduleItem[]> {
    return this.http.get<ScheduleItem[]>(`/api/doctors/${doctorId}/schedule`);
  }

  updateSchedule(doctorId: number, items: ScheduleItem[]): Observable<ScheduleItem[]> {
    return this.http.put<ScheduleItem[]>(`/api/doctors/${doctorId}/schedule`, { items });
  }

  assignServices(doctorId: number, serviceIds: number[]): Observable<unknown> {
    return this.http.put(`/api/doctors/${doctorId}/services`, { serviceIds });
  }

  // Time off
  timeOff(query: { doctorId?: number | null; status?: TimeOffStatus | null; page?: number; pageSize?: number }): Observable<PagedResult<TimeOff>> {
    return this.http.get<PagedResult<TimeOff>>('/api/time-off', { params: queryParams({ ...query }) });
  }

  requestTimeOff(request: { type: TimeOffType; startDateTime: string; endDateTime: string; reason: string | null }): Observable<TimeOff> {
    return this.http.post<TimeOff>('/api/time-off', request);
  }

  conflicts(id: number): Observable<ConflictingAppointment[]> {
    return this.http.get<ConflictingAppointment[]>(`/api/time-off/${id}/appointments`);
  }

  approveTimeOff(id: number, cancelConflictingAppointments: boolean): Observable<TimeOff> {
    return this.http.post<TimeOff>(`/api/time-off/${id}/approve`, { cancelConflictingAppointments });
  }

  declineTimeOff(id: number, reason: string): Observable<TimeOff> {
    return this.http.post<TimeOff>(`/api/time-off/${id}/decline`, { reason });
  }

  withdrawTimeOff(id: number): Observable<void> {
    return this.http.delete<void>(`/api/time-off/${id}`);
  }

  // Staff schedule overview
  staffSchedule(from: string, to: string, doctorId: number | null): Observable<DoctorScheduleOverview[]> {
    return this.http.get<DoctorScheduleOverview[]>('/api/admin/staff-schedule', { params: queryParams({ from, to, doctorId }) });
  }

  // Receptionists
  receptionists(): Observable<Receptionist[]> {
    return this.http.get<Receptionist[]>('/api/receptionists');
  }

  createReceptionist(request: { email: string; password: string; firstName: string; lastName: string; phone: string | null }): Observable<Receptionist> {
    return this.http.post<Receptionist>('/api/receptionists', request);
  }
}
