import { onUnmounted, ref, watch } from 'vue'

export function useCountUp(valueGetter, duration = 1200) {
  const display = ref(0)
  let rafId = null

  function animate(from, to) {
    if (rafId) {
      cancelAnimationFrame(rafId)
    }
    const start = performance.now()
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      display.value = Math.round(from + (to - from) * eased)
      if (progress < 1) {
        rafId = requestAnimationFrame(tick)
      }
    }
    rafId = requestAnimationFrame(tick)
  }

  watch(
    valueGetter,
    (to, from) => {
      animate(from ?? 0, to ?? 0)
    },
    { immediate: true }
  )

  onUnmounted(() => {
    if (rafId) {
      cancelAnimationFrame(rafId)
    }
  })

  return display
}