import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminClient from './AdminClient'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: buyer } = await supabase
    .from('buyers')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!buyer || buyer.role !== 'admin') redirect('/schedule')

  const [boothsResult, slotsResult, bookingsResult, buyersResult] = await Promise.all([
    supabase.from('booths').select('*').eq('is_active', true).order('id'),
    supabase.from('time_slots').select('*').order('sort_order'),
    supabase.from('bookings').select('*, booths(*), time_slots(*), buyers(*)').eq('status', 'confirmed').order('time_slot_id'),
    supabase.from('buyers').select('*').neq('role', 'admin').order('created_at'),
  ])

  return (
    <AdminClient
      booths={boothsResult.data ?? []}
      timeSlots={slotsResult.data ?? []}
      initialBookings={bookingsResult.data ?? []}
      buyers={buyersResult.data ?? []}
    />
  )
}
