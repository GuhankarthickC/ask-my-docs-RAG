import { CommonModule } from '@angular/common';
import { Component, ViewChild } from '@angular/core';
import { RouterModule } from '@angular/router';
import { UploadPanelComponent } from './upload-panel/upload-panel.component';
import { UploadedDocumentsComponent } from './uploaded-documents/uploaded-documents.component';

@Component({
  selector: 'app-document',
  standalone: true,
  imports: [CommonModule, RouterModule, UploadPanelComponent, UploadedDocumentsComponent],
  templateUrl: './document.component.html',
  styleUrl: './document.component.scss'
})
export class DocumentComponent {
  @ViewChild(UploadedDocumentsComponent) uploadedDocuments?: UploadedDocumentsComponent;

  handleFilesUploaded(): void {
    this.uploadedDocuments?.refresh();
  }
}
