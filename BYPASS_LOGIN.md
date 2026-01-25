# 🔓 Bypass Login - Rota de Desenvolvimento

## ⚠️ ATENÇÃO: USO APENAS EM DESENVOLVIMENTO

Esta rota permite fazer login com qualquer usuário usando apenas o `userId`. 

**NÃO USAR EM PRODUÇÃO!**

---

## Como usar

### 1. Obter o userId de um usuário

Você pode consultar os usuários no banco de dados ou usar o Prisma Studio:

```bash
# Via Prisma Studio (interface visual)
npx prisma studio

# Ou via SQL direto
```

```sql
SELECT id, email, "displayName" FROM "User";
```

### 2. Acessar a rota no navegador

Abra o navegador e acesse:

```
http://localhost:4000/api/auth/bypass?userId={userId}
```

Substitua `{userId}` pelo ID do usuário que você quer logar.

### Exemplo:

```
http://localhost:4000/api/auth/bypass?userId=seu-user-id-aqui
```

### 3. O que acontece:

1. A rota valida se o usuário existe
2. Gera um token JWT para esse usuário
3. Redireciona automaticamente para o frontend com o token: `http://localhost:5173/auth/callback?token=...`
4. O frontend processa o token e faz login automaticamente
5. Você é redirecionado para o dashboard: `/admin/dashboard`

---

## Testando via API (opcional)

Se preferir testar via API client (Postman, Insomnia, etc):

```http
GET http://localhost:4000/api/auth/bypass?userId={userId}
```

A resposta será um redirect 302 para o frontend.

---

## Código Adicionado

### Backend - auth.controller.ts
- Nova rota: `GET /auth/bypass?userId=...`
- Decorador `@Public()` para não exigir autenticação
- Aceita `userId` como query parameter

### Backend - auth.service.ts
- Novo método: `bypassLogin(userId: string)`

---

## Lembrete

**REMOVER ANTES DE IR PARA PRODUÇÃO!**

Para remover:
1. Deletar a rota `@Get('bypass')` do `auth.controller.ts`
2. Deletar o método `bypassLogin` do `auth.service.ts`
3. Deletar este arquivo e o `BYPASS_LOGIN_EXAMPLE.md`

