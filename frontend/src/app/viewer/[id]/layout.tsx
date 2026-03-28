'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import Sidebar from '@/components/Sidebar'
import { SidebarProvider, useSidebar } from '@/context/SidebarContext'

function ViewerInner({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { open } = useSidebar()

  useEffect(() => {
    if (!getCurrentUser()) router.replace('/login')
  }, [router])

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          marginLeft: open ? 'var(--sidebar-w)' : 'var(--sidebar-w-closed)',
          transition: 'margin-left var(--transition)',
          minWidth: 0,
        }}
      >
        {children}
      </main>
    </div>
  )
}

export default function ViewerLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <ViewerInner>{children}</ViewerInner>
    </SidebarProvider>
  )
}
