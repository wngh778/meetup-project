'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createBooking, cancelBooking, getMyBookings } from '@/lib/database'
import type { Booth, TimeSlot, Booking, Buyer } from '@/types'

interface Props {
  userId: string
  booths: Booth[]
  timeSlots: TimeSlot[]
  buyer: Buyer | null
}

type CellState = 'available' | 'mine' | 'taken' | 'conflict'

function getCellState(
  boothId: number,
  slotId: number,
  myId: string,
  bookings: Booking[]
): CellState {
  const booking = bookings.find(b => b.booth_id === boothId && b.time_slot_id === slotId)

  if (!booking) {
    // 이 슬롯에 내가 이미 다른 부스를 신청했는지 확인
    const mySlotBooking = bookings.find(b => b.time_slot_id === slotId && b.buyer_id === myId)
    if (mySlotBooking) return 'conflict'
    return 'available'
  }

  if (booking.buyer_id === myId) return 'mine'
  return 'taken'
}

export default function ScheduleClient({ userId, booths, timeSlots, buyer }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [bookings, setBookings] = useState<Booking[]>([])
  const [myBookings, setMyBookings] = useState<Booking[]>([])
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [processing, setProcessing] = useState<string | null>(null)

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const loadBookings = useCallback(async () => {
    const { data } = await supabase
      .from('bookings')
      .select('*')
      .eq('status', 'confirmed')
    setBookings(data ?? [])
  }, [supabase])

  const loadMyBookings = useCallback(async () => {
    const data = await getMyBookings(userId)
    setMyBookings(data)
  }, [userId])

  useEffect(() => {
    loadBookings()
    loadMyBookings()

    const channel = supabase
      .channel('bookings-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        loadBookings()
        loadMyBookings()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, loadBookings, loadMyBookings])

  async function handleCellClick(boothId: number, slotId: number) {
    const cellKey = `${boothId}-${slotId}`
    if (processing) return
    const state = getCellState(boothId, slotId, userId, bookings)

    if (state === 'taken' || state === 'conflict') return

    setProcessing(cellKey)
    try {
      if (state === 'mine') {
        // 취소
        const booking = bookings.find(b => b.booth_id === boothId && b.time_slot_id === slotId)
        if (!booking) return
        await cancelBooking(booking.id, userId)
        showToast('예약이 취소되었습니다.', 'success')
      } else {
        // 신청
        const result = await createBooking(userId, boothId, slotId)
        if (!result.success) {
          showToast(result.error ?? '오류가 발생했습니다.', 'error')
        } else {
          showToast('미팅이 신청되었습니다!', 'success')
        }
      }
      await loadBookings()
      await loadMyBookings()
    } finally {
      setProcessing(null)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-full px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">비즈매칭 신청</h1>
            {buyer && (
              <p className="text-xs text-gray-500">{buyer.company_name} · {buyer.contact_name}</p>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* 범례 */}
      <div className="max-w-full px-4 py-3 flex items-center gap-4 text-xs text-gray-600 bg-white border-b border-gray-100">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-white border border-gray-300" />
          <span>신청 가능</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-blue-500" />
          <span>내 예약 (클릭 시 취소)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-gray-300" />
          <span>마감</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-amber-100 border border-amber-300" />
          <span>같은 시간 신청됨</span>
        </div>
      </div>

      <div className="flex">
        {/* 스케줄 그리드 */}
        <div className="flex-1 overflow-x-auto p-4">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-28 px-3 py-2 text-left text-xs font-medium text-gray-500 bg-gray-50 border border-gray-200 sticky left-0">
                  시간
                </th>
                {booths.map(booth => (
                  <th
                    key={booth.id}
                    className="px-2 py-2 text-center text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 min-w-[110px]"
                  >
                    <div className="font-semibold">부스 {booth.id}</div>
                    <div className="text-gray-500 font-normal truncate">{booth.seller_name}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeSlots.map(slot => (
                <tr key={slot.id}>
                  <td className="px-3 py-2 text-xs text-gray-600 bg-gray-50 border border-gray-200 sticky left-0 whitespace-nowrap">
                    <div className="font-medium">{slot.start_time.slice(0, 5)}</div>
                    <div className="text-gray-400">~ {slot.end_time.slice(0, 5)}</div>
                  </td>
                  {booths.map(booth => {
                    const state = getCellState(booth.id, slot.id, userId, bookings)
                    const cellKey = `${booth.id}-${slot.id}`
                    const isProcessing = processing === cellKey

                    const cellClass = {
                      available: 'bg-white hover:bg-blue-50 cursor-pointer',
                      mine: 'bg-blue-500 text-white cursor-pointer hover:bg-blue-600',
                      taken: 'bg-gray-200 text-gray-400 cursor-not-allowed',
                      conflict: 'bg-amber-50 text-amber-400 cursor-not-allowed border-amber-200',
                    }[state]

                    return (
                      <td
                        key={booth.id}
                        className={`px-2 py-2 border border-gray-200 text-center transition-colors ${cellClass} ${isProcessing ? 'opacity-60' : ''}`}
                        onClick={() => handleCellClick(booth.id, slot.id)}
                      >
                        {state === 'mine' && (
                          <span className="text-xs font-medium">신청됨</span>
                        )}
                        {state === 'taken' && (
                          <span className="text-xs">마감</span>
                        )}
                        {state === 'available' && (
                          <span className="text-xs text-gray-400">신청</span>
                        )}
                        {state === 'conflict' && (
                          <span className="text-xs">-</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 내 예약 사이드바 */}
        <div className="w-64 shrink-0 border-l border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">내 예약 ({myBookings.length}건)</h2>
          {myBookings.length === 0 ? (
            <p className="text-xs text-gray-400">아직 신청한 미팅이 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {myBookings.map(booking => (
                <li
                  key={booking.id}
                  className="p-2.5 rounded-lg bg-blue-50 border border-blue-100"
                >
                  <div className="text-xs font-medium text-blue-800">
                    부스 {booking.booth_id} · {booking.booths?.seller_name}
                  </div>
                  <div className="text-xs text-blue-600 mt-0.5">
                    {booking.time_slots?.start_time?.slice(0, 5)} ~ {booking.time_slots?.end_time?.slice(0, 5)}
                  </div>
                  <button
                    onClick={() => handleCellClick(booking.booth_id, booking.time_slot_id)}
                    className="text-xs text-red-500 hover:text-red-700 mt-1 transition-colors"
                  >
                    취소
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* 토스트 */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl text-sm font-medium shadow-lg transition-all z-50 ${
            toast.type === 'success'
              ? 'bg-gray-900 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  )
}
