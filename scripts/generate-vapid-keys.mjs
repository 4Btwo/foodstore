/**
 * Gera as chaves VAPID para Web Push.
 * 
 * Uso:
 *   npm install -g web-push
 *   node scripts/generate-vapid-keys.mjs
 * 
 * Ou sem instalar:
 *   npx web-push generate-vapid-keys
 * 
 * Copie as chaves geradas para o .env:
 *   VITE_VAPID_PUBLIC_KEY=<publicKey>
 *   VAPID_PRIVATE_KEY=<privateKey>
 */

import webpush from 'web-push'

const keys = webpush.generateVAPIDKeys()

console.log('\n✅ Chaves VAPID geradas!\n')
console.log('Copie para o seu .env:\n')
console.log(`VITE_VAPID_PUBLIC_KEY=${keys.publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`)
console.log('\n⚠️  Guarde a chave privada em segredo — nunca coloque no frontend!')
