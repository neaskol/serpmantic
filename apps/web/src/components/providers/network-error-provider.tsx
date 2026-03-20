'use client'

import { useNetworkErrorToast } from '@/hooks/use-network-error-toast'

export function NetworkErrorProvider({ children }: { children: React.ReactNode }) {
  useNetworkErrorToast()
  return <>{children}</>
}
