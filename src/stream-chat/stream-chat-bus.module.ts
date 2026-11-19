import { Global, Module } from '@nestjs/common';
import { StreamChatBus } from './stream-chat-bus.service';

@Global()
@Module({
  providers: [StreamChatBus],
  exports: [StreamChatBus],
})
export class StreamChatBusModule {}
