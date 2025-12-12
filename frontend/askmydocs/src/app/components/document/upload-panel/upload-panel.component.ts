import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';
import { DocumentService, UploadResult } from '../../../services/document.service';

interface UploadQueueItem {
  id: string;
  file: File;
  fileName: string;
  size: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  message?: string;
}

interface UploadToast {
  id: string;
  type: 'success' | 'error';
  title: string;
  message?: string;
}

@Component({
  selector: 'app-upload-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './upload-panel.component.html',
  styleUrl: './upload-panel.component.scss'
})
export class UploadPanelComponent {
  @Output() filesUploaded = new EventEmitter<void>();

  isDragOver = false;
  queue: UploadQueueItem[] = [];
  isProcessing = false;
  toasts: UploadToast[] = [];
  showActivityOverlay = false;
  hasActivityAlert = false;

  constructor(private readonly documentService: DocumentService) {}

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
    const files = event.dataTransfer?.files;
    this.addFiles(files);
  }

  onFileBrowse(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.addFiles(input.files);
    input.value = '';
  }

  private addFiles(fileList: FileList | null | undefined): void {
    if (!fileList || fileList.length === 0) {
      return;
    }

    [...Array.from(fileList)].forEach(file => {
      this.queue.push({
        id: this.generateId(),
        file,
        fileName: file.name,
        size: file.size,
        status: 'pending'
      });
    });

    this.processQueue();
  }

  retryUpload(itemId: string): void {
    const item = this.queue.find(entry => entry.id === itemId);
    if (!item) {
      return;
    }
    item.status = 'pending';
    item.message = undefined;
    this.processQueue();
  }

  private processQueue(): void {
    if (this.isProcessing) {
      return;
    }

    const nextItem = this.queue.find(item => item.status === 'pending');
    if (!nextItem) {
      return;
    }

    this.isProcessing = true;
    nextItem.status = 'uploading';

    this.documentService.uploadDocument(nextItem.file).subscribe({
      next: (result: UploadResult) => {
        if (result.success) {
          nextItem.status = 'completed';
          nextItem.message = 'Uploaded';
          this.filesUploaded.emit();
          this.pushToast('success', `${nextItem.fileName} uploaded`, 'You can find it under Uploaded documents.');
          this.hasActivityAlert = true;
        } else {
          nextItem.status = 'error';
          nextItem.message = result.message ?? 'Upload failed';
          this.pushToast('error', `${nextItem.fileName} failed`, nextItem.message);
          this.hasActivityAlert = true;
        }
      },
      error: (error) => {
        console.error('Unhandled upload error', error);
        nextItem.status = 'error';
        nextItem.message = 'Unexpected error while uploading';
        this.pushToast('error', `${nextItem.fileName} failed`, nextItem.message);
        this.hasActivityAlert = true;
      },
      complete: () => {
        this.isProcessing = false;
        this.processQueue();
      }
    });
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

  getStatusLabel(status: UploadQueueItem['status']): string {
    switch (status) {
      case 'pending':
        return 'Queued';
      case 'uploading':
        return 'Uploading';
      case 'completed':
        return 'Uploaded';
      case 'error':
        return 'Error';
      default:
        return status;
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  getExtension(fileName: string): string {
    const parts = fileName.split('.');
    if (parts.length <= 1) {
      return 'FILE';
    }
    return parts.pop()?.slice(0, 4).toUpperCase() ?? 'FILE';
  }

  getProgress(status: UploadQueueItem['status']): number {
    switch (status) {
      case 'pending':
        return 20;
      case 'uploading':
        return 65;
      case 'completed':
        return 100;
      case 'error':
        return 100;
      default:
        return 0;
    }
  }

  getStatusNote(status: UploadQueueItem['status']): string {
    switch (status) {
      case 'pending':
        return 'Queued and waiting';
      case 'uploading':
        return 'Streaming securely';
      case 'completed':
        return 'Ready for chat';
      case 'error':
        return 'Needs attention';
      default:
        return '';
    }
  }

  pushToast(type: 'success' | 'error', title: string, message?: string): void {
    const toast: UploadToast = { id: this.generateId(), type, title, message };
    this.toasts = [...this.toasts, toast];
    setTimeout(() => this.dismissToast(toast.id), 6000);
  }

  dismissToast(id: string): void {
    this.toasts = this.toasts.filter(toast => toast.id !== id);
  }

  toggleActivityOverlay(): void {
    this.showActivityOverlay = !this.showActivityOverlay;
    if (this.showActivityOverlay) {
      this.hasActivityAlert = false;
    }
  }

  closeActivityOverlay(): void {
    this.showActivityOverlay = false;
  }
}
