import { Injectable, signal } from '@angular/core';

/** Message de confirmation éphémère, conservé d'une page à l'autre (ex. après création). */
@Injectable({ providedIn: 'root' })
export class FlashService {
  readonly message = signal<string | null>(null);
  private timer?: ReturnType<typeof setTimeout>;

  show(message: string, durationMs = 4000): void {
    clearTimeout(this.timer);
    this.message.set(message);
    this.timer = setTimeout(() => this.message.set(null), durationMs);
  }

  clear(): void {
    clearTimeout(this.timer);
    this.message.set(null);
  }
}