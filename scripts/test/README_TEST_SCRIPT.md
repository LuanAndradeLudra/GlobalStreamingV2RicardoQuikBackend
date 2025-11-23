# Script de Teste de Participantes

Este script cria participantes de teste para um stream giveaway com todos os tiers e tipos de donations.

## Como usar

```bash
npm run test:participants
```

ou

```bash
npx ts-node --project tsconfig.json scripts/test-participants.ts
```

## O que o script faz

1. **Busca ou cria um stream giveaway** para testes
2. **Remove participantes existentes** (se houver)
3. **Cria participantes com:**
   - Todos os tiers do Twitch (Tier 1, 2, 3, Non-Sub)
   - Todos os tiers do Kick (Sub, Non-Sub)
   - Todos os tiers do YouTube (Sub, Non-Sub)
   - Todos os tipos de donations (Bits, Gift Subs, Kick Coins, Superchat)
   - Alguns usuários com múltiplas entradas (tier + donations)

## Participantes criados

### Usuários com Tiers:
- **user1_twitch**: Tier 1 + Bits + Gift Subs
- **user2_twitch**: Tier 2 + Bits
- **user3_twitch**: Tier 3 + Bits + Gift Subs + Superchat
- **user4_twitch**: Non-Sub + Bits
- **user5_kick**: Kick Sub + Kick Coins
- **user6_kick**: Kick Non-Sub + Kick Coins
- **user7_youtube**: YouTube Sub
- **user8_youtube**: YouTube Non-Sub

### Usuários com Todos os Donations:
- **user9_all_donations**: Bits + Gift Subs + Superchat + Kick Coins
- **user10_whale**: Tier 3 + Bits + Gift Subs + Superchat (usuário com mais tickets)

## Estatísticas

O script mostra estatísticas ao final:
- Entradas por método
- Entradas por plataforma
- Top 10 usuários por tickets totais

## Requisitos

- Um usuário ADMIN deve existir no banco de dados
- O Prisma Client deve estar gerado (`npm run prisma:generate`)
- As migrations devem estar aplicadas (`npm run prisma:migrate`)

