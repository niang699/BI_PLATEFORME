import { User, USERS } from './mockData'

const SESSION_KEY = 'seneau_user'

export function login(email: string, password: string): User | null {
  // Phase 1 : auth simulée (Phase 2 → Keycloak/JWT réel)
  const MOCK_PWD: Record<string, string> = {
    'a.niang@seneau.sn': 'admin2025',
    'y.hachami@seneau.sn': 'analyste2025',
    'f.sarr@seneau.sn':   'lecteur2025',
  }
  if (MOCK_PWD[email] && MOCK_PWD[email] === password) {
    const user = USERS.find(u => u.email === email)!
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(user))
    }
    return user
  }
  return null
}

export function logout() {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(SESSION_KEY)
  }
}

export function getCurrentUser(): User | null {
  if (typeof window === 'undefined') return null
  const raw = sessionStorage.getItem(SESSION_KEY)
  return raw ? JSON.parse(raw) : null
}
