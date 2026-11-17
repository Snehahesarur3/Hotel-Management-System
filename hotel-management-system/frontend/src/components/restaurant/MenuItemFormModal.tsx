import { zodResolver } from '@hookform/resolvers/zod'
import { useId } from 'react'
import { useForm, type Path } from 'react-hook-form'
import { Button } from '@/components/common/Button'
import { Field, PrefixedInput, SelectInput, TextInput } from '@/components/common/FormControls'
import { Modal } from '@/components/common/Modal'
import { useSaveMenuItem } from '@/hooks/useRestaurant'
import { menuItemSchema, type MenuItemFormValues } from '@/schemas/restaurant'
import type { ApiError } from '@/types/api'
import { MENU_CATEGORIES } from '@/types/enums'
import type { MenuItemInput, MenuItemView } from '@/types/restaurant'
import { enumLabel } from '@/utils/format'

interface MenuItemFormModalProps {
  open: boolean
  item?: MenuItemView
  onClose: () => void
}

export function MenuItemFormModal(props: MenuItemFormModalProps) {
  if (!props.open) return null
  return <MenuItemForm key={props.item?.id ?? 'new'} {...props} />
}

function MenuItemForm({ item, onClose }: MenuItemFormModalProps) {
  const formId = useId()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<MenuItemFormValues, unknown, MenuItemInput>({
    resolver: zodResolver(menuItemSchema),
    defaultValues: item
      ? { name: item.name, category: item.category, price: item.price, isVegetarian: item.isVegetarian, available: item.available }
      : { name: '', category: 'MAIN_COURSE', price: Number.NaN, isVegetarian: true, available: true },
  })
  const mutation = useSaveMenuItem({
    onDone: onClose,
    onError: (error: ApiError) => {
      const entries = Object.entries(error.fieldErrors ?? {})
      entries.forEach(([field, message]) => setError(field as Path<MenuItemFormValues>, { message }))
      return entries.length > 0
    },
  })
  const onSubmit = handleSubmit((input) => mutation.mutate({ id: item?.id, input }))

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!mutation.isPending}
      title={item ? `Edit ${item.name}` : 'Add dish'}
      description={item ? 'Price changes apply to new orders only.' : 'New dishes can be ordered straight away if available.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={mutation.isPending} disabled={Boolean(item) && !isDirty}>
            {item ? 'Save changes' : 'Add dish'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name" required error={errors.name?.message} className="sm:col-span-2">
          {(a) => <TextInput {...a} autoComplete="off" invalid={Boolean(errors.name)} {...register('name')} />}
        </Field>
        <Field label="Course" required error={errors.category?.message}>
          {(a) => (
            <SelectInput {...a} invalid={Boolean(errors.category)} {...register('category')}>
              {MENU_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {enumLabel(c)}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>
        <Field label="Price" required error={errors.price?.message} hint="Before 5% GST">
          {(a) => (
            <PrefixedInput {...a} prefix="₹" type="number" inputMode="decimal" min={10} step={0.01} invalid={Boolean(errors.price)} {...register('price', { valueAsNumber: true })} />
          )}
        </Field>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" className="size-4 accent-brand-600" {...register('isVegetarian')} />
          Vegetarian
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" className="size-4 accent-brand-600" {...register('available')} />
          Available to order
        </label>
      </form>
    </Modal>
  )
}
