import { z } from 'zod'
import { unlessFailed } from './refine'
import { HOUSEKEEPING_TASK_TYPES, TASK_PRIORITIES } from '@/types/enums'
import { formatDate } from '@/utils/format'

/**
 * Housekeeping task validation shared by the form and the mock service.
 * `earliestDate`: today for new tasks; an existing task may keep its stored (earlier) date.
 */
export function housekeepingTaskSchema({ earliestDate }: { earliestDate: string }) {
  return z
    .object({
      roomId: z.string().trim().min(1, 'Choose a room'),
      assignedStaffId: z.string().trim().min(1, 'Assign a staff member'),
      taskType: z.enum(HOUSEKEEPING_TASK_TYPES, { error: 'Choose a task type' }),
      priority: z.enum(TASK_PRIORITIES, { error: 'Choose a priority' }),
      scheduledDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose the date'),
      notes: z
        .string()
        .trim()
        .max(200, 'At most 200 characters')
        .optional()
        .transform((v) => v || undefined),
    })
    .superRefine((task, ctx) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(task.scheduledDate) && task.scheduledDate < earliestDate) {
        ctx.addIssue({ code: 'custom', path: ['scheduledDate'], message: `Schedule on or after ${formatDate(earliestDate)}` })
      }
    }, unlessFailed('scheduledDate'))
}

export type HousekeepingTaskFormValues = z.input<ReturnType<typeof housekeepingTaskSchema>>
