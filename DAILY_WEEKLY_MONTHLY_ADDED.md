# ✅ Períodos DAILY, WEEKLY e MONTHLY Adicionados

## 📋 Resumo das Mudanças

Adicionamos os períodos **DAILY**, **WEEKLY** e **MONTHLY** em **todos** os tipos de sorteios.

### ✅ Antes e Depois

| Tipo de Sorteio | Antes | Depois |
|-----------------|-------|--------|
| **Twitch Bits** | DAILY, WEEKLY, MONTHLY, YEARLY | ✅ Sem mudança |
| **Twitch Gift Subs** | ACTIVE | **DAILY, WEEKLY, MONTHLY**, ACTIVE |
| **Kick Coins** | WEEKLY, MONTHLY | **DAILY**, WEEKLY, MONTHLY |
| **Kick Gift Subs** | WEEKLY, MONTHLY | **DAILY**, WEEKLY, MONTHLY |
| **Integrado Bits+Coins** | WEEKLY, MONTHLY | **DAILY**, WEEKLY, MONTHLY |
| **Integrado Gift Subs** | ACTIVE | **DAILY, WEEKLY, MONTHLY**, ACTIVE |

---

## 🔧 Alterações Realizadas

### 1. Schema Prisma (`prisma/schema.prisma`)

Atualizados todos os enums:

```prisma
enum KickGiftSubsCategory {
  DAILY      // ✅ NOVO
  WEEKLY
  MONTHLY
}

enum KickCoinsCategory {
  DAILY      // ✅ NOVO
  WEEKLY
  MONTHLY
}

enum TwitchGiftSubsCategory {
  DAILY      // ✅ NOVO
  WEEKLY     // ✅ NOVO
  MONTHLY    // ✅ NOVO
  ACTIVE
}

enum IntegratedBitsKickCoinsCategory {
  DAILY      // ✅ NOVO
  WEEKLY
  MONTHLY
}

enum IntegratedGiftSubsCategory {
  DAILY      // ✅ NOVO
  WEEKLY     // ✅ NOVO
  MONTHLY    // ✅ NOVO
  ACTIVE
}
```

### 2. Migration (`20260125180000_add_daily_weekly_monthly_to_all_categories/migration.sql`)

```sql
ALTER TYPE "KickGiftSubsCategory" ADD VALUE IF NOT EXISTS 'DAILY';
ALTER TYPE "KickCoinsCategory" ADD VALUE IF NOT EXISTS 'DAILY';
ALTER TYPE "TwitchGiftSubsCategory" ADD VALUE IF NOT EXISTS 'DAILY';
ALTER TYPE "TwitchGiftSubsCategory" ADD VALUE IF NOT EXISTS 'WEEKLY';
ALTER TYPE "TwitchGiftSubsCategory" ADD VALUE IF NOT EXISTS 'MONTHLY';
ALTER TYPE "IntegratedBitsKickCoinsCategory" ADD VALUE IF NOT EXISTS 'DAILY';
ALTER TYPE "IntegratedGiftSubsCategory" ADD VALUE IF NOT EXISTS 'DAILY';
ALTER TYPE "IntegratedGiftSubsCategory" ADD VALUE IF NOT EXISTS 'WEEKLY';
ALTER TYPE "IntegratedGiftSubsCategory" ADD VALUE IF NOT EXISTS 'MONTHLY';
```

### 3. Services

Atualizados os métodos `generateGiveawayName` em todos os services para suportar "Diário":

- `kick-coins-giveaway.service.ts`
- `kick-gift-subs-giveaway.service.ts`
- `integrated-bits-kick-coins-giveaway.service.ts`
- `integrated-gift-subs-giveaway.service.ts`
- `twitch-gift-subs-giveaway.service.ts`

**Exemplo:**
```typescript
const categoryLabel = 
  category === 'DAILY' ? 'Diário' :
  category === 'WEEKLY' ? 'Semanal' : 'Mensal';
```

### 4. DTOs

Atualizado o DTO do Twitch Gift Subs para incluir todos os períodos:

**`twitch-gift-subs-giveaway/dto/create-twitch-gift-subs-giveaway.dto.ts`:**
```typescript
export enum TwitchGiftSubsCategory {
  DAILY = 'DAILY',      // ✅ NOVO
  WEEKLY = 'WEEKLY',    // ✅ NOVO
  MONTHLY = 'MONTHLY',  // ✅ NOVO
  ACTIVE = 'ACTIVE',
}
```

---

## 📅 Helpers Criados

### 1. DateRangeHelper (`src/utils/date-range.helper.ts`)

Funções para calcular ranges de data:

```typescript
// Obter range do dia atual (00:00 até 00:00 do próximo dia)
DateRangeHelper.getDailyRange()

// Obter range da semana atual (Segunda 00:00 até próxima Segunda 00:00)
DateRangeHelper.getWeeklyRange()

// Obter range do mês atual (Dia 1 00:00 até dia 1 do próximo mês 00:00)
DateRangeHelper.getMonthlyRange()

// Gerar SQL WHERE clause para filtrar eventos
DateRangeHelper.getEventDateWhereClause('DAILY', 'eventDate')
```

### 2. CategoryLabelHelper (`src/utils/category-label.helper.ts`)

Funções para gerar labels em português:

```typescript
// Obter label em português
CategoryLabelHelper.getLabel('DAILY')    // "Diário"
CategoryLabelHelper.getLabel('WEEKLY')   // "Semanal"
CategoryLabelHelper.getLabel('MONTHLY')  // "Mensal"

// Gerar nome de sorteio
CategoryLabelHelper.generateGiveawayName('Kick Coins', 'DAILY')
// "Sorteio de Kick Coins - Diário - 25 01 2026"
```

---

## 🎯 Fontes de Dados

### Twitch Bits
- **DAILY**: API Twitch (com compensação de timezone após 21h)
- **WEEKLY**: API Twitch
- **MONTHLY**: API Twitch
- **YEARLY**: API Twitch

### Twitch Gift Subs
- **DAILY**: Tabela `Event` ⚠️ **Precisa implementar**
- **WEEKLY**: Tabela `Event` ⚠️ **Precisa implementar**
- **MONTHLY**: Tabela `Event` ⚠️ **Precisa implementar**
- **ACTIVE**: API Twitch ✅ Já existe

### Kick Coins
- **DAILY**: Tabela `Event` ⚠️ **Precisa implementar**
- **WEEKLY**: Tabela `Event` ⚠️ **Precisa implementar**
- **MONTHLY**: Tabela `Event` ⚠️ **Precisa implementar**

### Kick Gift Subs
- **DAILY**: Tabela `Event` ⚠️ **Precisa implementar**
- **WEEKLY**: Tabela `Event` ⚠️ **Precisa implementar**
- **MONTHLY**: Tabela `Event` ⚠️ **Precisa implementar**

### Integrado Bits + Kick Coins
- **DAILY**: API Twitch + Tabela Event ⚠️ **Precisa implementar**
- **WEEKLY**: API Twitch + Tabela Event ⚠️ **Precisa implementar**
- **MONTHLY**: API Twitch + Tabela Event ⚠️ **Precisa implementar**

### Integrado Gift Subs
- **DAILY**: Tabela `Event` ⚠️ **Precisa implementar**
- **WEEKLY**: Tabela `Event` ⚠️ **Precisa implementar**
- **MONTHLY**: Tabela `Event` ⚠️ **Precisa implementar**
- **ACTIVE**: API Twitch ✅ Já existe

---

## 📝 Próximos Passos (Para Implementar)

### Backend

1. **Implementar busca DAILY/WEEKLY/MONTHLY na tabela Event**
   - [ ] Criar método em cada service para buscar dados do banco
   - [ ] Usar `DateRangeHelper` para calcular ranges
   - [ ] Filtrar por `eventType` e `platform` corretos
   - [ ] Agrupar por `externalUserId` e somar `amount`

2. **Atualizar métodos `syncParticipants`**
   - [ ] Detectar categoria (DAILY/WEEKLY/MONTHLY/ACTIVE)
   - [ ] Chamar fonte correta de dados (API vs Event table)
   - [ ] Popular participantes

3. **Exemplo de query para Kick Coins DAILY:**
```typescript
const { start, end } = DateRangeHelper.getDailyRange();

const results = await this.prisma.event.groupBy({
  by: ['externalUserId', 'username'],
  where: {
    userId: adminUserId,
    platform: 'KICK',
    eventType: 'KICK_COINS',
    eventDate: {
      gte: start,
      lt: end,
    },
  },
  _sum: {
    amount: true,
  },
});

// results = [
//   { externalUserId: '123', username: 'user1', _sum: { amount: 500 } },
//   { externalUserId: '456', username: 'user2', _sum: { amount: 300 } },
// ]
```

### Frontend

1. **Atualizar tipos TypeScript**
   - [ ] Regenerar tipos do Prisma Client
   - [ ] Atualizar enums nos arquivos de tipos

2. **Atualizar formulários**
   - [ ] Adicionar opção "Diário" nos selects de categoria
   - [ ] Atualizar labels para português

3. **Atualizar listagens**
   - [ ] Exibir "Diário" corretamente na coluna de categoria

---

## ✅ Como Testar em Produção

### 1. Aplicar Migration

```bash
# Na VPS
cd /opt/gamerdubrasil
npx prisma migrate deploy
npx prisma generate
pm2 restart gamerdubrasil
```

### 2. Testar Criação de Sorteios

```bash
# Criar sorteio DAILY de Kick Coins
curl -X POST https://www.gamerdubrasil.com.br/api/kick-coins-giveaway \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"category":"DAILY","name":"Teste Diário Kick Coins"}'
```

### 3. Verificar no Banco

```sql
-- Ver sorteios criados
SELECT id, name, category, "createdAt" 
FROM "KickCoinsGiveaway" 
ORDER BY "createdAt" DESC 
LIMIT 5;

-- Verificar enum values
SELECT unnest(enum_range(NULL::"KickCoinsCategory"));
```

---

## 📚 Documentação

- `GIVEAWAY_PERIODS_LOGIC.md` - Lógica completa de períodos e queries SQL
- `DateRangeHelper` - Helper para calcular ranges de data
- `CategoryLabelHelper` - Helper para labels em português

---

Pronto! A base está criada. Agora é só implementar a busca na tabela Event para cada tipo de sorteio! 🎉

