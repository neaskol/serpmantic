'use client'

import { toast } from 'sonner'

interface FetchWithRetryOptions extends RequestInit {
  maxRetries?: number
  retryDelay?: number
  retryOn?: number[]
  showToast?: boolean
}

export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    retryOn = [503, 429],
    showToast = true,
    ...fetchOptions
  } = options

  let lastError: Error | null = null
  let attempt = 0

  while (attempt < maxRetries) {
    try {
      const response = await fetch(url, fetchOptions)

      if (response.ok) {
        return response
      }

      if (retryOn.includes(response.status)) {
        lastError = new Error(`HTTP ${response.status}`)
        attempt++

        if (attempt < maxRetries) {
          const delay = retryDelay * Math.pow(2, attempt - 1)

          if (showToast) {
            toast.info(`Nouvelle tentative dans ${delay / 1000}s...`, {
              duration: delay,
            })
          }

          await new Promise((resolve) => setTimeout(resolve, delay))
          continue
        }
      }

      return response
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Network error')
      attempt++

      if (attempt < maxRetries) {
        const delay = retryDelay * Math.pow(2, attempt - 1)

        if (showToast) {
          toast.warning(`Erreur réseau - Nouvelle tentative (${attempt}/${maxRetries})`, {
            duration: delay,
          })
        }

        await new Promise((resolve) => setTimeout(resolve, delay))
        continue
      }

      if (showToast) {
        toast.error('Impossible de joindre le serveur', {
          description: `Échec après ${maxRetries} tentatives`,
          duration: 5000,
        })
      }

      throw lastError
    }
  }

  if (showToast && lastError) {
    toast.error('Requête échouée', {
      description: lastError.message,
      duration: 5000,
    })
  }

  throw lastError || new Error('Request failed after retries')
}

export function useFetchWithRetry() {
  return {
    fetch: fetchWithRetry,
  }
}
