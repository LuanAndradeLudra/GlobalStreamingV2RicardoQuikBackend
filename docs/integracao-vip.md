# Integração de VIP

A ferramenta externa é a origem dos VIPs. Ela avisa esta API quando alguém vira VIP ou deixa de ser. O cadastro fica na conta do admin do canal. No sorteio, o bônus entra pelo nick de quem fala no chat da Twitch.

O VIP é só da Twitch. O nick (`platformUsername`) identifica a pessoa. Não existe id externo.

Base: `{BASE_URL}/api`

Em local: `http://localhost:3000/api`

Swagger: `{BASE_URL}/api/docs`, tag `vip-integration`.

## Autenticação

Todas as rotas abaixo exigem a chave configurada em `VIP_INTEGRATION_API_KEY`.

```http
X-Api-Key: <VIP_INTEGRATION_API_KEY>
Content-Type: application/json
```

O mesmo valor também vale em `Authorization: Bearer <VIP_INTEGRATION_API_KEY>`.

Chave ausente ou diferente responde `401`:

```json
{
  "statusCode": 401,
  "message": "API key inválida",
  "error": "Unauthorized"
}
```

Os VIPs são gravados na conta do único usuário com papel `ADMIN`. Se existir mais de um admin, defina `VIP_INTEGRATION_USER_ID` com o id dessa conta. Sem um admin resolvível, a resposta é `503`:

```json
{
  "statusCode": 503,
  "message": "Integração VIP sem admin configurado",
  "error": "Service Unavailable"
}
```

Campos que não existem no contrato são recusados com `400`.

## Campos

O sorteio compara o nick do chat com `platformUsername`, sem diferenciar maiúsculas.

| Campo | Obrigatório | Regra |
| --- | --- | --- |
| `platformUsername` | Sim | Nick na Twitch, sem `@`. Até 100 caracteres. É a chave do cadastro |
| `email` | Não | E-mail válido. Gravado em minúsculas |
| `name` | Não | Nome. Até 200 caracteres |
| `bonusTickets` | Não | Inteiro de 1 a 1000. Na criação, o padrão é 5. Se o campo for omitido numa atualização, o valor atual permanece |
| `expiresAt` | Não | Data ISO 8601, ou `null` para ficar ativo até ser removido. Se o campo for omitido numa atualização, a data atual permanece |

Um VIP vale no sorteio quando `expiresAt` é `null` ou está no futuro.

Cada nick existe uma vez só, sem diferenciar maiúsculas. Cadastrar de novo o mesmo nick renova esse registro em vez de criar outro. Remover também usa o nick.

Qualquer VIP gravado por esta API fica com `source: "INTEGRATION"`, inclusive um que tinha sido criado no painel.

## Cadastrar ou atualizar

`PUT /api/integrations/vips`

```json
{
  "email": "fulano@email.com",
  "name": "Fulano Silva",
  "platformUsername": "fulano",
  "bonusTickets": 5,
  "expiresAt": null
}
```

Resposta `200`:

```json
{
  "id": "uuid-interno",
  "email": "fulano@email.com",
  "name": "Fulano Silva",
  "platformUsername": "fulano",
  "bonusTickets": 5,
  "expiresAt": null,
  "source": "INTEGRATION",
  "createdAt": "2026-10-27T18:00:00.000Z",
  "updatedAt": "2026-10-27T18:00:00.000Z"
}
```

Repetir a chamada com o mesmo nick atualiza o registro.

## Remover

`DELETE /api/integrations/vips`

```json
{ "platformUsername": "fulano" }
```

Sucesso: `204`, sem corpo.

Se o VIP não existir: `404`.

```json
{
  "statusCode": 404,
  "message": "VIP não encontrado",
  "error": "Not Found"
}
```

## Listar

`GET /api/integrations/vips`

Resposta `200`: array no mesmo formato do `PUT`, ordenado pelo nick. Inclui VIPs criados no painel e os que chegaram pela integração.

## Sync completo

`POST /api/integrations/vips/sync`

Envia a lista inteira de VIPs ativos. O máximo é 1000 itens. Cada item segue as mesmas regras do `PUT`.

```json
{
  "vips": [
    {
      "email": "fulano@email.com",
      "name": "Fulano Silva",
      "platformUsername": "fulano",
      "bonusTickets": 5,
      "expiresAt": null
    }
  ]
}
```

Resposta `200`:

```json
{ "synced": 1, "removed": 0 }
```

`synced` é a quantidade de itens recebidos. `removed` é quantos VIPs com `source: "INTEGRATION"` foram apagados porque não estavam na lista. Uma lista vazia remove todos os VIPs que vieram da integração.

VIPs criados só no painel (`source: "MANUAL"`) ficam de fora dessa limpeza. Se o mesmo nick for enviado no sync, esse registro passa a ser `INTEGRATION` e os syncs seguintes passam a poder removê-lo.

## Webhook

`POST /api/integrations/vips/webhook`

A mesma chave autentica o webhook. Não há assinatura HMAC.

Ativar ou atualizar:

```json
{
  "event": "vip.activated",
  "data": {
    "email": "fulano@email.com",
    "name": "Fulano Silva",
    "platformUsername": "fulano",
    "bonusTickets": 5,
    "expiresAt": null
  }
}
```

Resposta `200`:

```json
{
  "ok": true,
  "event": "vip.activated",
  "vip": {
    "id": "uuid-interno",
    "email": "fulano@email.com",
    "name": "Fulano Silva",
    "platformUsername": "fulano",
    "bonusTickets": 5,
    "expiresAt": null,
    "source": "INTEGRATION",
    "createdAt": "2026-10-27T18:00:00.000Z",
    "updatedAt": "2026-10-27T18:00:00.000Z"
  }
}
```

Desativar:

```json
{
  "event": "vip.deactivated",
  "data": { "platformUsername": "fulano" }
}
```

Resposta `200`:

```json
{ "ok": true, "event": "vip.deactivated", "removed": true }
```

Se o VIP já não existir, a resposta continua `200` com `"removed": false`. Em `vip.deactivated`, `data.platformUsername` é obrigatório.

## Erros

| HTTP | Quando |
| --- | --- |
| `400` | JSON inválido, campo fora da regra, ou nick ausente |
| `401` | Chave ausente ou diferente de `VIP_INTEGRATION_API_KEY` |
| `404` | `DELETE` de um VIP que não existe |
| `503` | Chave válida, mas não há um admin definido para receber os VIPs |

O corpo de validação traz `message` como lista.

## Variáveis de ambiente

| Variável | Obrigatória | Uso |
| --- | --- | --- |
| `VIP_INTEGRATION_API_KEY` | Sim | Chave enviada pela ferramenta externa |
| `VIP_INTEGRATION_USER_ID` | Não | Id do admin que recebe os VIPs. Sem isso, usa o único usuário `ADMIN` |

Depois de alterar o `.env`, reinicie a API.
