<template>
  <div class="report-view">
    <el-row :gutter="14">
      <el-col :span="11">
        <div class="image-panel">
          <div class="image-title">
            <span>OCT 断层图像 · {{ report.examType }}</span>
            <el-tag size="small" effect="plain">{{ report.deviceId }}</el-tag>
          </div>
          <div class="oct-image">
            <div v-for="i in 14" :key="i" class="layer-line" :style="layerStyle(i)"></div>
            <svg class="lesion-layer" viewBox="0 0 100 100" preserveAspectRatio="none">
              <g v-for="(lesion, index) in report.lesions" :key="index">
                <rect
                  :x="lesion.box.x * 100"
                  :y="lesion.box.y * 100"
                  :width="lesion.box.w * 100"
                  :height="lesion.box.h * 100"
                  class="lesion-box"
                />
                <text
                  :x="lesion.box.x * 100 + 1"
                  :y="lesion.box.y * 100 - 1.5"
                  class="lesion-label"
                >
                  {{ lesion.disease }} {{ lesion.confidence }}%
                </text>
              </g>
            </svg>
            <div v-if="!report.lesions.length" class="no-lesion">
              <el-icon :size="34" color="#67c23a"><CircleCheckFilled /></el-icon>
              <span>未检出病灶区域</span>
            </div>
            <div v-if="report.status !== '已签发'" class="watermark">待医生复核</div>
          </div>
        </div>

        <el-card shadow="never" class="metrics-card">
          <template #header><span>定量指标</span></template>
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item v-for="m in report.metrics" :key="m.label" :label="m.label">
              {{ m.value }}{{ m.unit }}
            </el-descriptions-item>
            <el-descriptions-item label="病情趋势">
              <el-tag :type="trendType(report.trend)" size="small" effect="dark">{{ report.trend }}</el-tag>
            </el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>

      <el-col :span="13">
        <el-card shadow="never" class="conclusion-card">
          <template #header>
            <div class="card-head">
              <span>AI 诊断结论</span>
              <el-tag :type="report.status === '已签发' ? 'success' : 'warning'" size="small" effect="dark">
                {{ report.status }}
              </el-tag>
            </div>
          </template>
          <div class="ai-conclusion">
            <span class="ai-tag">AI 初筛</span>
            <span>{{ report.aiConclusion }}</span>
            <el-tag size="small" type="primary" effect="dark" class="confidence-tag">
              置信度 {{ report.confidence }}%
            </el-tag>
          </div>
          <div class="suggest-row">
            <span class="suggest-label">AI 建议诊断：</span>
            <span class="suggest-value">{{ report.suggestedDiagnosis }}</span>
          </div>

          <el-divider />

          <div class="lesion-table-title">检出病灶（{{ report.lesions.length }} 处）</div>
          <el-table :data="report.lesions" size="small" border class="lesion-table">
            <el-table-column prop="disease" label="病种" min-width="130" />
            <el-table-column prop="location" label="位置" min-width="150" />
            <el-table-column label="置信度" width="110" align="center">
              <template #default="{ row }">
                <span class="conf-text">{{ row.confidence }}%</span>
              </template>
            </el-table-column>
            <template #empty>未检出病灶，建议定期复查</template>
          </el-table>
        </el-card>

        <el-card v-if="report.status === '已签发'" shadow="never" class="signed-card">
          <template #header><span>医生签发</span></template>
          <div class="signature">
            <div class="sign-name">{{ report.reviewedBy }}</div>
            <div class="sign-time">签发时间：{{ report.reviewedAt }}</div>
          </div>
          <el-descriptions :column="1" border size="small" class="signed-desc">
            <el-descriptions-item label="最终诊断">{{ report.finalConclusion }}</el-descriptions-item>
            <el-descriptions-item v-if="report.reviewNote" label="医生备注">{{ report.reviewNote }}</el-descriptions-item>
          </el-descriptions>
        </el-card>
        <el-card v-else shadow="never" class="review-card">
          <template #header><span>医生复核</span></template>
          <div class="review-actions">
            <el-button type="success" :icon="CircleCheck" @click="$emit('confirm')">确认签发</el-button>
            <el-button type="primary" plain :icon="EditPen" @click="$emit('amend')">修正后签发</el-button>
          </div>
          <div class="review-tip">确认签发将采用 AI 建议诊断；修正后签发可选择最终诊断并填写备注</div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { CircleCheck, EditPen } from '@element-plus/icons-vue'

defineProps({
  report: { type: Object, required: true }
})

defineEmits(['confirm', 'amend'])

function layerStyle(i) {
  const hue = 205 + i * 5
  return {
    background: `linear-gradient(90deg, hsl(${hue}, 65%, 14%), hsl(${hue}, 75%, 42%), hsl(${hue}, 65%, 20%))`,
    opacity: 0.55 + (i % 4) * 0.12
  }
}

function trendType(trend) {
  if (trend === '减轻') return 'success'
  if (trend === '进展') return 'danger'
  return 'info'
}
</script>

<style scoped>
.report-view {
  width: 100%;
}

.image-panel {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 14px;
}

.image-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: #f5f7fa;
  font-size: 13px;
  color: #303133;
}

.oct-image {
  position: relative;
  height: 300px;
  background: #06101f;
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
  padding: 12px 16px;
}

.layer-line {
  height: 12px;
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
  font-size: 3.4px;
  font-weight: 600;
}

.no-lesion {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #67c23a;
  font-size: 14px;
  background: rgba(6, 16, 31, 0.35);
}

.watermark {
  position: absolute;
  right: 16px;
  bottom: 12px;
  padding: 3px 12px;
  border: 1px dashed rgba(255, 214, 107, 0.7);
  border-radius: 4px;
  color: rgba(255, 214, 107, 0.85);
  font-size: 13px;
  letter-spacing: 3px;
  transform: rotate(-8deg);
}

.metrics-card,
.conclusion-card,
.signed-card,
.review-card {
  margin-bottom: 14px;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ai-conclusion {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: #303133;
  flex-wrap: wrap;
}

.ai-tag {
  padding: 2px 8px;
  border-radius: 4px;
  background: #ecf5ff;
  color: #409eff;
  font-size: 12px;
}

.confidence-tag {
  margin-left: auto;
}

.suggest-row {
  margin-top: 10px;
  font-size: 14px;
}

.suggest-label {
  color: #909399;
}

.suggest-value {
  color: #409eff;
  font-weight: 600;
}

.lesion-table-title {
  font-size: 13px;
  color: #606266;
  margin-bottom: 8px;
}

.conf-text {
  color: #f56c6c;
  font-weight: 600;
}

.signature {
  display: flex;
  align-items: baseline;
  gap: 14px;
  margin-bottom: 12px;
}

.sign-name {
  font-family: 'KaiTi', 'STKaiti', 'Microsoft YaHei', cursive;
  font-size: 26px;
  color: #1f2d3d;
  border-bottom: 2px solid #67c23a;
  padding-bottom: 2px;
}

.sign-time {
  color: #909399;
  font-size: 12px;
}

.review-actions {
  display: flex;
  gap: 12px;
}

.review-tip {
  margin-top: 10px;
  font-size: 12px;
  color: #909399;
}
</style>