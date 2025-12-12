import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, DestroyRef, ElementRef, OnInit, QueryList, ViewChild, ViewChildren, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DocumentService, UploadedDocument } from '../../services/document.service';
import { ChatService } from '../../services/chat.service';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: Date;
  documents?: string[];
  html: string;
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss'
})
export class ChatComponent implements OnInit, AfterViewInit {
  @ViewChild('messageFeed') private messageFeed?: ElementRef<HTMLDivElement>;
  @ViewChildren('messageItem') private messageItems?: QueryList<ElementRef<HTMLElement>>;

  documents: UploadedDocument[] = [];
  documentsLoading = false;
  documentError = '';

  messages: ChatMessage[] = [];

  draftMessage = '';
  sendingMessage = false;

  private readonly documentService = inject(DocumentService);
  private readonly chatService = inject(ChatService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private selectedDocumentIds = new Set<string>();
  private pendingDocumentId?: string | null;

  ngOnInit(): void {
    this.observeRouteParams();
    this.loadDocuments();
  }

  ngAfterViewInit(): void {
    this.messageItems?.changes
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.scrollFeedToBottom());

    setTimeout(() => this.scrollFeedToBottom());
  }

  get contextStatus(): string {
    const count = this.selectedDocumentIds.size;
    if (count === 0) {
      return 'No documents selected';
    }
    return count === 1 ? '1 document selected' : `${count} documents selected`;
  }

  get selectedCount(): number {
    return this.selectedDocumentIds.size;
  }

  get hasSelection(): boolean {
    return this.selectedDocumentIds.size > 0;
  }

  get allSelected(): boolean {
    return this.documents.length > 0 && this.selectedDocumentIds.size === this.documents.length;
  }

  get partiallySelected(): boolean {
    return this.selectedDocumentIds.size > 0 && this.selectedDocumentIds.size < this.documents.length;
  }

  get selectedDocuments(): UploadedDocument[] {
    return this.documents.filter(doc => this.selectedDocumentIds.has(doc.id));
  }

  get canSend(): boolean {
    return this.draftMessage.trim().length > 0 && this.selectedDocumentIds.size > 0 && !this.sendingMessage;
  }

  refreshDocuments(): void {
    this.loadDocuments();
  }

  isSelected(documentId: string): boolean {
    return this.selectedDocumentIds.has(documentId);
  }

  toggleSelectAll(checked: boolean): void {
    if (checked) {
      this.selectedDocumentIds = new Set(this.documents.map(doc => doc.id));
    } else {
      this.selectedDocumentIds.clear();
    }
    this.announceContextChange();
  }

  toggleDocument(documentId: string, checked: boolean): void {
    if (checked) {
      this.selectedDocumentIds.add(documentId);
    } else {
      this.selectedDocumentIds.delete(documentId);
    }
    this.announceContextChange();
  }

  clearChat(): void {
    this.messages = [
      {
        id: this.generateId(),
        role: 'assistant',
        text: 'Chat history reset. Select a document and ask a new question.',
        html: this.renderRichText('Chat history reset. Select a document and ask a new question.'),
        timestamp: new Date()
      }
    ];
    this.draftMessage = '';
    this.sendingMessage = false;
    this.scrollFeedToBottom();
  }

  sendMessage(): void {
    if (!this.canSend) {
      return;
    }

    const question = this.draftMessage.trim();
    const contextDocs = [...this.selectedDocumentIds];
    const userMessage: ChatMessage = {
      id: this.generateId(),
      role: 'user',
      text: question,
      html: this.renderRichText(question),
      timestamp: new Date(),
      documents: contextDocs
    };

    this.messages = [...this.messages, userMessage];
    this.draftMessage = '';
    this.sendingMessage = true;
    this.scrollFeedToBottom();

    this.chatService.sendChat(question)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: responseText => {
          const assistantMessage: ChatMessage = {
            id: this.generateId(),
            role: 'assistant',
            text: responseText,
            html: this.renderRichText(responseText),
            timestamp: new Date(),
            documents: contextDocs
          };
          this.messages = [...this.messages, assistantMessage];
          this.sendingMessage = false;
          this.scrollFeedToBottom();
        },
        error: error => {
          console.error('Chat request failed', error);
          const failureMessage: ChatMessage = {
            id: this.generateId(),
            role: 'system',
            text: 'We could not reach the chat service. Please try again shortly.',
            html: this.renderRichText('We could not reach the chat service. Please try again shortly.'),
            timestamp: new Date(),
            documents: contextDocs
          };
          this.messages = [...this.messages, failureMessage];
          this.sendingMessage = false;
          this.scrollFeedToBottom();
        }
      });
  }

  trackByMessageId(_: number, message: ChatMessage): string {
    return message.id;
  }

  private loadDocuments(): void {
    this.documentsLoading = true;
    this.documentError = '';
    this.documentService.listDocuments().subscribe({
      next: docs => {
        this.documents = docs;
        this.documentsLoading = false;
        this.syncSelectionWithList();
        this.tryApplyPendingSelection();
      },
      error: error => {
        console.error('Unable to load documents for chat', error);
        this.documentError = 'Unable to reach the document index right now. Please try again.';
        this.documentsLoading = false;
      }
    });
  }

  private observeRouteParams(): void {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const documentId = params.get('documentId');
        if (documentId) {
          this.pendingDocumentId = documentId;
          this.tryApplyPendingSelection();
        }
      });
  }

  private tryApplyPendingSelection(): void {
    if (!this.pendingDocumentId) {
      return;
    }
    const exists = this.documents.some(doc => doc.id === this.pendingDocumentId);
    if (!exists) {
      return;
    }
    this.selectedDocumentIds = new Set([this.pendingDocumentId]);
    this.pendingDocumentId = null;
    this.announceContextChange();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { documentId: null },
      queryParamsHandling: 'merge'
    });
  }

  private announceContextChange(): void {
    const count = this.selectedDocumentIds.size;
    const text = count === 0
      ? 'Context cleared. Select at least one document to ground the chat.'
      : `I\'m now using ${count} document${count === 1 ? '' : 's'} for context in our conversation.`;

    this.messages = [...this.messages, {
      id: this.generateId(),
      role: 'system',
      text,
      html: this.renderRichText(text),
      timestamp: new Date(),
      documents: [...this.selectedDocumentIds]
    }];
    this.scrollFeedToBottom();
  }

  private syncSelectionWithList(): void {
    if (this.selectedDocumentIds.size === 0) {
      return;
    }
    const validIds = new Set(this.documents.map(doc => doc.id));
    const nextSelection = new Set(
      [...this.selectedDocumentIds].filter(id => validIds.has(id))
    );
    if (nextSelection.size === this.selectedDocumentIds.size) {
      return;
    }
    this.selectedDocumentIds = nextSelection;
    this.announceContextChange();
  }

  private getDocumentLabel(documentId: string): string {
    const match = this.documents.find(doc => doc.id === documentId);
    return match?.fileName ?? 'the selected document';
  }

  selectedDocumentPreview(): string {
    const names = this.selectedDocuments.map(doc => doc.fileName);
    if (names.length === 0) {
      return 'Select at least one document to provide chat context.';
    }
    if (names.length <= 2) {
      return names.join(', ');
    }
    return `${names[0]}, ${names[1]} +${names.length - 2} more`;
  }

  formatDocumentMeta(document: UploadedDocument): string {
    const sizeLabel = this.formatSize(document.size);
    const typeLabel = document.contentType ?? 'Unknown type';
    return `${sizeLabel} · ${typeLabel}`;
  }

  messageContextLabel(message: ChatMessage): string | null {
    if (!message.documents || message.documents.length === 0) {
      return null;
    }
    if (message.documents.length === 1) {
      return this.getDocumentLabel(message.documents[0]);
    }
    const first = this.getDocumentLabel(message.documents[0]);
    return `${first} +${message.documents.length - 1} more`;
  }

  private formatSize(bytes: number): string {
    if (!bytes || bytes <= 0) {
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

  private generateId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  private renderRichText(text: string): string {
    if (!text) {
      return '';
    }

    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    const withCode = escaped.replace(/`([^`]+)`/g, (_, code) => `<code>${code}</code>`);
    const withBold = withCode.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    const italicRegex = /(^|[\s.,;:!?\-])\*(?!\s)([^*\n]+?)\*(?=[\s.,;:!?\-]|$)/g;
    const withEmphasis = withBold.replace(italicRegex, (_match, prefix, content) => `${prefix}<em>${content}</em>`);
    const withLineBreaks = withEmphasis.replace(/\n/g, '<br />');

    return withLineBreaks;
  }

  private scrollFeedToBottom(): void {
    setTimeout(() => {
      const lastMessage = this.messageItems?.last?.nativeElement;
      if (lastMessage) {
        lastMessage.scrollIntoView({ behavior: 'smooth', block: 'end' });
        return;
      }

      const nativeEl = this.messageFeed?.nativeElement;
      if (nativeEl) {
        nativeEl.scrollTo({ top: nativeEl.scrollHeight, behavior: 'smooth' });
      }
    });
  }
}
