'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { adminCancelBooking } from '@/lib/database'
import type { Booth, TimeSlot, Booking, Buyer } from '@/types'

interface Props {
  booths: Booth[]
  timeSlots: TimeSlot[]
  initialBookings: Booking[]
  buyers: Buyer[]
}

type Tab = 'grid' | 'buyers' | 'stats'

export default function AdminClient({ booths, timeSlots, initialBookings, buyers }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('grid')
  const [bookings, setBookings] = useState<Booking[]>(initialBookings)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const loadBookings = useCallback(async () => {
    const { data } = await supabase
      .from('bookings')
      .select('*, booths(*), time_slots(*), buyers(*)')
      .eq('status', 'confirmed')
      .order('time_slot_id')
    setBookings(data ?? [])
  }, [supabase])

  useEffect(() => {
    const channel = supabase
      .channel('admin-bookings-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        loadBookings()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, loadBookings])

  async function handleCancel(bookingId: string) {
    if (!confirm('Cancel this meeting?')) return
    try {
      await adminCancelBooking(bookingId)
      showToast('Meeting cancelled.', 'success')
      await loadBookings()
    } catch {
      showToast('Failed to cancel meeting.', 'error')
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  // Stats computation
  const totalBookings = bookings.length
  const totalSlots = booths.length * timeSlots.length
  const fillRate = totalSlots > 0 ? Math.round((totalBookings / totalSlots) * 100) : 0

  const boothStats = booths.map(booth => {
    const count = bookings.filter(b => b.booth_id === booth.id).length
    return { booth, count, rate: Math.round((count / timeSlots.length) * 100) }
  })

  const buyerBookingMap = new Map<string, Booking[]>()
  bookings.forEach(b => {
    const arr = buyerBookingMap.get(b.buyer_id) ?? []
    arr.push(b)
    buyerBookingMap.set(b.buyer_id, arr)
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gray-900 text-white sticky top-0 z-10">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-base font-bold">Admin Dashboard</h1>
            <span className="text-xs bg-yellow-400 text-gray-900 px-2 py-0.5 rounded font-medium">ADMIN</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="/schedule" className="text-sm text-gray-300 hover:text-white transition-colors">
              View Schedule
            </a>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-300 hover:text-white transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 flex gap-0">
          {([
            { id: 'grid', label: 'Booking Grid' },
            { id: 'buyers', label: `Buyers (${buyers.length})` },
            { id: 'stats', label: 'Statistics' },
          ] as { id: Tab; label: string }[]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500">Total Bookings</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{totalBookings}</p>
            <p className="text-xs text-gray-400 mt-1">of {totalSlots} total slots</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500">Overall Fill Rate</p>
            <p className="text-3xl font-bold text-blue-600 mt-1">{fillRate}%</p>
            <div className="mt-2 bg-gray-100 rounded-full h-1.5">
              <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${fillRate}%` }} />
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500">Registered Buyers</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{buyers.length}</p>
            <p className="text-xs text-gray-400 mt-1">companies</p>
          </div>
        </div>

        {/* Tab content */}
        {tab === 'grid' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 bg-gray-50 border-b border-gray-200 sticky left-0 w-28">
                    Time
                  </th>
                  {booths.map(booth => (
                    <th key={booth.id} className="px-3 py-3 text-center text-xs font-medium text-gray-700 bg-gray-50 border-b border-l border-gray-200 min-w-[130px]">
                      <div className="font-semibold">Booth {booth.id}</div>
                      <div className="text-gray-400 font-normal truncate">{booth.seller_name}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeSlots.map(slot => (
                  <tr key={slot.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-600 bg-gray-50 border-t border-gray-200 sticky left-0 whitespace-nowrap">
                      <div className="font-medium">{slot.start_time.slice(0, 5)}</div>
                      <div className="text-gray-400">~ {slot.end_time.slice(0, 5)}</div>
                    </td>
                    {booths.map(booth => {
                      const booking = bookings.find(
                        b => b.booth_id === booth.id && b.time_slot_id === slot.id
                      )
                      return (
                        <td key={booth.id} className="px-3 py-2 border-t border-l border-gray-200 text-center">
                          {booking ? (
                            <div className="bg-blue-50 rounded-lg p-1.5">
                              <div className="text-xs font-medium text-blue-800 truncate">
                                {booking.buyers?.company_name}
                              </div>
                              <div className="text-xs text-blue-500 truncate">
                                {booking.buyers?.contact_name}
                              </div>
                              <button
                                onClick={() => handleCancel(booking.id)}
                                className="text-xs text-red-400 hover:text-red-600 mt-0.5 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'buyers' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Company</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Bookings</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Booked Slots</th>
                </tr>
              </thead>
              <tbody>
                {buyers.map(buyer => {
                  const myBookings = buyerBookingMap.get(buyer.id) ?? []
                  return (
                    <tr key={buyer.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{buyer.company_name}</td>
                      <td className="px-4 py-3 text-gray-600">{buyer.contact_name}</td>
                      <td className="px-4 py-3 text-gray-600">{buyer.phone}</td>
                      <td className="px-4 py-3 text-gray-600">{buyer.email}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          myBookings.length > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {myBookings.length}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {myBookings.length === 0 ? '—' : myBookings.map(b =>
                          `Booth ${b.booth_id} (${b.time_slots?.start_time?.slice(0, 5)})`
                        ).join(', ')}
                      </td>
                    </tr>
                  )
                })}
                {buyers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                      No buyers registered yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'stats' && (
          <div className="grid grid-cols-2 gap-6">
            {/* Booth stats */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Bookings per Booth</h3>
              <div className="space-y-3">
                {boothStats.map(({ booth, count, rate }) => (
                  <div key={booth.id}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-700 font-medium">Booth {booth.id} · {booth.seller_name}</span>
                      <span className="text-gray-500">{count}/{timeSlots.length} ({rate}%)</span>
                    </div>
                    <div className="bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all"
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Slot stats */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Bookings per Time Slot</h3>
              <div className="space-y-3">
                {timeSlots.map(slot => {
                  const count = bookings.filter(b => b.time_slot_id === slot.id).length
                  const rate = Math.round((count / booths.length) * 100)
                  return (
                    <div key={slot.id}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-700 font-medium">
                          {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                        </span>
                        <span className="text-gray-500">{count}/{booths.length} ({rate}%)</span>
                      </div>
                      <div className="bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-emerald-500 h-2 rounded-full transition-all"
                          style={{ width: `${rate}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl text-sm font-medium shadow-lg z-50 ${
          toast.type === 'success' ? 'bg-gray-900 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
