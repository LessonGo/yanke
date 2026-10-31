import { mockApi } from '../mock'

const API_TIMEOUT = 2500

function isAbortOrNetworkError(err) {
  return !err || !err.business
}

async function fetchWithTimeout(path, options) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT)
  try {
    const res = await fetch(path, {
      method: options.method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal
    })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    const json = await res.json()
    if (json.code !== 0) {
      throw { business: true, message: json.message || '请求失败' }
    }
    return json.data
  } finally {
    clearTimeout(timer)
  }
}

async function request(path, options = {}) {
  try {
    return await fetchWithTimeout(path, options)
  } catch (err) {
    if (err && err.business) {
      throw new Error(err.message)
    }
    if (!isAbortOrNetworkError(err)) {
      throw new Error('网络请求异常')
    }
    try {
      const json = await mockApi(path, options)
      if (json.code !== 0) {
        throw new Error(json.message || '请求失败')
      }
      return json.data
    } catch (mockErr) {
      if (mockErr instanceof Error) {
        throw mockErr
      }
      throw new Error('数据加载失败（后端与本地数据源均不可用）')
    }
  }
}

export const dataService = {
  login: (payload) => request('/api/login', { method: 'POST', body: payload }),
  getDashboard: () => request('/api/dashboard'),
  getPatients: (params = {}) => {
    const query = new URLSearchParams()
    if (params.page) query.set('page', params.page)
    if (params.pageSize) query.set('pageSize', params.pageSize)
    if (params.keyword) query.set('keyword', params.keyword)
    if (params.tag) query.set('tag', params.tag)
    const qs = query.toString()
    return request(`/api/patients${qs ? `?${qs}` : ''}`)
  },
  getPatientTags: () => request('/api/patient-tags'),
  getPatientDetail: (id) => request(`/api/patients/${encodeURIComponent(id)}`),
  getDevices: (params = {}) => {
    const query = new URLSearchParams()
    if (params.status) query.set('status', params.status)
    if (params.model) query.set('model', params.model)
    const qs = query.toString()
    return request(`/api/devices${qs ? `?${qs}` : ''}`)
  },
  getDeviceDetail: (id) => request(`/api/devices/${encodeURIComponent(id)}`),
  setDeviceStatus: (id, status) =>
    request(`/api/devices/${encodeURIComponent(id)}/status`, { method: 'POST', body: { status } }),
  getConsumables: () => request('/api/consumables'),
  adjustStock: (id, payload) =>
    request(`/api/consumables/${encodeURIComponent(id)}/stock`, { method: 'POST', body: payload }),
  getMobileReport: (examId) => request(`/api/m/report/${encodeURIComponent(examId)}`),
  getMobilePatient: (patientId) => request(`/api/m/patient/${encodeURIComponent(patientId)}`),
  getSystemInfo: () => request('/api/system/info'),
  getSystemUsers: () => request('/api/system/users'),
  getResetScopes: () => request('/api/system/reset-scopes'),
  resetDemoData: (scope) => request('/api/system/reset', { method: 'POST', body: { scope } }),
  getReservations: (params = {}) => {
    const query = new URLSearchParams()
    if (params.status) query.set('status', params.status)
    if (params.date) query.set('date', params.date)
    const qs = query.toString()
    return request(`/api/reservations${qs ? `?${qs}` : ''}`)
  },
  createReservation: (payload) => request('/api/reservations', { method: 'POST', body: payload }),
  startReservation: (id) => request(`/api/reservations/${encodeURIComponent(id)}/start`, { method: 'POST' }),
  completeReservation: (id) =>
    request(`/api/reservations/${encodeURIComponent(id)}/complete`, { method: 'POST' }),
  cancelReservation: (id) =>
    request(`/api/reservations/${encodeURIComponent(id)}/cancel`, { method: 'POST' }),
  getAiStats: () => request('/api/ai/stats'),
  aiRead: (examId) => request('/api/ai/read', { method: 'POST', body: { examId } }),
  reviewReport: (examId, payload) =>
    request(`/api/reports/${encodeURIComponent(examId)}/review`, { method: 'POST', body: payload })
}