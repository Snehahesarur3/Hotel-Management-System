import { zodResolver } from '@hookform/resolvers/zod'
import { useId } from 'react'
import { useForm, type Path } from 'react-hook-form'
import { Button } from '@/components/common/Button'
import { Field, PrefixedInput, SelectInput, TextInput } from '@/components/common/FormControls'
import { Modal } from '@/components/common/Modal'
import { useSaveInventoryItem, useSuppliers } from '@/hooks/useInventory'
import { inventoryItemSchema, type InventoryItemFormValues } from '@/schemas/inventory'
import type { ApiError } from '@/types/api'
import { INVENTORY_CATEGORIES } from '@/types/enums'
import type { InventoryItemInput, InventoryItemView } from '@/types/inventory'
import { enumLabel } from '@/utils/format'

interface InventoryItemFormModalProps {
  open: boolean
  item?: InventoryItemView
  onClose: () => void
}

export function InventoryItemFormModal(props: InventoryItemFormModalProps) {
  if (!props.open) return null
  return <ItemForm key={props.item?.id ?? 'new'} {...props} />
}

function ItemForm({ item, onClose }: InventoryItemFormModalProps) {
  const formId = useId()
  const supplierListId = useId()
  const suppliers = useSuppliers()
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isDirty },
  } = useForm<InventoryItemFormValues, unknown, InventoryItemInput>({
    resolver: zodResolver(inventoryItemSchema),
    defaultValues: item
      ? { name: item.name, category: item.category, unit: item.unit, quantity: item.quantity, minStockLevel: item.minStockLevel, unitCost: item.unitCost, supplier: item.supplier }
      : {
          name: '',
          category: 'LINEN',
          unit: 'pcs',
          quantity: 0,
          minStockLevel: Number.NaN,
          unitCost: Number.NaN,
          supplier: { name: '', contactPerson: '', phone: '', email: '' },
        },
  })
  const mutation = useSaveInventoryItem({
    onDone: onClose,
    onError: (error: ApiError) => {
      const entries = Object.entries(error.fieldErrors ?? {})
      entries.forEach(([field, message]) => setError(field as Path<InventoryItemFormValues>, { message }))
      return entries.length > 0
    },
  })
  const onSubmit = handleSubmit((input) => mutation.mutate({ id: item?.id, input }))

  /** Picking a known supplier fills in the contact details. */
  const onSupplierChange = (name: string) => {
    const known = suppliers.data?.find((s) => s.name === name)
    if (!known) return
    setValue('supplier.contactPerson', known.contactPerson, { shouldDirty: true })
    setValue('supplier.phone', known.phone, { shouldDirty: true })
    setValue('supplier.email', known.email, { shouldDirty: true })
  }
  const supplierErrors = errors.supplier

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!mutation.isPending}
      size="lg"
      title={item ? `Edit ${item.name}` : 'Add inventory item'}
      description={item ? 'Stock on hand changes only through stock-in and stock-out.' : 'Opening stock is recorded as the first stock movement.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={mutation.isPending} disabled={Boolean(item) && !isDirty}>
            {item ? 'Save changes' : 'Add item'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-6">
        <Field label="Item name" required error={errors.name?.message} className="sm:col-span-4">
          {(a) => <TextInput {...a} autoComplete="off" invalid={Boolean(errors.name)} {...register('name')} />}
        </Field>
        <Field label="Unit" required error={errors.unit?.message} className="sm:col-span-2">
          {(a) => <TextInput {...a} autoComplete="off" placeholder="pcs, bottles, kg…" invalid={Boolean(errors.unit)} {...register('unit')} />}
        </Field>
        <Field label="Category" required error={errors.category?.message} className="sm:col-span-2">
          {(a) => (
            <SelectInput {...a} invalid={Boolean(errors.category)} {...register('category')}>
              {INVENTORY_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {enumLabel(c)}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>
        {!item && (
          <Field label="Opening stock" required error={errors.quantity?.message} className="sm:col-span-2">
            {(a) => <TextInput {...a} type="number" inputMode="numeric" min={0} step={1} invalid={Boolean(errors.quantity)} {...register('quantity', { valueAsNumber: true })} />}
          </Field>
        )}
        <Field label="Reorder level" required error={errors.minStockLevel?.message} hint="Alert at or below" className="sm:col-span-2">
          {(a) => <TextInput {...a} type="number" inputMode="numeric" min={0} step={1} invalid={Boolean(errors.minStockLevel)} {...register('minStockLevel', { valueAsNumber: true })} />}
        </Field>
        <Field label="Unit cost" required error={errors.unitCost?.message} className="sm:col-span-2">
          {(a) => <PrefixedInput {...a} prefix="₹" type="number" inputMode="decimal" min={0.01} step={0.01} invalid={Boolean(errors.unitCost)} {...register('unitCost', { valueAsNumber: true })} />}
        </Field>

        <fieldset className="grid grid-cols-1 gap-4 border-t border-line pt-4 sm:col-span-6 sm:grid-cols-2">
          <legend className="sr-only">Supplier</legend>
          <p className="text-sm font-semibold text-ink sm:col-span-2">Supplier</p>
          <Field label="Supplier name" required error={supplierErrors?.name?.message}>
            {(a) => (
              <>
                <TextInput
                  {...a}
                  list={supplierListId}
                  autoComplete="off"
                  invalid={Boolean(supplierErrors?.name)}
                  {...register('supplier.name', { onChange: (e) => onSupplierChange(e.target.value) })}
                />
                <datalist id={supplierListId}>
                  {suppliers.data?.map((s) => (
                    <option key={s.name} value={s.name} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
          <Field label="Contact person" required error={supplierErrors?.contactPerson?.message}>
            {(a) => <TextInput {...a} autoComplete="off" invalid={Boolean(supplierErrors?.contactPerson)} {...register('supplier.contactPerson')} />}
          </Field>
          <Field label="Supplier phone" required error={supplierErrors?.phone?.message}>
            {(a) => <TextInput {...a} type="tel" autoComplete="off" invalid={Boolean(supplierErrors?.phone)} {...register('supplier.phone')} />}
          </Field>
          <Field label="Supplier email" required error={supplierErrors?.email?.message}>
            {(a) => <TextInput {...a} type="email" autoComplete="off" invalid={Boolean(supplierErrors?.email)} {...register('supplier.email')} />}
          </Field>
        </fieldset>
      </form>
    </Modal>
  )
}
