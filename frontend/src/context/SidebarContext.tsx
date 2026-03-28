'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface SidebarCtx {
  open:     boolean
  isMobile: boolean
  toggle:   () => void
  close:    () => void
}

const SidebarContext = createContext<SidebarCtx>({
  open: true, isMobile: false,
  toggle: () => {}, close: () => {},
})

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [open,     setOpen]     = useState(true)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (mobile) setOpen(false)   // fermer la sidebar au passage mobile
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  return (
    <SidebarContext.Provider value={{ open, isMobile, toggle: () => setOpen(p => !p), close: () => setOpen(false) }}>
      {children}
    </SidebarContext.Provider>
  )
}

export const useSidebar = () => useContext(SidebarContext)
