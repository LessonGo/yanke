<template>
  <div class="m-page">
    <div class="m-shell">
      <header class="m-header">
        <span class="m-logo">眼科 OCT 智慧管理平台</span>
        <span class="m-badge">手机版 · 只读</span>
      </header>

      <div v-if="loading" class="m-loading">
        <el-icon class="is-loading" :size="26"><Loading /></el-icon>
        <span>健康数据加载中…</span>
      </div>

      <el-alert v-else-if="loadError" type="error" :title="loadError" :closable="false" class="m-alert">
        <el-button size="small" type="danger" plain @click="load">重试</el-button>
      </el-alert>

      <template v-else-if="patient">
        <section class="m-card patient-bar">
          <div class="patient-main">
            <span class="patient-name">{{ patient.name }}</span>
            <span class="patient-meta">{{ patient.gender }} · {{ patient.age }}岁</span>
            <el-tag :type="statusType(patient.status)" size="small" effect="dark">{{ patient.status }}</el-tag>
          </div>
          <div class="patient-tags">
            <template v-if="patient.tags.length">
              <el-tag v-for="tag in patient.tags" :key="tag" size="small" effect="light" class="tag-item">{{ tag }}</el-tag>
            </template>
            <span v-else class="no-tag">健康筛查</span>
            <span class="last-date">最近检查 {{ patient.lastExamDate }}</span>
          </div>
        </section>

        <section class="m-card">
          <div class="card-title"><span>定量指标趋势（近 {{ seriesPointCount }} 次检查）</span></div>
          <div v-if="!series.length" class="empty-text">暂无可展示的指标数据</div>
          <div v-for="item in series" :key="item.label" class="series-block">
            <div class="series-head">
              <span class="series-label">{{ item.label }}</span>
              <span class="series-latest">
                最新 <b>{{ item.points[item.points.length - 1].value }}{{ item.unit }}</b>
              </span>
            </div>
            <MetricChart :item="item" />
          </div>
        </section>

        <section class="m-card">
          <div class="card-title"><span>历次检查结论（{{ exams.length }} 次）</span></div>
          <div class="exam-list">
            <div v-for="(exam, index) in exams" :key="exam.id" class="exam-item" @click="goReport(exam.id)">
              <div class="exam-head">
                <span class="exam-date">{{ exam.date }}</span>
                <el-tag v-if="index === 0 && exams.length > 1" :type="trendType(exam.trend)" size="small" effect="dark">
                  病情{{ exam.trend }}
                </el-tag>
                <span v-else class="exam-conf">置信度 {{ exam.confidence }}%</span>
              </div>
              <div class="exam-type">{{ exam.type }} · {{ exam.deviceId }}</div>
              <div class="exam-ai">{{ exam.aiResult }}</div>
              <div class="exam-conclusion">{{ exam.conclusion }}</div>
              <div class="exam-foot">
                <span class="exam-doctor">{{ exam.doctor }}</span>
                <span class="exam-link">查看报告 ›</span>
              </div>
            </div>
          </div>
        </section>
      </template>

      <footer class="m-footer">本页面为演示系统只读视图 · 数据以院内正式报告为准</footer>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Loading } from '@element-plus/icons-vue'
import MetricChart from '../../components/mobile/MetricChart.vue'
import { dataService } from '../../services/dataService'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const loadError = ref('')
const patient = ref(null)
const series = ref([])
const exams = ref([])


const seriesPointCount = computed(() => {
  if (!series.value.length) return 0
  return series.value[0].points.length
})

function statusType(status) {
  if (status === '随访中') return 'success'
  if (status === '待复查') return 'warning'
  return 'info'
}

function trendType(trend) {
  if (trend === '减轻') return 'success'
  if (trend === '进展') return 'danger'
  return 'info'
}


async function load() {
  loading.value = true
  loadError.value = ''
  patient.value = null
  series.value = []
  exams.value = []
  try {
    const data = await dataService.getMobilePatient(route.params.id)
    patient.value = data.patient
    series.value = data.series
    exams.value = data.exams
  } catch (err) {
    loadError.value = err.message || '健康数据加载失败'
  } finally {
    loading.value = false
  }
}

function goReport(examId) {
  router.push(`/m/report/${examId}`)
}

function goHome() {
  router.push('/m/patient/' + (patient.value ? patient.value.id : ''))
}

defineExpose({ patient, series, exams, loading, loadError, load, goReport, seriesPointCount })

onMounted(load)
</script>

<style scoped>
.m-page {
  min-height: 100vh;
  background: #eef2f7;
  padding: 12px 0 24px;
}

.m-shell {
  max-width: 420px;
  margin: 0 auto;
  padding: 0 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.m-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 2px;
}

.m-logo {
  font-size: 14px;
  font-weight: 600;
  color: #1f2d3d;
}

.m-badge {
  font-size: 11px;
  color: #409eff;
  border: 1px solid #b3d8ff;
  border-radius: 10px;
  padding: 1px 8px;
  background: #ecf5ff;
}

.m-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 60px 0;
  color: #909399;
  font-size: 14px;
}

.m-card {
  background: #ffffff;
  border-radius: 12px;
  padding: 14px;
  box-shadow: 0 1px 4px rgba(31, 45, 61, 0.06);
}

.card-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2d3d;
  margin-bottom: 10px;
}

.patient-bar {
  padding: 14px 16px;
}

.patient-main {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.patient-name {
  font-size: 20px;
  font-weight: 700;
  color: #1f2d3d;
}

.patient-meta {
  font-size: 13px;
  color: #606266;
}

.patient-tags {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.tag-item {
  margin-right: 0;
}

.no-tag {
  font-size: 12px;
  color: #909399;
}

.last-date {
  margin-left: auto;
  font-size: 12px;
  color: #909399;
}

.series-block {
  margin-bottom: 14px;
}

.series-block:last-child {
  margin-bottom: 0;
}

.series-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 4px;
}

.series-label {
  font-size: 13px;
  color: #606266;
}

.series-latest {
  font-size: 12px;
  color: #909399;
}

.series-latest b {
  font-size: 15px;
  color: #409eff;
}

.series-chart {
  height: 150px;
}

.exam-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.exam-item {
  border: 1px solid #f0f2f5;
  border-radius: 10px;
  padding: 10px 12px;
  background: #fafbfc;
  cursor: pointer;
}

.exam-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.exam-date {
  font-size: 13px;
  font-weight: 600;
  color: #1f2d3d;
}

.exam-conf {
  font-size: 12px;
  color: #909399;
}

.exam-type {
  margin-top: 4px;
  font-size: 12px;
  color: #a8abb2;
}

.exam-ai {
  margin-top: 6px;
  font-size: 13px;
  color: #409eff;
  line-height: 1.5;
}

.exam-conclusion {
  margin-top: 4px;
  font-size: 13px;
  color: #303133;
  line-height: 1.6;
}

.exam-foot {
  margin-top: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.exam-doctor {
  font-size: 12px;
  color: #909399;
}

.exam-link {
  font-size: 12px;
  color: #409eff;
}

.empty-text {
  font-size: 13px;
  color: #909399;
}

.m-footer {
  text-align: center;
  font-size: 11px;
  color: #a8abb2;
  margin-top: 6px;
}

.m-alert {
  border-radius: 10px;
}
</style>