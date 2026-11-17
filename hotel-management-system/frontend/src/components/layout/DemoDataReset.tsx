import { useQueryClient } from '@tanstack/react-query'
import { RotateCcw } from 'lucide-react'
import { useState } from 'react'
import type { DemoDataControls } from '@/api'
import { Button } from '@/components/common/Button'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { useApiMutation } from '@/hooks/useApiMutation'
import { formatDate } from '@/utils/format'

/**
 * Restores the original demo data after confirmation (mock mode only).
 * `icon`: compact top-bar button; `button`: labelled button, used on the Settings page.
 */
export function DemoDataReset({ controls, variant = 'icon' }: { controls: DemoDataControls; variant?: 'icon' | 'button' }) {
  const [confirming, setConfirming] = useState(false)
  const queryClient = useQueryClient()
  const reset = useApiMutation({
    mutationFn: () => controls.reset(),
    successMessage: 'Demo data restored',
    onSuccess: () => {
      // Every cached query may be stale after a reset.
      void queryClient.invalidateQueries()
      setConfirming(false)
    },
  })

  return (
    <>
      {variant === 'button' ? (
        <Button variant="danger-outline" icon={<RotateCcw className="size-4" aria-hidden />} onClick={() => setConfirming(true)}>
          Reset demo data
        </Button>
      ) : (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-full p-1.5 text-ink-subtle hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-600"
        aria-label="Reset demo data"
        title="Reset demo data"
      >
        <RotateCcw className="size-4" aria-hidden />
      </button>
      )}
      <ConfirmDialog
        open={confirming}
        title="Reset demo data?"
        message={
          <>
            <p>
              All changes made in this browser (new bookings, edits, payments…) will be discarded and the original
              demo data restored, with dates aligned to today.
            </p>
            <p className="mt-2 text-xs text-ink-subtle">Current data was generated on {formatDate(controls.seededOn())}.</p>
          </>
        }
        confirmLabel="Reset data"
        tone="danger"
        loading={reset.isPending}
        onConfirm={() => reset.mutate()}
        onCancel={() => setConfirming(false)}
      />
    </>
  )
}
