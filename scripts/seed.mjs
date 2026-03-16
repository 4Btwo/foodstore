/**
 * seed.mjs — Script para popular o Firestore com dados iniciais
 *
 * Uso:
 *   1. Instale: npm install -g firebase-admin
 *   2. Baixe a chave de serviço: Firebase Console > Configurações > Contas de serviço
 *   3. Execute: GOOGLE_APPLICATION_CREDENTIALS=./service-account.json node seed.mjs
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

initializeApp({ credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS || './service-account.json') })

const db   = getFirestore()
const auth = getAuth()

const RESTAURANT_ID = 'rest_001'

async function seed() {
  console.log('🌱 Iniciando seed do FoodStore...\n')

  // ── Restaurante ─────────────────────────────────────────────────────────────
  await db.doc(`restaurants/${RESTAURANT_ID}`).set({
    name:           'Burger House',
    logo:           '',
    primaryColor:   '#f97316',
    secondaryColor: '#1f2937',
    serviceRate:    0.10,
    createdAt:      Timestamp.now(),
  })
  console.log('✅ Restaurante criado')

  // ── Usuários ─────────────────────────────────────────────────────────────────
  const users = [
    { email: 'admin@burgerhouse.com',   password: 'Admin@123',  name: 'Admin',       role: 'admin'   },
    { email: 'caixa@burgerhouse.com',   password: 'Caixa@123',  name: 'Maria Caixa', role: 'cashier' },
    { email: 'garcom@burgerhouse.com',  password: 'Garcom@123', name: 'João Garçom', role: 'waiter'  },
  ]

  for (const u of users) {
    const fbUser = await auth.createUser({ email: u.email, password: u.password, displayName: u.name })
    await db.doc(`users/${fbUser.uid}`).set({
      name:         u.name,
      email:        u.email,
      role:         u.role,
      restaurantId: RESTAURANT_ID,
    })
    console.log(`✅ Usuário ${u.role}: ${u.email} / ${u.password}`)
  }

  // ── Produtos ──────────────────────────────────────────────────────────────────
  const products = [
    { name: 'X-Burguer',         price: 28.90, category: 'Hambúrguer', active: true  },
    { name: 'X-Bacon',           price: 34.90, category: 'Hambúrguer', active: true  },
    { name: 'X-Veggie',          price: 30.90, category: 'Hambúrguer', active: true  },
    { name: 'Batata Frita P',    price: 14.90, category: 'Porções',    active: true  },
    { name: 'Batata Frita G',    price: 22.90, category: 'Porções',    active: true  },
    { name: 'Onion Rings',       price: 18.90, category: 'Porções',    active: true  },
    { name: 'Coca-Cola Lata',    price:  7.90, category: 'Bebidas',    active: true  },
    { name: 'Suco de Laranja',   price:  9.90, category: 'Bebidas',    active: true  },
    { name: 'Água Mineral',      price:  4.90, category: 'Bebidas',    active: true  },
    { name: 'Sorvete 2 Bolas',   price: 12.90, category: 'Sobremesa',  active: true  },
    { name: 'Brownie c/ Sorvete',price: 16.90, category: 'Sobremesa',  active: true  },
  ]

  const batch = db.batch()
  for (const p of products) {
    const ref = db.collection('products').doc()
    batch.set(ref, { ...p, restaurantId: RESTAURANT_ID, image: '' })
  }
  await batch.commit()
  console.log(`✅ ${products.length} produtos criados`)

  // ── Mesas ─────────────────────────────────────────────────────────────────────
  const tablesBatch = db.batch()
  for (let i = 1; i <= 12; i++) {
    const ref = db.collection('tables').doc(`table_${String(i).padStart(2, '0')}`)
    tablesBatch.set(ref, {
      restaurantId: RESTAURANT_ID,
      number:       i,
      status:       'free',
    })
  }
  await tablesBatch.commit()
  console.log('✅ 12 mesas criadas')

  console.log('\n🎉 Seed concluído! Dados para login:\n')
  console.log('  Admin:  admin@burgerhouse.com   / Admin@123')
  console.log('  Caixa:  caixa@burgerhouse.com   / Caixa@123')
  console.log('  Garçom: garcom@burgerhouse.com  / Garcom@123')
}

seed().catch((err) => {
  console.error('❌ Erro no seed:', err)
  process.exit(1)
})
