<template>
  <el-dialog
    :model-value="visible"
    :title="title"
    width="360px"
    align-center
    class="qr-dialog"
    @update:model-value="$emit('update:visible', $event)"

  >
    <div class="qr-body">
      <div class="qr-frame">
        <img v-if="dataUrl" :src="dataUrl" alt="二维码" class="qr-img" />
        <div v-else class="qr-loading">
          <el-icon class="is-loading" :size="26"><Loading /></el-icon>
          <span>二维码生成中…</span>
        </div>
      </div>
      <div class="qr-tip">使用手机相机 / 微信「扫一扫」打开</div>
      <div class="qr-url" :title="url">{{ url }}</div>
      <el-button type="primary" plain size="small" :icon="CopyDocument" @click="copyUrl">
        复制链接
      </el-button>
      <div v-if="error" class="qr-error">{{ error }}</div>
      <el-alert
        type="info"
        :closable="false"
        class="qr-note"
        title="手机需与本机处于同一网络；若无法访问，可在电脑浏览器按 F12 切换设备模式（手机宽度）查看同一地址"
      />
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { CopyDocument, Loading } from '@element-plus/icons-vue'
import QRCode from 'qrcode'

const props = defineProps({
  visible: { type: Boolean, default: false },
  url: { type: String, default: '' },
  title: { type: String, default: '手机扫码查看' }
})

defineEmits(['update:visible'])

const dataUrl = ref('')
const error = ref('')

async function generate() {
  if (!props.url) {
    error.value = '链接地址为空，无法生成二维码'
    return
  }
  error.value = ''
  try {
    dataUrl.value = await QRCode.toDataURL(props.url, {
      width: 200,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#1f2d3d', light: '#ffffff' }
    })
  } catch (err) {
    error.value = err && err.message ? err.message : '二维码生成失败'
  }
}

async function copyUrl() {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(props.url)
    } else {
      throw new Error('clipboard unavailable')
    }
    ElMessage.success('链接已复制')
  } catch {
    ElMessage.warning('自动复制不可用，请手动选择链接复制')
  }
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      generate()
    }
  },
  { immediate: true }
)

defineExpose({ dataUrl, error, generate, copyUrl })
</script>

<style scoped>
.qr-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.qr-frame {
  width: 212px;
  height: 212px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #e4e7ed;
  border-radius: 10px;
  background: #ffffff;
}

.qr-img {
  width: 200px;
  height: 200px;
}

.qr-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: #909399;
  font-size: 13px;
}

.qr-tip {
  font-size: 13px;
  color: #606266;
}

.qr-url {
  max-width: 100%;
  font-size: 12px;
  color: #409eff;
  word-break: break-all;
  text-align: center;
  background: #f5f7fa;
  border-radius: 6px;
  padding: 6px 10px;
}

.qr-error {
  font-size: 12px;
  color: #f56c6c;
}

.qr-note {
  margin-top: 4px;
}
</style>