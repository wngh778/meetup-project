import { createClient } from '@/lib/supabase/client'
import type { Booking, Buyer } from '@/types'

const supabase = createClient()

export async function upsertBuyer(
  uid: string,
  profile: { company_name: string; contact_name: string; phone: string; email: string }
) {
  const { error } = await supabase
    .from('buyers')
    .upsert({ id: uid, ...profile, updated_at: new Date().toISOString() }, { onConflict: 'id' })
  if (error) throw error
}

export async function getBuyer(uid: string): Promise<Buyer | null> {
  const { data, error } = await supabase.from('buyers').select('*').eq('id', uid).single()
  if (error) return null
  return data
}

export async function getAllBookings(): Promise<Booking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('status', 'confirmed')
  if (error) throw error
  return data ?? []
}

export async function getMyBookings(buyerId: string): Promise<Booking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, booths(*), time_slots(*)')
    .eq('buyer_id', buyerId)
    .eq('status', 'confirmed')
    .order('time_slot_id')
  if (error) throw error
  return data ?? []
}

export async function createBooking(
  buyerId: string,
  boothId: number,
  timeSlotId: number
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('bookings').insert({
    buyer_id: buyerId,
    booth_id: boothId,
    time_slot_id: timeSlotId,
    status: 'confirmed',
  })

  if (error) {
    if (error.code === '23505') {
      if (error.message.includes('uq_booth_slot_confirmed')) {
        return { success: false, error: '이미 다른 분이 신청한 시간대입니다.' }
      }
      if (error.message.includes('uq_buyer_slot_confirmed')) {
        return { success: false, error: '같은 시간대에 이미 다른 부스를 신청하셨습니다.' }
      }
    }
    return { success: false, error: '예약에 실패했습니다. 잠시 후 다시 시도해주세요.' }
  }

  return { success: true }
}

export async function cancelBooking(bookingId: string, buyerId: string): Promise<void> {
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', bookingId)
    .eq('buyer_id', buyerId)
  if (error) throw error
}
