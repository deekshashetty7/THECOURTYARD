-- MySQL schema for Courtyard
-- Run this on your MySQL database before starting the backend.

CREATE TABLE IF NOT EXISTS profiles (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(50) NULL,
  password_hash VARCHAR(255) NULL,
  email_verified TINYINT(1) NOT NULL DEFAULT 0,
  verified_at DATETIME(3) NULL,
  app_role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
);

CREATE TABLE IF NOT EXISTS settings (
  `key` VARCHAR(100) PRIMARY KEY,
  pricing JSON NOT NULL,
  courts JSON NOT NULL,
  operating_hours JSON NOT NULL,
  booking_disabled TINYINT(1) NOT NULL DEFAULT 0,
  landing JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
);

CREATE TABLE IF NOT EXISTS gallery (
  id VARCHAR(191) PRIMARY KEY,
  url TEXT NOT NULL,
  caption TEXT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
);

CREATE TABLE IF NOT EXISTS court_blocks (
  id CHAR(36) PRIMARY KEY,
  block_date DATE NOT NULL,
  block_type ENUM('day', 'hour') NOT NULL DEFAULT 'day',
  courts JSON NOT NULL,
  all_courts TINYINT(1) NOT NULL DEFAULT 0,
  time_slot VARCHAR(255) NULL,
  time_slot_key VARCHAR(100) NULL,
  reason TEXT NULL,
  created_by VARCHAR(255) NULL,
  created_by_name VARCHAR(255) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_court_blocks_date (block_date),
  INDEX idx_court_blocks_date_time (block_date, time_slot_key)
);

CREATE TABLE IF NOT EXISTS bookings (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  court_name VARCHAR(255) NOT NULL,
  booking_date DATE NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  status ENUM('upcoming', 'completed', 'cancelled') NOT NULL DEFAULT 'upcoming',
  payment_id VARCHAR(255) NULL,
  payment_status VARCHAR(50) NULL,
  idempotency_key VARCHAR(191) NULL UNIQUE,
  cancelled_at DATETIME(3) NULL,
  cancel_reason TEXT NULL,
  user_name VARCHAR(255) NULL,
  user_email VARCHAR(255) NULL,
  user_phone VARCHAR(50) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_bookings_user_id (user_id),
  INDEX idx_bookings_date (booking_date),
  INDEX idx_bookings_status (status)
);

CREATE TABLE IF NOT EXISTS booking_slots (
  id CHAR(36) PRIMARY KEY,
  booking_id CHAR(36) NOT NULL,
  slot_id VARCHAR(191) NOT NULL,
  slot_time VARCHAR(255) NOT NULL,
  slot_time_key VARCHAR(100) NOT NULL,
  court INT NOT NULL,
  booking_date DATE NOT NULL,
  price DECIMAL(12,2) NOT NULL,
  status ENUM('available', 'booked', 'selected') NOT NULL DEFAULT 'booked',
  locked_by_subscription_id CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_booking_slot (booking_id, slot_id),
  INDEX idx_booking_slots_conflict (booking_date, court, slot_time_key, status)
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  court_name VARCHAR(255) NOT NULL,
  court INT NOT NULL,
  time_slot VARCHAR(255) NOT NULL,
  time_slot_key VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  weekdays_count INT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  status ENUM('active', 'expired', 'cancelled', 'paused') NOT NULL DEFAULT 'active',
  payment_id VARCHAR(255) NULL,
  payment_status VARCHAR(50) NULL,
  idempotency_key VARCHAR(191) NULL UNIQUE,
  locked_dates JSON NOT NULL,
  cancelled_at DATETIME(3) NULL,
  paused_at DATETIME(3) NULL,
  paused_original_end_date DATE NULL,
  resumed_at DATETIME(3) NULL,
  user_name VARCHAR(255) NULL,
  user_email VARCHAR(255) NULL,
  user_phone VARCHAR(50) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_subscriptions_user_id (user_id),
  INDEX idx_subscriptions_conflict (court, time_slot_key, start_date, end_date, status)
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NULL,
  subject VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'new',
  admin_reply TEXT NULL,
  admin_reply_by VARCHAR(255) NULL,
  admin_reply_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_contact_email (email),
  INDEX idx_contact_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS reviews (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  rating TINYINT NOT NULL,
  comment TEXT NOT NULL,
  review_date DATE NOT NULL,
  admin_reply TEXT NULL,
  admin_reply_by VARCHAR(255) NULL,
  admin_reply_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_reviews_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS email_verifications (
  email VARCHAR(255) PRIMARY KEY,
  token TEXT NOT NULL,
  expiry_time DATETIME(3) NOT NULL,
  verified TINYINT(1) NOT NULL DEFAULT 0,
  verified_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);

CREATE TABLE IF NOT EXISTS otp_tokens (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(255) NULL,
  phone VARCHAR(50) NULL,
  otp_code VARCHAR(6) NOT NULL,
  otp_type ENUM('email', 'phone') NOT NULL,
  is_verified TINYINT(1) NOT NULL DEFAULT 0,
  verification_attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  expiry_time DATETIME(3) NOT NULL,
  verified_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_otp_email (email),
  INDEX idx_otp_phone (phone),
  INDEX idx_otp_type (otp_type),
  INDEX idx_otp_expiry (expiry_time)
);

CREATE TABLE IF NOT EXISTS registration_pending (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  email_otp_verified TINYINT(1) NOT NULL DEFAULT 0,
  phone_otp_verified TINYINT(1) NOT NULL DEFAULT 0,
  email_otp_id CHAR(36) NULL,
  phone_otp_id CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at DATETIME(3) NOT NULL,
  INDEX idx_registration_email (email),
  INDEX idx_registration_phone (phone),
  INDEX idx_registration_expires (expires_at)
);

INSERT INTO settings (`key`, pricing, courts, operating_hours, booking_disabled, landing)
VALUES (
  'default',
  JSON_OBJECT('offPeak', 500, 'peak', 800, 'subscription', 2500),
  JSON_ARRAY('Court 1', 'Court 2', 'Court 3'),
  JSON_OBJECT('startHour', 5, 'endHour', 22),
  0,
  JSON_OBJECT()
)
ON DUPLICATE KEY UPDATE `key` = `key`;
