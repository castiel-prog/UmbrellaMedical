import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Allergy, CreatePrescriptionRequest, Diagnosis, DocumentType, MedicalDocument, MedicalRecord,
  MedicalRecordRequest, Medication, PagedResult, Prescription
} from './model';
import { queryParams } from './util';

@Injectable({ providedIn: 'root' })
export class MedicalApi {
  private readonly http = inject(HttpClient);

  // Records
  records(patientId: number, page = 1, pageSize = 20): Observable<PagedResult<MedicalRecord>> {
    return this.http.get<PagedResult<MedicalRecord>>(`/api/patients/${patientId}/medical-records`, {
      params: queryParams({ page, pageSize })
    });
  }

  record(id: number): Observable<MedicalRecord> {
    return this.http.get<MedicalRecord>(`/api/medical-records/${id}`);
  }

  createRecord(patientId: number, request: MedicalRecordRequest): Observable<MedicalRecord> {
    return this.http.post<MedicalRecord>(`/api/patients/${patientId}/medical-records`, request);
  }

  updateRecord(id: number, request: MedicalRecordRequest): Observable<MedicalRecord> {
    return this.http.put<MedicalRecord>(`/api/medical-records/${id}`, request);
  }

  // Prescriptions
  prescriptions(patientId: number, activeOnly: boolean | null, page = 1, pageSize = 20): Observable<PagedResult<Prescription>> {
    return this.http.get<PagedResult<Prescription>>(`/api/patients/${patientId}/prescriptions`, {
      params: queryParams({ activeOnly, page, pageSize })
    });
  }

  myPrescriptions(activeOnly: boolean | null, page = 1, pageSize = 20): Observable<PagedResult<Prescription>> {
    return this.http.get<PagedResult<Prescription>>('/api/prescriptions', { params: queryParams({ activeOnly, page, pageSize }) });
  }

  createPrescription(request: CreatePrescriptionRequest): Observable<Prescription> {
    return this.http.post<Prescription>('/api/prescriptions', request);
  }

  // Documents
  documents(patientId: number): Observable<MedicalDocument[]> {
    return this.http.get<MedicalDocument[]>(`/api/patients/${patientId}/documents`);
  }

  upload(patientId: number, file: File, type: DocumentType, description: string | null, medicalRecordId: number | null): Observable<MedicalDocument> {
    const form = new FormData();
    form.append('file', file);
    form.append('type', type);
    if (description) form.append('description', description);
    if (medicalRecordId) form.append('medicalRecordId', String(medicalRecordId));
    return this.http.post<MedicalDocument>(`/api/patients/${patientId}/documents`, form);
  }

  download(id: number): Observable<HttpResponse<Blob>> {
    return this.http.get(`/api/documents/${id}/download`, { responseType: 'blob', observe: 'response' });
  }

  // Catalog
  diagnoses(search: string | null): Observable<Diagnosis[]> {
    return this.http.get<Diagnosis[]>('/api/diagnoses', { params: queryParams({ search }) });
  }

  medications(search: string | null): Observable<Medication[]> {
    return this.http.get<Medication[]>('/api/medications', { params: queryParams({ search }) });
  }

  allergies(): Observable<Allergy[]> {
    return this.http.get<Allergy[]>('/api/allergies');
  }
}
