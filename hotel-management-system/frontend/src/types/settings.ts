export type { GstSlab, HotelSettings } from './domain'

/**
 * PUT /api/settings: the editable part of the settings, the hotel profile and the check-in/check-out times.
 * Currency, time zone and GST rates are fixed: bills are calculated from them, so changing a rate would silently
 * change invoices that were already issued.
 */
export interface SettingsInput {
  name: string
  address: string
  phone: string
  email: string
  gstin: string
  checkInTime: string
  checkOutTime: string
}
