# 🔓 URLs PRONTAS PARA TESTE - Bypass Login

## ✅ Rota funcionando!

A rota de bypass está ativa e funcionando. Basta copiar e colar uma das URLs abaixo no navegador!

---

## 🔗 URLs Disponíveis (seus usuários)

### 1. Luan Andrade (luanandradeti10@gmail.com) - ADMIN

```
http://localhost:4000/api/auth/bypass?userId=a59011a2-9d57-4a4a-91a0-e0ed6a41a803
```

### 2. Luan Andrade (luan.andrade@brilliantmachine.com.br) - ADMIN

```
http://localhost:4000/api/auth/bypass?userId=f2d8ccaa-d210-4f9d-b4e1-9eb4b0c9e92b
```

---

## 🚀 Como Usar

1. **Copie uma das URLs acima**
2. **Cole no navegador** (Chrome, Firefox, etc)
3. **Pressione Enter**
4. **Aguarde o redirect automático** para `http://localhost:5173/auth/callback?token=...`
5. **Pronto!** Você estará logado no dashboard 🎉

---

## 🔄 Atualizar Lista de Usuários

Se você criar novos usuários e quiser gerar novas URLs de bypass:

```bash
cd /home/luan-andrade/dev/work/TrullyGiveaway/backend
npx ts-node scripts/list-users-for-bypass.ts
```

---

## 📝 Formato da URL

```
http://localhost:4000/api/auth/bypass?userId={SEU_USER_ID}
```

Onde `{SEU_USER_ID}` é o UUID do usuário no banco.

---

## ⚠️ IMPORTANTE

- ✅ Use apenas em **desenvolvimento**
- ❌ **NUNCA** deixe isso em produção
- 🗑️ Remova antes do deploy

---

## 🐛 Testado e Funcionando

```bash
$ curl -I "http://localhost:4000/api/auth/bypass?userId=a59011a2-9d57-4a4a-91a0-e0ed6a41a803"

HTTP/1.1 302 Found
Location: http://localhost:5173/auth/callback?token=eyJhbGc...
```

✅ Status 302 - Redirect funcionando
✅ Token JWT gerado
✅ Redirecionamento para frontend configurado

---

Tudo pronto! 🎊

