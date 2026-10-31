<template>
  <div class="exams-page">
    <el-card shadow="never" class="filter-card">
      <el-form inline @submit.prevent>
        <el-form-item label="预约状态">
          <el-select v-model="filters.status" class="filter-select" clearable @change="load">
            <el-option label="待检查" value="待检查" />
            <el-option label="已完成" value="已完成" />
            <el-option label="已取消" value="已取消" />
          </el-select>
        </el-form-item>
        <el-form-item label="日期">
          <el-date-picker
            v-model="filters.date"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="全部日期"
            clearable
            class="filter-date"
            @change="load"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Plus" @click="openCreateDialog">新建预约</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="table-card">
      <el-table v-loading="loading" :data="rows" stripe class="exam-table">
        <el-table-column prop="id" label="预约号" width="90" />
        <el-table-column label="患者" min-width="150">
          <template #default="{ row }">
            <span>{{ row.patientName }}</span>
            <span class="patient-id">{{ row.patientId }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="examType" label="检查类型" width="180" />
        <el-table-column label="设备" min-width="180">
          <template #default="{ row }">
            <span>{{ row.deviceId }}</span>
            <span class="device-name">{{ row.deviceName }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="date" label="预约日期" width="120" />
        <el-table-column prop="slot" label="时段" width="130" />
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small" effect="dark">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="210" align="center" fixed="right">
          <template #default="{ row }">
            <template v-if="row.status === '待检查'">
              <el-button type="primary" size="small" @click="goCollect(row)">
                <el-icon><VideoPlay /></el-icon>
                <span>开始检查</span>
              </el-button>
              <el-button type="danger" size="small" plain @click="handleCancel(row)">取消</el-button>
            </template>
            <el-button v-else-if="row.status === '已完成'" type="primary" link size="small" @click="goPatient(row)">
              <el-icon><View /></el-icon>
              <span>查看患者</span>
            </el-button>
            <span v-else class="canceled-text">—</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" title="新建检查预约" width="560px" :close-on-click-modal="false">
      <el-form :model="form" label-width="90px">
        <el-form-item label="患者" required>
          <el-select
            v-model="form.patientId"
            filterable
            remote
            :remote-method="searchPatients"
            :loading="patientLoading"
            placeholder="输入姓名 / 手机号搜索"
            class="dialog-input"
          >
            <el-option
              v-for="p in patientOptions"
              :key="p.id"
              :label="`${p.name}（${p.id} · ${p.gender} · ${p.age}岁）`"
              :value="p.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="检查类型" required>
          <el-radio-group v-model="form.examType" @change="handleTypeChange">
            <el-radio-button v-for="t in examTypes" :key="t" :label="t">{{ t }}</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="设备" required>
          <el-select v-model="form.deviceId" placeholder="选择空闲设备" class="dialog-input">
            <el-option
              v-for="d in availableDevices"
              :key="d.id"
              :label="`${d.id} · ${d.name}（${d.location}）`"
              :value="d.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="预约日期" required>
          <el-date-picker
            v-model="form.date"
            type="date"
            value-format="YYYY-MM-DD"
            :disabled-date="disablePastDate"
            placeholder="选择日期"
            class="dialog-input"
          />
        </el-form-item>
        <el-form-item label="时段" required>
          <el-select v-model="form.slot" placeholder="选择时段" class="dialog-input">
            <el-option v-for="s in timeSlots" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>
        <el-alert v-if="formError" type="error" :title="formError" :closable="false" class="form-error" />
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">保存预约</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { dataService } from '../services/dataService'
import { TIME_SLOTS } from '../../../shared/reservationsCore.js'
import { EXAM_TYPES, DEVICE_TYPE } from '../../../shared/examContent.js'

const router = useRouter()

const loading = ref(false)
const rows = ref([])
const filters = reactive({ status: '', date: null })

const dialogVisible = ref(false)
const submitting = ref(false)
const formError = ref('')
const patientOptions = ref([])
const patientLoading = ref(false)
const devices = ref([])

const timeSlots = TIME_SLOTS
const examTypes = EXAM_TYPES

const form = reactive({
  patientId: '',
  examType: EXAM_TYPES[0],
  deviceId: '',
  date: '',
  slot: ''
})

const availableDevices = computed(() =>
  devices.value.filter((d) => d.status === 'online' && DEVICE_TYPE[d.id] === form.examType)
)

function statusType(status) {
  if (status === '待检查') return 'warning'
  if (status === '已完成') return 'success'
  return 'info'
}

function disablePastDate(date) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date.getTime() < today.getTime()
}

function handleTypeChange() {
  if (form.deviceId && DEVICE_TYPE[form.deviceId] !== form.examType) {
    form.deviceId = ''
  }
}

async function load() {
  loading.value = true
  try {
    rows.value = await dataService.getReservations({
      status: filters.status,
      date: filters.date || ''
    })
  } catch (err) {
    rows.value = []
    ElMessage.error(err.message || '预约数据加载失败')
  } finally {
    loading.value = false
  }
}

async function searchPatients(keyword) {
  if (!keyword || !keyword.trim()) {
    patientOptions.value = []
    return
  }
  patientLoading.value = true
  try {
    const data = await dataService.getPatients({ keyword: keyword.trim(), pageSize: 20 })
    patientOptions.value = data.list
  } catch {
    patientOptions.value = []
  } finally {
    patientLoading.value = false
  }
}

function openCreateDialog() {
  form.patientId = ''
  form.examType = EXAM_TYPES[0]
  form.deviceId = ''
  form.date = ''
  form.slot = ''
  formError.value = ''
  patientOptions.value = []
  dialogVisible.value = true
}

async function handleSubmit() {
  if (!form.patientId || !form.deviceId || !form.date || !form.slot) {
    formError.value = '请完整填写患者、设备、日期与时段'
    return
  }
  submitting.value = true
  formError.value = ''
  try {
    await dataService.createReservation({
      patientId: form.patientId,
      deviceId: form.deviceId,
      date: form.date,
      slot: form.slot
    })
    ElMessage.success('预约创建成功')
    dialogVisible.value = false
    await load()
  } catch (err) {
    formError.value = err.message || '预约创建失败'
  } finally {
    submitting.value = false
  }
}

async function handleCancel(row) {
  try {
    await ElMessageBox.confirm(`确定取消 ${row.patientName} 的预约（${row.date} ${row.slot}）吗？`, '取消预约', {
      confirmButtonText: '确定取消',
      cancelButtonText: '保留',
      type: 'warning'
    })
  } catch {
    return
  }
  try {
    await dataService.cancelReservation(row.id)
    ElMessage.success('预约已取消')
    await load()
  } catch (err) {
    ElMessage.error(err.message || '取消失败')
  }
}

function goCollect(row) {
  router.push(`/exams/collect/${row.id}`)
}

function goPatient(row) {
  router.push(`/patients/${row.patientId}`)
}

defineExpose({ filters, form, load, handleSubmit, openCreateDialog })

onMounted(async () => {
  load()
  try {
    const data = await dataService.getDevices()
    devices.value = data.list || []
  } catch {
    devices.value = []
  }
})
</script>

<style scoped>
.exams-page {
  padding: 16px;
  min-height: 100%;
}

.filter-card {
  margin-bottom: 14px;
}

.filter-card :deep(.el-form-item) {
  margin-bottom: 0;
  margin-right: 18px;
}

.filter-select {
  width: 160px;
}

.filter-date {
  width: 180px;
}

.table-card {
  min-height: 420px;
}

.exam-table {
  width: 100%;
}

.patient-id {
  margin-left: 8px;
  color: #909399;
  font-size: 12px;
}

.device-name {
  margin-left: 8px;
  color: #909399;
  font-size: 12px;
}

.canceled-text {
  color: #c0c4cc;
}

.dialog-input {
  width: 100%;
}

.form-error {
  margin-top: 4px;
}
</style>