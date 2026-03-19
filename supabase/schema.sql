-- ============================================================
-- 비즈매칭 플랫폼 DB 스키마
-- Supabase SQL Editor에서 순서대로 실행하세요
-- ============================================================

-- 1. 부스 테이블 (셀러 고정, 10개)
CREATE TABLE IF NOT EXISTS booths (
  id          SERIAL PRIMARY KEY,
  seller_name TEXT NOT NULL,
  description TEXT,
  contact     TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true
);

-- 2. 시간 슬롯 테이블 (10개 고정)
CREATE TABLE IF NOT EXISTS time_slots (
  id         SERIAL PRIMARY KEY,
  slot_label TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time   TIME NOT NULL,
  sort_order INT NOT NULL
);

-- 3. 바이어 프로필 (auth.users 1:1)
CREATE TABLE IF NOT EXISTS buyers (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  phone        TEXT NOT NULL,
  email        TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. 예약 테이블
CREATE TABLE IF NOT EXISTS bookings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id     UUID NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
  booth_id     INT  NOT NULL REFERENCES booths(id),
  time_slot_id INT  NOT NULL REFERENCES time_slots(id),
  status       TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 중복 방지 인덱스 (partial unique - confirmed 상태만)
CREATE UNIQUE INDEX IF NOT EXISTS uq_booth_slot_confirmed
  ON bookings (booth_id, time_slot_id)
  WHERE status = 'confirmed';

CREATE UNIQUE INDEX IF NOT EXISTS uq_buyer_slot_confirmed
  ON bookings (buyer_id, time_slot_id)
  WHERE status = 'confirmed';

-- ============================================================
-- RLS 정책
-- ============================================================

ALTER TABLE buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE booths ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- buyers
CREATE POLICY "buyers_select_own" ON buyers FOR SELECT USING (auth.uid() = id);
CREATE POLICY "buyers_insert_own" ON buyers FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "buyers_update_own" ON buyers FOR UPDATE USING (auth.uid() = id);

-- booths (로그인 사용자 전체 읽기)
CREATE POLICY "booths_select" ON booths FOR SELECT USING (auth.uid() IS NOT NULL);

-- time_slots (로그인 사용자 전체 읽기)
CREATE POLICY "time_slots_select" ON time_slots FOR SELECT USING (auth.uid() IS NOT NULL);

-- bookings
CREATE POLICY "bookings_select_all" ON bookings FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "bookings_insert_own" ON bookings FOR INSERT WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "bookings_update_own" ON bookings FOR UPDATE USING (auth.uid() = buyer_id);

-- ============================================================
-- 시드 데이터
-- ============================================================

-- 부스 10개 (셀러 회사명은 나중에 수정)
INSERT INTO booths (id, seller_name, description) VALUES
  (1,  '셀러 A사', NULL),
  (2,  '셀러 B사', NULL),
  (3,  '셀러 C사', NULL),
  (4,  '셀러 D사', NULL),
  (5,  '셀러 E사', NULL),
  (6,  '셀러 F사', NULL),
  (7,  '셀러 G사', NULL),
  (8,  '셀러 H사', NULL),
  (9,  '셀러 I사', NULL),
  (10, '셀러 J사', NULL)
ON CONFLICT (id) DO NOTHING;

-- 시간 슬롯 10개 (10:00~18:00, 30분 세션 + 10분 휴식, 점심 13:00~14:00)
INSERT INTO time_slots (id, slot_label, start_time, end_time, sort_order) VALUES
  (1,  'Slot 1',  '10:00', '10:30', 1),
  (2,  'Slot 2',  '10:40', '11:10', 2),
  (3,  'Slot 3',  '11:20', '11:50', 3),
  (4,  'Slot 4',  '12:00', '12:30', 4),
  (5,  'Slot 5',  '14:00', '14:30', 5),
  (6,  'Slot 6',  '14:40', '15:10', 6),
  (7,  'Slot 7',  '15:20', '15:50', 7),
  (8,  'Slot 8',  '16:00', '16:30', 8),
  (9,  'Slot 9',  '16:40', '17:10', 9),
  (10, 'Slot 10', '17:20', '17:50', 10)
ON CONFLICT (id) DO NOTHING;
