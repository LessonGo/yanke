import { onUnmounted, ref } from 'vue'

export function useStagedProgress() {
  const progress = ref(0)
  const stageIndex = ref(0)
  const running = ref(false)
  const currentStageName = ref('')

  let timer = null

  function start(stages, { fast = false } = {}) {
    return new Promise((resolve) => {
      stop()
      const list = Array.isArray(stages) && stages.length ? stages : [{ name: '分析中', duration: 1000 }]
      const scale = fast ? 0.05 : 1
      const totalMs = Math.max(200, list.reduce((s, x) => s + x.duration, 0) * scale)
      running.value = true
      progress.value = 0
      stageIndex.value = 0
      currentStageName.value = list[0].name
      const startTime = performance.now()

      timer = setInterval(() => {
        const elapsed = performance.now() - startTime
        progress.value = Math.min(100, Math.round((elapsed / totalMs) * 100))

        let acc = 0
        let idx = 0
        for (let i = 0; i < list.length; i++) {
          acc += list[i].duration * scale
          if (elapsed >= acc) {
            idx = Math.min(list.length - 1, i + 1)
          }
        }
        stageIndex.value = idx
        currentStageName.value = list[idx].name

        if (progress.value >= 100) {
          clearInterval(timer)
          timer = null
          running.value = false
          resolve()
        }
      }, 30)
    })
  }

  function stop() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
    running.value = false
  }

  onUnmounted(stop)

  return { progress, stageIndex, running, currentStageName, start, stop }
}