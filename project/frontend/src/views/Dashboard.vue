<template>
  <div v-loading="loading" class="dashboard" element-loading-background="rgba(10, 22, 40, 0.7)">
    <header class="screen-header">
      <div class="header-title">
        <el-icon :size="22"><DataBoard /></el-icon>
        <h1>眼科 OCT 数据监测管理平台</h1>
      </div>
      <div class="header-meta">
        <span class="clock">{{ clockText }}</span>
        <el-button size="small" type="primary" plain :loading="loading" @click="load(false)">
          <el-icon><Refresh /></el-icon>
          <span>立即刷新</span>
        </el-button>
        <span class="updated">最近更新 {{ lastUpdatedText }} · 每 30 秒自动刷新</span>
      </div>
    </header>

    <el-alert
      v-if="loadError"
      class="load-error"
      type="error"
      effect="dark"
      :closable="false"
      title="数据加载异常"
      :description="loadError"
    >
      <el-button size="small" type="danger" plain @click="retry">重试加载</el-button>
    </el-alert>

    <template v-if="dash">
      <section class="row row-kpi">
        <KpiBoard :kpis="dash.kpis" />
      </section>

      <section class="row row-mid">
        <div class="panel panel-flow">
          <div class="panel-title">
            <el-icon><TrendCharts /></el-icon>
            <span>患者流量监控（今日分时趋势）</span>
          </div>
          <PatientFlowChart :flow="dash.patientFlow" />
        </div>
        <div class="panel panel-disease">
          <div class="panel-title">
            <el-icon><PieChart /></el-icon>
            <span>疾病分布统计</span>
          </div>
          <DiseaseDistChart :diseases="dash.diseases" />
        </div>
      </section>

      <section class="row row-bottom">
        <div class="panel panel-region">
          <div class="panel-title">
            <el-icon><MapLocation /></el-icon>
            <span>患者区域分布（眼病筛查热力）</span>
            <el-tag v-if="regionMode === 'bar'" size="small" type="info" effect="dark" class="mode-tag">
              离线模式 · 区域排行
            </el-tag>
          </div>
          <RegionDistChart :regions="dash.regions" @mode-change="regionMode = $event" />
        </div>
        <div class="panel panel-devices">
          <div class="panel-title">
            <el-icon><Monitor /></el-icon>
            <span>OCT 设备运行状态</span>
          </div>
          <DeviceStatusPanel :devices="dash.devices" />
        </div>
      </section>
    </template>

    <div v-else-if="!loading && !loadError" class="empty-holder">
      <el-empty description="暂无数据，请点击右上角「立即刷新」" />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { dataService } from '../services/dataService'
import KpiBoard from '../components/dashboard/KpiBoard.vue'
import PatientFlowChart from '../components/dashboard/PatientFlowChart.vue'
import DiseaseDistChart from '../components/dashboard/DiseaseDistChart.vue'
import RegionDistChart from '../components/dashboard/RegionDistChart.vue'
import DeviceStatusPanel from '../components/dashboard/DeviceStatusPanel.vue'

const REFRESH_INTERVAL = 30000
const LOAD_DEADLINE = 8000

const dash = ref(null)
const loading = ref(false)
const loadError = ref('')
const lastUpdated = ref(null)
const regionMode = ref('map')
const clockText = ref('')

let refreshTimer = null
let clockTimer = null
let deadlineTimer = null
let loadingInFlight = false

const lastUpdatedText = computed(() => {
  if (!lastUpdated.value) return '--:--:--'
  return lastUpdated.value.toLocaleTimeString('zh-CN', { hour12: false })
})

function updateClock() {
  const now = new Date()
  const date = now.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'long' })
  const time = now.toLocaleTimeString('zh-CN', { hour12: false })
  clockText.value = `${date} ${time}`
}

function armDeadline() {
  clearDeadline()
  deadlineTimer = setTimeout(() => {
    if (loading.value) {
      loading.value = false
      loadingInFlight = false
      if (!dash.value) {
        loadError.value = `数据加载超时（${LOAD_DEADLINE / 1000} 秒无响应），已自动中止加载。请检查后端服务窗口是否正常运行，或点击重试。`
      }
    }
  }, LOAD_DEADLINE)
}

function clearDeadline() {
  if (deadlineTimer) {
    clearTimeout(deadlineTimer)
    deadlineTimer = null
  }
}

async function load(showLoading = true) {
  if (loadingInFlight) {
    return
  }
  loadingInFlight = true
  loadError.value = ''
  if (showLoading && !dash.value) {
    loading.value = true
    armDeadline()
  }
  try {
    dash.value = await dataService.getDashboard()
    lastUpdated.value = new Date()
  } catch (err) {
    loadError.value = (err && err.message) ? err.message : '数据加载失败，请稍后重试'
  } finally {
    loadingInFlight = false
    loading.value = false
    clearDeadline()
  }
}

function retry() {
  load(true)
}

onMounted(() => {
  updateClock()
  clockTimer = setInterval(updateClock, 1000)
  load(true)
  refreshTimer = setInterval(() => {
    if (!loadingInFlight) {
      load(false)
    }
  }, REFRESH_INTERVAL)
})

onUnmounted(() => {
  clearInterval(refreshTimer)
  clearInterval(clockTimer)
  clearDeadline()
})
</script>

<style scoped>
.dashboard {
  min-height: 100%;
  padding: 16px 20px 20px;
  color: #dce8f7;
  background:
    radial-gradient(ellipse at 15% 10%, rgba(31, 81, 153, 0.45), transparent 45%),
    radial-gradient(ellipse at 85% 90%, rgba(23, 62, 124, 0.5), transparent 50%),
    linear-gradient(180deg, #081426 0%, #0a1a33 100%);
}

.screen-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-title h1 {
  font-size: 24px;
  font-weight: 600;
  letter-spacing: 3px;
  background: linear-gradient(90deg, #6fc3ff, #b6e2ff);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.header-meta {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 13px;
  color: #9fb8d4;
}

.updated {
  color: #6d84a3;
}

.load-error {
  margin-bottom: 14px;
}

.empty-holder {
  padding: 40px 0;
}

.row {
  display: grid;
  gap: 14px;
}

.row-kpi {
  margin-bottom: 14px;
}

.row-mid {
  grid-template-columns: 2fr 1fr;
  margin-bottom: 14px;
}

.row-bottom {
  grid-template-columns: 2fr 1fr;
}

.panel {
  background: rgba(19, 41, 72, 0.72);
  border: 1px solid rgba(64, 120, 192, 0.35);
  border-radius: 10px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  min-height: 300px;
}

.panel-flow,
.panel-region {
  min-height: 320px;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: #cfe4ff;
  margin-bottom: 10px;
}

.mode-tag {
  margin-left: auto;
}

@media (max-width: 1100px) {
  .row-mid,
  .row-bottom {
    grid-template-columns: 1fr;
  }
}
</style>