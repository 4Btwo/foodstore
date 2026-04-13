import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  addDoc
} from "firebase/firestore";

// 🔥 CONFIG
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_DOMINIO",
  projectId: "SEU_PROJECT_ID",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 🧠 HELPERS
const random = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomPrice = (min, max) =>
  parseFloat((Math.random() * (max - min) + min).toFixed(2));

const statusList = ["novo", "em_preparo", "entregando", "finalizado"];

// 👥 CLIENTES FAKE
const clientes = [
  "João Silva", "Maria Souza", "Carlos Lima",
  "Ana Paula", "Bruno Costa", "Fernanda Alves",
  "Lucas Rocha", "Juliana Mendes", "Rafael Dias"
];

// 🍽️ RESTAURANTES
const restaurants = [
  { id: "rest_001", nome: "Burger House", tipo: "Hamburgueria" },
  { id: "rest_002", nome: "Bella Massa", tipo: "Pizzaria" },
  { id: "rest_003", nome: "Sushi Express", tipo: "Japonesa" },
  { id: "rest_004", nome: "Açaí Power", tipo: "Açaíteria" },
  { id: "rest_005", nome: "Churras Grill", tipo: "Churrascaria" },
  { id: "rest_006", nome: "Pastel do Zé", tipo: "Lanches" },
  { id: "rest_007", nome: "Fit Food", tipo: "Saudável" },
  { id: "rest_008", nome: "Doces da Vó", tipo: "Sobremesas" }
];

// 📸 IMAGENS BASE
const imagens = {
  logo: [
    "https://images.unsplash.com/photo-1550547660-d9450f859349",
    "https://images.unsplash.com/photo-1601924582975-7cba3c3e7d05",
    "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351"
  ],
  banner: [
    "https://images.unsplash.com/photo-1568901346375-23c9450c58cd",
    "https://images.unsplash.com/photo-1548365328-9f547fb0953c",
    "https://images.unsplash.com/photo-1553621042-f6e147245754"
  ]
};

// 🍔 PRODUTOS BASE POR TIPO
const baseProdutos = {
  Hamburgueria: ["X-Burguer", "X-Bacon", "X-Tudo", "Batata Frita", "Combo"],
  Pizzaria: ["Pizza Calabresa", "Pizza Frango", "Pizza 4 Queijos", "Broto"],
  Japonesa: ["Combo 20 peças", "Temaki", "Hot Roll", "Sashimi"],
  Açaíteria: ["Açaí 300ml", "Açaí 500ml", "Açaí Completo"],
  Churrascaria: ["Marmita Picanha", "Espetinho", "Costela"],
  Lanches: ["Pastel Carne", "Pastel Queijo", "Coxinha"],
  Saudável: ["Salada Fit", "Frango Grelhado", "Suco Detox"],
  Sobremesas: ["Bolo de Chocolate", "Pudim", "Brigadeiro"]
};

// 🚀 FUNÇÃO PRINCIPAL
async function seedDatabase() {
  console.log("🔥 SEED MASSIVO INICIADO...");

  for (const rest of restaurants) {
    const restData = {
      ...rest,
      logo: random(imagens.logo),
      banner: random(imagens.banner),
      createdAt: new Date()
    };

    // 🏪 cria restaurante
    await setDoc(doc(db, "restaurants", rest.id), restData);

    // 📦 cria produtos
    const nomesProdutos = baseProdutos[rest.tipo] || [];
    let produtosCriados = [];

    for (const nome of nomesProdutos) {
      const produto = {
        nome,
        preco: randomPrice(10, 80),
        ativo: true,
        createdAt: new Date()
      };

      const ref = await addDoc(
        collection(db, "restaurants", rest.id, "products"),
        produto
      );

      produtosCriados.push({ id: ref.id, ...produto });
    }

    // 🧾 cria pedidos fake (vários)
    for (let i = 0; i < 15; i++) {
      const itens = [];
      let total = 0;

      const qtdItens = Math.floor(Math.random() * 3) + 1;

      for (let j = 0; j < qtdItens; j++) {
        const prod = random(produtosCriados);
        itens.push({
          produtoId: prod.id,
          nome: prod.nome,
          preco: prod.preco,
          quantidade: Math.floor(Math.random() * 2) + 1
        });

        total += prod.preco;
      }

      const pedido = {
        cliente: random(clientes),
        restauranteId: rest.id,
        itens,
        total: parseFloat(total.toFixed(2)),
        status: random(statusList),
        createdAt: new Date()
      };

      await addDoc(collection(db, "orders"), pedido);
    }

    console.log(`✅ ${rest.nome} populado`);
  }

  console.log("🚀 SEED COMPLETO FINALIZADO!");
}

// ▶️ EXECUTA
seedDatabase().catch(console.error);