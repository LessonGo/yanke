import { reactive } from 'vue'

const STORAGE_KEY = 'eye_oct_auth'

function loadUser() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
  } catch {
    return null
  }
}

const authStore = reactive({
  user: loadUser(),
  get isLoggedIn() {
    return !!this.user
  },
  get role() {
    return this.user ? this.user.role : ''
  },
  get roleName() {
    return this.user ? this.user.roleName : ''
  },
  get displayName() {
    return this.user ? this.user.name : ''
  },
  login(user) {
    this.user = user
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
  },
  logout() {
    this.user = null
    localStorage.removeItem(STORAGE_KEY)
  }
})

export function useAuthStore() {
  return authStore
}