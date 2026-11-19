import { Injectable } from '@nestjs/common';
import { Subject, Subscription } from 'rxjs';

export interface StreamChatClosedEvent {
  userId: string;
  immediate: boolean;
}

/**
 * Notifies YouTube and TikTok chat workers when a stream giveaway opens or closes.
 * Kept separate from GiveawayService so the chat workers can depend on giveaways
 * without GiveawayService depending on them.
 */
@Injectable()
export class StreamChatBus {
  private readonly opened = new Subject<string>();
  private readonly closed = new Subject<StreamChatClosedEvent>();

  notifyOpened(userId: string): void {
    this.opened.next(userId);
  }

  notifyClosed(userId: string, immediate: boolean): void {
    this.closed.next({ userId, immediate });
  }

  onOpened(handler: (userId: string) => void): Subscription {
    return this.opened.subscribe(handler);
  }

  onClosed(handler: (event: StreamChatClosedEvent) => void): Subscription {
    return this.closed.subscribe(handler);
  }
}
