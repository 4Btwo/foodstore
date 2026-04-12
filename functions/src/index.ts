import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import { MercadoPagoConfig, Payment } from 'mercadopago'

if (!admin.apps.length) admin.initializeApp()
const db = admin.firestore()

function assertAdmin(context: functions.https.CallableContext) {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login necessário')
}

async function getMpToken(restaurantId: string): Promise<string> {
  const snap = await db.doc(`restaurants/${restaurantId}`).get()
  const token = snap.data()?.mpAccessToken as string | undefined
  if (!token) throw new Error('mpAccessToken não configurado')
  return token
}

// ─── Criar usuário ────────────────────────────────────────────────────────────
export const createUser = functions
  .region('southamerica-east1')
  .https.onCall(async (data, context) => {
    assertAdmin(context)
    const callerSnap = await db.doc(`users/${context.auth!.uid}`).get()
    if (callerSnap.data()?.role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Apenas admins podem criar usuários')
    }
    const { name, email, password, role, restaurantId } = data as {
      name: string; email: string; password: string; role: string; restaurantId: string
    }
    const fbUser = await admin.auth().createUser({ email, password, displayName: name })
    await db.doc(`users/${fbUser.uid}`).set({ name, email, role, restaurantId })
    return { uid: fbUser.uid }
  })

// ─── Desabilitar usuário ──────────────────────────────────────────────────────
export const disableUser = functions
  .region('southamerica-east1')
  .https.onCall(async (data, context) => {
    assertAdmin(context)
    const callerSnap = await db.doc(`users/${context.auth!.uid}`).get()
    if (callerSnap.data()?.role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Apenas admins podem desabilitar usuários')
    }
    const { uid } = data as { uid: string }
    await admin.auth().updateUser(uid, { disabled: true })
    await db.doc(`users/${uid}`).update({ disabled: true })
    return { success: true }
  })

// ─── PIX ──────────────────────────────────────────────────────────────────────
export const createPixPayment = functions
  .region('southamerica-east1')
  .https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login necessário')
    const { orderId, restaurantId } = data as { orderId: string; restaurantId: string }
    const orderSnap = await db.doc(`orders/${orderId}`).get()
    if (!orderSnap.exists) throw new functions.https.HttpsError('not-found', 'Pedido não encontrado')
    const order       = orderSnap.data()!
    const restSnap    = await db.doc(`restaurants/${restaurantId}`).get()
    const restaurant  = restSnap.data()!
    const serviceRate = (restaurant.serviceRate as number) ?? 0.10
    const totalWithFee = parseFloat(((order.total as number) * (1 + serviceRate)).toFixed(2))
    const accessToken  = await getMpToken(restaurantId)
    const client       = new MercadoPagoConfig({ accessToken })
    const mpResponse   = await new Payment(client).create({
      body: {
        transaction_amount: totalWithFee,
        description:        `${restaurant.name} — Mesa ${order.tableNumber}`,
        payment_method_id:  'pix',
        payer:              { email: 'cliente@foodstore.app' },
        external_reference: orderId,
        notification_url:   `https://southamerica-east1-${process.env.GCLOUD_PROJECT}.cloudfunctions.net/mercadoPagoWebhook`,
      },
    })
    const pixData = mpResponse.point_of_interaction?.transaction_data
    if (!pixData?.qr_code) throw new functions.https.HttpsError('internal', 'Falha ao gerar QR Code')
    await db.doc(`orders/${orderId}`).update({ mpPaymentId: mpResponse.id, paymentStatus: 'pending', totalWithFee })
    return { paymentId: mpResponse.id, qrCode: pixData.qr_code, qrCodeBase64: pixData.qr_code_base64, total: totalWithFee }
  })

// ─── Webhook ──────────────────────────────────────────────────────────────────
export const mercadoPagoWebhook = functions
  .region('southamerica-east1')
  .https.onRequest(async (req, res) => {
    const { type, data } = req.body as { type: string; data: { id: string } }
    if (type !== 'payment') { res.status(200).send('ignored'); return }
    try {
      const paymentId  = data.id
      const ordersSnap = await db.collection('orders').where('mpPaymentId', '==', paymentId).limit(1).get()
      if (ordersSnap.empty) { res.status(404).send('not found'); return }
      const orderDoc     = ordersSnap.docs[0]
      const restaurantId = orderDoc.data().restaurantId as string
      const client       = new MercadoPagoConfig({ accessToken: await getMpToken(restaurantId) })
      const mpPayment    = await new Payment(client).get({ id: paymentId })
      const mpStatus     = mpPayment.status
      await orderDoc.ref.update({ paymentStatus: mpStatus })
      if (mpStatus === 'approved') {
        await orderDoc.ref.update({ status: 'closed' })
        const tablesSnap = await db.collection('tables')
          .where('restaurantId', '==', restaurantId)
          .where('number', '==', orderDoc.data().tableNumber).limit(1).get()
        if (!tablesSnap.empty) await tablesSnap.docs[0].ref.update({ status: 'free' })
        await db.collection('payments').add({
          restaurantId, orderId: orderDoc.id, paymentId,
          amount: mpPayment.transaction_amount, method: 'pix',
          status: 'approved', paidAt: admin.firestore.Timestamp.now(),
        })
      }
      res.status(200).send('ok')
    } catch (err) { functions.logger.error('Webhook error', err); res.status(500).send('error') }
  })

// ─── Verificar pagamento ──────────────────────────────────────────────────────
export const checkPaymentStatus = functions
  .region('southamerica-east1')
  .https.onCall(async (data) => {
    const snap = await db.doc(`orders/${(data as { orderId: string }).orderId}`).get()
    if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Pedido não encontrado')
    const order = snap.data()!
    return { paymentStatus: order.paymentStatus ?? 'pending', orderStatus: order.status }
  })

// ─── PIX Online (pedidos pelo link público) ───────────────────────────────────
// Suporta 3 provedores:
//   mercadopago → gera cobrança real via API do MP e retorna QR code base64
//   pagbank     → gera cobrança real via API do PagBank e retorna QR code base64
//   nubank/outro → retorna a chave PIX estática do restaurante (cliente copia e cola)

export const createOnlinePixPayment = functions
  .region('southamerica-east1')
  .https.onCall(async (data) => {
    const { orderId, restaurantId } = data as { orderId: string; restaurantId: string }

    const [orderSnap, restSnap] = await Promise.all([
      db.doc(`online_orders/${orderId}`).get(),
      db.doc(`restaurants/${restaurantId}`).get(),
    ])

    if (!orderSnap.exists) throw new functions.https.HttpsError('not-found', 'Pedido não encontrado')

    const order      = orderSnap.data()!
    const restaurant = restSnap.data()!
    const serviceRate   = (restaurant.serviceRate as number) ?? 0
    const totalWithFee  = parseFloat(((order.total as number) * (1 + serviceRate)).toFixed(2))
    const pixProvider   = (restaurant.pixProvider as string) ?? 'mercadopago'
    const customerName  = (order.customerName as string) ?? 'Cliente'

    // ── Mercado Pago ──────────────────────────────────────────────────────────
    if (pixProvider === 'mercadopago') {
      const accessToken = restaurant.mpAccessToken as string | undefined
      if (!accessToken) throw new functions.https.HttpsError('failed-precondition', 'Token do Mercado Pago não configurado')

      const client     = new MercadoPagoConfig({ accessToken })
      const mpResponse = await new Payment(client).create({
        body: {
          transaction_amount: totalWithFee,
          description:        `${restaurant.name ?? 'Restaurante'} — Pedido Online`,
          payment_method_id:  'pix',
          payer:              { email: 'cliente@foodstore.app', first_name: customerName },
          external_reference: orderId,
          notification_url:   `https://southamerica-east1-${process.env.GCLOUD_PROJECT}.cloudfunctions.net/onlinePixWebhook`,
        },
      })

      const pixData = mpResponse.point_of_interaction?.transaction_data
      if (!pixData?.qr_code) throw new functions.https.HttpsError('internal', 'Falha ao gerar QR Code MP')

      await db.doc(`online_orders/${orderId}`).update({
        mpPaymentId:   mpResponse.id,
        paymentStatus: 'pending',
        totalWithFee,
      })

      return {
        provider:     'mercadopago',
        paymentId:    String(mpResponse.id),
        qrCode:       pixData.qr_code,
        qrCodeBase64: pixData.qr_code_base64 ?? '',
        pixKey:       pixData.qr_code,
        total:        totalWithFee,
      }
    }

    // ── PagBank ───────────────────────────────────────────────────────────────
    if (pixProvider === 'pagbank') {
      const token = restaurant.pagbankToken as string | undefined
      if (!token) throw new functions.https.HttpsError('failed-precondition', 'Token do PagBank não configurado')

      // Monta cobrança PIX via API REST do PagBank
      const response = await fetch('https://api.pagseguro.com/orders', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type':  'application/json',
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
      })

      if (!response.ok) {
        const errText = await response.text()
        functions.logger.error('PagBank error', errText)
        throw new functions.https.HttpsError('internal', `Erro PagBank: ${response.status}`)
      }

      const pbData = await response.json() as {
        id: string
        qr_codes?: { id: string; text: string; amount: { value: number } }[]
      }

      const qrCode = pbData.qr_codes?.[0]?.text
      if (!qrCode) throw new functions.https.HttpsError('internal', 'PagBank não retornou QR Code')

      await db.doc(`online_orders/${orderId}`).update({
        pagbankOrderId: pbData.id,
        paymentStatus:  'pending',
        totalWithFee,
      })

      return {
        provider:     'pagbank',
        paymentId:    pbData.id,
        qrCode,
        qrCodeBase64: '',         // PagBank não retorna base64 — cliente usa copia-e-cola
        pixKey:       qrCode,
        total:        totalWithFee,
      }
    }

    // ── Nubank / chave PIX estática (qualquer banco) ──────────────────────────
    const pixKey = restaurant.nubankKey as string | undefined
    if (!pixKey) throw new functions.https.HttpsError('failed-precondition', 'Chave PIX não configurada no painel')

    // Sem integração de API — registra o pedido como "aguardando confirmação manual"
    await db.doc(`online_orders/${orderId}`).update({
      paymentStatus: 'pending',
      totalWithFee,
    })

    return {
      provider:     'static',
      paymentId:    orderId,
      qrCode:       pixKey,     // chave PIX — cliente copia e usa no app do banco
      qrCodeBase64: '',
      pixKey,
      total:        totalWithFee,
    }
  })

// ─── Webhook PagBank ──────────────────────────────────────────────────────────
export const pagbankWebhook = functions
  .region('southamerica-east1')
  .https.onRequest(async (req, res) => {
    try {
      const body = req.body as { reference_id?: string; charges?: { status: string }[] }
      const orderId = body.reference_id
      if (!orderId) { res.status(200).send('ignored'); return }

      const charge = body.charges?.[0]
      if (charge?.status === 'PAID') {
        await db.doc(`online_orders/${orderId}`).update({
          paymentStatus: 'approved',
          status:        'confirmed',
        })
        await db.collection('payments').add({
          orderId, method: 'pix', provider: 'pagbank',
          status: 'approved', paidAt: admin.firestore.Timestamp.now(),
        })
      }
      res.status(200).send('ok')
    } catch (err) {
      functions.logger.error('PagBank webhook error', err)
      res.status(500).send('error')
    }
  })

// ─── Webhook Mercado Pago — Pedidos Online ────────────────────────────────────
export const onlinePixWebhook = functions
  .region('southamerica-east1')
  .https.onRequest(async (req, res) => {
    const { type, data } = req.body as { type: string; data: { id: string } }
    if (type !== 'payment') { res.status(200).send('ignored'); return }
    try {
      const paymentId   = data.id
      const ordersSnap  = await db.collection('online_orders')
        .where('mpPaymentId', '==', paymentId).limit(1).get()
      if (ordersSnap.empty) { res.status(404).send('not found'); return }

      const orderDoc     = ordersSnap.docs[0]
      const restaurantId = orderDoc.data().restaurantId as string
      const client       = new MercadoPagoConfig({ accessToken: await getMpToken(restaurantId) })
      const mpPayment    = await new Payment(client).get({ id: paymentId })

      await orderDoc.ref.update({ paymentStatus: mpPayment.status })
      if (mpPayment.status === 'approved') {
        await orderDoc.ref.update({ status: 'confirmed' })
        await db.collection('payments').add({
          restaurantId, orderId: orderDoc.id, paymentId,
          amount: mpPayment.transaction_amount, method: 'pix', provider: 'mercadopago',
          status: 'approved', paidAt: admin.firestore.Timestamp.now(),
        })
      }
      res.status(200).send('ok')
    } catch (err) {
      functions.logger.error('Online PIX webhook error', err)
      res.status(500).send('error')
    }
  })

// ─── Checar status de pagamento online ───────────────────────────────────────
export const checkOnlinePaymentStatus = functions
  .region('southamerica-east1')
  .https.onCall(async (data) => {
    const snap = await db.doc(`online_orders/${(data as { orderId: string }).orderId}`).get()
    if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Pedido não encontrado')
    const order = snap.data()!
    return {
      paymentStatus: (order.paymentStatus ?? 'pending') as string,
      orderStatus:   (order.status ?? 'new') as string,
    }
  })
