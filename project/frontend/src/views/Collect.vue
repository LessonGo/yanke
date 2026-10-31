<template>
  <div v-loading="loading" class="collect-page">
    <el-page-header class="page-header" @back="goBack">
      <template #content>
        <span class="header-title">模拟数据采集</span>
      </template>
    </el-page-header>

    <el-alert
      v-if="startError"
      type="error"
      :title="startError"
      :closable="false"
      class="start-error"
    >
      <el-button size="small" type="danger" plain @click="goBack">返回检查管理</el-button>
    </el-alert>

    <template v-if="session">
      <el-row :gutter="14">
        <el-col :span="10">
          <el-card shadow="never" class="info-card">
            <template #header><span>检查信息</span></template>
            <el-descriptions :column="1" border>
              <el-descriptions-item label="患者">{{ session.patient.name }}（{{ session.patient.gender }} · {{ session.patient.age }} 岁）</el-descriptions-item>
              <el-descriptions-item label="档案号">{{ session.patient.id }}</el-descriptions-item>
              <el-descriptions-item label="病种标签">
                <template v-if="session.patient.tags.length">
                  <el-tag v-for="tag in session.patient.tags" :key="tag" size="small" effect="light" class="tag-item">{{ tag }}</el-tag>
                </template>
                <span v-else class="no-tag">健康筛查</span>
              </el-descriptions-item>
              <el-descriptions-item label="设备">{{ session.device.id }} · {{ session.device.name }}</el-descriptions-item>
              <el-descriptions-item label="预约时段">{{ session.reservation.date }} {{ session.reservation.slot }}</el-descriptions-item>
            </el-descriptions>

            <div class="platform-switch">
              <span class="platform-label">采集平台</span>
              <el-radio-group v-model="platform" :disabled="running">
                <el-radio-button label="SD-OCT">SD-OCT（谱域）</el-radio-button>
                <el-radio-button label="SS-OCT">SS-OCT（扫频光源）</el-radio-button>
              </el-radio-group>
            </div>
          </el-card>

          <el-card shadow="never" class="profile-card">
            <template #header><span>参数面板 · {{ profile.platformName }}</span></template>
            <el-descriptions :column="1" border size="small">
              <el-descriptions-item label="光源">{{ profile.lightSource }}</el-descriptions-item>
              <el-descriptions-item label="扫描速度">{{ profile.scanSpeed }}</el-descriptions-item>
              <el-descriptions-item label="成像深度">{{ profile.imagingDepth }}</el-descriptions-item>
              <el-descriptions-item label="扫描角度">{{ profile.scanAngle }}</el-descriptions-item>
              <el-descriptions-item label="轴向分辨率">{{ profile.axialResolution }}</el-descriptions-item>
              <el-descriptions-item label="单次扫描时长">{{ profile.scanDuration }}</el-descriptions-item>
            </el-descriptions>
          </el-card>
        </el-col>

        <el-col :span="14">
          <el-card shadow="never" class="scan-card">
            <template #header>
              <div class="scan-head">
                <span>OCT 断层采集</span>
                <el-tag v-if="done" type="success" effect="dark" size="small">采集完成</el-tag>
                <el-tag v-else-if="running" type="primary" effect="dark" size="small">{{ stageText }}</el-tag>
                <el-tag v-else type="info" effect="plain" size="small">待启动</el-tag>
              </div>
            </template>

            <div class="scan-window" :class="{ scanning: running, finished: done }">
              <div v-for="i in 12" :key="i" class="b-scan-line" :style="lineStyle(i)"></div>
              <div class="scan-overlay">
                <template v-if="done">
                  <el-icon :size="42" color="#67c23a"><CircleCheckFilled /></el-icon>
                  <span class="overlay-text">断层图像采集完成</span>
                </template>
                <template v-else-if="running">
                  <span class="overlay-text">{{ stageText }} · {{ progress }}%</span>
                </template>
                <template v-else>
                  <el-icon :size="42" color="#8fb0d6"><VideoCamera /></el-icon>
                  <span class="overlay-text idle">等待开始采集</span>
                </template>
              </div>
            </div>

            <el-progress
              :percentage="progress"
              :stroke-width="14"
              :status="done ? 'success' : undefined"
              class="scan-progress"
            />

            <div class="stage-list">
              <div
                v-for="(stage, index) in stages"
                :key="stage.label"
                class="stage-item"
                :class="{ active: stageIndex === index, passed: stageIndex > index }"
              >
                <span class="stage-dot"></span>
                <span class="stage-label">{{ stage.label }}</span>
              </div>
            </div>

            <div class="scan-actions">
              <el-button
                v-if="!running && !done"
                type="primary"
                size="large"
                :icon="VideoPlay"
                @click="startCollect"
              >
                开始采集
              </el-button>
              <el-button v-if="done" type="success" size="large" :icon="View" @click="goPatientTimeline">
                查看患者时间线
              </el-button>
              <el-button v-if="done" size="large" @click="goBack">返回检查管理</el-button>
            </div>

            <el-alert v-if="collectError" type="error" :title="collectError" :closable="false" class="collect-error" />
          </el-card>

          <el-card v-if="result" shadow="never" class="result-card">
            <template #header><span>新检查记录已生成</span></template>
            <el-descriptions :column="1" border>
              <el-descriptions-item label="记录号">{{ result.examId }}</el-descriptions-item>
              <el-descriptions-item label="患者">{{ result.patientName }}</el-descriptions-item>
              <el-descriptions-item label="AI 初筛">
                <span class="ai-text">{{ result.aiResult }}</span>
              </el-descriptions-item>
              <el-descriptions-item label="医生结论">{{ result.conclusion }}</el-descriptions-item>
              <el-descriptions-item label="读片医生">{{ result.doctor }}</el-descriptions-item>
            </el-descriptions>
            <div class="result-tip">该记录已同步至患者详情页时间线顶部，数据中心大屏「今日检查量」已联动更新</div>
          </el-card>
        </el-col>
      </el-row>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { VideoPlay, View } from '@element-plus/icons-vue'
import { dataService } from '../services/dataService'
import { PLATFORM_PROFILES } from '../../../shared/examContent.js'

const props = defineProps({
  fast: { type: Boolean, default: false }
})

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const startError = ref('')
const session = ref(null)
const platform = ref('SD-OCT')

const running = ref(false)
const done = ref(false)
const progress = ref(0)
const collectError = ref('')
const result = ref(null)

const stages = [
  { label: '设备自检', until: 10 },
  { label: '对准瞳孔', until: 25 },
  { label: 'OCT 断层扫描', until: 75 },
  { label: '图像重建', until: 90 },
  { label: 'AI 分析', until: 100 }
]

const profile = computed(() => PLATFORM_PROFILES[platform.value])

const stageIndex = computed(() => {
  let index = 0
  for (let i = 0; i < stages.length; i++) {
    if (progress.value <= stages[i].until) {
      index = i
      break
    }
    index = i
  }
  return index
})

const stageText = computed(() => stages[stageIndex.value].label)

let timer = null

function lineStyle(i) {
  const hue = 200 + i * 8
  return {
    background: `linear-gradient(90deg, hsl(${hue}, 70%, 18%), hsl(${hue}, 80%, 45%), hsl(${hue}, 70%, 18%))`,
    animationDelay: `${(i % 6) * 0.12}s`
  }
}

async function loadSession() {
  loading.value = true
  startError.value = ''
  try {
    const data = await dataService.startReservation(route.params.id)
    session.value = data
    platform.value = data.platform
  } catch (err) {
    startError.value = err.message || '预约信息加载失败'
  } finally {
    loading.value = false
  }
}

function startCollect() {
  running.value = true
  collectError.value = ''
  const tick = props.fast ? 5 : 90
  const step = props.fast ? [2, 6] : [1, 3]
  timer = setInterval(() => {
    const inc = step[0] + Math.floor(Math.random() * (step[1] - step[0] + 1))
    progress.value = Math.min(100, progress.value + inc)
    if (progress.value >= 100) {
      clearInterval(timer)
      timer = null
      finishCollect()
    }
  }, tick)
}

async function finishCollect() {
  running.value = false
  try {
    const data = await dataService.completeReservation(route.params.id)
    result.value = data
    done.value = true
    ElMessage.success('检查完成，检查记录已生成并同步患者时间线')
  } catch (err) {
    collectError.value = err.message || '检查完成处理失败'
    progress.value = 0
  }
}

function goPatientTimeline() {
  router.push(`/patients/${result.value.patientId}`)
}

function goBack() {
  router.push('/exams')
}

onMounted(loadSession)

onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
  }
})

defineExpose({ session, platform, progress, running, done, result, startCollect, loadSession })
</script>

<style scoped>
.collect-page {
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

.start-error {
  margin-top: 20px;
}

.info-card,
.profile-card,
.scan-card,
.result-card {
  margin-bottom: 14px;
}

.platform-switch {
  margin-top: 14px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.platform-label {
  font-size: 13px;
  color: #606266;
}

.tag-item {
  margin-right: 6px;
}

.no-tag {
  color: #909399;
  font-size: 12px;
}

.scan-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.scan-window {
  position: relative;
  height: 320px;
  border-radius: 8px;
  overflow: hidden;
  background: #06101f;
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
  padding: 10px 18px;
}

.b-scan-line {
  height: 14px;
  border-radius: 3px;
  opacity: 0.55;
  filter: saturate(0.8);
}

.scan-window.scanning .b-scan-line {
  animation: bscan 1.1s ease-in-out infinite;
  opacity: 0.9;
}

.scan-window.finished .b-scan-line {
  opacity: 1;
  filter: saturate(1.1);
}

@keyframes bscan {
  0%,
  100% {
    transform: scaleX(0.96);
    opacity: 0.5;
  }
  50% {
    transform: scaleX(1);
    opacity: 1;
  }
}

.scan-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: rgba(6, 16, 31, 0.45);
}

.overlay-text {
  color: #dce8f7;
  font-size: 15px;
  letter-spacing: 2px;
}

.overlay-text.idle {
  color: #8fb0d6;
}

.scan-progress {
  margin-top: 14px;
}

.stage-list {
  display: flex;
  justify-content: space-between;
  margin-top: 12px;
}

.stage-item {
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

.stage-item.active {
  color: #409eff;
  font-weight: 600;
}

.stage-item.active .stage-dot {
  background: #409eff;
  box-shadow: 0 0 6px #409eff;
}

.stage-item.passed {
  color: #67c23a;
}

.stage-item.passed .stage-dot {
  background: #67c23a;
}

.scan-actions {
  margin-top: 16px;
  display: flex;
  justify-content: center;
  gap: 12px;
}

.collect-error {
  margin-top: 12px;
}

.ai-text {
  color: #409eff;
}

.result-tip {
  margin-top: 12px;
  font-size: 12px;
  color: #909399;
}
</style>