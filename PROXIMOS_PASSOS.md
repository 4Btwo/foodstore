# ✅ Projeto configurado — Próximos passos

## Seu projeto Firebase: `foodstore-3a918`

---

## 1. Ativar Authentication no Firebase Console

1. Acesse: https://console.firebase.google.com/project/foodstore-3a918/authentication
2. Clique em **"Começar"**
3. Em **"Método de login"** → ative **"E-mail/senha"**

---

## 2. Ativar o Firestore

1. Acesse: https://console.firebase.google.com/project/foodstore-3a918/firestore
2. Clique em **"Criar banco de dados"**
3. Escolha **"Iniciar no modo de produção"**
4. Região: **southamerica-east1 (São Paulo)** ← importante para baixa latência

---

## 3. Instalar Firebase CLI e fazer deploy das regras

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore
```

---

## 4. Popular o banco com dados de teste

```bash
# No Firebase Console > Configurações do projeto > Contas de serviço
# Clique em "Gerar nova chave privada"
# Salve como service-account.json na pasta do projeto (NÃO faça commit desse arquivo)

node scripts/seed.mjs
```

Isso cria:
- Restaurante "Burger House"  
- 3 usuários: admin / caixa / garçom  
- 11 produtos  
- 12 mesas  

**Credenciais geradas:**
- admin@burgerhouse.com / Admin@123  
- caixa@burgerhouse.com / Caixa@123  
- garcom@burgerhouse.com / Garcom@123  

---

## 5. Rodar localmente

```bash
npm run dev
# Abrir: http://localhost:5173
```

---

## 6. PIX — Configurar Mercado Pago (Fase 2)

Você já tem:
- User ID: `817235040`
- App: `1718382710212356`

Falta obter o **Access Token**:
1. https://www.mercadopago.com.br/developers/panel/app/1718382710212356
2. Aba **"Credenciais"**
3. Copie o **Access Token de teste** para testar sem cobrar de verdade
4. Cole no campo em: **Configurações do restaurante** (dentro do app)

---

## 7. Deploy na Vercel

```bash
# Instale a CLI da Vercel
npm install -g vercel

# Faça login e conecte o projeto
vercel login
vercel link

# Deploy de produção
vercel --prod
```

Após o deploy, atualize `VITE_APP_URL` no painel da Vercel com a URL gerada.

---

## Checklist rápido

- [ ] Firebase Authentication → E-mail/senha ativado
- [ ] Firestore criado em southamerica-east1
- [ ] `firebase deploy --only firestore` executado
- [ ] `node scripts/seed.mjs` executado (com service-account.json)
- [ ] `npm run dev` funcionando
- [ ] Access Token do Mercado Pago configurado (para PIX)
- [ ] Deploy na Vercel
