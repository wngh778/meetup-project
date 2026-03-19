import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ScheduleClient from './ScheduleClient'

export default async function SchedulePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [boothsResult, slotsResult, buyerResult] = await Promise.all([
    supabase.from('booths').select('*').eq('is_active', true).order('id'),
    supabase.from('time_slots').select('*').order('sort_order'),
    supabase.from('buyers').select('*').eq('id', user.id).single(),
  ])

  return (
    <ScheduleClient
      userId={user.id}
      booths={boothsResult.data ?? []}
      timeSlots={slotsResult.data ?? []}
      buyer={buyerResult.data}
    />
  )
}
