"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkOnlinePaymentStatus = exports.onlinePixWebhook = exports.pagbankWebhook = exports.createOnlinePixPayment = exports.checkPaymentStatus = exports.mercadoPagoWebhook = exports.createPixPayment = exports.disableUser = exports.createUser = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const mercadopago_1 = require("mercadopago");
if (!admin.apps.length)
    admin.initializeApp();
const db = admin.firestore();
function assertAdmin(context) {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Login necessário');
}
async function getMpToken(restaurantId) {
    var _a;
    const snap = await db.doc(`restaurants/${restaurantId}`).get();
    const token = (_a = snap.data()) === null || _a === void 0 ? void 0 : _a.mpAccessToken;
    if (!token)
        throw new Error('mpAccessToken não configurado');
    return token;
}
// ─── Criar usuário ────────────────────────────────────────────────────────────
exports.createUser = functions
    .region('southamerica-east1')
    .https.onCall(async (data, context) => {
    var _a;
    assertAdmin(context);
    const callerSnap = await db.doc(`users/${context.auth.uid}`).get();
    if (((_a = callerSnap.data()) === null || _a === void 0 ? void 0 : _a.role) !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Apenas admins podem criar usuários');
    }
    const { name, email, password, role, restaurantId } = data;
    const fbUser = await admin.auth().createUser({ email, password, displayName: name });
    await db.doc(`users/${fbUser.uid}`).set({ name, email, role, restaurantId });
    return { uid: fbUser.uid };
});
// ─── Desabilitar usuário ──────────────────────────────────────────────────────
exports.disableUser = functions
    .region('southamerica-east1')
    .https.onCall(async (data, context) => {
    var _a;
    assertAdmin(context);
    const callerSnap = await db.doc(`users/${context.auth.uid}`).get();
    if (((_a = callerSnap.data()) === null || _a === void 0 ? void 0 : _a.role) !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Apenas admins podem desabilitar usuários');
    }
    const { uid } = data;
    await admin.auth().updateUser(uid, { disabled: true });
    await db.doc(`users/${uid}`).update({ disabled: true });
    return { success: true };
});
// ─── PIX ──────────────────────────────────────────────────────────────────────
exports.createPixPayment = functions
    .region('southamerica-east1')
    .https.onCall(async (data, context) => {
    var _a, _b;
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Login necessário');
    const { orderId, restaurantId } = data;
    const orderSnap = await db.doc(`orders/${orderId}`).get();
    if (!orderSnap.exists)
        throw new functions.https.HttpsError('not-found', 'Pedido não encontrado');
    const order = orderSnap.data();
    const restSnap = await db.doc(`restaurants/${restaurantId}`).get();
    const restaurant = restSnap.data();
    const serviceRate = (_a = restaurant.serviceRate) !== null && _a !== void 0 ? _a : 0.10;
    const totalWithFee = parseFloat((order.total * (1 + serviceRate)).toFixed(2));
    const accessToken = await getMpToken(restaurantId);
    const client = new mercadopago_1.MercadoPagoConfig({ accessToken });
    const mpResponse = await new mercadopago_1.Payment(client).create({
        body: {
            transaction_amount: totalWithFee,
            description: `${restaurant.name} — Mesa ${order.tableNumber}`,
            payment_method_id: 'pix',
            payer: { email: 'cliente@foodstore.app' },
            external_reference: orderId,
            notification_url: `https://southamerica-east1-${process.env.GCLOUD_PROJECT}.cloudfunctions.net/mercadoPagoWebhook`,
        },
    });
    const pixData = (_b = mpResponse.point_of_interaction) === null || _b === void 0 ? void 0 : _b.transaction_data;
    if (!(pixData === null || pixData === void 0 ? void 0 : pixData.qr_code))
        throw new functions.https.HttpsError('internal', 'Falha ao gerar QR Code');
    await db.doc(`orders/${orderId}`).update({ mpPaymentId: mpResponse.id, paymentStatus: 'pending', totalWithFee });
    return { paymentId: mpResponse.id, qrCode: pixData.qr_code, qrCodeBase64: pixData.qr_code_base64, total: totalWithFee };
});
// ─── Webhook ──────────────────────────────────────────────────────────────────
exports.mercadoPagoWebhook = functions
    .region('southamerica-east1')
    .https.onRequest(async (req, res) => {
    const { type, data } = req.body;
    if (type !== 'payment') {
        res.status(200).send('ignored');
        return;
    }
    try {
        const paymentId = data.id;
        const ordersSnap = await db.collection('orders').where('mpPaymentId', '==', paymentId).limit(1).get();
        if (ordersSnap.empty) {
            res.status(404).send('not found');
            return;
        }
        const orderDoc = ordersSnap.docs[0];
        const restaurantId = orderDoc.data().restaurantId;
        const client = new mercadopago_1.MercadoPagoConfig({ accessToken: await getMpToken(restaurantId) });
        const mpPayment = await new mercadopago_1.Payment(client).get({ id: paymentId });
        const mpStatus = mpPayment.status;
        await orderDoc.ref.update({ paymentStatus: mpStatus });
        if (mpStatus === 'approved') {
            await orderDoc.ref.update({ status: 'closed' });
            const tablesSnap = await db.collection('tables')
                .where('restaurantId', '==', restaurantId)
                .where('number', '==', orderDoc.data().tableNumber).limit(1).get();
            if (!tablesSnap.empty)
                await tablesSnap.docs[0].ref.update({ status: 'free' });
            await db.collection('payments').add({
                restaurantId, orderId: orderDoc.id, paymentId,
                amount: mpPayment.transaction_amount, method: 'pix',
                status: 'approved', paidAt: admin.firestore.Timestamp.now(),
            });
        }
        res.status(200).send('ok');
    }
    catch (err) {
        functions.logger.error('Webhook error', err);
        res.status(500).send('error');
    }
});
// ─── Verificar pagamento ──────────────────────────────────────────────────────
exports.checkPaymentStatus = functions
    .region('southamerica-east1')
    .https.onCall(async (data) => {
    var _a;
    const snap = await db.doc(`orders/${data.orderId}`).get();
    if (!snap.exists)
        throw new functions.https.HttpsError('not-found', 'Pedido não encontrado');
    const order = snap.data();
    return { paymentStatus: (_a = order.paymentStatus) !== null && _a !== void 0 ? _a : 'pending', orderStatus: order.status };
});
// ─── PIX Online (pedidos pelo link público) ───────────────────────────────────
// Suporta 3 provedores:
//   mercadopago → gera cobrança real via API do MP e retorna QR code base64
//   pagbank     → gera cobrança real via API do PagBank e retorna QR code base64
//   nubank/outro → retorna a chave PIX estática do restaurante (cliente copia e cola)
exports.createOnlinePixPayment = functions
    .region('southamerica-east1')
    .https.onCall(async (data) => {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const { orderId, restaurantId } = data;
    const [orderSnap, restSnap] = await Promise.all([
        db.doc(`online_orders/${orderId}`).get(),
        db.doc(`restaurants/${restaurantId}`).get(),
    ]);
    if (!orderSnap.exists)
        throw new functions.https.HttpsError('not-found', 'Pedido não encontrado');
    const order = orderSnap.data();
    const restaurant = restSnap.data();
    const serviceRate = (_a = restaurant.serviceRate) !== null && _a !== void 0 ? _a : 0;
    const totalWithFee = parseFloat((order.total * (1 + serviceRate)).toFixed(2));
    const pixProvider = (_b = restaurant.pixProvider) !== null && _b !== void 0 ? _b : 'mercadopago';
    const customerName = (_c = order.customerName) !== null && _c !== void 0 ? _c : 'Cliente';
    // ── Mercado Pago ──────────────────────────────────────────────────────────
    if (pixProvider === 'mercadopago') {
        const accessToken = restaurant.mpAccessToken;
        if (!accessToken)
            throw new functions.https.HttpsError('failed-precondition', 'Token do Mercado Pago não configurado');
        const client = new mercadopago_1.MercadoPagoConfig({ accessToken });
        const mpResponse = await new mercadopago_1.Payment(client).create({
            body: {
                transaction_amount: totalWithFee,
                description: `${(_d = restaurant.name) !== null && _d !== void 0 ? _d : 'Restaurante'} — Pedido Online`,
                payment_method_id: 'pix',
                payer: { email: 'cliente@foodstore.app', first_name: customerName },
                external_reference: orderId,
                notification_url: `https://southamerica-east1-${process.env.GCLOUD_PROJECT}.cloudfunctions.net/onlinePixWebhook`,
            },
        });
        const pixData = (_e = mpResponse.point_of_interaction) === null || _e === void 0 ? void 0 : _e.transaction_data;
        if (!(pixData === null || pixData === void 0 ? void 0 : pixData.qr_code))
            throw new functions.https.HttpsError('internal', 'Falha ao gerar QR Code MP');
        await db.doc(`online_orders/${orderId}`).update({
            mpPaymentId: mpResponse.id,
            paymentStatus: 'pending',
            totalWithFee,
        });
        return {
            provider: 'mercadopago',
            paymentId: String(mpResponse.id),
            qrCode: pixData.qr_code,
            qrCodeBase64: (_f = pixData.qr_code_base64) !== null && _f !== void 0 ? _f : '',
            pixKey: pixData.qr_code,
            total: totalWithFee,
        };
    }
    // ── PagBank ───────────────────────────────────────────────────────────────
    if (pixProvider === 'pagbank') {
        const token = restaurant.pagbankToken;
        if (!token)
            throw new functions.https.HttpsError('failed-precondition', 'Token do PagBank não configurado');
        // Monta cobrança PIX via API REST do PagBank
        const response = await fetch('https://api.pagseguro.com/orders', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'x-api-version': '4.0',
            },
            body: JSON.stringify({
                reference_id: orderId,
                customer: { name: customerName, email: 'cliente@foodstore.app' },
                items: [{ name: 'Pedido Online', quantity: 1, unit_amount: Math.round(totalWithFee * 100) }],
                qr_codes: [{ amount: { value: Math.round(totalWithFee * 100) } }],
                notification_urls: [
                    `https://southamerica-east1-${process.env.GCLOUD_PROJECT}.cloudfunctions.net/pagbankWebhook`,
                ],
            }),
        });
        if (!response.ok) {
            const errText = await response.text();
            functions.logger.error('PagBank error', errText);
            throw new functions.https.HttpsError('internal', `Erro PagBank: ${response.status}`);
        }
        const pbData = await response.json();
        const qrCode = (_h = (_g = pbData.qr_codes) === null || _g === void 0 ? void 0 : _g[0]) === null || _h === void 0 ? void 0 : _h.text;
        if (!qrCode)
            throw new functions.https.HttpsError('internal', 'PagBank não retornou QR Code');
        await db.doc(`online_orders/${orderId}`).update({
            pagbankOrderId: pbData.id,
            paymentStatus: 'pending',
            totalWithFee,
        });
        return {
            provider: 'pagbank',
            paymentId: pbData.id,
            qrCode,
            qrCodeBase64: '', // PagBank não retorna base64 — cliente usa copia-e-cola
            pixKey: qrCode,
            total: totalWithFee,
        };
    }
    // ── Nubank / chave PIX estática (qualquer banco) ──────────────────────────
    const pixKey = restaurant.nubankKey;
    if (!pixKey)
        throw new functions.https.HttpsError('failed-precondition', 'Chave PIX não configurada no painel');
    // Sem integração de API — registra o pedido como "aguardando confirmação manual"
    await db.doc(`online_orders/${orderId}`).update({
        paymentStatus: 'pending',
        totalWithFee,
    });
    return {
        provider: 'static',
        paymentId: orderId,
        qrCode: pixKey, // chave PIX — cliente copia e usa no app do banco
        qrCodeBase64: '',
        pixKey,
        total: totalWithFee,
    };
});
// ─── Webhook PagBank ──────────────────────────────────────────────────────────
exports.pagbankWebhook = functions
    .region('southamerica-east1')
    .https.onRequest(async (req, res) => {
    var _a;
    try {
        const body = req.body;
        const orderId = body.reference_id;
        if (!orderId) {
            res.status(200).send('ignored');
            return;
        }
        const charge = (_a = body.charges) === null || _a === void 0 ? void 0 : _a[0];
        if ((charge === null || charge === void 0 ? void 0 : charge.status) === 'PAID') {
            await db.doc(`online_orders/${orderId}`).update({
                paymentStatus: 'approved',
                status: 'confirmed',
            });
            await db.collection('payments').add({
                orderId, method: 'pix', provider: 'pagbank',
                status: 'approved', paidAt: admin.firestore.Timestamp.now(),
            });
        }
        res.status(200).send('ok');
    }
    catch (err) {
        functions.logger.error('PagBank webhook error', err);
        res.status(500).send('error');
    }
});
// ─── Webhook Mercado Pago — Pedidos Online ────────────────────────────────────
exports.onlinePixWebhook = functions
    .region('southamerica-east1')
    .https.onRequest(async (req, res) => {
    const { type, data } = req.body;
    if (type !== 'payment') {
        res.status(200).send('ignored');
        return;
    }
    try {
        const paymentId = data.id;
        const ordersSnap = await db.collection('online_orders')
            .where('mpPaymentId', '==', paymentId).limit(1).get();
        if (ordersSnap.empty) {
            res.status(404).send('not found');
            return;
        }
        const orderDoc = ordersSnap.docs[0];
        const restaurantId = orderDoc.data().restaurantId;
        const client = new mercadopago_1.MercadoPagoConfig({ accessToken: await getMpToken(restaurantId) });
        const mpPayment = await new mercadopago_1.Payment(client).get({ id: paymentId });
        await orderDoc.ref.update({ paymentStatus: mpPayment.status });
        if (mpPayment.status === 'approved') {
            await orderDoc.ref.update({ status: 'confirmed' });
            await db.collection('payments').add({
                restaurantId, orderId: orderDoc.id, paymentId,
                amount: mpPayment.transaction_amount, method: 'pix', provider: 'mercadopago',
                status: 'approved', paidAt: admin.firestore.Timestamp.now(),
            });
        }
        res.status(200).send('ok');
    }
    catch (err) {
        functions.logger.error('Online PIX webhook error', err);
        res.status(500).send('error');
    }
});
// ─── Checar status de pagamento online ───────────────────────────────────────
exports.checkOnlinePaymentStatus = functions
    .region('southamerica-east1')
    .https.onCall(async (data) => {
    var _a, _b;
    const snap = await db.doc(`online_orders/${data.orderId}`).get();
    if (!snap.exists)
        throw new functions.https.HttpsError('not-found', 'Pedido não encontrado');
    const order = snap.data();
    return {
        paymentStatus: ((_a = order.paymentStatus) !== null && _a !== void 0 ? _a : 'pending'),
        orderStatus: ((_b = order.status) !== null && _b !== void 0 ? _b : 'new'),
    };
});
//# sourceMappingURL=index.js.map