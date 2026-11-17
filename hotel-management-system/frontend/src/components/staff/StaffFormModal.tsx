import { zodResolver } from '@hookform/resolvers/zod'
import { useId, useMemo } from 'react'
import { useForm, type Path } from 'react-hook-form'
import { Button } from '@/components/common/Button'
import { Field, SelectInput, TextInput } from '@/components/common/FormControls'
import { Modal } from '@/components/common/Modal'
import { useSaveStaff } from '@/hooks/useStaff'
import { MAX_DAYS_BEFORE_JOINING, staffInputSchema, type StaffFormValues } from '@/schemas/staff'
import type { ApiError } from '@/types/api'
import { DEPARTMENTS, EMPLOYMENT_STATUSES } from '@/types/enums'
import type { StaffInput, StaffView } from '@/types/staff'
import { addDays, todayISO } from '@/utils/date'
import { enumLabel } from '@/utils/format'

interface StaffFormModalProps {
  open: boolean
  member?: StaffView
  onClose: () => void
}

export function StaffFormModal(props: StaffFormModalProps) {
  if (!props.open) return null
  return <StaffForm key={props.member?.id ?? 'new'} {...props} />
}

function StaffForm({ member, onClose }: StaffFormModalProps) {
  const formId = useId()
  const today = todayISO()
  const schema = useMemo(() => staffInputSchema({ today }), [today])
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<StaffFormValues, unknown, StaffInput>({
    resolver: zodResolver(schema),
    defaultValues: member
      ? {
          fullName: member.fullName,
          email: member.email,
          phone: member.phone,
          department: member.department,
          designation: member.designation,
          joiningDate: member.joiningDate,
          employmentStatus: member.employmentStatus,
        }
      : { fullName: '', email: '', phone: '', department: 'RECEPTION', designation: '', joiningDate: today, employmentStatus: 'ACTIVE' },
  })
  const mutation = useSaveStaff({
    onDone: onClose,
    onError: (error: ApiError) => {
      const entries = Object.entries(error.fieldErrors ?? {})
      entries.forEach(([field, message]) => setError(field as Path<StaffFormValues>, { message }))
      return entries.length > 0
    },
  })
  const onSubmit = handleSubmit((input) => mutation.mutate({ id: member?.id, input }))

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!mutation.isPending}
      size="lg"
      title={member ? `Edit ${member.fullName}` : 'Add staff member'}
      description={
        member && member.openTasks > 0
          ? `${member.openTasks} open housekeeping task${member.openTasks === 1 ? '' : 's'}: status and department changes need them reassigned first.`
          : 'Employee record for scheduling and task assignment.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={mutation.isPending} disabled={Boolean(member) && !isDirty}>
            {member ? 'Save changes' : 'Add staff member'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Full name" required error={errors.fullName?.message} className="sm:col-span-2">
          {(a) => <TextInput {...a} autoComplete="off" invalid={Boolean(errors.fullName)} {...register('fullName')} />}
        </Field>
        <Field label="Work email" required error={errors.email?.message}>
          {(a) => <TextInput {...a} type="email" autoComplete="off" invalid={Boolean(errors.email)} {...register('email')} />}
        </Field>
        <Field label="Phone" required error={errors.phone?.message}>
          {(a) => <TextInput {...a} type="tel" autoComplete="off" invalid={Boolean(errors.phone)} {...register('phone')} />}
        </Field>
        <Field label="Department" required error={errors.department?.message}>
          {(a) => (
            <SelectInput {...a} invalid={Boolean(errors.department)} {...register('department')}>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {enumLabel(d)}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>
        <Field label="Job title" required error={errors.designation?.message}>
          {(a) => <TextInput {...a} autoComplete="off" placeholder="e.g. Front Office Associate" invalid={Boolean(errors.designation)} {...register('designation')} />}
        </Field>
        <Field label="Joining date" required error={errors.joiningDate?.message} hint={`Up to ${MAX_DAYS_BEFORE_JOINING} days ahead for new hires.`}>
          {(a) => <TextInput {...a} type="date" max={addDays(today, MAX_DAYS_BEFORE_JOINING)} invalid={Boolean(errors.joiningDate)} {...register('joiningDate')} />}
        </Field>
        <Field label="Employment status" required error={errors.employmentStatus?.message}>
          {(a) => (
            <SelectInput {...a} invalid={Boolean(errors.employmentStatus)} {...register('employmentStatus')}>
              {EMPLOYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {enumLabel(s)}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>
      </form>
    </Modal>
  )
}
