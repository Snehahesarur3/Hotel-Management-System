import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ApiError } from '@/types/api'

interface ApiMutationOptions<TData, TVariables> {
  mutationFn: (variables: TVariables) => Promise<TData>
  /** Toast shown on success; may depend on the result. */
  successMessage?: string | ((data: TData, variables: TVariables) => string)
  /** Query keys to invalidate after success (prefix match), e.g. [['rooms'], ['dashboard']]. */
  invalidate?: QueryKey[]
  onSuccess?: (data: TData, variables: TVariables) => void
  /** Called before the error toast; return true to suppress the toast (e.g. errors shown inline in a form). */
  onError?: (error: ApiError, variables: TVariables) => boolean | void
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return 'Something went wrong. Please try again.'
}

/**
 * Standard write operation: runs the mutation, invalidates affected queries,
 * and reports the outcome with a toast. Used by every create/update/delete in the app.
 */
export function useApiMutation<TData = unknown, TVariables = void>({
  mutationFn,
  successMessage,
  invalidate = [],
  onSuccess,
  onError,
}: ApiMutationOptions<TData, TVariables>) {
  const queryClient = useQueryClient()
  return useMutation<TData, Error, TVariables>({
    mutationFn,
    onSuccess: async (data, variables) => {
      await Promise.all(invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
      if (successMessage) {
        toast.success(typeof successMessage === 'function' ? successMessage(data, variables) : successMessage)
      }
      onSuccess?.(data, variables)
    },
    onError: (error, variables) => {
      const apiError = error instanceof ApiError ? error : new ApiError(0, errorMessage(error))
      const handled = onError?.(apiError, variables)
      if (!handled) toast.error(apiError.message)
    },
  })
}
