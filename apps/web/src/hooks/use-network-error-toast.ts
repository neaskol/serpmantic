'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'

export function useNetworkErrorToast() {
  useEffect(() => {
    const originalFetch = window.fetch

    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args)

        if (!response.ok) {
          const url = typeof args[0] === 'string'
            ? args[0]
            : args[0] instanceof Request
              ? args[0].url
              : args[0].toString()
          const method = typeof args[1] === 'object' && args[1]?.method ? args[1].method : 'GET'

          let errorMessage = `Erreur ${response.status}`

          try {
            const data = await response.clone().json()
            if (data.message || data.error) {
              errorMessage = data.message || data.error
            }
          } catch {
            errorMessage = response.statusText || errorMessage
          }

          toast.error(`${method} ${url}`, {
            description: errorMessage,
            duration: 5000,
          })
        }

        return response
      } catch (error) {
        const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || 'inconnue'

        toast.error('Erreur réseau', {
          description: `Impossible de joindre le serveur (${url})`,
          duration: 5000,
        })

        throw error
      }
    }

    return () => {
      window.fetch = originalFetch
    }
  }, [])
}
