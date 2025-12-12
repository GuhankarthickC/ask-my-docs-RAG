import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DocumentService, UploadedDocument } from '../../../services/document.service';

@Component({
  selector: 'app-uploaded-documents',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './uploaded-documents.component.html',
  styleUrl: './uploaded-documents.component.scss'
})
export class UploadedDocumentsComponent implements OnInit {
  documents: UploadedDocument[] = [];
  loading = false;
  errorMessage = '';

  constructor(private readonly documentService: DocumentService, private readonly router: Router) {}

  ngOnInit(): void {
    this.loadDocuments();
  }

  refresh(): void {
    this.loadDocuments();
  }

  async goToChat(document: UploadedDocument): Promise<void> {
    await this.router.navigate(['/chat'], { queryParams: { documentId: document.id } });
  }

  deleteDocument(document: UploadedDocument): void {
    this.documentService.deleteDocument(document.id).subscribe(success => {
      if (!success) {
        this.errorMessage = 'Unable to delete document right now. Please try again.';
        return;
      }
      this.loadDocuments();
    });
  }

  trackByDocId(_: number, doc: UploadedDocument): string {
    return doc.id;
  }

  formatSize(bytes: number): string {
    if (!bytes) {
      return '0 B';
    }
    const units = ['B', 'KB', 'MB', 'GB'];
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const size = bytes / Math.pow(1024, exponent);
    return `${size.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
  }

  getExtension(fileName?: string): string {
    if (!fileName || !fileName.includes('.')) {
      return 'FILE';
    }
    return fileName.split('.').pop()?.slice(0, 4).toUpperCase() ?? 'FILE';
  }

  getDescription(contentType?: string): string {
    if (!contentType) {
      return 'Stored securely and ready to power grounded chat.';
    }
    if (contentType.includes('pdf')) {
      return 'Portable document indexed for semantic answers.';
    }
    if (contentType.includes('word') || contentType.includes('doc')) {
      return 'Word document parsed into knowledge snippets.';
    }
    if (contentType.includes('excel') || contentType.includes('sheet') || contentType.includes('csv')) {
      return 'Tabular data normalized for fast lookups.';
    }
    return 'Stored securely and ready to power grounded chat.';
  }

  private loadDocuments(): void {
    this.loading = true;
    this.errorMessage = '';
    this.documentService.listDocuments().subscribe({
      next: documents => {
        this.documents = documents;
        this.loading = false;
      },
      error: error => {
        console.error('Unable to list documents', error);
        this.errorMessage = 'Unable to reach the upload service. Please refresh and try again.';
        this.loading = false;
      }
    });
  }
}
