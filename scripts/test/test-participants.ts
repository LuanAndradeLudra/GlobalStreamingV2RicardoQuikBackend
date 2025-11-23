import { PrismaClient, EntryMethod, ConnectedPlatform, StreamGiveawayStatus, DonationWindow } from '@prisma/client';

const prisma = new PrismaClient();

interface ParticipantData {
  platform: ConnectedPlatform;
  externalUserId: string;
  username: string;
  avatarUrl?: string;
  method: EntryMethod;
  tickets: number;
  metadata?: Record<string, any>;
}

async function main() {
  console.log('🚀 Iniciando script de teste de participantes...\n');

  try {
    // 1. Buscar ou criar um stream giveaway para testes
    let streamGiveaway = await prisma.streamGiveaway.findFirst({
      where: { status: StreamGiveawayStatus.OPEN },
      orderBy: { createdAt: 'desc' },
    });

    if (!streamGiveaway) {
      // Buscar um admin user
      const adminUser = await prisma.user.findFirst({
        where: { role: 'ADMIN' },
      });

      if (!adminUser) {
        throw new Error('Nenhum usuário ADMIN encontrado. Crie um usuário ADMIN primeiro.');
      }

      console.log(`📝 Criando stream giveaway para testes...`);
      streamGiveaway = await prisma.streamGiveaway.create({
        data: {
          userId: adminUser.id,
          name: 'Test Stream Giveaway - Participantes',
          description: 'Stream giveaway criado automaticamente para testes de participantes',
          status: StreamGiveawayStatus.OPEN,
          platforms: [ConnectedPlatform.TWITCH, ConnectedPlatform.KICK, ConnectedPlatform.YOUTUBE],
          keyword: '!enter',
          allowedRoles: [
            'TWITCH_TIER_1',
            'TWITCH_TIER_2',
            'TWITCH_TIER_3',
            'TWITCH_NON_SUB',
            'KICK_SUB',
            'KICK_NON_SUB',
            'YOUTUBE_SUB',
            'YOUTUBE_NON_SUB',
          ],
          donationConfigs: {
            create: [
              { platform: ConnectedPlatform.TWITCH, unitType: 'BITS', donationWindow: DonationWindow.DAILY },
              { platform: ConnectedPlatform.TWITCH, unitType: 'GIFT_SUB', donationWindow: DonationWindow.DAILY },
              { platform: ConnectedPlatform.KICK, unitType: 'KICK_COINS', donationWindow: DonationWindow.DAILY },
              { platform: ConnectedPlatform.YOUTUBE, unitType: 'SUPERCHAT', donationWindow: DonationWindow.DAILY },
            ],
          },
        },
      });
      console.log(`✅ Stream giveaway criado: ${streamGiveaway.id}\n`);
    } else {
      console.log(`✅ Usando stream giveaway existente: ${streamGiveaway.id}\n`);
    }

    // 2. Limpar participantes existentes deste giveaway (opcional)
    const existingCount = await prisma.streamGiveawayParticipant.count({
      where: { streamGiveawayId: streamGiveaway.id },
    });

    if (existingCount > 0) {
      console.log(`🗑️  Removendo ${existingCount} participantes existentes...`);
      await prisma.streamGiveawayParticipant.deleteMany({
        where: { streamGiveawayId: streamGiveaway.id },
      });
      console.log('✅ Participantes removidos\n');
    }

    // URLs dos avatares por plataforma
    const TWITCH_AVATAR = 'https://br.freepik.com/fotos-vetores-gratis/twitch-logo';
    const KICK_AVATAR = 'https://www.pinterest.com/pin/kick-logo-vector-download-kick-streaming-logo--865043040928639546/';
    const YOUTUBE_AVATAR = 'https://www.flaticon.com/br/icone-gratis/youtube_1384060';

    // 3. Definir participantes com todos os tiers e donations
    const participants: ParticipantData[] = [];

    // === USUÁRIOS COM TIERS DO TWITCH ===
    // User 1: Tier 1 + Bits + Gift Subs
    participants.push(
      { platform: ConnectedPlatform.TWITCH, externalUserId: 'user1_twitch', username: 'twitch_user1', avatarUrl: TWITCH_AVATAR, method: EntryMethod.TWITCH_TIER_1, tickets: 10 },
      { platform: ConnectedPlatform.TWITCH, externalUserId: 'user1_twitch', username: 'twitch_user1', avatarUrl: TWITCH_AVATAR, method: EntryMethod.BITS, tickets: 100, metadata: { bitsAmount: 10000 } },
      { platform: ConnectedPlatform.TWITCH, externalUserId: 'user1_twitch', username: 'twitch_user1', avatarUrl: TWITCH_AVATAR, method: EntryMethod.GIFT_SUB, tickets: 40, metadata: { giftSubsAmount: 10 } },
    );

    // User 2: Tier 2 + Bits
    participants.push(
      { platform: ConnectedPlatform.TWITCH, externalUserId: 'user2_twitch', username: 'twitch_user2', avatarUrl: TWITCH_AVATAR, method: EntryMethod.TWITCH_TIER_2, tickets: 15 },
      { platform: ConnectedPlatform.TWITCH, externalUserId: 'user2_twitch', username: 'twitch_user2', avatarUrl: TWITCH_AVATAR, method: EntryMethod.BITS, tickets: 75, metadata: { bitsAmount: 7500 } },
    );

    // User 3: Tier 3 + Bits + Gift Subs
    participants.push(
      { platform: ConnectedPlatform.TWITCH, externalUserId: 'user3_twitch', username: 'twitch_user3', avatarUrl: TWITCH_AVATAR, method: EntryMethod.TWITCH_TIER_3, tickets: 20 },
      { platform: ConnectedPlatform.TWITCH, externalUserId: 'user3_twitch', username: 'twitch_user3', avatarUrl: TWITCH_AVATAR, method: EntryMethod.BITS, tickets: 150, metadata: { bitsAmount: 15000 } },
      { platform: ConnectedPlatform.TWITCH, externalUserId: 'user3_twitch', username: 'twitch_user3', avatarUrl: TWITCH_AVATAR, method: EntryMethod.GIFT_SUB, tickets: 80, metadata: { giftSubsAmount: 20 } },
      { platform: ConnectedPlatform.YOUTUBE, externalUserId: 'user3_twitch', username: 'twitch_user3', avatarUrl: YOUTUBE_AVATAR, method: EntryMethod.SUPERCHAT, tickets: 50, metadata: { superchatAmount: 5000 } },
    );

    // User 4: Non-Sub + Bits
    participants.push(
      { platform: ConnectedPlatform.TWITCH, externalUserId: 'user4_twitch', username: 'twitch_user4', avatarUrl: TWITCH_AVATAR, method: EntryMethod.TWITCH_NON_SUB, tickets: 1 },
      { platform: ConnectedPlatform.TWITCH, externalUserId: 'user4_twitch', username: 'twitch_user4', avatarUrl: TWITCH_AVATAR, method: EntryMethod.BITS, tickets: 25, metadata: { bitsAmount: 2500 } },
    );

    // === USUÁRIOS DO KICK ===
    // User 5: Kick Sub + Kick Coins
    participants.push(
      { platform: ConnectedPlatform.KICK, externalUserId: 'user5_kick', username: 'kick_user5', avatarUrl: KICK_AVATAR, method: EntryMethod.KICK_SUB, tickets: 15 },
      { platform: ConnectedPlatform.KICK, externalUserId: 'user5_kick', username: 'kick_user5', avatarUrl: KICK_AVATAR, method: EntryMethod.KICK_COINS, tickets: 30, metadata: { coinsAmount: 3000 } },
    );

    // User 6: Kick Non-Sub + Kick Coins
    participants.push(
      { platform: ConnectedPlatform.KICK, externalUserId: 'user6_kick', username: 'kick_user6', avatarUrl: KICK_AVATAR, method: EntryMethod.KICK_NON_SUB, tickets: 1 },
      { platform: ConnectedPlatform.KICK, externalUserId: 'user6_kick', username: 'kick_user6', avatarUrl: KICK_AVATAR, method: EntryMethod.KICK_COINS, tickets: 15, metadata: { coinsAmount: 1500 } },
    );

    // === USUÁRIOS DO YOUTUBE ===
    // User 7: YouTube Sub
    participants.push(
      { platform: ConnectedPlatform.YOUTUBE, externalUserId: 'user7_youtube', username: 'youtube_user7', avatarUrl: YOUTUBE_AVATAR, method: EntryMethod.YOUTUBE_SUB, tickets: 25 },
    );

    // User 8: YouTube Non-Sub
    participants.push(
      { platform: ConnectedPlatform.YOUTUBE, externalUserId: 'user8_youtube', username: 'youtube_user8', avatarUrl: YOUTUBE_AVATAR, method: EntryMethod.YOUTUBE_NON_SUB, tickets: 1 },
    );

    // === USUÁRIOS COM TODOS OS TIPOS DE DONATIONS ===
    // User 9: Todos os donations possíveis
    participants.push(
      { platform: ConnectedPlatform.TWITCH, externalUserId: 'user9_all_donations', username: 'donation_master', avatarUrl: TWITCH_AVATAR, method: EntryMethod.BITS, tickets: 200, metadata: { bitsAmount: 20000 } },
      { platform: ConnectedPlatform.TWITCH, externalUserId: 'user9_all_donations', username: 'donation_master', avatarUrl: TWITCH_AVATAR, method: EntryMethod.GIFT_SUB, tickets: 100, metadata: { giftSubsAmount: 25 } },
      { platform: ConnectedPlatform.YOUTUBE, externalUserId: 'user9_all_donations', username: 'donation_master', avatarUrl: YOUTUBE_AVATAR, method: EntryMethod.SUPERCHAT, tickets: 75, metadata: { superchatAmount: 7500 } },
      { platform: ConnectedPlatform.KICK, externalUserId: 'user9_all_donations', username: 'donation_master', avatarUrl: KICK_AVATAR, method: EntryMethod.KICK_COINS, tickets: 60, metadata: { coinsAmount: 6000 } },
    );

    // User 10: Tier 3 + Todos os donations
    participants.push(
      { platform: ConnectedPlatform.TWITCH, externalUserId: 'user10_whale', username: 'whale_user', avatarUrl: TWITCH_AVATAR, method: EntryMethod.TWITCH_TIER_3, tickets: 20 },
      { platform: ConnectedPlatform.TWITCH, externalUserId: 'user10_whale', username: 'whale_user', avatarUrl: TWITCH_AVATAR, method: EntryMethod.BITS, tickets: 500, metadata: { bitsAmount: 50000 } },
      { platform: ConnectedPlatform.TWITCH, externalUserId: 'user10_whale', username: 'whale_user', avatarUrl: TWITCH_AVATAR, method: EntryMethod.GIFT_SUB, tickets: 200, metadata: { giftSubsAmount: 50 } },
      { platform: ConnectedPlatform.YOUTUBE, externalUserId: 'user10_whale', username: 'whale_user', avatarUrl: YOUTUBE_AVATAR, method: EntryMethod.SUPERCHAT, tickets: 150, metadata: { superchatAmount: 15000 } },
    );

    // 4. Criar todos os participantes
    console.log(`📊 Criando ${participants.length} entradas de participantes...\n`);

    const created = await prisma.streamGiveawayParticipant.createMany({
      data: participants.map((p) => ({
        streamGiveawayId: streamGiveaway.id,
        platform: p.platform,
        externalUserId: p.externalUserId,
        username: p.username,
        avatarUrl: p.avatarUrl || undefined,
        method: p.method,
        tickets: p.tickets,
        metadata: p.metadata || undefined,
      })),
    });

    console.log(`✅ ${created.count} entradas de participantes criadas com sucesso!\n`);

    // 5. Mostrar estatísticas
    console.log('📈 Estatísticas dos participantes:\n');

    const stats = await prisma.streamGiveawayParticipant.groupBy({
      by: ['method'],
      where: { streamGiveawayId: streamGiveaway.id },
      _count: { method: true },
      _sum: { tickets: true },
    });

    console.log('Por método de entrada:');
    stats.forEach((stat) => {
      console.log(`  ${stat.method}: ${stat._count.method} entradas, ${stat._sum.tickets} tickets totais`);
    });

    console.log('\nPor plataforma:');
    const platformStats = await prisma.streamGiveawayParticipant.groupBy({
      by: ['platform'],
      where: { streamGiveawayId: streamGiveaway.id },
      _count: { platform: true },
      _sum: { tickets: true },
    });
    platformStats.forEach((stat) => {
      console.log(`  ${stat.platform}: ${stat._count.platform} entradas, ${stat._sum.tickets} tickets totais`);
    });

    console.log('\nPor usuário (top 10 por tickets totais):');
    const userStats = await prisma.$queryRaw<Array<{ externalUserId: string; username: string; totalTickets: bigint; entries: bigint }>>`
      SELECT 
        "externalUserId",
        "username",
        SUM("tickets") as "totalTickets",
        COUNT(*) as "entries"
      FROM "StreamGiveawayParticipant"
      WHERE "streamGiveawayId" = ${streamGiveaway.id}
      GROUP BY "externalUserId", "username"
      ORDER BY SUM("tickets") DESC
      LIMIT 10
    `;

    userStats.forEach((stat, index) => {
      console.log(`  ${index + 1}. ${stat.username} (${stat.externalUserId}): ${stat.totalTickets} tickets em ${stat.entries} entradas`);
    });

    console.log(`\n✅ Script concluído com sucesso!`);
    console.log(`\n💡 Stream Giveaway ID: ${streamGiveaway.id}`);
    console.log(`💡 Total de entradas: ${created.count}`);
    console.log(`💡 Total de tickets: ${stats.reduce((sum, s) => sum + (s._sum.tickets || 0), 0)}`);

  } catch (error) {
    console.error('❌ Erro ao executar script:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

