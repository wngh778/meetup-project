import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin-client'
import AdminClient from './AdminClient'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // 본인 role 확인 (일반 client 사용 - 자기 row는 볼 수 있음)
  const { data: buyer } = await supabase
    .from('buyers')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!buyer || buyer.role !== 'admin') redirect('/schedule')

  // 전체 데이터 조회 시 RLS 우회를 위해 admin client 사용
  const adminSupabase = createAdminClient()

  const [boothsResult, slotsResult, bookingsResult, buyersResult] = await Promise.all([
    adminSupabase.from('booths').select('*').eq('is_active', true).order('id'),
    adminSupabase.from('time_slots').select('*').order('sort_order'),
    adminSupabase.from('bookings').select('*, booths(*), time_slots(*), buyers(*)').eq('status', 'confirmed').order('time_slot_id'),
    adminSupabase.from('buyers').select('*').neq('role', 'admin').order('created_at'),
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
