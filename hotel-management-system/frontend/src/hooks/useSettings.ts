import { useQuery } from '@tanstack/react-query'
import { api } from '@/api'
import type { ApiError } from '@/types/api'
import type { SettingsInput } from '@/types/settings'
import { useApiMutation } from './useApiMutation'

export const settingsKeys = { all: ['settings'] as const }

export function useSettings() {
  return useQuery({ queryKey: settingsKeys.all, queryFn: () => api.settings.get() })
}

/** Saving the profile changes every invoice header. */
export function useUpdateSettings({ onError }: { onError?: (error: ApiError) => boolean | void } = {}) {
  return useApiMutation({
    mutationFn: (input: SettingsInput) => api.settings.update(input),
    successMessage: 'Hotel profile saved',
    invalidate: [settingsKeys.all, ['billing']],
    onError,
  })
}
