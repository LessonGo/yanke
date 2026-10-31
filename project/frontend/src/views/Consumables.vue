<template>
  <div class="consumables-page">
    <el-alert
      v-if="lowStockCount > 0"
      class="low-stock-alert"
      type="error"
      effect="dark"
      :closable="false"
      show-icon
      :title="`${lowStockCount} 种耗材低于安全阈值，请及时补货`"
    >
      <template #default>
        <span class="alert-detail">{{ lowStockNames }}</span>
      </template>
    </el-alert>
    <el-alert
      v-else
      class="low-stock-alert"
      type="success"
      effect="dark"
      :closable="false"
      show-icon
      title="全部耗材库存充足"
    />

    <el-card shadow="never" class="table-card">
      <template #header>
        <div class="card-head">
          <span>耗材库存（共 {{ total }} 种）</span>
          <el-input
            v-model="keyword"
            placeholder="搜索耗材名称 / 规格"
            clearable
            class="search-input"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </div>
      </template>

      <el-table v-loading="loading" :data="filteredRows" stripe class="consumable-table" :row-class-name="rowClass">
        <el-table-column prop="id" label="编号" width="80" />
        <el-table-column prop="name" label="耗材名称" min-width="200">
          <template #default="{ row }">
            <span>{{ row.name }}</span>
            <el-tag v-if="row.lowStock" type="danger" size="small" effect="dark" class="low-tag">库存告警</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="spec" label="型号规格" min-width="160" />
        <el-table-column prop="unit" label="单位" width="70" align="center" />
        <el-table-column label="当前库存" width="110" align="center">
          <template #default="{ row }">
            <span :class="{ 'low-stock-text': row.lowStock }">{{ row.stock }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="threshold" label="安全阈值" width="100" align="center" />
        <el-table-column label="库存水位" min-width="180">
          <template #default="{ row }">
            <el-progress
              :percentage="row.stockLevel"
              :stroke-width="12"
              :color="levelColor(row)"
              :show-text="false"
              class="level-bar"
            />
            <span class="level-text" :class="{ 'low-stock-text': row.lowStock }">
              {{ row.lowStock ? `低于阈值 ${row.threshold - row.stock}${row.unit}` : '充足' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="170" align="center" fixed="right">
          <template #default="{ row }">
            <el-button type="success" size="small" plain @click="openStockDialog(row, 'in')">入库</el-button>
            <el-button type="warning" size="small" plain @click="openStockDialog(row, 'out')">出库</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card shadow="never" class="logs-card">
      <template #header><span>最近出入库记录</span></template>
      <el-table :data="logs" size="small" border>
        <el-table-column prop="time" label="时间" width="170" />
        <el-table-column prop="consumableName" label="耗材" min-width="180" />
        <el-table-column label="类型" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.type === 'in' ? 'success' : 'warning'" size="small" effect="light">
              {{ row.type === 'in' ? '入库' : '出库' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="数量" width="110" align="center">
          <template #default="{ row }">
            {{ row.type === 'in' ? '+' : '-' }}{{ row.quantity }}{{ row.unit }}
          </template>
        </el-table-column>
        <el-table-column prop="operator" label="经办人" width="110" />
        <el-table-column prop="note" label="备注" min-width="160" />
        <el-table-column prop="balanceAfter" label="结存" width="90" align="center" />
        <template #empty>暂无出入库记录</template>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="480px" :close-on-click-modal="false">
      <el-form :model="stockForm" label-width="90px">
        <el-form-item label="耗材">
          <span>{{ currentRow ? `${currentRow.name}（${currentRow.spec}）` : '' }}</span>
        </el-form-item>
        <el-form-item label="当前库存">
          <span class="dialog-stock">{{ currentRow ? `${currentRow.stock}${currentRow.unit}` : '' }}</span>
        </el-form-item>
        <el-form-item :label="isOut ? '出库数量' : '入库数量'" required>
          <el-input-number v-model="stockForm.quantity" :min="1" :max="9999" class="dialog-input" />
        </el-form-item>
        <el-form-item label="经办人" required>
          <el-input v-model="stockForm.operator" placeholder="请输入经办人姓名" class="dialog-input" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="stockForm.note"
            type="textarea"
            :rows="2"
            :placeholder="isOut ? '如：门诊使用、设备维护' : '如：厂家补货、季度采购'"
            class="dialog-input"
          />
        </el-form-item>
        <el-alert v-if="formError" type="error" :title="formError" :closable="false" />
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">
          {{ isOut ? '确认出库' : '确认入库' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { dataService } from '../services/dataService'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()

const loading = ref(false)
const rows = ref([])
const logs = ref([])
const lowStockCount = ref(0)
const total = ref(0)
const keyword = ref('')

const dialogVisible = ref(false)
const submitting = ref(false)
const formError = ref('')
const currentRow = ref(null)
const stockType = ref('in')

const stockForm = reactive({ quantity: 1, operator: '', note: '' })

const isOut = computed(() => stockType.value === 'out')
const dialogTitle = computed(() => `${isOut.value ? '出库' : '入库'}登记`)

const filteredRows = computed(() => {
  const kw = keyword.value.trim()
  if (!kw) return rows.value
  return rows.value.filter((r) => r.name.includes(kw) || (r.spec || '').includes(kw))
})

const lowStockNames = computed(() =>
  rows.value
    .filter((r) => r.lowStock)
    .map((r) => `${r.name}（${r.stock}/${r.threshold}${r.unit}）`)
    .join('、')
)

function levelColor(row) {
  if (row.lowStock) return '#f56c6c'
  if (row.stockLevel < 70) return '#e6a23c'
  return '#67c23a'
}

function rowClass({ row }) {
  return row.lowStock ? 'low-stock-row' : ''
}

async function load() {
  loading.value = true
  try {
    const data = await dataService.getConsumables()
    rows.value = data.list
    lowStockCount.value = data.lowStockCount
    total.value = data.total
    logs.value = data.logs
  } catch (err) {
    rows.value = []
    ElMessage.error(err.message || '耗材库存加载失败')
  } finally {
    loading.value = false
  }
}

function openStockDialog(row, type) {
  currentRow.value = row
  stockType.value = type
  stockForm.quantity = 1
  stockForm.operator = auth.displayName || ''
  stockForm.note = ''
  formError.value = ''
  dialogVisible.value = true
}

async function handleSubmit() {
  if (submitting.value) {
    return
  }
  if (!stockForm.quantity || stockForm.quantity <= 0) {
    formError.value = '数量必须为正整数'
    return
  }
  if (!stockForm.operator.trim()) {
    formError.value = '请填写经办人'
    return
  }
  if (isOut.value && stockForm.quantity > currentRow.value.stock) {
    formError.value = `出库数量 ${stockForm.quantity} 超过当前库存 ${currentRow.value.stock}${currentRow.value.unit}`
    return
  }
  submitting.value = true
  formError.value = ''
  try {
    await dataService.adjustStock(currentRow.value.id, {
      type: stockType.value,
      quantity: stockForm.quantity,
      operator: stockForm.operator.trim(),
      note: stockForm.note.trim()
    })
    ElMessage.success(`${isOut.value ? '出库' : '入库'}登记成功`)
    dialogVisible.value = false
    await load()
  } catch (err) {
    formError.value = err.message || '登记失败'
  } finally {
    submitting.value = false
  }
}

defineExpose({ rows, logs, lowStockCount, filteredRows, stockForm, keyword, load, openStockDialog, handleSubmit })

onMounted(load)
</script>

<style scoped>
.consumables-page {
  padding: 16px;
  min-height: 100%;
}

.low-stock-alert {
  margin-bottom: 14px;
}

.alert-detail {
  font-size: 12px;
  opacity: 0.9;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.search-input {
  width: 260px;
}

.table-card {
  margin-bottom: 14px;
}

.consumable-table {
  width: 100%;
}

.low-tag {
  margin-left: 8px;
}

.low-stock-text {
  color: #f56c6c;
  font-weight: 700;
}

.level-bar {
  width: 120px;
  display: inline-block;
  vertical-align: middle;
}

.level-text {
  margin-left: 8px;
  font-size: 12px;
  color: #909399;
}

.consumable-table :deep(.low-stock-row) {
  background: #fef0f0 !important;
}

.dialog-input {
  width: 100%;
}

.dialog-stock {
  font-weight: 600;
  color: #303133;
}

.logs-card {
  margin-bottom: 14px;
}
</style>