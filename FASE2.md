# Fase 2 — Configuração PIX + QR Code

## 1. Configurar Mercado Pago

### Criar conta e obter o Access Token
1. Acesse https://www.mercadopago.com.br/developers
2. Crie um app em "Suas integrações"
3. Copie o **Access Token de produção** (ou de teste para testes)

### Salvar o token no Firestore (por restaurante)
No Firebase Console > Firestore, no documento `restaurants/rest_001`, adicione:
```
mpAccessToken: "APP_USR-xxxx-seu-token-aqui"
```

> Isso é multi-tenant: cada restaurante tem seu próprio token do Mercado Pago.

---

## 2. Deploy das Cloud Functions

```bash
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions
```

Após o deploy, anote a URL da função `mercadoPagoWebhook`:
```
https://southamerica-east1-SEU_PROJETO.cloudfunctions.net/mercadoPagoWebhook
```

---

## 3. Configurar o Webhook no Mercado Pago

1. No painel MP: Configurações > Webhooks
2. Adicione a URL da função acima
3. Selecione o evento: **Pagamentos**
4. Salve

O webhook vai receber confirmações automáticas e fechar pedidos pagos.

---

## 4. Variável de ambiente (opcional)

Adicione ao `.env` do frontend:
```
VITE_APP_URL=https://seu-dominio.vercel.app
```

Isso garante que os QR Codes gerados apontem para o domínio correto de produção.

---

## 5. Teste local das Cloud Functions

```bash
firebase emulators:start --only functions,firestore
```

Use o Access Token de **teste** do Mercado Pago para simular pagamentos sem cobrar.

---

## Fluxo completo

```
Cliente escaneia QR da mesa
        ↓
/menu/:restaurantId/:tableNumber
        ↓
Vê cardápio → adiciona itens → toca "Confirmar e pagar com PIX"
        ↓
Frontend chama Cloud Function createPixPayment
        ↓
Cloud Function cria pagamento no Mercado Pago API
        ↓
Retorna qrCode + qrCodeBase64 para o frontend
        ↓
Cliente vê QR e paga pelo app do banco
        ↓
Mercado Pago envia POST para mercadoPagoWebhook
        ↓
Cloud Function confirma e fecha pedido + libera mesa
        ↓
Frontend (polling a cada 5s) detecta status "approved"
        ↓
Tela de sucesso ✅
```
