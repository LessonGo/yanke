<template>
  <div v-loading="loading" class="patient-detail-page">
    <el-page-header class="page-header" @back="goBack">
      <template #content>
        <span class="header-title">患者详情</span>
      </template>
    </el-page-header>

    <template v-if="patient">
      <el-card shadow="never" class="info-card">
        <template #header>
          <div class="card-head">
            <span>基本信息</span>
            <div class="card-head-right">
              <el-tag :type="statusType(patient.status)" effect="dark" size="small">{{ patient.status }}</el-tag>
              <el-button type="success" link class="qr-entry-btn" @click="openQr">
                <el-icon><Iphone /></el-icon>
                <span>手机扫码查看</span>
              </el-button>
            </div>
          </div>
        </template>
        <el-descriptions :column="3" border>
          <el-descriptions-item label="档案号">{{ patient.id }}</el-descriptions-item>
          <el-descriptions-item label="姓名">{{ patient.name }}</el-descriptions-item>
          <el-descriptions-item label="性别">{{ patient.gender }}</el-descriptions-item>
          <el-descriptions-item label="年龄">{{ patient.age }} 岁</el-descriptions-item>
          <el-descriptions-item label="手机号">{{ patient.phone }}</el-descriptions-item>
          <el-descriptions-item label="所属地区">{{ patient.region }}</el-descriptions-item>
          <el-descriptions-item label="最近检查">{{ patient.lastExamDate }}</el-descriptions-item>
          <el-descriptions-item label="累计检查">{{ examList.length }} 次</el-descriptions-item>
          <el-descriptions-item label="病种标签">
            <template v-if="patient.tags && patient.tags.length">
              <el-tag v-for="tag in patient.tags" :key="tag" size="small" effect="light" class="tag-item">
                {{ tag }}
              </el-tag>
            </template>
            <span v-else class="no-tag">健康筛查</span>
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <el-card shadow="never" class="timeline-card">
        <template #header>
          <span>检查时间线（{{ examList.length }} 次记录，按日期倒序）</span>
        </template>
        <el-timeline v-if="examList.length">
          <el-timeline-item
            v-for="(exam, index) in examList"
            :key="exam.id"
            :timestamp="exam.date"
            placement="top"
            :type="'primary'"
          >
            <div class="exam-item">
              <div class="exam-head">
                <span class="exam-type">{{ exam.type }}</span>
                <span class="head-tags">
                  <el-tag
                    v-if="index === 0 && examList.length > 1 && exam.trend"
                    :type="trendTagType(exam.trend)"
                    size="small"
                    effect="dark"
                  >
                    病情{{ exam.trend }}
                  </el-tag>
                  <el-tag size="small" effect="plain">{{ exam.deviceId }}</el-tag>
                </span>
              </div>
              <el-divider class="exam-divider" />
              <div class="exam-row">
                <span class="row-label">AI 初筛</span>
                <span class="row-value ai">{{ exam.aiResult }}</span>
              </div>
              <div class="exam-row">
                <span class="row-label">医生结论</span>
                <span class="row-value">{{ exam.conclusion }}</span>
              </div>
              <div v-if="exam.metrics && exam.metrics.length" class="metric-row">
                <span
                  v-for="m in exam.metrics"
                  :key="m.label"
                  class="metric-tag"
                  :class="`metric-${m.trend}`"
                >
                  {{ m.label }} {{ m.value }}{{ m.unit }}
                  <template v-if="m.delta !== null && m.delta !== undefined">
                    （较上次 {{ m.deltaText }} · {{ m.trend }}）
                  </template>
                </span>
              </div>
              <div class="exam-foot">
                <span class="doctor">检查医生：{{ exam.doctor }}</span>
                <el-button
                  size="small"
                  type="primary"
                  plain
                  :disabled="!exam.reportReady"
                  @click="viewReport(exam)"
                >
                  <el-icon><Document /></el-icon>
                  <span>查看报告</span>
                </el-button>
              </div>
            </div>
          </el-timeline-item>
        </el-timeline>
        <el-empty v-else description="该患者暂无检查记录" />
      </el-card>
    </template>

    <el-alert
      v-else-if="!loading && loadError"
      type="error"
      :title="loadError"
      :closable="false"
      class="load-error"
    >
      <el-button size="small" type="danger" plain @click="load">重试加载</el-button>
    </el-alert>

    <QrCodeDialog v-model:visible="qrVisible" :url="qrUrl" title="扫码查看健康趋势（手机版）" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Iphone } from '@element-plus/icons-vue'
import QrCodeDialog from '../components/QrCodeDialog.vue'
import { dataService } from '../services/dataService'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const loadError = ref('')
const patient = ref(null)
const examList = ref([])

const qrVisible = ref(false)
const qrUrl = computed(() => `${window.location.origin}/m/patient/${patient.value ? patient.value.id : ''}`)

function openQr() {
  qrVisible.value = true
}

function statusType(status) {
  if (status === '随访中') return 'success'
  if (status === '待复查') return 'warning'
  return 'info'
}

function trendTagType(trend) {
  if (trend === '减轻') return 'success'
  if (trend === '进展') return 'danger'
  return 'info'
}

function goBack() {
  router.push('/patients')
}

function viewReport(exam) {
  router.push(`/ai-diagnosis/report/${exam.id}?from=${patient.value.id}`)
}

async function load() {
  loading.value = true
  loadError.value = ''
  patient.value = null
  examList.value = []
  try {
    const data = await dataService.getPatientDetail(route.params.id)
    patient.value = data.patient
    examList.value = data.exams
  } catch (err) {
    loadError.value = err.message || '患者详情加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.patient-detail-page {
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

.info-card {
  margin-bottom: 14px;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-head-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.qr-entry-btn {
  vertical-align: middle;
}

.tag-item {
  margin-right: 6px;
}

.no-tag {
  color: #909399;
  font-size: 12px;
}

.timeline-card {
  min-height: 300px;
}

.exam-item {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 12px 16px;
  background: #fafbfc;
}

.exam-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.head-tags {
  display: flex;
  align-items: center;
  gap: 6px;
}

.metric-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 2px 0 4px 80px;
}

.metric-tag {
  display: inline-flex;
  align-items: center;
  padding: 1px 8px;
  border-radius: 4px;
  font-size: 12px;
  background: #f0f5ff;
  color: #4a5a76;
}

.metric-tag.metric-减轻 {
  background: #f0f9eb;
  color: #529b2e;
}

.metric-tag.metric-进展 {
  background: #fef0f0;
  color: #c45656;
}

.metric-tag.metric-稳定 {
  background: #f4f4f5;
  color: #73767a;
}

.exam-type {
  font-weight: 600;
  color: #303133;
}

.exam-divider {
  margin: 10px 0;
}

.exam-row {
  display: flex;
  gap: 10px;
  margin-bottom: 6px;
  line-height: 1.6;
}

.row-label {
  flex-shrink: 0;
  width: 70px;
  color: #909399;
  font-size: 13px;
}

.row-value {
  color: #303133;
  font-size: 13px;
}

.row-value.ai {
  color: #409eff;
}

.exam-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}

.doctor {
  color: #909399;
  font-size: 12px;
}

.load-error {
  margin-top: 20px;
}
</style>