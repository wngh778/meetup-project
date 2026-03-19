export interface Booth {
  id: number
  seller_name: string
  description: string | null
  contact: string | null
  is_active: boolean
}

export interface TimeSlot {
  id: number
  slot_label: string
  start_time: string
  end_time: string
  sort_order: number
}

export interface Buyer {
  id: string
  company_name: string
  contact_name: string
  phone: string
  email: string
  role: 'buyer' | 'admin'
  created_at: string
  updated_at: string
}

export interface Booking {
  id: string
  buyer_id: string
  booth_id: number
  time_slot_id: number
  status: 'confirmed' | 'cancelled'
  created_at: string
  updated_at: string
  booths?: Booth
  time_slots?: TimeSlot
  buyers?: Buyer
}
