import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { ConnectedPlatform } from '@prisma/client';

/**
 * Interface para dados de sorteio armazenados no Redis
 */
export interface ActiveGiveawayData {
  streamGiveawayId: string;
  userId: string; // admin user ID
  keyword: string;
  platforms: ConnectedPlatform[];
  allowedRoles: string[];
  channelIds: Record<ConnectedPlatform, string>; // Map de platform -> externalChannelId
  donationConfigs: Array<{
    platform: ConnectedPlatform;
    unitType: string;
    donationWindow: string;
  }>;
}

/**
 * Interface para dados do vencedor armazenados no Redis
 */
export interface WinnerData {
  streamGiveawayId: string;
  username: string;
  platform: ConnectedPlatform;
  externalUserId: string;
  drawnAt: string;
}

/**
 * Interface para mensagem do vencedor
 */
export interface WinnerMessage {
  text: string;
  timestamp: string;
}

/**
 * Service para gerenciar sorteios ativos no Redis
 * 
 * Estrutura de chaves no Redis:
 * - `giveaway:active:{platform}:{channelId}:{keyword}` -> JSON com dados do sorteio
 * - `giveaway:participants:{streamGiveawayId}:{platform}:{externalUserId}` -> SET de métodos já usados
 * - `giveaway:metrics:{streamGiveawayId}` -> HASH com contadores (total_participants, etc)
 * 
 * Nota: Usamos channelId ao invés de userId porque o canal define onde a mensagem aconteceu,
 * tornando o lookup mais consistente e direto.
 */
@Injectable()
export class StreamGiveawayRedisService {
  private readonly logger = new Logger(StreamGiveawayRedisService.name);
  private readonly GIVEAWAY_PREFIX = 'giveaway:active';
  private readonly PARTICIPANTS_PREFIX = 'giveaway:participants';
  private readonly METRICS_PREFIX = 'giveaway:metrics';
  private readonly WINNER_PREFIX = 'giveaway:winner';
  private readonly WINNER_MESSAGES_PREFIX = 'giveaway:winner:messages';
  private readonly WINNER_TTL = 60; // 60 segundos

  constructor(private readonly redis: RedisService) {}

  /**
   * Publica um sorteio ativo no Redis
   * Cria chaves para cada plataforma configurada usando channelId
   */
  async publishActiveGiveaway(data: ActiveGiveawayData): Promise<void> {
    const { streamGiveawayId, userId, keyword, platforms, allowedRoles, donationConfigs, channelIds } = data;

    // Normaliza keyword (lowercase, trim)
    const normalizedKeyword = keyword.toLowerCase().trim();

    this.logger.log(`📤 Publishing active giveaway: ${streamGiveawayId} with keyword: "${normalizedKeyword}"`);

    // Cria uma chave para cada plataforma usando channelId
    for (const platform of platforms) {
      const channelId = channelIds[platform];
      if (!channelId) {
        this.logger.warn(`⚠️ No channelId found for platform ${platform}, skipping...`);
        continue;
      }

      const key = this.getGiveawayKey(platform, channelId, normalizedKeyword);
      const value = JSON.stringify({
        streamGiveawayId,
        userId,
        keyword: normalizedKeyword,
        platform,
        allowedRoles,
        channelId,
        donationConfigs: donationConfigs.filter(c => c.platform === platform),
      });

      await this.redis.set(key, value);
      this.logger.log(`✅ Giveaway published for platform ${platform}: ${key}`);
    }

    // Inicializa métricas
    await this.initializeMetrics(streamGiveawayId);
  }

  /**
   * Remove um sorteio ativo do Redis
   */
  async removeActiveGiveaway(data: {
    streamGiveawayId: string;
    keyword: string;
    platforms: ConnectedPlatform[];
    channelIds: Record<ConnectedPlatform, string>;
  }): Promise<void> {
    const { streamGiveawayId, keyword, platforms, channelIds } = data;
    const normalizedKeyword = keyword.toLowerCase().trim();

    this.logger.log(`📥 Removing active giveaway: ${streamGiveawayId}`);

    // Remove chaves de cada plataforma usando channelId
    for (const platform of platforms) {
      const channelId = channelIds[platform];
      if (!channelId) {
        this.logger.warn(`⚠️ No channelId found for platform ${platform}, skipping removal...`);
        continue;
      }

      const key = this.getGiveawayKey(platform, channelId, normalizedKeyword);
      await this.redis.del(key);
      this.logger.log(`🗑️ Giveaway key removed: ${key}`);
    }

    // Remove métricas
    await this.redis.del(this.getMetricsKey(streamGiveawayId));
    this.logger.log(`🗑️ Metrics key removed: ${this.getMetricsKey(streamGiveawayId)}`);

    // Remove todos os participantes relacionados ao sorteio
    await this.removeAllParticipants(streamGiveawayId);
  }

  /**
   * Remove todos os participantes de um sorteio do Redis
   */
  async removeAllParticipants(streamGiveawayId: string): Promise<void> {
    this.logger.log(`📥 Removing all participants for giveaway: ${streamGiveawayId}`);

    // Busca todas as chaves de participantes para este sorteio
    const pattern = `${this.PARTICIPANTS_PREFIX}:${streamGiveawayId}:*`;
    const keys = await this.redis.keys(pattern);

    if (keys.length === 0) {
      this.logger.log(`ℹ️ No participant keys found for giveaway: ${streamGiveawayId}`);
      return;
    }

    // Remove todas as chaves encontradas
    for (const key of keys) {
      await this.redis.del(key);
    }

    this.logger.log(`🗑️ Removed ${keys.length} participant keys for giveaway: ${streamGiveawayId}`);
  }

  /**
   * Busca sorteio ativo por palavra-chave, plataforma e channelId
   * Retorna null se não encontrado
   * 
   * Usa channelId + platform para lookup direto e consistente
   */
  async findActiveGiveawayByKeyword(
    platform: ConnectedPlatform,
    channelId: string,
    message: string,
  ): Promise<ActiveGiveawayData | null> {
    // Normaliza mensagem (lowercase, trim)
    const normalizedMessage = message.toLowerCase().trim();

    this.logger.log(`🔍 Searching for giveaway in message: "${normalizedMessage}" (platform: ${platform}, channelId: ${channelId})`);

    // Busca chaves para este canal específico
    const pattern = `${this.GIVEAWAY_PREFIX}:${platform}:${channelId}:*`;
    const keys = await this.redis.keys(pattern);

    this.logger.log(`📋 Found ${keys.length} active giveaway keys for pattern: ${pattern}`);

    const match = await this.findMatchingGiveaway(keys, normalizedMessage);
    if (match) {
      return match;
    }

    this.logger.log(`❌ No giveaway match found for message: "${normalizedMessage}"`);
    return null;
  }

  /**
   * Helper method to find matching giveaway from a list of keys
   * Uses substring matching (like Kick) instead of exact word matching
   */
  private async findMatchingGiveaway(
    keys: string[],
    normalizedMessage: string,
  ): Promise<ActiveGiveawayData | null> {
    for (const key of keys) {
      const data = await this.redis.get(key);
      if (!data) continue;

      const giveaway = JSON.parse(data);
      const keyword = giveaway.keyword?.toLowerCase().trim();

      if (!keyword) continue;

      // Usa substring matching (como Kick) para suportar casos como:
      // - Mensagem: "!sorteiovip" → Keyword: "!sorteio" ✅
      // - Mensagem: "digite !sorteio" → Keyword: "!sorteio" ✅
      if (normalizedMessage.includes(keyword)) {
        this.logger.log(`✅ Match found! Keyword: "${keyword}" in message: "${normalizedMessage}"`);
        return giveaway;
      }
    }

    return null;
  }

  /**
   * Verifica se um usuário já participou com um método específico (dedupe)
   * Retorna true se já participou, false se é novo
   */
  async checkDuplicate(
    streamGiveawayId: string,
    platform: ConnectedPlatform,
    externalUserId: string,
    method: string,
  ): Promise<boolean> {
    const key = this.getParticipantKey(streamGiveawayId, platform, externalUserId);
    const isDuplicate = await this.redis.sismember(key, method);

    if (isDuplicate) {
      this.logger.log(`⚠️ Duplicate entry detected: ${externalUserId} with method ${method}`);
    } else {
      this.logger.log(`✅ New entry: ${externalUserId} with method ${method}`);
    }

    return isDuplicate;
  }

  /**
   * Marca um usuário como participante com um método específico (dedupe)
   */
  async markParticipant(
    streamGiveawayId: string,
    platform: ConnectedPlatform,
    externalUserId: string,
    method: string,
  ): Promise<void> {
    const key = this.getParticipantKey(streamGiveawayId, platform, externalUserId);
    await this.redis.sadd(key, method);
    
    // Define TTL de 30 dias para limpeza automática
    await this.redis.expire(key, 30 * 24 * 60 * 60);

    this.logger.log(`✅ Marked participant: ${externalUserId} with method ${method}`);
  }

  /**
   * Incrementa contador de métricas
   */
  async incrementMetric(streamGiveawayId: string, metric: string): Promise<void> {
    const key = this.getMetricsKey(streamGiveawayId);
    const current = await this.redis.hget(key, metric);
    const newValue = (parseInt(current || '0', 10) + 1).toString();
    await this.redis.hset(key, metric, newValue);
  }

  /**
   * Obtém métricas do sorteio
   */
  async getMetrics(streamGiveawayId: string): Promise<Record<string, string>> {
    const key = this.getMetricsKey(streamGiveawayId);
    return this.redis.hgetall(key);
  }

  /**
   * Inicializa métricas de um sorteio
   */
  private async initializeMetrics(streamGiveawayId: string): Promise<void> {
    const key = this.getMetricsKey(streamGiveawayId);
    await this.redis.hset(key, 'total_participants', '0');
    await this.redis.hset(key, 'total_messages_processed', '0');
  }

  /**
   * Gera chave para sorteio ativo usando platform + channelId
   * Formato: giveaway:active:{platform}:{channelId}:{keyword}
   */
  private getGiveawayKey(platform: ConnectedPlatform, channelId: string, keyword: string): string {
    return `${this.GIVEAWAY_PREFIX}:${platform}:${channelId}:${keyword}`;
  }

  /**
   * Gera chave para participantes
   */
  private getParticipantKey(
    streamGiveawayId: string,
    platform: ConnectedPlatform,
    externalUserId: string,
  ): string {
    return `${this.PARTICIPANTS_PREFIX}:${streamGiveawayId}:${platform}:${externalUserId}`;
  }

  /**
   * Gera chave para métricas
   */
  private getMetricsKey(streamGiveawayId: string): string {
    return `${this.METRICS_PREFIX}:${streamGiveawayId}`;
  }

  /**
   * Gera chave para dados do vencedor
   */
  private getWinnerKey(streamGiveawayId: string): string {
    return `${this.WINNER_PREFIX}:${streamGiveawayId}`;
  }

  /**
   * Gera chave para mensagens do vencedor
   */
  private getWinnerMessagesKey(streamGiveawayId: string): string {
    return `${this.WINNER_MESSAGES_PREFIX}:${streamGiveawayId}`;
  }

  /**
   * Salva dados do vencedor no Redis com TTL de 60 segundos
   * Se já existir um vencedor, ele será sobrescrito
   * IMPORTANTE: Limpa as mensagens do vencedor anterior antes de definir o novo
   */
  async setWinner(data: WinnerData): Promise<void> {
    const key = this.getWinnerKey(data.streamGiveawayId);
    const messagesKey = this.getWinnerMessagesKey(data.streamGiveawayId);
    const value = JSON.stringify(data);
    
    // Limpa mensagens do vencedor anterior antes de definir o novo vencedor
    // Isso evita que mensagens de vencedores antigos sejam misturadas com o novo
    await this.redis.del(messagesKey);
    
    // Define o novo vencedor
    await this.redis.set(key, value, this.WINNER_TTL);
    
    this.logger.log(`🏆 Winner set for giveaway ${data.streamGiveawayId}: ${data.username} (${data.platform})`);
    this.logger.log(`🗑️ Previous winner messages cleared for giveaway ${data.streamGiveawayId}`);
  }

  /**
   * Busca dados do vencedor no Redis
   * Retorna null se não encontrado ou se TTL expirou
   */
  async getWinner(streamGiveawayId: string): Promise<WinnerData | null> {
    const key = this.getWinnerKey(streamGiveawayId);
    const data = await this.redis.get(key);
    
    if (!data) {
      return null;
    }
    
    return JSON.parse(data);
  }

  /**
   * Adiciona uma mensagem do vencedor ao Redis
   * Também define TTL de 60 segundos para a lista de mensagens
   */
  async addWinnerMessage(streamGiveawayId: string, message: WinnerMessage): Promise<void> {
    const key = this.getWinnerMessagesKey(streamGiveawayId);
    const value = JSON.stringify(message);
    
    // Adiciona mensagem à lista (usando RPUSH para manter ordem cronológica)
    await this.redis.rpush(key, value);
    
    // Define TTL de 60 segundos
    await this.redis.expire(key, this.WINNER_TTL);
    
    this.logger.log(`💬 Winner message added for giveaway ${streamGiveawayId}: "${message.text.substring(0, 50)}..."`);
  }

  /**
   * Busca todas as mensagens do vencedor
   * Retorna array vazio se não houver mensagens ou se TTL expirou
   */
  async getWinnerMessages(streamGiveawayId: string): Promise<WinnerMessage[]> {
    const key = this.getWinnerMessagesKey(streamGiveawayId);
    const messages = await this.redis.lrange(key, 0, -1);
    
    if (!messages || messages.length === 0) {
      return [];
    }
    
    return messages.map(msg => JSON.parse(msg));
  }

  /**
   * Remove dados do vencedor e suas mensagens
   * Útil quando um novo sorteio começa
   */
  async removeWinner(streamGiveawayId: string): Promise<void> {
    const winnerKey = this.getWinnerKey(streamGiveawayId);
    const messagesKey = this.getWinnerMessagesKey(streamGiveawayId);
    
    await this.redis.del(winnerKey);
    await this.redis.del(messagesKey);
    
    this.logger.log(`🗑️ Winner data removed for giveaway ${streamGiveawayId}`);
  }
}











