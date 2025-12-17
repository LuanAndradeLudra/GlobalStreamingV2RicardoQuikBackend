# Sistema de Sorteio com Palavras-Chave - Integração Twitch

## Visão Geral

Sistema completo de sorteios em tempo real integrado com webhooks da Twitch (e preparado para Kick/YouTube). Quando um usuário digita uma palavra-chave no chat, ele automaticamente entra no sorteio.

## Arquitetura

### Componentes Principais

1. **Redis** - Cache em memória para sorteios ativos e dedupe
2. **PostgreSQL** - Armazenamento persistente de participantes e vencedores
3. **Socket.IO** - Broadcast em tempo real para o frontend
4. **Webhooks** - Captura de mensagens da Twitch/Kick

### Fluxo de Ponta a Ponta

```
┌─────────────────────────────────────────────────────────────────┐
│                    1. ABRIR SORTEIO (HTTP)                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                   ┌──────────────────────┐
                   │   PostgreSQL (DB)    │ ← Persiste sorteio
                   └──────────────────────┘
                              ↓
                   ┌──────────────────────┐
                   │   Redis (Cache)      │ ← Publica estado quente
                   │ Key: giveaway:active │   (keyword, platforms)
                   └──────────────────────┘
                              ↓
                   ┌──────────────────────┐
                   │   Socket.IO          │ ← Broadcast "giveaway:opened"
                   └──────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│            2. MENSAGEM NO CHAT (Webhook Twitch)                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
              "!sorteio" enviado por @viewer123
                              ↓
         ┌────────────────────────────────────────┐
         │ TwitchWebhooksService.processChatMessage│
         └────────────────────────────────────────┘
                              ↓
         ┌────────────────────────────────────────┐
         │ Normaliza mensagem (lowercase, trim)    │
         │ Busca keyword no Redis                  │
         └────────────────────────────────────────┘
                              ↓
                    ┌─────────────┐
                    │ Match? ✅   │
                    └─────────────┘
                              ↓
         ┌────────────────────────────────────────┐
         │ Verifica DEDUPE no Redis                │
         │ Key: giveaway:participants:{id}:{user}  │
         └────────────────────────────────────────┘
                              ↓
                    ┌─────────────┐
                    │ Duplicado?  │
                    └─────────────┘
                       ↓        ↓
                     SIM      NÃO
                       ↓        ↓
                   Ignora  Continua
                              ↓
         ┌────────────────────────────────────────┐
         │ Calcula tickets (regras globais/override)│
         └────────────────────────────────────────┘
                              ↓
         ┌────────────────────────────────────────┐
         │ Salva no PostgreSQL                     │
         │ Table: StreamGiveawayParticipant        │
         └────────────────────────────────────────┘
                              ↓
         ┌────────────────────────────────────────┐
         │ Marca no Redis (dedupe)                 │
         │ Incrementa métricas                     │
         └────────────────────────────────────────┘
                              ↓
         ┌────────────────────────────────────────┐
         │ Socket.IO Broadcast                     │
         │ Event: "participant:added"              │
         └────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│              3. FECHAR SORTEIO / SORTEAR VENCEDOR               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
         ┌────────────────────────────────────────┐
         │ Update status: OPEN → CLOSED/DONE       │
         └────────────────────────────────────────┘
                              ↓
         ┌────────────────────────────────────────┐
         │ Remove do Redis (limpa cache)           │
         └────────────────────────────────────────┘
                              ↓
         ┌────────────────────────────────────────┐
         │ Socket.IO Broadcast                     │
         │ Event: "giveaway:closed"                │
         └────────────────────────────────────────┘
```

## Estrutura de Dados no Redis

### 1. Sorteios Ativos (Keyword Matching)
```
Key: giveaway:active:{userId}:{platform}:{keyword}
Value: JSON {
  streamGiveawayId: "uuid",
  userId: "admin-uuid",
  keyword: "sorteio",
  platform: "TWITCH",
  allowedRoles: ["TWITCH_NON_SUB", "TWITCH_TIER_1", ...],
  donationConfigs: [...]
}
TTL: Nenhum (removido manualmente ao fechar)
```

### 2. Dedupe de Participantes
```
Key: giveaway:participants:{streamGiveawayId}:{platform}:{externalUserId}
Value: SET ["TWITCH_NON_SUB", "BITS", ...]
TTL: 30 dias (limpeza automática)
```

### 3. Métricas em Tempo Real
```
Key: giveaway:metrics:{streamGiveawayId}
Value: HASH {
  "total_participants": "42",
  "total_messages_processed": "150"
}
TTL: Nenhum
```

## Eventos Socket.IO

### Frontend → Backend
Nenhum (apenas recebe broadcasts)

### Backend → Frontend
- `giveaway:opened` - Sorteio aberto
- `giveaway:closed` - Sorteio fechado
- `participant:added` - Novo participante
- `participant:updated` - Participante atualizado
- `winner:drawn` - Vencedor sorteado
- `metrics:updated` - Métricas atualizadas

## APIs HTTP

### Criar/Abrir Sorteio
```http
POST /giveaway
Authorization: Bearer {jwt}
Content-Type: application/json

{
  "name": "Sorteio da Stream",
  "keyword": "sorteio",
  "platforms": ["TWITCH"],
  "status": "OPEN",
  "allowedRoles": ["TWITCH_NON_SUB", "TWITCH_TIER_1"],
  "donationConfigs": [
    {
      "platform": "TWITCH",
      "unitType": "BITS",
      "donationWindow": "DAILY"
    }
  ]
}
```

### Atualizar Status (Fechar)
```http
PATCH /giveaway/{id}
Authorization: Bearer {jwt}
Content-Type: application/json

{
  "status": "CLOSED"
}
```

### Sortear Vencedor
```http
POST /giveaway/{id}/draw
Authorization: Bearer {jwt}
```

## Configuração

### Variáveis de Ambiente

```env
# Redis
REDIS_URL=redis://localhost:6379

# Twitch
TWITCH_CLIENT_ID=your_client_id
TWITCH_WEBHOOK_SECRET=your_webhook_secret

# Random.org
RANDOM_ORG_API_KEY=your_api_key
```

### Instalação de Dependências

```bash
cd backend
npm install
```

### Iniciar Redis (Docker)

```bash
docker run -d -p 6379:6379 --name redis redis:alpine
```

### Iniciar Backend

```bash
npm run start:dev
```

## Regras de Negócio

### Dedupe
- Um usuário pode participar apenas uma vez com cada método (NON_SUB, BITS, GIFT_SUB, etc)
- Verificação atômica no Redis antes de inserir no banco

### Cálculo de Tickets
1. **Base** - Tickets por role (NON_SUB, TIER_1, etc)
2. **Bits** - Tickets por quantidade de bits (se habilitado)
3. **Gift Subs** - Tickets por gift subs (se habilitado)

### Janelas de Tempo (Donation Windows)
- `DAILY` - Hoje até amanhã (24h)
- `WEEKLY` - Segunda atual até próxima segunda (7 dias)
- `MONTHLY` - 1º do mês atual até 1º do próximo mês (30 dias)

## Logs e Monitoramento

### Logs Importantes
- `📤 Publishing active giveaway` - Sorteio publicado no Redis
- `📥 Removing active giveaway` - Sorteio removido do Redis
- `🔍 Searching for giveaway` - Busca de keyword na mensagem
- `✅ Match found!` - Keyword encontrada
- `⚠️ Duplicate entry detected` - Usuário já participou
- `🎉 Participant added` - Participante adicionado com sucesso

## Próximos Passos

### Integração Kick
- [ ] Adicionar processamento no `KickWebhooksService`
- [ ] Mesmo fluxo do Twitch

### Integração YouTube
- [ ] Implementar polling do YouTube Chat API
- [ ] Processar mensagens e adicionar participantes

### Validação de Bits/Gift Subs
- [ ] Buscar dados de doações nas APIs quando donation config está habilitado
- [ ] Adicionar participantes automáticos para doadores

### Jobs Assíncronos (Opcional)
- [ ] BullMQ para validações pesadas
- [ ] Retry logic para APIs externas

## Troubleshooting

### Participante não entra no sorteio
1. Verificar se sorteio está OPEN
2. Verificar se keyword foi digitada corretamente
3. Verificar logs: "Match found" deve aparecer
4. Verificar se role do usuário está em allowedRoles

### Redis não conecta
1. Verificar se Redis está rodando: `docker ps`
2. Verificar REDIS_URL no `.env`
3. Verificar logs: "Redis connected successfully"

### Socket.IO não conecta
1. Verificar CORS no frontend
2. Verificar namespace: `/giveaway`
3. Verificar porta do backend (padrão: 3000)




