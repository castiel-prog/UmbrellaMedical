import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  AdminReview, AdminService, Department, DoctorReportRow, PagedResult, ReportSummary, RevenueReport,
  Role, Room, RoomType, ServiceReportRow, UserListItem
} from './model';
import { queryParams } from './util';

export interface DepartmentRequest { name: string; description: string | null; }
export interface RoomRequest { number: string; floor: number; type: RoomType; isActive: boolean; departmentId: number; }
export interface ServiceRequest {
  name: string; description: string | null; price: number; durationMinutes: number; departmentId: number; isActive: boolean;
}

@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly http = inject(HttpClient);

  // Departments
  departments(): Observable<Department[]> {
    return this.http.get<Department[]>('/api/departments');
  }
  createDepartment(r: DepartmentRequest): Observable<Department> {
    return this.http.post<Department>('/api/departments', r);
  }
  updateDepartment(id: number, r: DepartmentRequest): Observable<Department> {
    return this.http.put<Department>(`/api/departments/${id}`, r);
  }
  deleteDepartment(id: number): Observable<void> {
    return this.http.delete<void>(`/api/departments/${id}`);
  }

  // Rooms
  rooms(): Observable<Room[]> {
    return this.http.get<Room[]>('/api/rooms');
  }
  createRoom(r: RoomRequest): Observable<Room> {
    return this.http.post<Room>('/api/rooms', r);
  }
  updateRoom(id: number, r: RoomRequest): Observable<Room> {
    return this.http.put<Room>(`/api/rooms/${id}`, r);
  }

  // Services
  services(search: string | null = null): Observable<AdminService[]> {
    return this.http.get<AdminService[]>('/api/admin/services', { params: queryParams({ search }) });
  }
  createService(r: ServiceRequest): Observable<AdminService> {
    return this.http.post<AdminService>('/api/admin/services', r);
  }
  updateService(id: number, r: ServiceRequest): Observable<AdminService> {
    return this.http.put<AdminService>(`/api/admin/services/${id}`, r);
  }

  // Users
  users(query: { role?: Role | null; isActive?: boolean | null; search?: string | null; page?: number; pageSize?: number }): Observable<PagedResult<UserListItem>> {
    return this.http.get<PagedResult<UserListItem>>('/api/admin/users', { params: queryParams({ ...query }) });
  }
  setUserStatus(id: number, isActive: boolean, reason: string | null): Observable<void> {
    return this.http.put<void>(`/api/admin/users/${id}/status`, { isActive, reason });
  }

  // Reviews
  reviews(query: { doctorId?: number | null; isApproved?: boolean | null; page?: number; pageSize?: number }): Observable<PagedResult<AdminReview>> {
    return this.http.get<PagedResult<AdminReview>>('/api/admin/reviews', { params: queryParams({ ...query }) });
  }
  setReviewVisibility(id: number, isApproved: boolean): Observable<void> {
    return this.http.put<void>(`/api/reviews/${id}/visibility`, { isApproved });
  }

  // Reminders
  runReminders(): Observable<{ remindersSent: number }> {
    return this.http.post<{ remindersSent: number }>('/api/admin/reminders/run', {});
  }

  // Reports
  summary(from: string, to: string): Observable<ReportSummary> {
    return this.http.get<ReportSummary>('/api/reports/summary', { params: queryParams({ from, to }) });
  }
  byDoctor(from: string, to: string): Observable<DoctorReportRow[]> {
    return this.http.get<DoctorReportRow[]>('/api/reports/appointments-by-doctor', { params: queryParams({ from, to }) });
  }
  popularServices(from: string, to: string, top = 10): Observable<ServiceReportRow[]> {
    return this.http.get<ServiceReportRow[]>('/api/reports/popular-services', { params: queryParams({ from, to, top }) });
  }
  revenue(from: string, to: string, groupBy: 'day' | 'month'): Observable<RevenueReport> {
    return this.http.get<RevenueReport>('/api/reports/revenue', { params: queryParams({ from, to, groupBy }) });
  }
  exportRevenue(from: string, to: string, groupBy: 'day' | 'month'): Observable<HttpResponse<Blob>> {
    return this.http.get('/api/reports/revenue/export', {
      params: queryParams({ from, to, groupBy }), responseType: 'blob', observe: 'response'
    });
  }
}
