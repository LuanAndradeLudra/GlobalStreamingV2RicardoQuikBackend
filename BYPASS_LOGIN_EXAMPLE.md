# 🚀 Como Usar o Bypass Login

## ⚡ Exemplo Prático - Copie e Cole!

### Passo 1: Descubra seu userId

Acesse o Prisma Studio para ver seus usuários:

```
http://localhost:5555
```

Ou abra uma aba de rede no navegador quando estiver logado e veja o retorno de `/api/auth/me`

### Passo 2: Use esta URL no navegador

**Formato:**
```
http://localhost:4000/api/auth/bypass?userId=SEU_USER_ID_AQUI
```

**Exemplo (substitua pelo seu userId real):**
```
http://localhost:4000/api/auth/bypass?userId=cm4abc123def456ghi789
```

---

## 🎯 O que vai acontecer:

1. ✅ Backend valida se o userId existe
2. 🔑 Gera um token JWT para esse usuário
3. ↪️ Redireciona automaticamente para: `http://localhost:5173/auth/callback?token=...`
4. 🎉 Você estará logado automaticamente no dashboard!

---

## 💡 Dicas

### Caso não saiba seu userId:

1. **Via Prisma Studio** (recomendado):
   - Já está rodando em: http://localhost:5555
   - Clique na tabela "User"
   - Copie o campo "id" do usuário desejado

2. **Via Frontend** (se já estiver logado):
   - Abra o DevTools (F12)
   - Vá para a aba Network
   - Procure a chamada `/api/auth/me`
   - Veja o campo `id` no response

3. **Via Backend Log**:
   - Faça login normalmente pelo Google
   - Veja o console do backend, o userId aparece nos logs

### Erro "User not found"?
- Verifique se o userId está correto (é um UUID longo)
- Certifique-se que o usuário existe no banco
- Use o Prisma Studio para confirmar

---

## 📝 Variáveis de Ambiente

Certifique-se que o `.env` do backend tem:

```env
FRONTEND_URL=http://localhost:5173
JWT_SECRET=your-secret-key
```

---

## ⚠️ LEMBRETE IMPORTANTE

Esta rota é **APENAS PARA DESENVOLVIMENTO**!

Antes de fazer deploy em produção:
- [ ] Remover a rota `@Get('bypass')` do auth.controller.ts
- [ ] Remover o método `bypassLogin()` do auth.service.ts
- [ ] Deletar os arquivos `BYPASS_LOGIN*.md`

---

## 🐛 Troubleshooting

| Problema | Solução |
|----------|---------|
| 404 - Rota não encontrada | Verifique se o backend reiniciou após as mudanças |
| 400 - Missing userId | Esqueceu de passar `?userId=...` na URL |
| 404 - User not found | O userId não existe no banco, verifique no Prisma Studio |
| Não redireciona | Verifique se o frontend está rodando na porta 5173 |
| Token inválido | Verifique a variável `JWT_SECRET` no .env |
