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
  donationConfigs: Array<{
    platform: ConnectedPlatform;
    unitType: string;
    donationWindow: string;
  }>;
}

/**
 * Service para gerenciar sorteios ativos no Redis
 * 
 * Estrutura de chaves no Redis:
 * - `giveaway:active:{userId}:{platform}:keyword` -> JSON com dados do sorteio
 * - `giveaway:participants:{streamGiveawayId}:{platform}:{externalUserId}` -> SET de métodos já usados
 * - `giveaway:metrics:{streamGiveawayId}` -> HASH com contadores (total_participants, etc)
 */
@Injectable()
export class StreamGiveawayRedisService {
  private readonly logger = new Logger(StreamGiveawayRedisService.name);
  private readonly GIVEAWAY_PREFIX = 'giveaway:active';
  private readonly PARTICIPANTS_PREFIX = 'giveaway:participants';
  private readonly METRICS_PREFIX = 'giveaway:metrics';

  constructor(private readonly redis: RedisService) {}

  /**
   * Publica um sorteio ativo no Redis
   * Cria chaves para cada plataforma configurada
   */
  async publishActiveGiveaway(data: ActiveGiveawayData): Promise<void> {
    const { streamGiveawayId, userId, keyword, platforms, allowedRoles, donationConfigs } = data;

    // Normaliza keyword (lowercase, trim)
    const normalizedKeyword = keyword.toLowerCase().trim();

    this.logger.log(`📤 Publishing active giveaway: ${streamGiveawayId} with keyword: "${normalizedKeyword}"`);

    // Cria uma chave para cada plataforma
    for (const platform of platforms) {
      const key = this.getGiveawayKey(userId, platform, normalizedKeyword);
      const value = JSON.stringify({
        streamGiveawayId,
        userId,
        keyword: normalizedKeyword,
        platform,
        allowedRoles,
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
    userId: string;
    keyword: string;
    platforms: ConnectedPlatform[];
  }): Promise<void> {
    const { streamGiveawayId, userId, keyword, platforms } = data;
    const normalizedKeyword = keyword.toLowerCase().trim();

    this.logger.log(`📥 Removing active giveaway: ${streamGiveawayId}`);

    // Remove chaves de cada plataforma
    for (const platform of platforms) {
      const key = this.getGiveawayKey(userId, platform, normalizedKeyword);
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
   * Busca sorteio ativo por palavra-chave e plataforma
   * Retorna null se não encontrado
   */
  async findActiveGiveawayByKeyword(
    userId: string,
    platform: ConnectedPlatform,
    message: string,
  ): Promise<ActiveGiveawayData | null> {
    // Normaliza mensagem (lowercase, trim, tokeniza)
    const normalizedMessage = message.toLowerCase().trim();
    const words = normalizedMessage.split(/\s+/);

    this.logger.log(`🔍 Searching for giveaway in message: "${normalizedMessage}"`);

    // Busca todas as chaves ativas para este usuário e plataforma
    const pattern = `${this.GIVEAWAY_PREFIX}:${userId}:${platform}:*`;
    const keys = await this.redis.keys(pattern);

    this.logger.log(`📋 Found ${keys.length} active giveaway keys for pattern: ${pattern}`);

    // Verifica cada chave para match de keyword
    for (const key of keys) {
      const data = await this.redis.get(key);
      if (!data) continue;

      const giveaway = JSON.parse(data);
      const keyword = giveaway.keyword.toLowerCase().trim();

      // Verifica se a keyword está presente nas palavras da mensagem
      if (words.includes(keyword)) {
        this.logger.log(`✅ Match found! Keyword: "${keyword}" in message: "${normalizedMessage}"`);
        return giveaway;
      }
    }

    this.logger.log(`❌ No giveaway match found for message: "${normalizedMessage}"`);
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
   * Gera chave para sorteio ativo
   */
  private getGiveawayKey(userId: string, platform: ConnectedPlatform, keyword: string): string {
    return `${this.GIVEAWAY_PREFIX}:${userId}:${platform}:${keyword}`;
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
}





