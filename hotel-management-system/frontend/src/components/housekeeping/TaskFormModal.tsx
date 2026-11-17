import { zodResolver } from '@hookform/resolvers/zod'
import { useId, useMemo } from 'react'
import { useForm, type Path } from 'react-hook-form'
import { Button } from '@/components/common/Button'
import { Field, SelectInput, TextArea, TextInput } from '@/components/common/FormControls'
import { Modal } from '@/components/common/Modal'
import { useCreateTask, useHousekeepingSummary, useUpdateTask } from '@/hooks/useHousekeeping'
import { useRoomList } from '@/hooks/useRooms'
import { housekeepingTaskSchema, type HousekeepingTaskFormValues } from '@/schemas/housekeeping'
import type { ApiError } from '@/types/api'
import { HOUSEKEEPING_TASK_TYPES, TASK_PRIORITIES } from '@/types/enums'
import type { HousekeepingTaskInput, HousekeepingTaskView } from '@/types/housekeeping'
import { todayISO } from '@/utils/date'
import { enumLabel } from '@/utils/format'

interface TaskFormModalProps {
  open: boolean
  /** Task to edit; omit to create one. */
  task?: HousekeepingTaskView
  onClose: () => void
}

export function TaskFormModal(props: TaskFormModalProps) {
  if (!props.open) return null
  return <TaskForm key={props.task?.id ?? 'new'} {...props} />
}

function TaskForm({ task, onClose }: TaskFormModalProps) {
  const formId = useId()
  const today = todayISO()
  const earliestDate = task && task.scheduledDate < today ? task.scheduledDate : today
  const schema = useMemo(() => housekeepingTaskSchema({ earliestDate }), [earliestDate])
  const rooms = useRoomList({ size: 200, sort: { field: 'roomNumber', direction: 'asc' } })
  const staff = useHousekeepingSummary(today)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<HousekeepingTaskFormValues, unknown, HousekeepingTaskInput>({
    resolver: zodResolver(schema),
    defaultValues: task
      ? {
          roomId: task.roomId,
          assignedStaffId: task.assignedStaffId,
          taskType: task.taskType,
          priority: task.priority,
          scheduledDate: task.scheduledDate,
          notes: task.notes ?? '',
        }
      : { roomId: '', assignedStaffId: '', taskType: 'DAILY_SERVICE', priority: 'NORMAL', scheduledDate: today, notes: '' },
  })

  const showFieldErrors = (error: ApiError) => {
    const entries = Object.entries(error.fieldErrors ?? {})
    entries.forEach(([field, message]) => setError(field as Path<HousekeepingTaskFormValues>, { message }))
    return entries.length > 0
  }
  const create = useCreateTask({ onDone: onClose, onError: showFieldErrors })
  const update = useUpdateTask({ onDone: onClose, onError: showFieldErrors })
  const saving = create.isPending || update.isPending
  const onSubmit = handleSubmit((input) => (task ? update.mutate({ id: task.id, input }) : create.mutate(input)))

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!saving}
      title={task ? `Edit ${task.id}` : 'New housekeeping task'}
      description={task ? `Room ${task.roomNumber} · ${enumLabel(task.taskType)}` : 'Schedule cleaning, service or an inspection and assign it.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={saving} disabled={Boolean(task) && !isDirty}>
            {task ? 'Save changes' : 'Create task'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Room" required error={errors.roomId?.message}>
          {(a) => (
            <SelectInput {...a} invalid={Boolean(errors.roomId)} disabled={rooms.isPending} {...register('roomId')}>
              <option value="">{rooms.isPending ? 'Loading rooms…' : 'Select…'}</option>
              {rooms.data?.content.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.roomNumber} · {enumLabel(r.type)} · {enumLabel(r.status)}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>
        <Field label="Task" required error={errors.taskType?.message}>
          {(a) => (
            <SelectInput {...a} invalid={Boolean(errors.taskType)} {...register('taskType')}>
              {HOUSEKEEPING_TASK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {enumLabel(t)}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>
        <Field
          label="Assign to"
          required
          error={errors.assignedStaffId?.message}
          hint="Open tasks today are shown; the least busy are listed first."
          className="sm:col-span-2"
        >
          {(a) => (
            <SelectInput {...a} invalid={Boolean(errors.assignedStaffId)} disabled={staff.isPending} {...register('assignedStaffId')}>
              <option value="">{staff.isPending ? 'Loading staff…' : 'Select…'}</option>
              {staff.data?.staff.map((s) => (
                <option key={s.staffId} value={s.staffId}>
                  {s.fullName} · {enumLabel(s.department)} · {s.open} open
                </option>
              ))}
            </SelectInput>
          )}
        </Field>
        <Field label="Priority" required error={errors.priority?.message}>
          {(a) => (
            <SelectInput {...a} invalid={Boolean(errors.priority)} {...register('priority')}>
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {enumLabel(p)}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>
        <Field label="Date" required error={errors.scheduledDate?.message}>
          {(a) => <TextInput {...a} type="date" min={earliestDate} invalid={Boolean(errors.scheduledDate)} {...register('scheduledDate')} />}
        </Field>
        <Field label="Notes" error={errors.notes?.message} className="sm:col-span-2">
          {(a) => <TextArea {...a} rows={2} placeholder="e.g. Guest requested extra towels" invalid={Boolean(errors.notes)} {...register('notes')} />}
        </Field>
      </form>
    </Modal>
  )
}
