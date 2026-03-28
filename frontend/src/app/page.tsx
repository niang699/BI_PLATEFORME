'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'

export default function Root() {
  const router = useRouter()
  useEffect(() => {
    const user = getCurrentUser()
    router.replace(user ? '/dashboard' : '/login')
  }, [router])
  return (
    <div className="flex items-center justify-center min-h-screen login-bg">
      <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
    </div>
  )
}
