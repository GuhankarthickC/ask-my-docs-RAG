import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

interface ChatResponse {
  message?: string;
  response?: string;
  answer?: string | StructuredAnswer;
  question?: string;
}

interface StructuredAnswer {
  Content?: Array<StructuredContent>;
  content?: Array<StructuredContent>;
  answer?: string;
  text?: string;
}

interface StructuredContent {
  Text?: string;
  text?: string;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:5089/api/Chat';

  sendChat(message: string): Observable<string> {
    return this.http
      .post<ChatResponse | string>(this.baseUrl, { message })
      .pipe(map(payload => this.normalizeResponse(payload)));
  }

  private normalizeResponse(payload: ChatResponse | string): string {
    if (typeof payload === 'string') {
      return payload.trim() || 'Received an empty response.';
    }

    const answerText = this.extractAnswerText(payload.answer);
    if (answerText) {
      return answerText;
    }

    const fallback = payload.message ?? payload.response ?? payload.question;
    return (fallback?.trim() || 'Received a response without text.');
  }

  private extractAnswerText(answer: string | StructuredAnswer | undefined): string | undefined {
    if (!answer) {
      return undefined;
    }

    if (typeof answer === 'string') {
      const trimmed = answer.trim();
      if (!trimmed) {
        return undefined;
      }

      const parsed = this.tryParseJson(trimmed);
      if (parsed) {
        return this.extractAnswerText(parsed) ?? trimmed;
      }

      return trimmed;
    }

    const contentArray = answer.Content ?? answer.content;
    if (Array.isArray(contentArray)) {
      const textEntry = contentArray.find(item => (item.Text ?? item.text)?.trim());
      if (textEntry) {
        return (textEntry.Text ?? textEntry.text)?.trim();
      }
    }

    if (answer.answer && typeof answer.answer === 'string') {
      return answer.answer.trim();
    }

    if (answer.text && typeof answer.text === 'string') {
      return answer.text.trim();
    }

    return undefined;
  }

  private tryParseJson(content: string): StructuredAnswer | undefined {
    try {
      return JSON.parse(content) as StructuredAnswer;
    } catch {
      return undefined;
    }
  }
}
