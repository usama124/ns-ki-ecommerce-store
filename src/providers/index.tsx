import { AuthProvider } from '@/providers/Auth'
import React from 'react'

import { CartProvider } from './Cart'
import { HeaderThemeProvider } from './HeaderTheme'
import { ThemeProvider } from './Theme'
import { SonnerProvider } from '@/providers/Sonner'
import { Analytics } from '@/components/Analytics'

export const Providers: React.FC<{
  children: React.ReactNode
}> = ({ children }) => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <HeaderThemeProvider>
          <SonnerProvider />
          <Analytics deploymentAllowed={process.env.NODE_ENV === 'production' && (!process.env.VERCEL_ENV || process.env.VERCEL_ENV === 'production')} />
          <CartProvider>{children}</CartProvider>
        </HeaderThemeProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
