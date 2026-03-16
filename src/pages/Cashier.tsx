import { useEffect, useState } from "react"
import { Layout, PageHeader } from "@/components/Layout"
import { OrderStatusBadge } from "@/components/OrderStatusBadge"
import { PixModal } from "@/components/PixModal"
import { useTables } from "@/hooks/useTables"
import { useOrders } from "@/hooks/useOrders"
import { useAuth } from "@/hooks/useAuth"
import { updateOrderStatus, subscribeOrderItems } from "@/services/orders"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/services/firebase"
import type { Table, Order, OrderItem } from "@/types"

function BillModal({
  table, orders, restaurantId, onClose,
}: {
  table: Table; orders: Order[]; restaurantId: string; onClose: () => void
}) {
  const [allItems, setAllItems]       = useState<OrderItem[]>([])
  const [serviceRate, setServiceRate] = useState(0.10)
  const [closing, setClosing]         = useState(false)
  const [showPix, setShowPix]         = useState(false)
  const [mainOrderId, setMainOrderId] = useState("")

  useEffect(() => {
    getDoc(doc(db, "restaurants", restaurantId)).then((snap) => {
      if (snap.exists()) setServiceRate(snap.data().serviceRate ?? 0.10)
    })
  }, [restaurantId])

  useEffect(() => {
    if (orders.length > 0) setMainOrderId(orders[0].id)
    const unsubs = orders.map((o) =>
      subscribeOrderItems(o.id, (items) => {
        setAllItems((prev) => [...prev.filter((i) => i.orderId !== o.id), ...items])
      }),
    )
    return () => unsubs.forEach((u) => u())
  }, [orders])

  const subtotal = allItems.reduce((s, i) => s + i.price * i.qty, 0)
  const service  = subtotal * serviceRate
  const total    = subtotal + service

  async function handleManualClose() {
    setClosing(true)
    await Promise.all(
      orders.map((o) => updateOrderStatus(o.id, "closed", restaurantId, table.number))
    )
    setClosing(false)
    onClose()
  }

  if (showPix && mainOrderId) {
    return (
      <PixModal
        orderId={mainOrderId}
        restaurantId={restaurantId}
        tableNumber={table.number}
        onSuccess={onClose}
        onClose={() => setShowPix(false)}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Mesa {table.number} — Conta</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="mb-4 max-h-64 overflow-y-auto rounded-xl border border-gray-100 divide-y divide-gray-50">
          {allItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="text-gray-700">{item.qty}× {item.name}</span>
              <span className="text-gray-800">R$ {(item.price * item.qty).toFixed(2)}</span>
            </div>
          ))}
        </div>

        <div className="space-y-1.5 rounded-xl bg-gray-50 px-4 py-3">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span><span>R$ {subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>Taxa serviço ({(serviceRate * 100).toFixed(0)}%)</span>
            <span>R$ {service.toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-1.5 text-base font-semibold text-gray-900">
            <span>Total</span><span>R$ {total.toFixed(2)}</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button
            onClick={() => setShowPix(true)}
            className="rounded-xl bg-green-500 py-2.5 text-sm font-semibold text-white hover:bg-green-600"
          >
            💳 PIX
          </button>
          <button onClick={handleManualClose} disabled={closing} className="btn-primary">
            {closing ? "…" : "✅ Fechar"}
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-gray-400">
          PIX gera QR automático · Fechar marca como pago manualmente
        </p>
      </div>
    </div>
  )
}

export default function CashierPage() {
  const { tables }              = useTables()
  const { orders }              = useOrders(["new", "preparing", "ready"])
  const { restaurantId }        = useAuth()
  const [selected, setSelected] = useState<Table | null>(null)

  const openTables = tables.filter((t) => t.status === "open" || t.status === "closing")

  function getTableOrders(tableNumber: number) {
    return orders.filter((o) => o.tableNumber === tableNumber)
  }

  return (
    <Layout>
      <PageHeader title="Caixa / PDV" subtitle={`${openTables.length} mesa${openTables.length !== 1 ? "s" : ""} abertas`} />

      <div className="flex-1 overflow-y-auto p-6">
        {openTables.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-gray-400">
            <span className="text-5xl">🎉</span>
            <p className="text-sm">Nenhuma mesa aberta</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {openTables.map((table) => {
              const tableOrders = getTableOrders(table.number)
              const tableTotal  = tableOrders.reduce((s, o) => s + o.total, 0)
              return (
                <div key={table.id} className="rounded-2xl border border-gray-100 bg-white p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xl font-bold text-gray-800">Mesa {table.number}</span>
                    <span className="text-sm font-semibold text-gray-700">R$ {tableTotal.toFixed(2)}</span>
                  </div>
                  <div className="mb-4 space-y-1.5">
                    {tableOrders.length === 0 ? (
                      <p className="text-xs text-gray-400">Sem pedidos ativos</p>
                    ) : tableOrders.map((o) => (
                      <div key={o.id} className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          {new Date(o.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <OrderStatusBadge status={o.status} />
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setSelected(table)} className="btn-primary w-full text-sm">
                    Ver conta
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {selected && restaurantId && (
        <BillModal
          table={selected}
          orders={getTableOrders(selected.number)}
          restaurantId={restaurantId}
          onClose={() => setSelected(null)}
        />
      )}
    </Layout>
  )
}
