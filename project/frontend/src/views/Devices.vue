<template>
  <div class="devices-page">
    <el-card shadow="never" class="filter-card">
      <el-form inline @submit.prevent>
        <el-form-item label="设备状态">
          <el-select v-model="filters.status" class="filter-select" clearable placeholder="全部状态" @change="load">
            <el-option label="在线" value="online" />
            <el-option label="维护中" value="maintenance" />
            <el-option label="离线" value="offline" />
          </el-select>
        </el-form-item>
        <el-form-item label="设备型号">
          <el-select v-model="filters.model" class="filter-select" clearable placeholder="全部型号" @change="load">
            <el-option v-for="m in modelOptions" :key="m" :label="m" :value="m" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-alert type="info" :closable="false" class="summary-alert">
            <template #title>
              共 {{ summary.total }} 台 · 在线 {{ summary.online }} · 维护中 {{ summary.maintenance }} · 离线 {{ summary.offline }}
            </template>
          </el-alert>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="table-card">
      <el-table v-loading="loading" :data="rows" stripe class="device-table">
        <el-table-column prop="id" label="设备编号" width="100" />
        <el-table-column prop="name" label="设备名称" min-width="180" />
        <el-table-column prop="model" label="型号" width="130" />
        <el-table-column prop="location" label="安装位置" min-width="140" />
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small" effect="dark">
              <i class="status-dot" :class="row.status"></i>{{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="使用率" width="150">
          <template #default="{ row }">
            <el-progress :percentage="row.usageRate" :stroke-width="10" :color="progressColor" />
          </template>
        </el-table-column>
        <el-table-column prop="todayCount" label="今日检查" width="100" align="center" />
        <el-table-column prop="totalScans" label="累计检查" width="110" align="center" />
        <el-table-column label="操作" width="200" align="center" fixed="right">
          <template #default="{ row }">
            <div class="op-actions">
              <el-button type="primary" link size="small" class="op-btn" @click="openDetail(row)">
                <el-icon class="op-icon"><View /></el-icon>
                <span class="op-text">详情</span>
              </el-button>
              <el-dropdown trigger="click" class="op-dropdown" @command="(cmd) => handleStatus(row, cmd)">
                <el-button type="warning" link size="small" class="op-btn">
                  <span class="op-text">切换状态</span>
                  <el-icon class="op-icon"><ArrowDown /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="online" :disabled="row.status === 'online'">设为在线</el-dropdown-item>
                    <el-dropdown-item command="maintenance" :disabled="row.status === 'maintenance'">设为维护中</el-dropdown-item>
                    <el-dropdown-item command="offline" :disabled="row.status === 'offline'">设为离线</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-drawer v-model="detailVisible" size="60%" :title="`设备详情 · ${detail ? detail.device.id : ''}`">
      <div v-loading="detailLoading" class="detail-body">
        <template v-if="detail">
          <el-descriptions :column="2" border class="detail-desc">
            <el-descriptions-item label="设备名称">{{ detail.device.name }}</el-descriptions-item>
            <el-descriptions-item label="型号">{{ detail.device.model }}</el-descriptions-item>
            <el-descriptions-item label="序列号">{{ detail.device.serialNo }}</el-descriptions-item>
            <el-descriptions-item label="安装位置">{{ detail.device.location }}</el-descriptions-item>
            <el-descriptions-item label="采购日期">{{ detail.device.purchaseDate }}</el-descriptions-item>
            <el-descriptions-item label="保修至">{{ detail.device.warrantyUntil }}</el-descriptions-item>
            <el-descriptions-item label="当前状态">
              <el-tag :type="statusType(detail.device.status)" size="small" effect="dark">{{ statusLabel(detail.device.status) }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="累计扫描次数">{{ detail.stats.totalScans }} 次</el-descriptions-item>
          </el-descriptions>

          <div class="detail-stats">
            <div class="stat-item">
              <span class="stat-num">{{ detail.stats.total }}</span>
              <span class="stat-label">累计检查记录</span>
            </div>
            <div class="stat-item">
              <span class="stat-num">{{ detail.stats.thisMonth }}</span>
              <span class="stat-label">本月检查</span>
            </div>
            <div class="stat-item">
              <span class="stat-num">{{ detail.stats.todayCount }}</span>
              <span class="stat-label">今日检查</span>
            </div>
            <div class="stat-item">
              <span class="stat-num">{{ detail.stats.lastDate }}</span>
              <span class="stat-label">最近检查日期</span>
            </div>
          </div>

          <div class="trend-title">近 7 日使用率趋势</div>
          <div ref="trendEl" class="trend-chart"></div>
        </template>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { dataService } from '../services/dataService'
import { useChart } from '../composables/useChart'

const loading = ref(false)
const rows = ref([])
const summary = ref({ total: 0, online: 0, maintenance: 0, offline: 0 })
const filters = reactive({ status: '', model: '' })

const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref(null)
const statusSubmitting = ref(false)

const progressColor = [
  { color: '#f56c6c', percentage: 40 },
  { color: '#e6a23c', percentage: 70 },
  { color: '#67c23a', percentage: 100 }
]

const modelOptions = computed(() => [...new Set(rows.value.map((d) => d.model))].filter(Boolean))

function statusLabel(status) {
  if (status === 'online') return '在线'
  if (status === 'maintenance') return '维护中'
  return '离线'
}

function statusType(status) {
  if (status === 'online') return 'success'
  if (status === 'maintenance') return 'warning'
  return 'danger'
}

const trendOption = computed(() => {
  const trend = detail.value ? detail.value.trend : []
  return {
    grid: { top: 30, left: 10, right: 20, bottom: 10, containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.96)',
      borderColor: '#dcdfe6',
      textStyle: { color: '#303133' },
      formatter: (params) => {
        const item = params[0]
        return `${item.name}<br/>使用率 ${item.value}%`
      }
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: trend.map((t) => t.date.slice(5)),
      axisLine: { lineStyle: { color: '#dcdfe6' } },
      axisLabel: { color: '#606266' }
    },
    yAxis: {
      type: 'value',
      max: 100,
      name: '使用率 %',
      nameTextStyle: { color: '#909399' },
      splitLine: { lineStyle: { color: '#ebeef5' } },
      axisLabel: { color: '#606266' }
    },
    series: [
      {
        name: '使用率',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 7,
        data: trend.map((t) => t.usageRate),
        lineStyle: { width: 3, color: '#409eff' },
        itemStyle: { color: '#409eff' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(64, 158, 255, 0.35)' },
              { offset: 1, color: 'rgba(64, 158, 255, 0.02)' }
            ]
          }
        },
        markPoint: {
          data: [{ type: 'max', name: '峰值' }],
          symbolSize: 44,
          label: { fontSize: 10 }
        }
      }
    ]
  }
})

const { el: trendEl, resize: resizeTrend } = useChart(trendOption)

async function load() {
  loading.value = true
  try {
    const data = await dataService.getDevices({ status: filters.status, model: filters.model })
    rows.value = data.list
    summary.value = data.summary
  } catch (err) {
    rows.value = []
    ElMessage.error(err.message || '设备台账加载失败')
  } finally {
    loading.value = false
  }
}

async function openDetail(row) {
  detailVisible.value = true
  detailLoading.value = true
  detail.value = null
  try {
    detail.value = await dataService.getDeviceDetail(row.id)
  } catch (err) {
    ElMessage.error(err.message || '设备详情加载失败')
  } finally {
    detailLoading.value = false
    await nextTick()
    resizeTrend()
  }
}

async function handleStatus(row, status) {
  if (statusSubmitting.value) {
    return
  }
  statusSubmitting.value = true
  try {
    await dataService.setDeviceStatus(row.id, status)
    ElMessage.success(`设备 ${row.id} 状态已切换为「${statusLabel(status)}」`)
    await load()
  } catch (err) {
    ElMessage.error(err.message || '状态切换失败')
  } finally {
    statusSubmitting.value = false
  }
}

defineExpose({ filters, rows, summary, detail, load, openDetail, handleStatus })

onMounted(load)
</script>

<style scoped>
.devices-page {
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
  width: 170px;
}

.summary-alert {
  width: 360px;
}

.table-card {
  min-height: 420px;
}

.device-table {
  width: 100%;
}

.op-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  line-height: 1;
}

.op-actions :deep(.el-dropdown),
.op-actions :deep(.el-button) {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
}

.op-actions :deep(.el-button) {
  height: auto;
  padding: 0;
  font-size: 13px;
  line-height: 1;
}

.op-text {
  font-size: 13px;
  line-height: 1;
}

.op-icon {
  margin: 0;
  font-size: 14px;
  line-height: 1;
}

.op-btn .op-icon {
  margin-left: 2px;
}

.status-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-right: 4px;
  background: currentColor;
}

.detail-body {
  padding: 0 6px;
}

.detail-desc {
  margin-bottom: 16px;
}

.detail-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 18px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 14px 8px;
  border-radius: 8px;
  background: #f5f7fa;
}

.stat-num {
  font-size: 20px;
  font-weight: 700;
  color: #1f2d3d;
}

.stat-label {
  font-size: 12px;
  color: #909399;
}

.trend-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}

.trend-chart {
  height: 260px;
}
</style>