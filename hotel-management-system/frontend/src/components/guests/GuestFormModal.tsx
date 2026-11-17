import { zodResolver } from '@hookform/resolvers/zod'
import { useId, useMemo } from 'react'
import { useForm, useWatch, type Path } from 'react-hook-form'
import { Button } from '@/components/common/Button'
import { Field, SelectInput, TextArea, TextInput } from '@/components/common/FormControls'
import { Modal } from '@/components/common/Modal'
import { useCreateGuest, useUpdateGuest } from '@/hooks/useGuests'
import { COMMON_NATIONALITIES, guestInputSchema, ID_PROOF_RULES, type GuestFormValues } from '@/schemas/guest'
import type { ApiError } from '@/types/api'
import { ID_PROOF_TYPES } from '@/types/enums'
import type { GuestInput, GuestSummary } from '@/types/guest'
import { enumLabel } from '@/utils/format'

interface GuestFormModalProps {
  open: boolean
  /** Guest to edit; omit to register a new guest. */
  guest?: GuestSummary
  onClose: () => void
  onSaved?: (guest: GuestSummary) => void
}

const EMPTY: GuestFormValues = {
  fullName: '',
  email: '',
  phone: '',
  address: '',
  nationality: 'Indian',
  idProofType: 'NATIONAL_ID',
  idProofNumber: '',
}

export function GuestFormModal(props: GuestFormModalProps) {
  if (!props.open) return null
  return <GuestForm key={props.guest?.id ?? 'new'} {...props} />
}

function GuestForm({ guest, onClose, onSaved }: GuestFormModalProps) {
  const formId = useId()
  const nationalityListId = useId()
  const editing = Boolean(guest)
  const schema = useMemo(() => guestInputSchema({ requireIdNumber: !editing }), [editing])
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isDirty },
  } = useForm<GuestFormValues, unknown, GuestInput>({
    resolver: zodResolver(schema),
    defaultValues: guest
      ? {
          fullName: guest.fullName,
          email: guest.email,
          phone: guest.phone,
          address: guest.address,
          nationality: guest.nationality,
          idProofType: guest.idProofType,
          idProofNumber: '',
        }
      : EMPTY,
    mode: 'onTouched',
  })
  const idType = useWatch({ control, name: 'idProofType' })

  const showFieldErrors = (error: ApiError) => {
    const entries = Object.entries(error.fieldErrors ?? {})
    entries.forEach(([field, message]) => setError(field as Path<GuestFormValues>, { message }))
    return entries.length > 0
  }
  const done = (saved: GuestSummary) => {
    onSaved?.(saved)
    onClose()
  }
  const create = useCreateGuest({ onSaved: done, onError: showFieldErrors })
  const update = useUpdateGuest({ onSaved: done, onError: showFieldErrors })
  const saving = create.isPending || update.isPending
  const onSubmit = handleSubmit((input) => (guest ? update.mutate({ id: guest.id, input }) : create.mutate(input)))

  const idHint = editing
    ? `On file: ${guest!.idProofNumber}. Leave blank to keep it.`
    : `${ID_PROOF_RULES[idType ?? 'NATIONAL_ID'].hint}. Only the last 4 characters are stored.`

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!saving}
      size="lg"
      title={editing ? `Edit ${guest!.fullName}` : 'Register guest'}
      description={editing ? 'Update contact and identity details.' : 'Create a guest profile for reservations and billing.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={saving} disabled={editing && !isDirty}>
            {editing ? 'Save changes' : 'Register guest'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Full name" required className="sm:col-span-2" error={errors.fullName?.message}>
          {(a) => <TextInput {...a} autoComplete="off" invalid={Boolean(errors.fullName)} {...register('fullName')} />}
        </Field>
        <Field label="Email" required error={errors.email?.message}>
          {(a) => <TextInput {...a} type="email" autoComplete="off" invalid={Boolean(errors.email)} {...register('email')} />}
        </Field>
        <Field label="Phone" required error={errors.phone?.message} hint="Include the country code, e.g. +91">
          {(a) => <TextInput {...a} type="tel" autoComplete="off" invalid={Boolean(errors.phone)} {...register('phone')} />}
        </Field>
        <Field label="Address" required className="sm:col-span-2" error={errors.address?.message}>
          {(a) => <TextArea {...a} rows={2} invalid={Boolean(errors.address)} {...register('address')} />}
        </Field>
        <Field label="Nationality" required error={errors.nationality?.message}>
          {(a) => (
            <>
              <TextInput {...a} list={nationalityListId} autoComplete="off" invalid={Boolean(errors.nationality)} {...register('nationality')} />
              <datalist id={nationalityListId}>
                {COMMON_NATIONALITIES.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </>
          )}
        </Field>
        <Field label="ID proof type" required error={errors.idProofType?.message}>
          {(a) => (
            <SelectInput {...a} invalid={Boolean(errors.idProofType)} {...register('idProofType')}>
              {ID_PROOF_TYPES.map((t) => (
                <option key={t} value={t}>
                  {enumLabel(t)}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>
        <Field label="ID number" required={!editing} className="sm:col-span-2" error={errors.idProofNumber?.message} hint={idHint}>
          {(a) => (
            <TextInput
              {...a}
              autoComplete="off"
              spellCheck={false}
              placeholder={editing ? 'Unchanged' : undefined}
              invalid={Boolean(errors.idProofNumber)}
              {...register('idProofNumber')}
            />
          )}
        </Field>
      </form>
    </Modal>
  )
}
