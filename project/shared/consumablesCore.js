import { todayStr } from './generators.js'

export function decorateConsumable(c) {
  const threshold = Number(c.threshold) || 0
  const stock = Number(c.stock) || 0
  const ratio = threshold > 0 ? Math.round((stock / (threshold * 2)) * 100) : 100
  return {
    ...c,
    lowStock: stock < threshold,
    stockLevel: Math.max(0, Math.min(100, ratio))
  }
}

export function getConsumables(db) {
  const list = (db.consumables || []).map(decorateConsumable)
  return {
    list,
    lowStockCount: list.filter((c) => c.lowStock).length,
    total: list.length
  }
}

export function getConsumableById(db, id) {
  const found = (db.consumables || []).find((c) => c.id === id)
  return found ? decorateConsumable(found) : null
}

export function getStockLogs(db, limit = 10) {
  return [...(db.stockLogs || [])].reverse().slice(0, limit)
}

function formatTime(now) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

export function adjustStock(db, consumableId, { type, quantity, operator = '', note = '' } = {}, now) {
  const list = db.consumables || []
  const index = list.findIndex((c) => c.id === consumableId)
  if (index === -1) {
    return { ok: false, message: '耗材不存在' }
  }
  if (type !== 'in' && type !== 'out') {
    return { ok: false, message: '出入库类型无效' }
  }
  const qty = Number(quantity)
  if (!Number.isInteger(qty) || qty <= 0) {
    return { ok: false, message: '数量必须为正整数' }
  }
  const consumable = list[index]
  if (type === 'out' && qty > Number(consumable.stock)) {
    return {
      ok: false,
      message: `出库数量 ${qty} 超过当前库存 ${consumable.stock}${consumable.unit}`
    }
  }
  const nextStock = type === 'in' ? Number(consumable.stock) + qty : Number(consumable.stock) - qty
  const updated = {
    ...consumable,
    stock: nextStock,
    updatedAt: todayStr()
  }
  const log = {
    id: `L${(db.stockLogs || []).length + 1}`,
    consumableId,
    consumableName: consumable.name,
    type,
    quantity: qty,
    unit: consumable.unit,
    operator: String(operator || '').trim() || '未署名',
    note: String(note || '').trim(),
    time: formatTime(now || new Date()),
    balanceAfter: nextStock
  }
  const consumables = list.map((c) => (c.id === consumableId ? updated : c))
  const stockLogs = [...(db.stockLogs || []), log]
  return {
    ok: true,
    consumable: decorateConsumable(updated),
    log,
    db: { ...db, consumables, stockLogs }
  }
}