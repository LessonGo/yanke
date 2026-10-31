<template>
  <div class="ai-report-page">
    <el-page-header class="page-header" @back="goBack">
      <template #content>
        <span class="header-title">AI 诊断报告</span>
      </template>
    </el-page-header>

    <el-alert v-if="readError" type="error" :title="readError" :closable="false" class="error-alert">
      <el-button size="small" type="danger" plain @click="goBack">返回</el-button>
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
          :class="{ active: stageIndex === index, passed: stageIndex > index }"
        >
          <span class="stage-dot"></span>
          <span>{{ stage.name }}</span>
        </div>
      </div>
    </el-card>

    <template v-if="report && !reading">
      <el-card shadow="never" class="patient-card">
        <div class="patient-line">
          <span class="patient-name">{{ report.patientName }}</span>
          <el-tag size="small" effect="plain">{{ report.examDate }}</el-tag>
          <el-tag size="small" effect="plain">{{ report.examType }}</el-tag>
          <el-button type="primary" link @click="goPatient">查看患者档案</el-button>
          <el-button type="success" link class="qr-entry-btn" @click="openQr">
            <el-icon><Iphone /></el-icon>
            <span>手机扫码查看</span>
          </el-button>
        </div>
      </el-card>
      <QrCodeDialog v-model:visible="qrVisible" :url="qrUrl" title="扫码查看检查报告（手机版）" />
      <ReportView :report="report" @confirm="handleConfirm" @amend="openAmendDialog" />
    </template>

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
          <el-input v-model="amendForm.note" type="textarea" :rows="3" placeholder="可填写复核说明、治疗建议等" class="amend-input" />
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
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Iphone } from '@element-plus/icons-vue'
import ReportView from '../components/ai/ReportView.vue'
import QrCodeDialog from '../components/QrCodeDialog.vue'
import { dataService } from '../services/dataService'
import { useAuthStore } from '../stores/auth'
import { useStagedProgress } from '../composables/useStagedProgress'

const props = defineProps({
  fast: { type: Boolean, default: false }
})

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const report = ref(null)
const stages = ref([])
const readError = ref('')
const reading = ref(false)
const amendVisible = ref(false)
const amendError = ref('')
const submitting = ref(false)
const amendForm = reactive({ finalConclusion: '', note: '' })

const qrVisible = ref(false)
const qrUrl = computed(() => `${window.location.origin}/m/report/${route.params.examId}`)

function openQr() {
  qrVisible.value = true
}

const { progress, stageIndex, running: animating, currentStageName, start } = useStagedProgress()

const diagnosisOptions = computed(() => (report.value ? report.value.diagnosisOptions || [] : []))

async function loadAndRead() {
  if (reading.value) {
    return
  }
  reading.value = true
  readError.value = ''
  report.value = null
  try {
    const data = await dataService.aiRead(route.params.examId)
    stages.value = data.stages
    await start(data.stages, { fast: props.fast })
    report.value = data.report
  } catch (err) {
    readError.value = err.message || 'AI 读片失败'
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
    return true
  } catch (err) {
    ElMessage.error(err.message || '签发失败')
    return false
  } finally {
    submitting.value = false
  }
}

async function handleConfirm() {
  await submitReview({ action: 'confirm', reviewer: `${auth.displayName}医生`, note: '' }, '报告已确认签发')
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

function goBack() {
  goPatient()
}

function goPatient() {
  const patientId = report.value ? report.value.patientId : route.query.from
  if (patientId) {
    router.push(`/patients/${patientId}`)
  } else {
    router.push('/ai-diagnosis')
  }
}

defineExpose({ report, progress, reading, readError, amendForm, qrVisible, qrUrl, openQr, loadAndRead, handleConfirm, handleAmendSubmit, openAmendDialog })

onMounted(loadAndRead)
</script>

<style scoped>
.ai-report-page {
  padding: 16px;
  min-height: 100%;
}

.page-header {
  margin-bottom: 14px;
}

.header-title {
  font-size: 16px;
  font-weight: 600;
}

.error-alert {
  margin-bottom: 14px;
}

.anim-card {
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

.patient-card {
  margin-bottom: 14px;
}

.patient-line {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.patient-name {
  font-size: 16px;
  font-weight: 600;
  color: #1f2d3d;
}

.amend-input {
  width: 100%;
}
</style>