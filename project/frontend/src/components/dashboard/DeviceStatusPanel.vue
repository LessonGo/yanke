<template>
  <div class="device-panel">
    <div class="device-summary">
      <div class="summary-item">
        <span class="summary-num total">{{ devices.length }}</span>
        <span class="summary-label">设备总数</span>
      </div>
      <div class="summary-item">
        <span class="summary-num online">{{ onlineCount }}</span>
        <span class="summary-label">在线</span>
      </div>
      <div class="summary-item">
        <span class="summary-num maintenance">{{ maintenanceCount }}</span>
        <span class="summary-label">维护中</span>
      </div>
      <div class="summary-item">
        <span class="summary-num offline">{{ offlineCount }}</span>
        <span class="summary-label">离线</span>
      </div>
      <div class="summary-item">
        <span class="summary-num total-today">{{ todayTotal }}</span>
        <span class="summary-label">今日检查量</span>
      </div>
    </div>

    <div class="device-list">
      <div v-for="device in devices" :key="device.id" class="device-card">
        <div class="device-head">
          <span class="device-name">{{ device.name }}</span>
          <span class="device-status" :class="device.status">
            <i class="dot"></i>{{ statusText[device.status] }}
          </span>
        </div>
        <div class="device-meta">
          <span>{{ device.id }}</span>
          <span>{{ device.model }}</span>
          <span>{{ device.location }}</span>
        </div>
        <div class="device-foot">
          <el-progress
            :percentage="device.usageRate"
            :stroke-width="8"
            :color="progressColor"
            class="device-progress"
          />
          <span class="today-count">今日 {{ device.todayCount }} 例</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  devices: { type: Array, default: () => [] }
})

const statusText = {
  online: '在线',
  offline: '离线',
  maintenance: '维护中'
}

const progressColor = [
  { color: '#f56c6c', percentage: 40 },
  { color: '#e6a23c', percentage: 70 },
  { color: '#37d0c0', percentage: 100 }
]

const onlineCount = computed(() => props.devices.filter((d) => d.status === 'online').length)
const maintenanceCount = computed(() => props.devices.filter((d) => d.status === 'maintenance').length)
const offlineCount = computed(() => props.devices.filter((d) => d.status === 'offline').length)
const todayTotal = computed(() => props.devices.reduce((sum, d) => sum + d.todayCount, 0))
</script>

<style scoped>
.device-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.device-summary {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}

.summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 4px;
  border-radius: 8px;
  background: rgba(30, 64, 118, 0.5);
}

.summary-num {
  font-size: 20px;
  font-weight: 700;
}

.summary-num.total {
  color: #dce8f7;
}
.summary-num.online {
  color: #37d0c0;
}
.summary-num.maintenance {
  color: #f6b352;
}
.summary-num.offline {
  color: #ff7b9c;
}
.summary-num.total-today {
  color: #6fc3ff;
}

.summary-label {
  margin-top: 2px;
  font-size: 12px;
  color: #8fb0d6;
}

.device-list {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  overflow-y: auto;
  min-height: 0;
}

.device-card {
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(19, 41, 72, 0.65);
  border: 1px solid rgba(64, 120, 192, 0.25);
}

.device-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.device-name {
  font-size: 13px;
  font-weight: 600;
  color: #cfe4ff;
}

.device-status {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
}

.device-status .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.device-status.online {
  color: #37d0c0;
}
.device-status.online .dot {
  background: #37d0c0;
  box-shadow: 0 0 6px #37d0c0;
  animation: pulse 1.8s infinite;
}
.device-status.offline {
  color: #ff7b9c;
}
.device-status.offline .dot {
  background: #ff7b9c;
}
.device-status.maintenance {
  color: #f6b352;
}
.device-status.maintenance .dot {
  background: #f6b352;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}

.device-meta {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin: 6px 0;
  font-size: 11px;
  color: #6d84a3;
}

.device-foot {
  display: flex;
  align-items: center;
  gap: 10px;
}

.device-progress {
  flex: 1;
}

.device-progress :deep(.el-progress__text) {
  color: #8fb0d6;
  font-size: 11px !important;
}

.today-count {
  font-size: 11px;
  color: #6fc3ff;
  white-space: nowrap;
}
</style>