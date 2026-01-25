

# 📅 Períodos de Sorteios - Lógica de Busca

## Resumo das Mudanças

Adicionamos os períodos **DAILY**, **WEEKLY** e **MONTHLY** em todos os tipos de sorteios:

| Tipo de Sorteio | Antes | Depois |
|-----------------|-------|--------|
| **Twitch Bits** | DAILY, WEEKLY, MONTHLY, YEARLY | ✅ Sem mudança |
| **Twitch Gift Subs** | ACTIVE | DAILY, WEEKLY, MONTHLY, ACTIVE |
| **Kick Coins** | WEEKLY, MONTHLY | DAILY, WEEKLY, MONTHLY |
| **Kick Gift Subs** | WEEKLY, MONTHLY | DAILY, WEEKLY, MONTHLY |
| **Integrado Bits+Coins** | WEEKLY, MONTHLY | DAILY, WEEKLY, MONTHLY |
| **Integrado Gift Subs** | ACTIVE | DAILY, WEEKLY, MONTHLY, ACTIVE |

---

## 🎯 Fontes de Dados por Tipo e Período

### 1. **Twitch Bits**

| Período | Fonte | Observações |
|---------|-------|-------------|
| **DAILY** | API Twitch | ✅ Com compensação de timezone (após 21h Brasil busca próximo dia UTC) |
| **WEEKLY** | API Twitch | Segunda-feira 00:00 UTC da semana atual |
| **MONTHLY** | API Twitch | Dia 1 00:00 UTC do mês atual |
| **YEARLY** | API Twitch | - |

**Implementação:** Já existe no `TwitchService.getBitsLeaderboard()`

---

### 2. **Twitch Gift Subs**

| Período | Fonte | Observações |
|---------|-------|-------------|
| **DAILY** | Tabela `Event` | ⚠️ NOVO - Buscar onde `eventType = 'GIFT_SUBSCRIPTION'` do dia |
| **WEEKLY** | Tabela `Event` | ⚠️ NOVO - Segunda 00:00 até próxima Segunda 00:00 (Brasil) |
| **MONTHLY** | Tabela `Event` | ⚠️ NOVO - Dia 1 00:00 até fim do mês (Brasil) |
| **ACTIVE** | API Twitch | ✅ Já existe - Gift subs ativos |

**Query SQL (DAILY):**
```sql
SELECT 
  "externalUserId",
  "username",
  SUM("amount") as total_gifts
FROM "Event"
WHERE "userId" = 'admin_user_id'
  AND "platform" = 'TWITCH'
  AND "eventType" = 'GIFT_SUBSCRIPTION'
  AND "eventDate" >= (CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo')
  AND "eventDate" < (CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo' + INTERVAL '1 day')
GROUP BY "externalUserId", "username"
```

**Query SQL (WEEKLY):**
```sql
-- Segunda-feira 00:00 da semana atual até próxima segunda 00:00
SELECT 
  "externalUserId",
  "username",
  SUM("amount") as total_gifts
FROM "Event"
WHERE "userId" = 'admin_user_id'
  AND "platform" = 'TWITCH'
  AND "eventType" = 'GIFT_SUBSCRIPTION'
  AND "eventDate" >= date_trunc('week', CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')
  AND "eventDate" < date_trunc('week', CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo') + INTERVAL '1 week'
GROUP BY "externalUserId", "username"
```

---

### 3. **Kick Coins**

| Período | Fonte | Observações |
|---------|-------|-------------|
| **DAILY** | Tabela `Event` | ⚠️ NOVO - Buscar onde `eventType = 'KICK_COINS'` do dia |
| **WEEKLY** | Tabela `Event` | ⚠️ NOVO - Segunda 00:00 até próxima Segunda 00:00 (Brasil) |
| **MONTHLY** | Tabela `Event` | Segunda 00:00 até próxima Segunda 00:00 (Brasil) |

**Query SQL (DAILY):**
```sql
SELECT 
  "externalUserId",
  "username",
  SUM("amount") as total_coins
FROM "Event"
WHERE "userId" = 'admin_user_id'
  AND "platform" = 'KICK'
  AND "eventType" = 'KICK_COINS'
  AND "eventDate" >= (CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo')
  AND "eventDate" < (CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo' + INTERVAL '1 day')
GROUP BY "externalUserId", "username"
```

---

### 4. **Kick Gift Subs**

| Período | Fonte | Observações |
|---------|-------|-------------|
| **DAILY** | Tabela `Event` | ⚠️ NOVO - Buscar onde `eventType = 'GIFT_SUBSCRIPTION'` e `platform = 'KICK'` |
| **WEEKLY** | Tabela `Event` | ⚠️ NOVO - Segunda 00:00 até próxima Segunda 00:00 (Brasil) |
| **MONTHLY** | Tabela `Event` | ✅ Já existe - Usar tabela `Event` |

**Query SQL (DAILY):**
```sql
SELECT 
  "externalUserId",
  "username",
  SUM("amount") as total_gifts
FROM "Event"
WHERE "userId" = 'admin_user_id'
  AND "platform" = 'KICK'
  AND "eventType" = 'GIFT_SUBSCRIPTION'
  AND "eventDate" >= (CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo')
  AND "eventDate" < (CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo' + INTERVAL '1 day')
GROUP BY "externalUserId", "username"
```

---

### 5. **Integrado - Bits + Kick Coins**

| Período | Fonte | Observações |
|---------|-------|-------------|
| **DAILY** | ⚠️ NOVO | |
| - Twitch Bits | API Twitch | Com compensação de timezone |
| - Kick Coins | Tabela `Event` | Buscar `KICK_COINS` do dia |
| **WEEKLY** | Misto | |
| - Twitch Bits | API Twitch | |
| - Kick Coins | Tabela `Event` | |
| **MONTHLY** | Misto | |
| - Twitch Bits | API Twitch | |
| - Kick Coins | Tabela `Event` | |

---

### 6. **Integrado - Gift Subs (Twitch + Kick)**

| Período | Fonte | Observações |
|---------|-------|-------------|
| **DAILY** | Tabela `Event` | ⚠️ NOVO - Ambas as plataformas da tabela Event |
| **WEEKLY** | Tabela `Event` | ⚠️ NOVO - Ambas as plataformas da tabela Event |
| **MONTHLY** | Tabela `Event` | ⚠️ NOVO - Ambas as plataformas da tabela Event |
| **ACTIVE** | API Twitch | ✅ Já existe - Apenas Twitch gift subs ativos |

**Query SQL (DAILY - Integrado):**
```sql
SELECT 
  "platform",
  "externalUserId",
  "username",
  SUM("amount") as total_gifts
FROM "Event"
WHERE "userId" = 'admin_user_id'
  AND "eventType" = 'GIFT_SUBSCRIPTION'
  AND "eventDate" >= (CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo')
  AND "eventDate" < (CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo' + INTERVAL '1 day')
GROUP BY "platform", "externalUserId", "username"
```

---

## 🕐 Lógica de Semana (WEEKLY)

Seguindo a especificação da Twitch:

> **week** — A week spans from 00:00:00 on the Monday of the week specified in started_at and runs through 00:00:00 of the next Monday.

**PostgreSQL:**
```sql
-- Início da semana (Segunda 00:00)
date_trunc('week', CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')

-- Fim da semana (Próxima Segunda 00:00)
date_trunc('week', CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo') + INTERVAL '1 week'
```

**Exemplo:**
- Hoje: Sábado, 25/01/2026 15:00 BRT
- Início da semana: Segunda, 20/01/2026 00:00 BRT
- Fim da semana: Segunda, 27/01/2026 00:00 BRT

---

## 🕐 Lógica de Dia (DAILY)

**PostgreSQL:**
```sql
-- Início do dia
CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo'

-- Fim do dia
CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo' + INTERVAL '1 day'
```

**Exemplo:**
- Hoje: 25/01/2026 15:30 BRT
- Início do dia: 25/01/2026 00:00 BRT
- Fim do dia: 26/01/2026 00:00 BRT

---

## 📋 Checklist de Implementação

### Backend - Services

- [ ] **TwitchGiftSubsGiveawayService**
  - [ ] Adicionar método `getGiftSubsByPeriod(category: 'DAILY' | 'WEEKLY' | 'MONTHLY')`
  - [ ] Query na tabela `Event` para DAILY/WEEKLY/MONTHLY
  - [ ] Manter lógica ACTIVE existente (API)

- [ ] **KickCoinsGiveawayService**
  - [ ] Adicionar método para DAILY
  - [ ] Adicionar método para WEEKLY
  - [ ] Atualizar lógica MONTHLY para usar tabela Event

- [ ] **KickGiftSubsGiveawayService**
  - [ ] Adicionar método para DAILY
  - [ ] Adicionar método para WEEKLY
  - [ ] Atualizar lógica MONTHLY para usar tabela Event

- [ ] **IntegratedBitsKickCoinsGiveawayService**
  - [ ] Adicionar método para DAILY (API Twitch + Event Kick)
  - [ ] Atualizar WEEKLY e MONTHLY

- [ ] **IntegratedGiftSubsGiveawayService**
  - [ ] Adicionar método para DAILY (Event)
  - [ ] Adicionar método para WEEKLY (Event)
  - [ ] Adicionar método para MONTHLY (Event)
  - [ ] Manter ACTIVE (API Twitch)

### Frontend - DTOs

- [ ] Atualizar tipos TypeScript para incluir novos enum values
- [ ] Atualizar formulários de criação de sorteios
- [ ] Adicionar labels PT-BR para "Diário"

---

## 🧪 Como Testar

### 1. Testar DAILY (Kick Coins)

```bash
# Criar evento de teste para hoje
curl -X POST http://localhost:4000/webhooks-test/kick/coins \
  -H "Content-Type: application/json" \
  -d '{"username":"TestDaily","amount":1000}'

# Criar sorteio DAILY de Kick Coins
# Verificar se o usuário "TestDaily" aparece com 1000 coins
```

### 2. Testar WEEKLY

```bash
# Criar eventos em dias diferentes da semana
curl -X POST http://localhost:4000/webhooks-test/kick/coins \
  -d '{"username":"TestWeekly","amount":500}'

# Aguardar 1 dia, doar novamente
curl -X POST http://localhost:4000/webhooks-test/kick/coins \
  -d '{"username":"TestWeekly","amount":300}'

# Criar sorteio WEEKLY
# Verificar se o usuário "TestWeekly" aparece com 800 coins (500+300)
```

---

## ⚠️ Importante

1. **Timezone:** Certifique-se que a VPS está configurada com timezone `America/Sao_Paulo`
2. **Twitch Bits DAILY:** Usa API com compensação de timezone (após 21h busca próximo dia)
3. **Event DAILY/WEEKLY:** Usa tabela Event com timezone Brasil
4. **date_trunc('week'):** No PostgreSQL, semana começa na segunda-feira por padrão

---

Pronto! Agora todos os sorteios suportam DAILY, WEEKLY e MONTHLY! 🎉

