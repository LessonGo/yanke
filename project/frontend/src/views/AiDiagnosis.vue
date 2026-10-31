<template>
  <div class="ai-page">
    <div class="stats-bar">
      <div v-for="stat in statCards" :key="stat.label" class="stat-card">
        <div class="stat-icon">
          <el-icon :size="24"><component :is="stat.icon" /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-value">
            <span class="stat-num">{{ stat.value }}</span>
            <span class="stat-unit">{{ stat.unit }}</span>
          </div>
          <div class="stat-label">{{ stat.label }}</div>
        </div>
      </div>
    </div>

    <el-card shadow="never" class="select-card">
      <el-form inline @submit.prevent>
        <el-form-item label="选择患者">
          <el-select
            v-model="selectedPatientId"
            filterable
            remote
            :remote-method="searchPatients"
            :loading="patientLoading"
            placeholder="输入姓名 / 手机号搜索"
            class="patient-select"
            @change="handlePatientChange"
          >
            <el-option
              v-for="p in patientOptions"
              :key="p.id"
              :label="`${p.name}（${p.id} · ${p.gender} · ${p.age}岁）`"
              :value="p.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="检查记录">
          <el-select
            v-model="selectedExamId"
            placeholder="选择该患者的检查记录"
            :disabled="!examOptions.length"
            class="exam-select"
          >
            <el-option
              v-for="e in examOptions"
              :key="e.id"
              :label="`${e.date} · ${e.type}`"
              :value="e.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            size="large"
            :icon="MagicStick"
            :disabled="!selectedExamId || reading"
            :loading="reading"
            @click="handleRead"
          >
            {{ reading ? '读片中…' : 'AI 读片' }}
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-alert v-if="readError" class="read-error" type="error" :title="readError" :closable="false">
      <el-button size="small" type="danger" plain @click="handleRead">重试读片</el-button>
    </el-alert>

    <el-card v-if="reading" shadow="never" class="anim-card read-pending">
      <div class="anim-head">
        <span>{{ animating ? 'AI 智能读片中…' : '正在载入检查数据…' }}</span>
        <el-tag v-if="animating" type="primary" effect="dark" size="small">{{ currentStageName }}</el-tag>
      </div>
      <el-progress :percentage="progress" :stroke-width="14" class="anim-progress" />
      <div class="anim-stages">
        <div
          v-for="(stage, index) in stages"
          :key="stage.name"
          class="anim-stage"
          :class="{ active: animating && stageIndex === index, passed: animating && stageIndex > index }"
        >
          <span class="stage-dot"></span>
          <span>{{ stage.name }}</span>
        </div>
      </div>
    </el-card>

    <template v-if="report && !reading">
      <ReportView :report="report" @confirm="handleConfirm" @amend="openAmendDialog" />
    </template>

    <div v-if="!report && !reading && !readError" class="empty-holder">
      <el-empty description="请选择患者与检查记录后点击「AI 读片」" />
    </div>

    <el-dialog v-model="amendVisible" title="修正后签发" width="520px" :close-on-click-modal="false">
      <el-form :model="amendForm" label-width="90px">
        <el-form-item label="AI 建议">
          <el-tag type="primary" effect="light" size="small">{{ report ? report.suggestedDiagnosis : '' }}</el-tag>
        </el-form-item>
        <el-form-item label="最终诊断" required>
          <el-select v-model="amendForm.finalConclusion" placeholder="选择最终诊断结论" class="amend-input">
            <el-option v-for="opt in diagnosisOptions" :key="opt" :label="opt" :value="opt" />
          </el-select>
        </el-form-item>
        <el-form-item label="医生备注">
          <el-input
            v-model="amendForm.note"
            type="textarea"
            :rows="3"
            placeholder="可填写复核说明、治疗建议等"
            class="amend-input"
          />
        </el-form-item>
        <el-alert v-if="amendError" type="error" :title="amendError" :closable="false" />
      </el-form>
      <template #footer>
        <el-button @click="amendVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleAmendSubmit">修正并签发</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { MagicStick } from '@element-plus/icons-vue'
import ReportView from '../components/ai/ReportView.vue'
import { dataService } from '../services/dataService'
import { useAuthStore } from '../stores/auth'
import { useStagedProgress } from '../composables/useStagedProgress'

const props = defineProps({
  fast: { type: Boolean, default: false }
})

const auth = useAuthStore()

const stats = ref({ todayReadCount: 0, avgReadSeconds: 3, diseaseCoverage: 0, reviewedCount: 0, totalReports: 0 })
const patientOptions = ref([])
const patientLoading = ref(false)
const selectedPatientId = ref('')
const examOptions = ref([])
const selectedExamId = ref('')

const report = ref(null)
const stages = ref([])
const readError = ref('')
const reading = ref(false)

const amendVisible = ref(false)
const amendError = ref('')
const submitting = ref(false)
const amendForm = reactive({ finalConclusion: '', note: '' })

const { progress, stageIndex, running: animating, currentStageName, start } = useStagedProgress()

const statCards = computed(() => [
  { label: '今日 AI 读片数', value: stats.value.todayReadCount, unit: '例', icon: 'MagicStick' },
  { label: '平均读片耗时', value: stats.value.avgReadSeconds, unit: '秒', icon: 'Timer' },
  { label: '覆盖病种数', value: stats.value.diseaseCoverage, unit: '类', icon: 'DataAnalysis' },
  { label: '已签发报告', value: stats.value.reviewedCount, unit: '份', icon: 'DocumentChecked' }
])

const diagnosisOptions = computed(() => (report.value ? report.value.diagnosisOptions || [] : []))

async function loadStats() {
  try {
    stats.value = await dataService.getAiStats()
  } catch {
    stats.value = { todayReadCount: 0, avgReadSeconds: 3, diseaseCoverage: 0, reviewedCount: 0, totalReports: 0 }
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

async function handlePatientChange(patientId) {
  selectedExamId.value = ''
  examOptions.value = []
  report.value = null
  if (!patientId) return
  try {
    const data = await dataService.getPatientDetail(patientId)
    examOptions.value = data.exams.map((e) => ({ id: e.id, date: e.date, type: e.type }))
    if (examOptions.value.length) {
      selectedExamId.value = examOptions.value[0].id
    }
  } catch (err) {
    ElMessage.error(err.message || '检查记录加载失败')
  }
}

async function handleRead() {
  if (!selectedExamId.value || reading.value) {
    return
  }
  reading.value = true
  readError.value = ''
  report.value = null
  try {
    const data = await dataService.aiRead(selectedExamId.value)
    stages.value = data.stages
    await start(data.stages, { fast: props.fast })
    report.value = data.report
    await loadStats()
  } catch (err) {
    readError.value = err.message || 'AI 读片失败，请重试'
  } finally {
    reading.value = false
  }
}

async function submitReview(payload, successText) {
  submitting.value = true
  try {
    const updated = await dataService.reviewReport(report.value.examId, payload)
    report.value = updated
    ElMessage.success(successText)
    await loadStats()
    return true
  } catch (err) {
    ElMessage.error(err.message || '签发失败')
    return false
  } finally {
    submitting.value = false
  }
}

async function handleConfirm() {
  await submitReview(
    { action: 'confirm', reviewer: `${auth.displayName}医生`, note: '' },
    '报告已确认签发'
  )
}

function openAmendDialog() {
  amendForm.finalConclusion = ''
  amendForm.note = ''
  amendError.value = ''
  amendVisible.value = true
}

async function handleAmendSubmit() {
  if (!amendForm.finalConclusion) {
    amendError.value = '请选择最终诊断结论'
    return
  }
  amendError.value = ''
  const ok = await submitReview(
    {
      action: 'amend',
      finalConclusion: amendForm.finalConclusion,
      note: amendForm.note,
      reviewer: `${auth.displayName}医生`
    },
    '报告已修正并签发'
  )
  if (ok) {
    amendVisible.value = false
  }
}

defineExpose({
  stats,
  selectedPatientId,
  selectedExamId,
  report,
  stages,
  progress,
  reading,
  readError,
  amendForm,
  handlePatientChange,
  handleRead,
  handleConfirm,
  handleAmendSubmit,
  openAmendDialog
})

onMounted(loadStats)
</script>

<style scoped>
.ai-page {
  padding: 16px;
  min-height: 100%;
}

.stats-bar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 14px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-radius: 10px;
  background: linear-gradient(135deg, #f2f7ff, #e8f1ff);
  border: 1px solid #d6e6ff;
}

.stat-icon {
  width: 46px;
  height: 46px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #409eff;
  background: rgba(64, 158, 255, 0.14);
}

.stat-value {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.stat-num {
  font-size: 26px;
  font-weight: 700;
  color: #1f2d3d;
}

.stat-unit {
  font-size: 12px;
  color: #8a97a8;
}

.stat-label {
  margin-top: 2px;
  font-size: 13px;
  color: #606266;
}

.select-card {
  margin-bottom: 14px;
}

.select-card :deep(.el-form-item) {
  margin-bottom: 0;
  margin-right: 18px;
}

.patient-select {
  width: 280px;
}

.exam-select {
  width: 320px;
}

.anim-card {
  margin-bottom: 14px;
}

.read-error {
  margin-bottom: 14px;
}

.anim-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.anim-progress {
  margin: 16px 0 12px;
}

.anim-stages {
  display: flex;
  justify-content: space-between;
}

.anim-stage {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #909399;
}

.stage-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #dcdfe6;
}

.anim-stage.active {
  color: #409eff;
  font-weight: 600;
}

.anim-stage.active .stage-dot {
  background: #409eff;
  box-shadow: 0 0 6px #409eff;
}

.anim-stage.passed {
  color: #67c23a;
}

.anim-stage.passed .stage-dot {
  background: #67c23a;
}

.empty-holder {
  padding: 30px 0;
}

.amend-input {
  width: 100%;
}

@media (max-width: 1200px) {
  .stats-bar {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>