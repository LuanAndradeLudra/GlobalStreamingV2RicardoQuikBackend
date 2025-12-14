import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

/**
 * Gateway para comunicação em tempo real via Socket.IO
 * 
 * Eventos emitidos:
 * - `giveaway:opened` - Sorteio foi aberto
 * - `giveaway:closed` - Sorteio foi fechado
 * - `participant:added` - Novo participante adicionado
 * - `participant:updated` - Participante atualizado
 * - `winner:drawn` - Vencedor sorteado
 */
@WebSocketGateway({
  cors: {
    origin: '*', // TODO: Configure properly for production
    credentials: true,
  },
  namespace: '/giveaway',
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  afterInit(server: Server) {
    this.logger.log('🚀 WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`🔌 Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`🔌 Client disconnected: ${client.id}`);
  }

  /**
   * Broadcast que um sorteio foi aberto
   */
  emitGiveawayOpened(data: {
    streamGiveawayId: string;
    name: string;
    keyword: string;
    platforms: string[];
  }): void {
    this.logger.log(`📢 Broadcasting giveaway opened: ${data.streamGiveawayId}`);
    this.server.emit('giveaway:opened', data);
  }

  /**
   * Broadcast que um sorteio foi fechado
   */
  emitGiveawayClosed(data: {
    streamGiveawayId: string;
    name: string;
  }): void {
    this.logger.log(`📢 Broadcasting giveaway closed: ${data.streamGiveawayId}`);
    this.server.emit('giveaway:closed', data);
  }

  /**
   * Broadcast que um novo participante foi adicionado
   */
  emitParticipantAdded(data: {
    streamGiveawayId: string;
    participant: {
      id: string;
      username: string;
      platform: string;
      method: string;
      tickets: number;
      avatarUrl?: string;
    };
  }): void {
    this.logger.log(
      `📢 Broadcasting participant added: ${data.participant.username} (${data.participant.platform})`,
    );
    this.server.emit('participant:added', data);
  }

  /**
   * Broadcast que um participante foi atualizado
   */
  emitParticipantUpdated(data: {
    streamGiveawayId: string;
    participant: {
      id: string;
      username: string;
      platform: string;
      method: string;
      tickets: number;
      avatarUrl?: string;
    };
  }): void {
    this.logger.log(
      `📢 Broadcasting participant updated: ${data.participant.username} (${data.participant.platform})`,
    );
    this.server.emit('participant:updated', data);
  }

  /**
   * Broadcast que um vencedor foi sorteado
   */
  emitWinnerDrawn(data: {
    streamGiveawayId: string;
    winner: {
      id: string;
      username: string;
      platform: string;
      tickets: number;
      drawnNumber: number;
    };
  }): void {
    this.logger.log(
      `📢 Broadcasting winner drawn: ${data.winner.username} (${data.winner.platform})`,
    );
    this.server.emit('winner:drawn', data);
  }

  /**
   * Broadcast métricas em tempo real
   */
  emitMetrics(data: {
    streamGiveawayId: string;
    totalParticipants: number;
    totalTickets: number;
    totalMessagesProcessed: number;
  }): void {
    this.server.emit('metrics:updated', data);
  }
}

