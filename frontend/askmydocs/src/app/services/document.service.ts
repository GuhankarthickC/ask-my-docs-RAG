import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';

export interface UploadedDocument {
  id: string;
  fileName: string;
  size: number;
  uploadedOn: string;
  contentType?: string;
  rawName?: string;
}

interface DocumentApiModel {
  name: string;
  sizeBytes: number;
  format: string;
  uploadedOn: string;
}

interface UploadApiResponse {
  blobName: string;
  blobUri: string;
}

export interface UploadResult {
  success: boolean;
  fileName: string;
  document?: UploadedDocument;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class DocumentService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:5089/api/FileUpload';

  listDocuments(): Observable<UploadedDocument[]> {
    return this.http.get<DocumentApiModel[]>(this.baseUrl).pipe(
      map(items => items.map(item => this.toUploadedDocument(item))),
      catchError(error => {
        console.error('Unable to load documents', error);
        return of([]);
      })
    );
  }

  uploadDocument(file: File): Observable<UploadResult> {
    const formData = new FormData();
    formData.append('file', file, file.name);

    return this.http.post<UploadApiResponse>(this.baseUrl, formData).pipe(
      map(apiModel => ({ success: true, fileName: file.name, document: this.fromUploadResponse(apiModel, file) })),
      catchError(error => {
        console.error('Upload failed', error);
        return of({ success: false, fileName: file.name, message: this.describeError(error) });
      })
    );
  }

  deleteDocument(documentId: string): Observable<boolean> {
    const targetId = encodeURIComponent(documentId);
    return this.http.delete<void>(`${this.baseUrl}/${targetId}`).pipe(
      map(() => true),
      catchError(error => {
        console.error('Delete failed', error);
        return of(false);
      })
    );
  }

  private describeError(error: HttpErrorResponse): string {
    if (error.error instanceof ErrorEvent) {
      return error.error.message;
    }

    if (typeof error.error === 'string') {
      const cleaned = this.stripTags(error.error);
      if (cleaned) {
        return cleaned;
      }
    }

    const apiMessage = this.extractMessageFromPayload(error.error);
    if (apiMessage) {
      return apiMessage;
    }

    if (error.status) {
      const label = error.statusText || 'Server error';
      return `${label} (${error.status})`;
    }

    return 'Unexpected error while uploading. Please try again.';
  }

  private extractMessageFromPayload(payload: unknown): string | undefined {
    if (!payload || typeof payload !== 'object') {
      return undefined;
    }

    const maybeMessage = (payload as { message?: unknown }).message;
    return typeof maybeMessage === 'string' ? maybeMessage : undefined;
  }

  private stripTags(value: string): string {
    const withoutTags = value.replace(/<[^>]*>/g, '').trim();
    return withoutTags.length ? withoutTags : '';
  }

  private toUploadedDocument(api: DocumentApiModel): UploadedDocument {
    return {
      id: api.name,
      rawName: api.name,
      fileName: this.extractReadableName(api.name),
      size: api.sizeBytes,
      uploadedOn: api.uploadedOn,
      contentType: api.format
    };
  }

  private extractReadableName(name: string): string {
    if (!name.includes('-')) {
      return name;
    }
    const [, ...rest] = name.split('-');
    return rest.join('-') || name;
  }

  private fromUploadResponse(response: UploadApiResponse, file: File): UploadedDocument {
    return {
      id: response.blobName,
      rawName: response.blobName,
      fileName: file.name,
      size: file.size,
      uploadedOn: new Date().toISOString(),
      contentType: file.type,
    };
  }
}
