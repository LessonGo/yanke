<template>
  <div class="m-page">
    <div class="m-shell">
      <header class="m-header">
        <span class="m-logo">眼科 OCT 智慧管理平台</span>
        <span class="m-badge">手机版 · 只读</span>
      </header>

      <div v-if="loading" class="m-loading">
        <el-icon class="is-loading" :size="26"><Loading /></el-icon>
        <span>报告加载中…</span>
      </div>

      <el-alert v-else-if="loadError" type="error" :title="loadError" :closable="false" class="m-alert">
        <el-button size="small" type="danger" plain @click="load">重试</el-button>
      </el-alert>

      <template v-else-if="report">
        <section class="m-card patient-bar">
          <div class="patient-main">
            <span class="patient-name">{{ report.patientName }}</span>
            <span class="patient-meta">{{ patient ? `${patient.gender} · ${patient.age}岁` : '' }}</span>
          </div>
          <div class="patient-sub">
            <span>{{ report.examDate }}</span>
            <span class="dot">·</span>
            <span>{{ report.examType }}</span>
          </div>
        </section>

        <section class="m-card">
          <div class="card-title">
            <span>AI 诊断结论</span>
            <el-tag :type="report.status === '已签发' ? 'success' : 'warning'" size="small" effect="dark">
              {{ report.status }}
            </el-tag>
          </div>
          <div class="conclusion-line">
            <span class="ai-tag">AI 初筛</span>
            <span>{{ report.aiConclusion }}</span>
          </div>
          <div class="confidence-line">
            <span class="label">置信度</span>
            <span class="confidence-value">{{ report.confidence }}%</span>
            <el-tag size="small" :type="trendType(report.trend)" effect="light">病情{{ report.trend }}</el-tag>
          </div>
          <div class="suggest-line">
            <span class="label">建议诊断</span>
            <span class="suggest-value">{{ report.suggestedDiagnosis }}</span>
          </div>
        </section>

        <section class="m-card">
          <div class="card-title"><span>OCT 断层图像与病灶圈注</span></div>
          <div class="oct-image">
            <div v-for="i in 10" :key="i" class="layer-line" :style="layerStyle(i)"></div>
            <svg class="lesion-layer" viewBox="0 0 100 100" preserveAspectRatio="none">
              <g v-for="(lesion, index) in report.lesions" :key="index">
                <rect
                  :x="lesion.box.x * 100"
                  :y="lesion.box.y * 100"
                  :width="lesion.box.w * 100"
                  :height="lesion.box.h * 100"
                  class="lesion-box"
                />
                <text :x="lesion.box.x * 100 + 1" :y="lesion.box.y * 100 - 1.5" class="lesion-label">
                  {{ lesion.disease }}
                </text>
              </g>
            </svg>
            <div v-if="!report.lesions.length" class="no-lesion">
              <el-icon :size="30" color="#67c23a"><CircleCheckFilled /></el-icon>
              <span>未检出病灶区域</span>
            </div>
            <div v-if="report.status !== '已签发'" class="watermark">待医生复核</div>
          </div>
        </section>

        <section class="m-card">
          <div class="card-title"><span>检出病灶（{{ report.lesions.length }} 处）</span></div>
          <div v-if="report.lesions.length" class="lesion-list">
            <div v-for="(lesion, index) in report.lesions" :key="index" class="lesion-item">
              <div class="lesion-head">
                <span class="lesion-disease">{{ lesion.disease }}</span>
                <span class="lesion-conf">{{ lesion.confidence }}%</span>
              </div>
              <div class="lesion-location">{{ lesion.location }}</div>
            </div>
          </div>
          <div v-else class="empty-text">未检出病灶，建议定期复查</div>
        </section>

        <section class="m-card">
          <div class="card-title"><span>定量指标</span></div>
          <div class="metric-list">
            <div v-for="metric in report.metrics" :key="metric.label" class="metric-item">
              <span class="metric-label">{{ metric.label }}</span>
              <span class="metric-value">{{ metric.value }}{{ metric.unit }}</span>
            </div>
          </div>
        </section>

        <section v-if="report.status === '已签发'" class="m-card">
          <div class="card-title"><span>医生签发</span></div>
          <div class="sign-line">
            <span class="sign-name">{{ report.reviewedBy }}</span>
            <span class="sign-time">{{ report.reviewedAt }}</span>
          </div>
          <div class="suggest-line">
            <span class="label">最终诊断</span>
            <span class="final-value">{{ report.finalConclusion }}</span>
          </div>
          <div v-if="report.reviewNote" class="note-line">
            <span class="label">医生备注</span>
            <span>{{ report.reviewNote }}</span>
          </div>
        </section>
        <el-alert
          v-else
          type="warning"
          :closable="false"
          class="m-alert"
          title="该报告尚未完成医生复核，最终诊断以医生签发为准"
        />

        <section class="m-card link-card">
          <div class="card-title"><span>更多</span></div>
          <el-button type="primary" plain size="small" @click="goTrend">查看该患者健康趋势</el-button>
        </section>
      </template>

      <footer class="m-footer">本页面为演示系统只读视图 · 数据以院内正式报告为准</footer>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Loading } from '@element-plus/icons-vue'
import { dataService } from '../../services/dataService'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const loadError = ref('')
const report = ref(null)
const patient = ref(null)

function trendType(trend) {
  if (trend === '减轻') return 'success'
  if (trend === '进展') return 'danger'
  return 'info'
}

function layerStyle(i) {
  const hue = 205 + i * 5
  return {
    background: `linear-gradient(90deg, hsl(${hue}, 65%, 14%), hsl(${hue}, 75%, 42%), hsl(${hue}, 65%, 20%))`,
    opacity: 0.55 + (i % 4) * 0.12
  }
}

async function load() {
  loading.value = true
  loadError.value = ''
  report.value = null
  try {
    const data = await dataService.getMobileReport(route.params.examId)
    report.value = data.report
    patient.value = data.patient
  } catch (err) {
    loadError.value = err.message || '报告加载失败'
  } finally {
    loading.value = false
  }
}

function goTrend() {
  const id = report.value ? report.value.patientId : (patient.value ? patient.value.id : '')
  if (id) {
    router.push(`/m/patient/${id}`)
  }
}

defineExpose({ report, patient, loading, loadError, load, goTrend })

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
  display: flex;
  align-items: center;
  justify-content: space-between;
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
  align-items: baseline;
  gap: 8px;
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

.patient-sub {
  margin-top: 6px;
  font-size: 12px;
  color: #909399;
}

.dot {
  margin: 0 4px;
}

.conclusion-line {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 14px;
  color: #303133;
  line-height: 1.6;
}

.ai-tag {
  flex-shrink: 0;
  padding: 1px 8px;
  border-radius: 4px;
  background: #ecf5ff;
  color: #409eff;
  font-size: 12px;
}

.confidence-line {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.confidence-value {
  font-size: 20px;
  font-weight: 700;
  color: #409eff;
}

.label {
  color: #909399;
  font-size: 12px;
  flex-shrink: 0;
  width: 56px;
}

.suggest-line,
.note-line {
  margin-top: 8px;
  display: flex;
  gap: 8px;
  font-size: 13px;
  line-height: 1.6;
}

.suggest-value {
  color: #409eff;
  font-weight: 600;
}

.final-value {
  color: #303133;
  font-weight: 600;
}

.oct-image {
  position: relative;
  height: 200px;
  border-radius: 8px;
  overflow: hidden;
  background: #06101f;
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
  padding: 10px 12px;
}

.layer-line {
  height: 11px;
  border-radius: 3px;
}

.lesion-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.lesion-box {
  fill: rgba(245, 108, 108, 0.16);
  stroke: #f56c6c;
  stroke-width: 0.7;
  stroke-dasharray: 3 1.6;
}

.lesion-label {
  fill: #ffd66b;
  font-size: 4px;
  font-weight: 600;
}

.no-lesion {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: #67c23a;
  font-size: 13px;
  background: rgba(6, 16, 31, 0.35);
}

.watermark {
  position: absolute;
  right: 10px;
  bottom: 8px;
  padding: 2px 10px;
  border: 1px dashed rgba(255, 214, 107, 0.7);
  border-radius: 4px;
  color: rgba(255, 214, 107, 0.85);
  font-size: 12px;
  letter-spacing: 2px;
  transform: rotate(-8deg);
}

.lesion-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.lesion-item {
  border: 1px solid #f0f2f5;
  border-radius: 8px;
  padding: 8px 10px;
  background: #fafbfc;
}

.lesion-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.lesion-disease {
  font-size: 13px;
  font-weight: 600;
  color: #1f2d3d;
}

.lesion-conf {
  font-size: 13px;
  font-weight: 700;
  color: #f56c6c;
}

.lesion-location {
  margin-top: 3px;
  font-size: 12px;
  color: #909399;
}

.empty-text {
  font-size: 13px;
  color: #909399;
}

.metric-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.metric-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-radius: 8px;
  background: #f5f7fa;
}

.metric-label {
  font-size: 13px;
  color: #606266;
}

.metric-value {
  font-size: 15px;
  font-weight: 700;
  color: #1f2d3d;
}

.sign-line {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 8px;
}

.sign-name {
  font-family: 'KaiTi', 'STKaiti', 'Microsoft YaHei', cursive;
  font-size: 22px;
  color: #1f2d3d;
  border-bottom: 2px solid #67c23a;
}

.sign-time {
  font-size: 12px;
  color: #909399;
}

.link-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
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