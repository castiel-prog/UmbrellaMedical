import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  PagedResult, PatientAllergy, PatientAllergyInput, PatientContactRequest, PatientDetails,
  PatientInsurance, PatientListItem, PatientRequest
} from './model';
import { queryParams } from './util';

@Injectable({ providedIn: 'root' })
export class PatientsApi {
  private readonly http = inject(HttpClient);

  list(search: string | null, page = 1, pageSize = 20): Observable<PagedResult<PatientListItem>> {
    return this.http.get<PagedResult<PatientListItem>>('/api/patients', { params: queryParams({ search, page, pageSize }) });
  }

  get(id: number): Observable<PatientDetails> {
    return this.http.get<PatientDetails>(`/api/patients/${id}`);
  }

  me(): Observable<PatientDetails> {
    return this.http.get<PatientDetails>('/api/patients/me');
  }

  create(request: PatientRequest): Observable<PatientDetails> {
    return this.http.post<PatientDetails>('/api/patients', request);
  }

  update(id: number, request: PatientRequest): Observable<PatientDetails> {
    return this.http.put<PatientDetails>(`/api/patients/${id}`, request);
  }

  updateMyContact(request: PatientContactRequest): Observable<PatientDetails> {
    return this.http.put<PatientDetails>('/api/patients/me', request);
  }

  replaceAllergies(patientId: number, allergies: PatientAllergyInput[]): Observable<PatientAllergy[]> {
    return this.http.put<PatientAllergy[]>(`/api/patients/${patientId}/allergies`, { allergies });
  }

  insurances(patientId: number): Observable<PatientInsurance[]> {
    return this.http.get<PatientInsurance[]>(`/api/patients/${patientId}/insurances`);
  }

  addInsurance(patientId: number, request: {
    insuranceCompanyId: number; policyNumber: string; coveragePercent: number; validFrom: string; validTo: string;
  }): Observable<PatientInsurance> {
    return this.http.post<PatientInsurance>(`/api/patients/${patientId}/insurances`, request);
  }

  updateInsurance(patientId: number, id: number, request: {
    coveragePercent: number; validFrom: string; validTo: string;
  }): Observable<PatientInsurance> {
    return this.http.put<PatientInsurance>(`/api/patients/${patientId}/insurances/${id}`, request);
  }
}
