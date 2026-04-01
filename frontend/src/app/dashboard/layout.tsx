'use client'
import { useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import Sidebar from '@/components/Sidebar'
import { SidebarProvider, useSidebar } from '@/context/SidebarContext'

function DashboardInner({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { open, isMobile } = useSidebar()
  const mainRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!getCurrentUser()) router.replace('/login')
  }, [router])

  // Scroll manuel vers le haut à chaque changement de page
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main
        ref={mainRef}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          marginLeft: isMobile ? 0 : (open ? 'var(--sidebar-w)' : 'var(--sidebar-w-closed)'),
          transition: 'margin-left var(--transition)',
          minWidth: 0,
          overflowY: 'auto',
        }}
      >
        {children}
      </main>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <DashboardInner>{children}</DashboardInner>
    </SidebarProvider>
  )
}
