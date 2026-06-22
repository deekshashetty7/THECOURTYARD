const crypto = require('crypto');
const bcryptjs = require('bcryptjs');
const { createPool } = require('mysql2/promise');
const { ApiError } = require('./middleware');
const { env } = require('./config');
const {
  buildDailySlots,
  getSubscriptionWeekdays,
  isWeekday,
  normalizeTimeRange,
  toUtcDateKey,
} = require('./lib');

const DEFAULT_SETTINGS = {
  key: 'default',
  pricing: { offPeak: 500, peak: 800, subscription: 2500 },
  courts: ['Court 1', 'Court 2', 'Court 3'],
  operating_hours: { startHour: 5, endHour: 22 },
  bookingDisabled: false,
  landing: {},
};

const DEFAULT_GALLERY = [
  {
    id: 'gallery-1',
    url: '/img1.jpg',
    caption: 'Professional court lighting',
  },
  {
    id: 'gallery-2',
    url: '/im2.jpg',
    caption: 'Premium playing surface',
  },
  {
    id: 'gallery-3',
    url: '/img3.webp',
    caption: 'Ready for competitive play',
  },
  {
    id: 'gallery-4',
    url: '/img4.webp',
    caption: 'Weekend training sessions',
  },
  {
    id: 'gallery-5',
    url: '/img5.jpg',
    caption: 'High energy match nights',
  },
];

let pool = null;

async function ensureProfilesColumns() {
  const wanted = ['password_hash', 'email_verified', 'verified_at', 'app_role'];

  const rows = await runQuery(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'profiles'
        AND COLUMN_NAME IN (?, ?, ?, ?)
    `,
    wanted
  );

  const existing = new Set((rows || []).map(r => String(r.COLUMN_NAME).toLowerCase()));

  // Add password_hash if missing
  if (!existing.has('password_hash')) {
    await runQuery('ALTER TABLE profiles ADD COLUMN password_hash VARCHAR(255) NULL AFTER phone');
  }

  // Add email_verified if missing
  if (!existing.has('email_verified')) {
    await runQuery('ALTER TABLE profiles ADD COLUMN email_verified TINYINT(1) NOT NULL DEFAULT 0 AFTER password_hash');
  }

  // Add verified_at if missing
  if (!existing.has('verified_at')) {
    await runQuery('ALTER TABLE profiles ADD COLUMN verified_at DATETIME(3) NULL AFTER email_verified');
  }

  // Add app_role if missing
  if (!existing.has('app_role')) {
    await runQuery("ALTER TABLE profiles ADD COLUMN app_role ENUM('user','admin') NOT NULL DEFAULT 'user' AFTER verified_at");
  }
}

async function ensureOtpTables() {
  await runQuery(`
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
    )
  `);

  await runQuery(`
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
    )
  `);
}

async function ensureSubscriptionsPaymentStatusColumn() {
  const rows = await runQuery(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'subscriptions'
        AND COLUMN_NAME = 'payment_status'
    `
  );

  if (!(rows || []).length) {
    await runQuery('ALTER TABLE subscriptions ADD COLUMN payment_status VARCHAR(50) NULL AFTER payment_id');
  }
}

async function repairCancelledBookingSlots() {
  try {
    const result = await runQuery(
      `UPDATE booking_slots bs
       INNER JOIN bookings b ON b.id = bs.booking_id
       SET bs.status = 'available'
       WHERE b.status = 'cancelled' AND bs.status = 'booked'`
    );
    if (result?.affectedRows > 0) {
      console.log(`Repaired ${result.affectedRows} slot(s) left booked after cancellation`);
    }
  } catch (error) {
    console.warn('Unable to repair cancelled booking slots:', error instanceof Error ? error.message : error);
  }
}

async function initializeMysqlSchema() {
  await ensureProfilesColumns();
  await ensureSubscriptionsPaymentStatusColumn();
  await ensureOtpTables();
  await repairCancelledBookingSlots();
}

function buildPoolOptions() {
  if (env.mysqlUrl) {
    return {
      uri: env.mysqlUrl,
      connectionLimit: 10,
      waitForConnections: true,
      dateStrings: true,
      decimalNumbers: true,
      timezone: 'Z',
    };
  }

  return {
    host: env.mysqlHost,
    port: env.mysqlPort || 3306,
    user: env.mysqlUser,
    password: env.mysqlPassword,
    database: env.mysqlDatabase,
    connectionLimit: 10,
    waitForConnections: true,
    dateStrings: true,
    decimalNumbers: true,
    timezone: 'Z',
  };
}

function getPool() {
  if (!pool) {
    if (!env.mysqlUrl && !(env.mysqlHost && env.mysqlUser && env.mysqlDatabase)) {
      throw new Error('MySQL is not configured. Set MYSQL_URL or MYSQL_HOST, MYSQL_USER, MYSQL_DATABASE.');
    }

    pool = createPool(buildPoolOptions());
  }

  return pool;
}

async function runQuery(sql, params = [], connection = null) {
  const executor = connection || getPool();
  const [rows] = await executor.execute(sql, params);
  return rows;
}

function toJson(value, fallback = null) {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value === 'object') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function toJsonString(value, fallback = null) {
  if (value === null || value === undefined) {
    return fallback;
  }

  return JSON.stringify(value);
}

function isoNow() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function mapSettingsRow(row) {
  return {
    key: row.key,
    pricing: toJson(row.pricing, DEFAULT_SETTINGS.pricing),
    courts: toJson(row.courts, DEFAULT_SETTINGS.courts),
    operatingHours: toJson(row.operating_hours, DEFAULT_SETTINGS.operating_hours),
    bookingDisabled: Boolean(row.booking_disabled),
    landing: toJson(row.landing, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCourtBlockRow(row) {
  return {
    id: row.id,
    date: String(row.block_date || ''),
    blockType: row.block_type === 'hour' ? 'hour' : 'day',
    courts: toJson(row.courts, []).map((court) => Number(court)).filter((court) => Number.isInteger(court) && court > 0),
    allCourts: Boolean(row.all_courts),
    timeSlot: row.time_slot || null,
    timeSlotKey: row.time_slot_key || null,
    reason: row.reason || null,
    createdBy: row.created_by || null,
    createdByName: row.created_by_name || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isWithinInclusiveRange(dateKey, startDate, endDate) {
  if (!dateKey || !startDate || !endDate) {
    return false;
  }

  const target = new Date(`${dateKey}T12:00:00.000Z`).getTime();
  const start = new Date(`${startDate}T12:00:00.000Z`).getTime();
  const end = new Date(`${endDate}T12:00:00.000Z`).getTime();

  if (Number.isNaN(target) || Number.isNaN(start) || Number.isNaN(end)) {
    return false;
  }

  return target >= start && target <= end;
}

function addWeekdaysToDateKey(dateKey, weekdayCount) {
  const current = new Date(`${dateKey}T12:00:00.000Z`);
  let remaining = Math.max(0, Number(weekdayCount || 0));

  while (remaining > 0) {
    current.setUTCDate(current.getUTCDate() + 1);
    const day = current.getUTCDay();
    if (day !== 0 && day !== 6) {
      remaining -= 1;
    }
  }

  return current.toISOString().slice(0, 10);
}

function normalizeCourtSelection(courts, settings) {
  const maxCourts = Array.isArray(settings?.courts) ? settings.courts.length : 0;
  const allCourts = Array.from({ length: maxCourts }, (_, index) => index + 1);

  if (!Array.isArray(courts) || !courts.length) {
    return allCourts;
  }

  const selected = Array.from(new Set(courts.map((court) => Number(court)).filter((court) => Number.isInteger(court) && court >= 1 && court <= maxCourts)));
  return selected.length ? selected : allCourts;
}

function isCourtBlockApplicableToSlot(courtBlock, dateKey, courtNumber, slotTimeKey) {
  if (!courtBlock || courtBlock.date !== dateKey) {
    return false;
  }

  const blockCourts = Array.isArray(courtBlock.courts) ? courtBlock.courts : [];
  const isCourtIncluded = courtBlock.allCourts === true || blockCourts.includes(Number(courtNumber));
  if (!isCourtIncluded) {
    return false;
  }

  if (courtBlock.blockType === 'day') {
    return true;
  }

  const blockTimeKey = String(courtBlock.timeSlotKey || normalizeTimeRange(courtBlock.timeSlot || '')).trim();
  return Boolean(blockTimeKey) && blockTimeKey === String(slotTimeKey || '').trim();
}

function isCourtBlockApplicableToSubscription(courtBlock, subscription, dateKey) {
  if (!courtBlock || !subscription) {
    return false;
  }

  if (!isWithinInclusiveRange(dateKey, subscription.startDate, subscription.endDate)) {
    return false;
  }

  if (!isWeekday(dateKey)) {
    return false;
  }

  const blockCourts = Array.isArray(courtBlock.courts) ? courtBlock.courts : [];
  const isCourtIncluded = courtBlock.allCourts === true || blockCourts.includes(Number(subscription.court));

  if (!isCourtIncluded) {
    return false;
  }

  if (courtBlock.blockType === 'day') {
    return true;
  }

  const blockTimeKey = String(courtBlock.timeSlotKey || normalizeTimeRange(courtBlock.timeSlot || '')).trim();
  const subscriptionTimeKey = String(normalizeTimeRange(subscription.timeSlot || '')).trim();
  return Boolean(blockTimeKey) && blockTimeKey === subscriptionTimeKey;
}

function mapGalleryRow(row) {
  return {
    id: row.id,
    url: String(row.url || '').trim(),
    caption: String(row.caption || '').trim(),
    sortOrder: Number(row.sort_order || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapContactMessageRow(row) {
  return {
    id: row.id,
    name: String(row.name || '').trim(),
    email: String(row.email || '').trim().toLowerCase(),
    phone: String(row.phone || '').trim() || null,
    subject: String(row.subject || '').trim(),
    message: String(row.message || '').trim(),
    status: String(row.status || 'new').trim(),
    adminReply: row.admin_reply || null,
    adminReplyBy: row.admin_reply_by || null,
    adminReplyAt: row.admin_reply_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapReviewRow(row) {
  return {
    id: row.id,
    userId: row.user_id || null,
    name: String(row.name || 'Anonymous').trim(),
    email: String(row.email || '').trim().toLowerCase(),
    rating: Number(row.rating || 0),
    comment: String(row.comment || '').trim(),
    date: String(row.review_date || String(row.created_at || '').slice(0, 10)),
    adminReply: row.admin_reply || null,
    adminReplyBy: row.admin_reply_by || null,
    adminReplyAt: row.admin_reply_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapVerificationRow(row) {
  return {
    email: String(row.email || '').trim().toLowerCase(),
    token: String(row.token || ''),
    expiryTime: row.expiry_time,
    verified: Boolean(row.verified),
    verifiedAt: row.verified_at || null,
    createdAt: row.created_at,
  };
}

function mapSlotInput(slot, fallbackDate) {
  const dateKey = toUtcDateKey(slot.date || fallbackDate);
  const normalizedTimeKey = normalizeTimeRange(slot.time);

  if (!normalizedTimeKey) {
    throw new ApiError(400, `Invalid time format: "${slot.time}". Expected format: "H:MM AM/PM - H:MM AM/PM" (e.g., "5:00 AM - 6:00 AM")`);
  }

  return {
    slot_id: slot.slotId || slot.id || `${dateKey}-${slot.court}-${crypto.randomUUID().slice(0, 8)}`,
    slot_time: slot.time,
    slot_time_key: normalizedTimeKey,
    court: Number(slot.court),
    booking_date: dateKey,
    price: Number(slot.price || 0),
    status: 'booked',
  };
}

function generateBookingId() {
  const suffix = String(Date.now()).slice(-6);
  return `CY-${suffix}`;
}

function generateSubscriptionId() {
  const suffix = String(Date.now()).slice(-6);
  return `CS-${suffix}`;
}

function resolvePaymentMethod(paymentId, paymentStatus) {
  const normalized = String(paymentId || '').toUpperCase();
  if (normalized.startsWith('ONSITE')) {
    return 'onsite';
  }
  if (paymentStatus === 'pending' && !normalized) {
    return 'onsite';
  }
  return 'online';
}

function mapBookingRow(row, slotRows) {
  return {
    id: row.id,
    userId: row.user_id,
    courtName: row.court_name,
    date: row.booking_date,
    slots: slotRows
      .filter((slot) => slot.booking_id === row.id)
      .map((slot) => ({
        id: slot.slot_id,
        time: slot.slot_time,
        court: slot.court,
        date: slot.booking_date,
        price: Number(slot.price),
        status: slot.status,
      })),
    totalAmount: Number(row.total_amount),
    status: row.status,
    paymentId: row.payment_id,
    paymentMethod: resolvePaymentMethod(row.payment_id, row.payment_status),
    paymentStatus: row.payment_status || null,
    createdAt: row.created_at,
    userName: row.user_name,
    userEmail: row.user_email,
    userPhone: row.user_phone,
  };
}

function mapSubscriptionRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    courtName: row.court_name,
    court: Number(row.court),
    timeSlot: row.time_slot,
    startDate: row.start_date,
    endDate: row.end_date,
    weekdaysCount: Number(row.weekdays_count || 0),
    amount: Number(row.amount || 0),
    status: row.status,
    paymentId: row.payment_id,
    paymentMethod: resolvePaymentMethod(row.payment_id, row.payment_status),
    paymentStatus: row.payment_status || (String(row.payment_id || '').toUpperCase().startsWith('ONSITE') ? 'pending' : 'paid'),
    createdAt: row.created_at,
    userName: row.user_name,
    userEmail: row.user_email,
    userPhone: row.user_phone,
    pausedAt: row.paused_at || null,
    pausedOriginalEndDate: row.paused_original_end_date || null,
    resumedAt: row.resumed_at || null,
  };
}

async function ensureSettingsRow(connection = null) {
  const rows = await runQuery('SELECT * FROM settings WHERE `key` = ? LIMIT 1', ['default'], connection);
  if (rows.length) {
    return rows[0];
  }

  await runQuery(
    'INSERT INTO settings (`key`, pricing, courts, operating_hours, booking_disabled, landing, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(3), NOW(3))',
    [
      'default',
      toJsonString(DEFAULT_SETTINGS.pricing),
      toJsonString(DEFAULT_SETTINGS.courts),
      toJsonString(DEFAULT_SETTINGS.operating_hours),
      0,
      toJsonString({}),
    ],
    connection
  );

  const inserted = await runQuery('SELECT * FROM settings WHERE `key` = ? LIMIT 1', ['default'], connection);
  return inserted[0];
}

async function getAppSettings() {
  const row = await ensureSettingsRow();
  return mapSettingsRow(row);
}

async function updateAppSettings(payload) {
  const current = await ensureSettingsRow();
  const currentSettings = mapSettingsRow(current);
  const next = {
    pricing: payload.pricing ? { ...currentSettings.pricing, ...payload.pricing } : currentSettings.pricing,
    courts: Array.isArray(payload.courts) && payload.courts.length ? payload.courts : currentSettings.courts,
    operatingHours: payload.operatingHours
      ? { ...currentSettings.operatingHours, ...payload.operatingHours }
      : currentSettings.operatingHours,
    bookingDisabled: typeof payload.bookingDisabled === 'boolean' ? payload.bookingDisabled : Boolean(currentSettings.bookingDisabled),
    landing: payload.landing ? { ...currentSettings.landing, ...payload.landing } : currentSettings.landing,
  };

  await runQuery(
    'UPDATE settings SET pricing = ?, courts = ?, operating_hours = ?, booking_disabled = ?, landing = ?, updated_at = NOW(3) WHERE `key` = ?',
    [toJsonString(next.pricing), toJsonString(next.courts), toJsonString(next.operatingHours), next.bookingDisabled ? 1 : 0, toJsonString(next.landing), 'default']
  );

  const updated = await ensureSettingsRow();
  return mapSettingsRow({ ...updated, pricing: toJsonString(next.pricing), courts: toJsonString(next.courts), operating_hours: toJsonString(next.operatingHours), booking_disabled: next.bookingDisabled ? 1 : 0, landing: toJsonString(next.landing) });
}

async function getGalleryImages(limit) {
  const normalizedLimit = Number.parseInt(String(limit || ''), 10);
  const rows = Number.isFinite(normalizedLimit) && normalizedLimit > 0
    ? await runQuery('SELECT * FROM gallery ORDER BY sort_order ASC LIMIT ?', [normalizedLimit])
    : await runQuery('SELECT * FROM gallery ORDER BY sort_order ASC');
  return rows.map(mapGalleryRow).filter((item) => item.url);
}

async function replaceGalleryImages(items) {
  const normalizedItems = Array.isArray(items)
    ? items
        .map((item, index) => ({
          id: String(item?.id || `gallery-${Date.now()}-${index}`).trim(),
          url: String(item?.url || '').trim(),
          caption: String(item?.caption || '').trim(),
          sortOrder: index,
        }))
        .filter((item) => item.url)
    : [];

  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute('DELETE FROM gallery');

    for (const item of normalizedItems) {
      await connection.execute(
        'INSERT INTO gallery (id, url, caption, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(3), NOW(3))',
        [item.id, item.url, item.caption, item.sortOrder]
      );
    }

    await connection.execute(
      'UPDATE settings SET landing = JSON_SET(COALESCE(landing, JSON_OBJECT()), \'$.gallery\', CAST(? AS JSON)), updated_at = NOW(3) WHERE `key` = \'default\'',
      [JSON.stringify(normalizedItems.map((item) => ({ id: item.id, url: item.url, caption: item.caption })))]
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return normalizedItems.map((item) => ({ id: item.id, url: item.url, caption: item.caption, sortOrder: item.sortOrder }));
}

async function deleteGalleryImage(imageId, imageUrl, imageCaption, imageIndex) {
  const currentGallery = await getGalleryImages();
  const normalizeValue = (value) => String(value || '').trim().toLowerCase();
  const normalizeUrl = (value) => {
    const raw = String(value || '').trim();
    if (!raw) {
      return '';
    }

    try {
      const parsed = new URL(raw);
      return `${parsed.origin}${parsed.pathname}`.toLowerCase();
    } catch {
      return raw.toLowerCase();
    }
  };

  const targetId = normalizeValue(imageId);
  const targetUrl = normalizeUrl(imageUrl);
  const targetCaption = normalizeValue(imageCaption);

  const nextGallery = currentGallery.filter((item, index) => {
    const itemId = normalizeValue(item.id);
    const itemUrl = normalizeUrl(item.url);
    const itemCaption = normalizeValue(item.caption);

    if (Number.isInteger(imageIndex) && imageIndex >= 0 && index === imageIndex) {
      return false;
    }

    if (targetId && itemId === targetId) {
      return false;
    }

    if (targetUrl && itemUrl === targetUrl) {
      return false;
    }

    if (targetCaption && itemCaption === targetCaption) {
      return false;
    }

    return true;
  });

  await replaceGalleryImages(nextGallery);
  return nextGallery;
}

async function listCourtBlocks() {
  const rows = await runQuery('SELECT * FROM court_blocks ORDER BY created_at DESC');
  return rows.map(mapCourtBlockRow);
}

async function createCourtBlockRecord(payload, authUser) {
  if (!authUser?.sub || authUser.role !== 'admin') {
    throw new ApiError(403, 'Forbidden');
  }

  const settings = await getAppSettings();
  const rawDate = String(payload?.date || '').trim();
  const parsedDate = new Date(rawDate);
  if (!rawDate || Number.isNaN(parsedDate.getTime())) {
    throw new ApiError(400, 'A valid date is required');
  }

  const dateKey = toUtcDateKey(parsedDate);
  const blockType = String(payload?.blockType || 'day').toLowerCase() === 'hour' ? 'hour' : 'day';
  const courts = normalizeCourtSelection(payload?.courts, settings);
  if (!courts.length) {
    throw new ApiError(400, 'At least one court is required');
  }

  let timeSlot = null;
  let timeSlotKey = null;
  if (blockType === 'hour') {
    timeSlot = String(payload?.timeSlot || '').trim();
    if (!timeSlot) {
      throw new ApiError(400, 'timeSlot is required for hour blocks');
    }
    timeSlotKey = normalizeTimeRange(timeSlot);
  }

  const reason = String(payload?.reason || '').trim();
  const blockRecord = {
    date: dateKey,
    blockType,
    courts,
    allCourts: courts.length === settings.courts.length,
    timeSlot,
    timeSlotKey,
  };
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const blockId = crypto.randomUUID();
    await connection.execute(
      'INSERT INTO court_blocks (id, block_date, block_type, courts, all_courts, time_slot, time_slot_key, reason, created_by, created_by_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))',
      [blockId, dateKey, blockType, JSON.stringify(courts), blockRecord.allCourts ? 1 : 0, timeSlot, timeSlotKey, reason || null, authUser.sub, authUser.name || authUser.email || 'Admin']
    );

    const [subRows] = await connection.execute('SELECT * FROM subscriptions WHERE status = \'active\'');
    const affectedSubscriptions = (subRows || [])
      .filter((sub) => isCourtBlockApplicableToSubscription(blockRecord, { court: Number(sub.court), timeSlot: sub.time_slot, startDate: sub.start_date, endDate: sub.end_date }, dateKey));

    for (const sub of affectedSubscriptions) {
      const nextEnd = addWeekdaysToDateKey(sub.end_date, 1);
      const nextWeekdays = Number(sub.weekdays_count || 0) + 1;
      await connection.execute('UPDATE subscriptions SET end_date = ?, weekdays_count = ?, updated_at = NOW(3) WHERE id = ?', [nextEnd, nextWeekdays, sub.id]);
    }

    await connection.commit();

    const createdRows = await runQuery('SELECT * FROM court_blocks WHERE id = ? LIMIT 1', [blockId]);
    return { block: mapCourtBlockRow(createdRows[0]), affectedSubscriptions: affectedSubscriptions.length };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function deleteCourtBlock(blockId, authUser) {
  if (!authUser?.sub || authUser.role !== 'admin') {
    throw new ApiError(403, 'Forbidden');
  }

  if (!blockId) {
    throw new ApiError(400, 'blockId is required');
  }

  await runQuery('DELETE FROM court_blocks WHERE id = ?', [blockId]);
  return { id: blockId };
}

async function getAvailability(date, court) {
  if (!date || !court) {
    throw new ApiError(400, 'date and court are required');
  }

  const settings = await getAppSettings();
  const dateKey = toUtcDateKey(date);
  const courtNumber = Number(court);
  const allSlots = buildDailySlots(dateKey, courtNumber, settings.pricing, settings.operatingHours.startHour, settings.operatingHours.endHour);

  const bookedRows = await runQuery(
    'SELECT slot_time_key FROM booking_slots WHERE booking_date = ? AND court = ? AND status = \'booked\'',
    [dateKey, courtNumber]
  );
  const blockedKeys = new Set((bookedRows || []).map((row) => row.slot_time_key));

  const blockRows = await runQuery('SELECT * FROM court_blocks WHERE block_date = ?', [dateKey]);
  for (const row of blockRows || []) {
    const block = mapCourtBlockRow(row);
    for (const slot of allSlots) {
      if (isCourtBlockApplicableToSlot(block, dateKey, courtNumber, normalizeTimeRange(slot.time))) {
        blockedKeys.add(normalizeTimeRange(slot.time));
      }
    }
  }

  if (isWeekday(dateKey)) {
    const subRows = await runQuery(
      'SELECT time_slot_key FROM subscriptions WHERE court = ? AND status = \'active\' AND start_date <= ? AND end_date >= ?',
      [courtNumber, dateKey, dateKey]
    );

    for (const row of subRows || []) {
      blockedKeys.add(row.time_slot_key);
    }
  }

  return allSlots.map((slot) => ({
    ...slot,
    status: blockedKeys.has(normalizeTimeRange(slot.time)) ? 'booked' : 'available',
  }));
}

async function assertNoSlotConflicts(connection, slots) {
  for (const slot of slots) {
    const booked = await runQuery(
      'SELECT id FROM booking_slots WHERE booking_date = ? AND court = ? AND slot_time_key = ? AND status = \'booked\' LIMIT 1',
      [slot.booking_date, slot.court, slot.slot_time_key],
      connection
    );

    if (booked.length) {
      throw new ApiError(409, `Slot ${slot.slot_time} on ${slot.booking_date} is already booked`);
    }

    if (!isWeekday(slot.booking_date)) {
      continue;
    }

    const subscriptionConflict = await runQuery(
      'SELECT id, start_date, end_date FROM subscriptions WHERE court = ? AND time_slot_key = ? AND status = \'active\' AND start_date <= ? AND end_date >= ? LIMIT 1',
      [slot.court, slot.slot_time_key, slot.booking_date, slot.booking_date],
      connection
    );

    if (subscriptionConflict.length) {
      throw new ApiError(409, `Slot ${slot.slot_time} on ${slot.booking_date} is blocked by a subscription`);
    }

    const blocks = await runQuery('SELECT * FROM court_blocks WHERE block_date = ?', [slot.booking_date], connection);
    const courtBlocks = (blocks || []).map(mapCourtBlockRow);
    const blockConflict = courtBlocks.find((block) => isCourtBlockApplicableToSlot(block, slot.booking_date, slot.court, slot.slot_time_key));
    if (blockConflict) {
      throw new ApiError(409, `Slot ${slot.slot_time} on ${slot.booking_date} is blocked by a court block`);
    }
  }
}

async function createBookingRecord({ userId, userName, userEmail, userPhone, courtName, date, slots, totalAmount, paymentId, status = 'upcoming', paymentStatus = 'paid', idempotencyKey, source = 'user-app' }) {
  if (!userId) {
    throw new ApiError(401, 'Authentication required');
  }

  if (!Array.isArray(slots) || !slots.length) {
    throw new ApiError(400, 'At least one slot is required');
  }

  const settings = await getAppSettings();
  if (settings.bookingDisabled && source !== 'admin-desk') {
    throw new ApiError(403, 'Bookings are temporarily paused by the admin');
  }

  const dateKey = toUtcDateKey(date);
  const normalizedSlots = slots.map((slot) => mapSlotInput(slot, dateKey));

  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();

    if (idempotencyKey) {
      const existing = await runQuery('SELECT * FROM bookings WHERE idempotency_key = ? LIMIT 1', [idempotencyKey], connection);
      if (existing.length) {
        const existingSlots = await runQuery('SELECT * FROM booking_slots WHERE booking_id = ?', [existing[0].id], connection);
        await connection.rollback();
        return mapBookingRow(existing[0], existingSlots);
      }
    }

    await assertNoSlotConflicts(connection, normalizedSlots);

    const bookingId = generateBookingId();
    await connection.execute(
      'INSERT INTO bookings (id, user_id, court_name, booking_date, total_amount, status, payment_id, payment_status, idempotency_key, user_name, user_email, user_phone, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))',
      [bookingId, userId, courtName, dateKey, Number(totalAmount), status, paymentId || null, paymentStatus || null, idempotencyKey || null, userName || null, userEmail || null, userPhone || null]
    );

    for (const slot of normalizedSlots) {
      await connection.execute(
        'INSERT INTO booking_slots (id, booking_id, slot_id, slot_time, slot_time_key, court, booking_date, price, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, \'booked\', NOW(3))',
        [crypto.randomUUID(), bookingId, slot.slot_id, slot.slot_time, slot.slot_time_key, slot.court, slot.booking_date, slot.price]
      );
    }

    await connection.commit();

    const bookingRows = await runQuery('SELECT * FROM bookings WHERE id = ? LIMIT 1', [bookingId]);
    const slotRows = await runQuery('SELECT * FROM booking_slots WHERE booking_id = ?', [bookingId]);
    return mapBookingRow(bookingRows[0], slotRows);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function listBookings(user, filters = {}) {
  let sql = 'SELECT * FROM bookings';
  const params = [];

  if (user.role !== 'admin') {
    sql += ' WHERE user_id = ?';
    params.push(user.sub);
  }

  if (filters.status) {
    sql += params.length ? ' AND status = ?' : ' WHERE status = ?';
    params.push(filters.status);
  }

  if (filters.date) {
    sql += params.length ? ' AND booking_date = ?' : ' WHERE booking_date = ?';
    params.push(toUtcDateKey(filters.date));
  }

  sql += ' ORDER BY created_at DESC';

  const bookings = await runQuery(sql, params);
  if (!bookings.length) {
    return [];
  }

  const bookingIds = bookings.map((booking) => booking.id);
  const placeholders = bookingIds.map(() => '?').join(',');
  const slots = await runQuery(`SELECT * FROM booking_slots WHERE booking_id IN (${placeholders})`, bookingIds);
  return bookings.map((booking) => mapBookingRow(booking, slots || []));
}

async function getBookingById(user, bookingId) {
  const rows = await runQuery('SELECT * FROM bookings WHERE id = ? LIMIT 1', [bookingId]);
  if (!rows.length) {
    throw new ApiError(404, 'Booking not found');
  }

  const booking = rows[0];
  if (user.role !== 'admin' && booking.user_id !== user.sub) {
    throw new ApiError(403, 'Forbidden');
  }

  const slots = await runQuery('SELECT * FROM booking_slots WHERE booking_id = ?', [booking.id]);
  return mapBookingRow(booking, slots || []);
}

async function cancelBooking(user, bookingId, reason = 'Cancelled by user') {
  const booking = await getBookingById(user, bookingId);
  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();
    await connection.execute(
      'UPDATE bookings SET status = \'cancelled\', cancelled_at = NOW(3), cancel_reason = ?, updated_at = NOW(3) WHERE id = ?',
      [reason, booking.id]
    );
    await connection.execute(
      'UPDATE booking_slots SET status = \'available\' WHERE booking_id = ?',
      [booking.id]
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return {
    ...booking,
    status: 'cancelled',
    slots: booking.slots.map((slot) => ({ ...slot, status: 'available' })),
    cancelledAt: new Date().toISOString(),
    cancelReason: reason,
  };
}

async function updateBooking(user, bookingId, updates = {}) {
  const booking = await getBookingById(user, bookingId);
  if (!Object.prototype.hasOwnProperty.call(updates, 'paymentStatus')) {
    return booking;
  }

  await runQuery('UPDATE bookings SET payment_status = ?, updated_at = NOW(3) WHERE id = ?', [updates.paymentStatus, booking.id]);
  return { ...booking, paymentStatus: updates.paymentStatus, updatedAt: new Date().toISOString() };
}

async function createSubscriptionRecord({ userId, userName, userEmail, userPhone, courtName, court, timeSlot, startDate, endDate, weekdaysCount, amount, paymentId, status = 'active', idempotencyKey, source = 'user-app' }) {
  if (!userId) {
    throw new ApiError(401, 'Authentication required');
  }

  const settings = await getAppSettings();
  if (settings.bookingDisabled && source !== 'admin-desk') {
    throw new ApiError(403, 'Subscriptions are temporarily paused by the admin');
  }

  const normalizedStart = toUtcDateKey(startDate);
  const normalizedEnd = toUtcDateKey(endDate);
  if (!isWeekday(normalizedStart)) {
    throw new ApiError(400, 'Subscription start date must be a weekday');
  }

  const timeKey = normalizeTimeRange(timeSlot);
  const weekdayDates = getSubscriptionWeekdays(normalizedStart, normalizedEnd);
  const courtNumber = Number(court);

  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();

    for (const dateKey of weekdayDates) {
      const bookingConflict = await runQuery(
        'SELECT id FROM booking_slots WHERE booking_date = ? AND court = ? AND slot_time_key = ? AND status = \'booked\' LIMIT 1',
        [dateKey, courtNumber, timeKey],
        connection
      );
      if (bookingConflict.length) {
        throw new ApiError(409, `Slot occupied on ${dateKey}, please choose a different slot/date range`);
      }

      const blockRows = await runQuery('SELECT * FROM court_blocks WHERE block_date = ?', [dateKey], connection);
      const blockConflict = (blockRows || []).map(mapCourtBlockRow).find((block) => isCourtBlockApplicableToSubscription(block, { court: courtNumber, timeSlot, startDate: normalizedStart, endDate: normalizedEnd }, dateKey));
      if (blockConflict) {
        throw new ApiError(409, `Slot occupied on ${dateKey}, please choose a different slot/date range`);
      }
    }

    const subOverlap = await runQuery(
      'SELECT id, start_date, end_date FROM subscriptions WHERE court = ? AND time_slot_key = ? AND status = \'active\' AND start_date <= ? AND end_date >= ?',
      [courtNumber, timeKey, normalizedEnd, normalizedStart],
      connection
    );
    if (subOverlap.length) {
      throw new ApiError(409, `Slot occupied on ${subOverlap[0].start_date}, please choose a different slot/date range`);
    }

    if (idempotencyKey) {
      const existing = await runQuery('SELECT * FROM subscriptions WHERE idempotency_key = ? LIMIT 1', [idempotencyKey], connection);
      if (existing.length) {
        await connection.rollback();
        return mapSubscriptionRow(existing[0]);
      }
    }

    const id = generateSubscriptionId();
    const resolvedPaymentStatus = String(paymentId || '').toUpperCase().startsWith('ONSITE') ? 'pending' : 'paid';
    await connection.execute(
      'INSERT INTO subscriptions (id, user_id, court_name, court, time_slot, time_slot_key, start_date, end_date, weekdays_count, amount, status, payment_id, payment_status, idempotency_key, locked_dates, user_name, user_email, user_phone, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))',
      [id, userId, courtName, courtNumber, timeSlot, timeKey, normalizedStart, normalizedEnd, weekdaysCount, Number(amount), status, paymentId || null, resolvedPaymentStatus, idempotencyKey || null, JSON.stringify(weekdayDates), userName || null, userEmail || null, userPhone || null]
    );

    await connection.commit();

    const rows = await runQuery('SELECT * FROM subscriptions WHERE id = ? LIMIT 1', [id]);
    return mapSubscriptionRow(rows[0]);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function listSubscriptions(user, filters = {}) {
  let sql = 'SELECT * FROM subscriptions';
  const params = [];

  if (user.role !== 'admin') {
    sql += ' WHERE user_id = ?';
    params.push(user.sub);
  }

  if (filters.status) {
    sql += params.length ? ' AND status = ?' : ' WHERE status = ?';
    params.push(filters.status);
  }

  if (filters.court) {
    sql += params.length ? ' AND court = ?' : ' WHERE court = ?';
    params.push(Number(filters.court));
  }

  sql += ' ORDER BY created_at DESC';
  const rows = await runQuery(sql, params);
  return rows.map(mapSubscriptionRow);
}

async function getSubscriptionById(user, subscriptionId) {
  const rows = await runQuery('SELECT * FROM subscriptions WHERE id = ? LIMIT 1', [subscriptionId]);
  if (!rows.length) {
    throw new ApiError(404, 'Subscription not found');
  }

  if (user.role !== 'admin' && rows[0].user_id !== user.sub) {
    throw new ApiError(403, 'Forbidden');
  }

  return mapSubscriptionRow(rows[0]);
}

async function cancelSubscription(user, subscriptionId) {
  const subscription = await getSubscriptionById(user, subscriptionId);
  await runQuery('UPDATE subscriptions SET status = \'cancelled\', cancelled_at = NOW(3), updated_at = NOW(3) WHERE id = ?', [subscription.id]);
  return { ...subscription, status: 'cancelled', cancelledAt: new Date().toISOString() };
}

async function updateSubscription(user, subscriptionId, updates = {}) {
  const subscription = await getSubscriptionById(user, subscriptionId);
  const changes = {};

  if (typeof updates.status === 'string') {
    changes.status = updates.status;
    if (updates.status === 'paused') {
      changes.paused_at = isoNow();
      changes.paused_original_end_date = subscription.endDate;
    } else if (updates.status === 'active') {
      if (subscription.pausedAt) {
        const pausedAt = new Date(subscription.pausedAt);
        const resumedAt = new Date();
        const ms = resumedAt.getTime() - pausedAt.getTime();
        const daysPaused = Math.ceil(ms / (24 * 60 * 60 * 1000));
        if (subscription.pausedOriginalEndDate) {
          const orig = new Date(`${subscription.pausedOriginalEndDate}T00:00:00.000Z`);
          orig.setUTCDate(orig.getUTCDate() + daysPaused);
          changes.end_date = orig.toISOString().slice(0, 10);
        }
      }
      changes.paused_at = null;
      changes.paused_original_end_date = null;
      changes.resumed_at = isoNow();
    } else if (updates.status === 'cancelled') {
      changes.cancelled_at = isoNow();
    }
  }

  if (typeof updates.endDate === 'string' && updates.endDate.trim()) {
    changes.end_date = updates.endDate;
  }

  if (typeof updates.paymentStatus === 'string' && ['paid', 'pending'].includes(updates.paymentStatus)) {
    changes.payment_status = updates.paymentStatus;
  }

  if (!Object.keys(changes).length) {
    return subscription;
  }

  const setClause = Object.keys(changes).map((key) => `${key} = ?`).join(', ');
  await runQuery(`UPDATE subscriptions SET ${setClause}, updated_at = NOW(3) WHERE id = ?`, [...Object.values(changes), subscription.id]);

  const rows = await runQuery('SELECT * FROM subscriptions WHERE id = ? LIMIT 1', [subscription.id]);
  return mapSubscriptionRow(rows[0]);
}

async function getDashboardStats() {
  const [bookingCountRows, activeSubRows, cancelledBookingRows, bookingRevenueRows, subscriptionRevenueRows] = await Promise.all([
    runQuery('SELECT COUNT(*) AS count FROM bookings WHERE status <> \'cancelled\''),
    runQuery('SELECT COUNT(*) AS count FROM subscriptions WHERE status = \'active\''),
    runQuery('SELECT COUNT(*) AS count FROM bookings WHERE status = \'cancelled\''),
    runQuery('SELECT total_amount FROM bookings WHERE status <> \'cancelled\''),
    runQuery('SELECT amount FROM subscriptions WHERE status <> \'cancelled\''),
  ]);

  const bookingRevenue = (bookingRevenueRows || []).reduce((sum, row) => sum + Number(row.total_amount || 0), 0);
  const subscriptionRevenue = (subscriptionRevenueRows || []).reduce((sum, row) => sum + Number(row.amount || 0), 0);

  return {
    totalBookings: Number(bookingCountRows[0]?.count || 0),
    activeSubscriptions: Number(activeSubRows[0]?.count || 0),
    cancelledBookings: Number(cancelledBookingRows[0]?.count || 0),
    totalRevenue: bookingRevenue + subscriptionRevenue,
    bookingRevenue,
    subscriptionRevenue,
  };
}

async function getRevenueSeries(month) {
  const monthKey = month || toUtcDateKey(new Date()).slice(0, 7);
  const startDate = `${monthKey}-01`;
  const startMonth = new Date(`${startDate}T00:00:00.000Z`);
  const endMonth = new Date(Date.UTC(startMonth.getUTCFullYear(), startMonth.getUTCMonth() + 1, 0));
  const endDate = toUtcDateKey(endMonth);

  const bookings = await runQuery(
    'SELECT booking_date AS date, total_amount, status FROM bookings WHERE booking_date >= ? AND booking_date <= ? AND status <> \'cancelled\'',
    [startDate, endDate]
  );
  const subscriptions = await runQuery(
    'SELECT start_date, amount, status FROM subscriptions WHERE start_date <= ? AND end_date >= ? AND status <> \'cancelled\'',
    [endDate, startDate]
  );

  const byDate = new Map();
  for (const booking of bookings || []) {
    const current = byDate.get(booking.date) || { date: booking.date, revenue: 0, bookings: 0 };
    current.revenue += Number(booking.total_amount || 0);
    current.bookings += 1;
    byDate.set(booking.date, current);
  }

  for (const sub of subscriptions || []) {
    const current = byDate.get(sub.start_date) || { date: sub.start_date, revenue: 0, bookings: 0 };
    current.revenue += Number(sub.amount || 0);
    byDate.set(sub.start_date, current);
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function getEffectiveBookingStatusFromRow(row) {
  if (row.status === 'cancelled') {
    return 'cancelled';
  }

  const slotTimeRange = String(row.last_slot_time || '').trim();
  const endTimeStr = slotTimeRange.includes(' - ')
    ? slotTimeRange.split(' - ')[1]?.trim()
    : slotTimeRange;

  if (!endTimeStr || !row.booking_date) {
    return row.status || 'upcoming';
  }

  try {
    const bookingDate = new Date(row.booking_date);
    const timeMatch = endTimeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!timeMatch) {
      return row.status || 'upcoming';
    }

    let hour = parseInt(timeMatch[1], 10);
    const minute = parseInt(timeMatch[2], 10);
    const period = timeMatch[3]?.toUpperCase();

    if (period === 'PM' && hour !== 12) {
      hour += 12;
    } else if (period === 'AM' && hour === 12) {
      hour = 0;
    }

    const bookingEndDateTime = new Date(bookingDate);
    bookingEndDateTime.setHours(hour, minute, 0, 0);

    if (new Date() > bookingEndDateTime) {
      return 'completed';
    }

    return 'upcoming';
  } catch {
    return row.status || 'upcoming';
  }
}

function normalizePhoneDigits(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) {
    return '';
  }

  return digits.length > 10 ? digits.slice(-10) : digits;
}

function userMatchesProfile(item, profile) {
  if (item.user_id === profile.id) {
    return true;
  }

  const profileEmail = String(profile.email || '').trim().toLowerCase();
  const itemEmail = String(item.user_email || '').trim().toLowerCase();
  if (profileEmail && itemEmail && itemEmail === profileEmail) {
    return true;
  }

  const profilePhone = normalizePhoneDigits(profile.phone);
  const itemPhone = normalizePhoneDigits(item.user_phone);
  return Boolean(profilePhone && itemPhone && profilePhone === itemPhone);
}

function buildBookingStatsForUser(bookingRows, profile) {
  const userBookings = (bookingRows || []).filter((item) => userMatchesProfile(item, profile));

  const stats = {
    total: userBookings.length,
    completed: 0,
    upcoming: 0,
    cancelled: 0,
  };

  for (const booking of userBookings) {
    const effectiveStatus = getEffectiveBookingStatusFromRow(booking);
    if (effectiveStatus === 'completed') {
      stats.completed += 1;
    } else if (effectiveStatus === 'cancelled') {
      stats.cancelled += 1;
    } else {
      stats.upcoming += 1;
    }
  }

  return stats;
}

function buildSubscriptionStatsForUser(subscriptionRows, profile) {
  const userSubscriptions = (subscriptionRows || []).filter((item) => userMatchesProfile(item, profile));

  return {
    total: userSubscriptions.length,
    active: userSubscriptions.filter((item) => item.status === 'active').length,
    expired: userSubscriptions.filter((item) => item.status === 'expired').length,
    cancelled: userSubscriptions.filter((item) => item.status === 'cancelled').length,
    paused: userSubscriptions.filter((item) => item.status === 'paused').length,
  };
}

async function listUsers() {
  const [profiles, bookingRows, subscriptions] = await Promise.all([
    runQuery('SELECT id, app_role, name, email, phone, created_at, updated_at FROM profiles'),
    runQuery(`
      SELECT b.id, b.user_id, b.user_email, b.user_phone, b.status, b.booking_date,
        (
          SELECT bs.slot_time
          FROM booking_slots bs
          WHERE bs.booking_id = b.id
          ORDER BY bs.slot_time_key DESC
          LIMIT 1
        ) AS last_slot_time
      FROM bookings b
    `),
    runQuery('SELECT user_id, user_email, status, created_at FROM subscriptions'),
  ]);

  return (profiles || [])
    .map((profile) => {
      const bookingStats = buildBookingStatsForUser(bookingRows, profile);
      const subscriptionStats = buildSubscriptionStatsForUser(subscriptions, profile);
      const activeSubscriptionCount = subscriptionStats.active;

      const status = profile.app_role === 'admin'
        ? 'Admin'
        : activeSubscriptionCount > 0
          ? 'Subscriber'
          : 'Active';

      return {
        id: profile.id,
        name: profile.name || profile.email || 'User',
        email: profile.email || '',
        phone: profile.phone || null,
        role: profile.app_role || 'user',
        status,
        bookings: bookingStats.total,
        bookingStats,
        subscriptions: subscriptionStats.total,
        subscriptionStats,
        joinedAt: profile.created_at,
        updatedAt: profile.updated_at,
      };
    })
    .sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime());
}

async function deleteUser(authUser, userId) {
  if (!authUser?.sub || authUser.role !== 'admin') {
    throw new ApiError(403, 'Forbidden');
  }

  const normalizedUserId = String(userId || '').trim();
  if (!normalizedUserId) {
    throw new ApiError(400, 'User id is required');
  }

  if (normalizedUserId === authUser.sub) {
    throw new ApiError(400, 'You cannot delete your own account');
  }

  const targetUser = await getUserById(normalizedUserId);
  if (!targetUser) {
    throw new ApiError(404, 'User not found');
  }

  if (targetUser.role === 'admin') {
    throw new ApiError(403, 'Admin accounts cannot be deleted');
  }

  const email = String(targetUser.email || '').trim().toLowerCase();
  const phone = String(targetUser.phone || '').trim();
  const bookingRows = await runQuery(
    'SELECT id FROM bookings WHERE user_id = ? OR user_email = ?',
    [normalizedUserId, email]
  );
  const bookingIds = (bookingRows || []).map((row) => row.id);

  if (bookingIds.length) {
    const placeholders = bookingIds.map(() => '?').join(', ');
    await runQuery(`DELETE FROM booking_slots WHERE booking_id IN (${placeholders})`, bookingIds);
  }

  const bookingDeleteResult = await runQuery('DELETE FROM bookings WHERE user_id = ? OR user_email = ?', [normalizedUserId, email]);
  const subscriptionDeleteResult = await runQuery('DELETE FROM subscriptions WHERE user_id = ? OR user_email = ?', [normalizedUserId, email]);
  await runQuery('DELETE FROM reviews WHERE user_id = ?', [normalizedUserId]);

  if (email) {
    await runQuery('DELETE FROM email_verifications WHERE email = ?', [email]);
    await runQuery('DELETE FROM otp_tokens WHERE email = ?', [email]);
    await runQuery('DELETE FROM registration_pending WHERE email = ?', [email]);
  }

  if (phone) {
    await runQuery('DELETE FROM otp_tokens WHERE phone = ?', [phone]);
    await runQuery('DELETE FROM registration_pending WHERE phone = ?', [phone]);
  }

  await runQuery('DELETE FROM profiles WHERE id = ?', [normalizedUserId]);

  return {
    userId: normalizedUserId,
    deleted: true,
    bookingsDeleted: bookingDeleteResult?.affectedRows ?? bookingIds.length,
    subscriptionsDeleted: subscriptionDeleteResult?.affectedRows ?? 0,
  };
}

async function createContactMessage(payload) {
  const name = String(payload?.name || '').trim();
  const email = String(payload?.email || '').trim().toLowerCase();
  const phone = String(payload?.phone || '').trim();
  const subject = String(payload?.subject || '').trim();
  const message = String(payload?.message || '').trim();

  if (!name || !email || !subject || !message) {
    throw new ApiError(400, 'name, email, subject, and message are required');
  }

  const id = crypto.randomUUID();
  await runQuery(
    'INSERT INTO contact_messages (id, name, email, phone, subject, message, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, \'new\', NOW(3), NOW(3))',
    [id, name, email, phone || null, subject, message]
  );
  const rows = await runQuery('SELECT * FROM contact_messages WHERE id = ? LIMIT 1', [id]);
  return mapContactMessageRow(rows[0]);
}

async function listContactMessages() {
  const rows = await runQuery('SELECT * FROM contact_messages ORDER BY created_at DESC');
  return rows.map(mapContactMessageRow);
}

async function listContactMessagesByEmail(email) {
  if (!email || typeof email !== 'string') {
    throw new ApiError(400, 'email is required');
  }

  const rows = await runQuery('SELECT * FROM contact_messages WHERE email = ? ORDER BY created_at DESC', [email.trim().toLowerCase()]);
  return rows.map(mapContactMessageRow);
}

async function replyToContactMessage(messageId, payload, authUser) {
  if (!authUser?.sub || authUser.role !== 'admin') {
    throw new ApiError(403, 'Forbidden');
  }

  const reply = String(payload?.reply || '').trim();
  if (!reply) {
    throw new ApiError(400, 'reply is required');
  }

  await runQuery(
    'UPDATE contact_messages SET admin_reply = ?, admin_reply_by = ?, admin_reply_at = NOW(3), status = \'replied\', updated_at = NOW(3) WHERE id = ?',
    [reply, authUser.name || authUser.email || 'Admin', messageId]
  );
  const rows = await runQuery('SELECT * FROM contact_messages WHERE id = ? LIMIT 1', [messageId]);
  if (!rows.length) {
    throw new ApiError(404, 'Message not found');
  }
  return mapContactMessageRow(rows[0]);
}

async function listReviews(limit) {
  const normalizedLimit = Number.parseInt(String(limit || ''), 10);
  const rows = Number.isFinite(normalizedLimit) && normalizedLimit > 0
    ? await runQuery('SELECT * FROM reviews ORDER BY created_at DESC LIMIT ?', [normalizedLimit])
    : await runQuery('SELECT * FROM reviews ORDER BY created_at DESC');
  return rows.map(mapReviewRow).filter((review) => review.rating >= 1 && review.rating <= 5 && review.comment);
}

async function createReview(payload, authUser) {
  if (!authUser?.sub) {
    throw new ApiError(401, 'Authentication required');
  }

  const rating = Number(payload?.rating || 0);
  const comment = String(payload?.comment || '').trim();

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ApiError(400, 'rating must be an integer between 1 and 5');
  }

  if (!comment) {
    throw new ApiError(400, 'comment is required');
  }

  const id = crypto.randomUUID();
  await runQuery(
    'INSERT INTO reviews (id, user_id, name, email, rating, comment, review_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))',
    [id, authUser.sub, authUser.name || 'User', authUser.email || '', rating, comment, isoNow().slice(0, 10)]
  );
  const rows = await runQuery('SELECT * FROM reviews WHERE id = ? LIMIT 1', [id]);
  return mapReviewRow(rows[0]);
}

async function replyToReview(reviewId, payload, authUser) {
  if (!authUser?.sub || authUser.role !== 'admin') {
    throw new ApiError(403, 'Forbidden');
  }

  const reply = String(payload?.reply || '').trim();
  if (!reply) {
    throw new ApiError(400, 'reply is required');
  }

  await runQuery(
    'UPDATE reviews SET admin_reply = ?, admin_reply_by = ?, admin_reply_at = NOW(3), updated_at = NOW(3) WHERE id = ?',
    [reply, authUser.name || authUser.email || 'Admin', reviewId]
  );
  const rows = await runQuery('SELECT * FROM reviews WHERE id = ? LIMIT 1', [reviewId]);
  if (!rows.length) {
    throw new ApiError(404, 'Review not found');
  }
  return mapReviewRow(rows[0]);
}

async function deleteReview(reviewId, authUser) {
  if (!authUser?.sub || authUser.role !== 'admin') {
    throw new ApiError(403, 'Forbidden');
  }

  await runQuery('DELETE FROM reviews WHERE id = ?', [reviewId]);
  return { id: reviewId };
}

async function storeVerificationToken(email, token, expiryTime) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    throw new ApiError(400, 'email is required');
  }

  await runQuery(
    'INSERT INTO email_verifications (email, token, expiry_time, verified, verified_at, created_at) VALUES (?, ?, ?, 0, NULL, NOW(3)) ON DUPLICATE KEY UPDATE token = VALUES(token), expiry_time = VALUES(expiry_time), verified = 0, verified_at = NULL',
    [normalizedEmail, token, new Date(expiryTime).toISOString().slice(0, 19).replace('T', ' ')]
  );
}

async function verifyEmail(email, token) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    throw new ApiError(400, 'email is required');
  }

  const rows = await runQuery('SELECT * FROM email_verifications WHERE email = ? LIMIT 1', [normalizedEmail]);
  if (!rows.length) {
    throw new ApiError(404, 'Verification token not found');
  }

  const verification = mapVerificationRow(rows[0]);
  if (verification.token !== token) {
    throw new ApiError(401, 'Invalid verification token');
  }

  if (verification.expiryTime && new Date() > new Date(verification.expiryTime)) {
    throw new ApiError(401, 'Verification token has expired');
  }

  const verifiedAt = isoNow();
  await runQuery('UPDATE email_verifications SET verified = 1, verified_at = ? WHERE email = ?', [verifiedAt, normalizedEmail]);
  await runQuery('UPDATE profiles SET updated_at = NOW(3) WHERE email = ?', [normalizedEmail]);
  return true;
}

async function checkEmailVerification(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const rows = await runQuery('SELECT * FROM email_verifications WHERE email = ? LIMIT 1', [normalizedEmail]);
  if (!rows.length) {
    return { verified: false, exists: false };
  }

  const verification = mapVerificationRow(rows[0]);
  return {
    verified: verification.verified === true,
    exists: true,
    expiryTime: verification.expiryTime,
  };
}

async function seedDefaultSettings() {
  await ensureSettingsRow();

  const currentGallery = await getGalleryImages();
  if (!currentGallery.length) {
    await replaceGalleryImages(DEFAULT_GALLERY);
  }
}

// ========== USER AUTHENTICATION FUNCTIONS ==========

function mapUserRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: String(row.name || '').trim(),
    email: String(row.email || '').trim().toLowerCase(),
    phone: String(row.phone || '').trim() || null,
    password_hash: row.password_hash || null,
    role: String(row.app_role || 'user').trim(),
    emailVerified: Boolean(row.email_verified),
    verifiedAt: row.verified_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function createUser(name, email, phone, passwordHash = null, role = 'user', emailVerified = false) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedName = String(name || '').trim();
  const normalizedPhone = String(phone || '').trim() || null;

  if (!normalizedEmail || !normalizedName) {
    throw new ApiError(400, 'name and email are required');
  }

  // Check if email already exists
  const existing = await runQuery('SELECT id FROM profiles WHERE email = ? LIMIT 1', [normalizedEmail]);
  if (existing.length) {
    throw new ApiError(409, 'Email already registered');
  }

  const userId = crypto.randomUUID();
  try {
    await runQuery(
      'INSERT INTO profiles (id, name, email, phone, app_role, password_hash, email_verified, verified_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))',
      [userId, normalizedName, normalizedEmail, normalizedPhone, role, passwordHash || null, emailVerified ? 1 : 0, emailVerified ? isoNow() : null]
    );

    const rows = await runQuery('SELECT * FROM profiles WHERE id = ? LIMIT 1', [userId]);
    return mapUserRow(rows[0]);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw new ApiError(409, 'Email already registered');
    }
    throw error;
  }
}

async function getUserByEmail(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    return null;
  }

  const rows = await runQuery('SELECT * FROM profiles WHERE email = ? LIMIT 1', [normalizedEmail]);
  return rows.length ? mapUserRow(rows[0]) : null;
}

async function getUserByPhone(phone) {
  const normalizedPhone = String(phone || '').trim();
  if (!normalizedPhone) {
    return null;
  }

  const rows = await runQuery('SELECT * FROM profiles WHERE phone = ? LIMIT 1', [normalizedPhone]);
  return rows.length ? mapUserRow(rows[0]) : null;
}

async function getUserById(userId) {
  if (!userId) {
    return null;
  }

  const rows = await runQuery('SELECT * FROM profiles WHERE id = ? LIMIT 1', [userId]);
  return rows.length ? mapUserRow(rows[0]) : null;
}

async function updateUserProfile(userId, updates) {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const allowedFields = ['name', 'phone'];
  const changes = {};

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(updates, field) && updates[field] !== undefined && updates[field] !== null) {
      changes[field === 'name' ? 'name' : field === 'phone' ? 'phone' : null] = updates[field];
    }
  }

  if (!Object.keys(changes).length) {
    return user;
  }

  const setClause = Object.keys(changes).map((key) => `${key} = ?`).join(', ');
  await runQuery(`UPDATE profiles SET ${setClause}, updated_at = NOW(3) WHERE id = ?`, [...Object.values(changes), userId]);

  const updated = await getUserById(userId);
  return updated;
}

async function markEmailVerified(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    throw new ApiError(400, 'email is required');
  }

  const user = await getUserByEmail(normalizedEmail);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const verifiedAt = isoNow();
  await runQuery('UPDATE profiles SET email_verified = 1, verified_at = ? WHERE id = ?', [verifiedAt, user.id]);

  return getUserById(user.id);
}

async function updateUserPassword(userId, newPasswordHash) {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  await runQuery('UPDATE profiles SET password_hash = ?, updated_at = NOW(3) WHERE id = ?', [newPasswordHash, userId]);
  return getUserById(userId);
}

// ========== OTP FUNCTIONS ==========

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function createOTPToken(email = null, phone = null, otpType = 'email') {
  if (!email && !phone) {
    throw new ApiError(400, 'Either email or phone is required');
  }

  const id = crypto.randomUUID();
  const otpCode = generateOTP();
  const expiryTime = new Date(Date.now() + (env.otpExpiryMinutes * 60 * 1000));

  try {
    await runQuery(
      'INSERT INTO otp_tokens (id, email, phone, otp_code, otp_type, expiry_time, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(3), NOW(3))',
      [id, email || null, phone || null, otpCode, otpType, expiryTime]
    );

    return {
      id,
      otpCode,
      email,
      phone,
      otpType,
      expiryTime: expiryTime.toISOString(),
    };
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      await ensureOtpTables();
      await runQuery(
        'INSERT INTO otp_tokens (id, email, phone, otp_code, otp_type, expiry_time, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(3), NOW(3))',
        [id, email || null, phone || null, otpCode, otpType, expiryTime]
      );

      return {
        id,
        otpCode,
        email,
        phone,
        otpType,
        expiryTime: expiryTime.toISOString(),
      };
    }

    throw new ApiError(500, 'Failed to create OTP token');
  }
}

async function verifyOTP(otpId, otpCode) {
  const rows = await runQuery('SELECT * FROM otp_tokens WHERE id = ? LIMIT 1', [otpId]);

  if (!rows.length) {
    throw new ApiError(404, 'OTP token not found');
  }

  const token = rows[0];

  // Compare in MySQL (UTC) — JS `new Date(mysqlString)` treats stored UTC as local time and falsely expires OTPs.
  const activeRows = await runQuery(
    'SELECT id FROM otp_tokens WHERE id = ? AND expiry_time > UTC_TIMESTAMP(3) LIMIT 1',
    [otpId]
  );
  if (!activeRows.length) {
    throw new ApiError(401, 'OTP has expired. Please request a new one.');
  }

  // Check if already verified
  if (token.is_verified) {
    throw new ApiError(400, 'OTP has already been verified');
  }

  // Check max attempts
  if (token.verification_attempts >= token.max_attempts) {
    throw new ApiError(429, 'Maximum OTP verification attempts exceeded. Please request a new OTP.');
  }

  // Verify OTP code (digits only — ignore accidental spaces)
  const storedCode = String(token.otp_code ?? '').replace(/\D/g, '');
  const submittedCode = String(otpCode ?? '').replace(/\D/g, '');
  if (storedCode !== submittedCode) {
    await runQuery('UPDATE otp_tokens SET verification_attempts = verification_attempts + 1 WHERE id = ?', [otpId]);
    throw new ApiError(401, 'Invalid OTP code');
  }

  // Mark as verified
  const verifiedAt = isoNow();
  await runQuery('UPDATE otp_tokens SET is_verified = 1, verified_at = ?, updated_at = NOW(3) WHERE id = ?', [verifiedAt, otpId]);

  return {
    id: otpId,
    verified: true,
    email: token.email,
    phone: token.phone,
    otpType: token.otp_type,
    verifiedAt,
  };
}

async function getOTPToken(otpId) {
  const rows = await runQuery('SELECT * FROM otp_tokens WHERE id = ? LIMIT 1', [otpId]);
  
  if (!rows.length) {
    return null;
  }

  const token = rows[0];
  return {
    id: token.id,
    email: token.email,
    phone: token.phone,
    otpType: token.otp_type,
    isVerified: Boolean(token.is_verified),
    verificationAttempts: token.verification_attempts,
    maxAttempts: token.max_attempts,
    expiryTime: token.expiry_time,
    createdAt: token.created_at,
  };
}

async function createPendingRegistration(name, email, phone, passwordHash) {
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + (30 * 60 * 1000)); // 30 minutes

  try {
    await runQuery(
      'INSERT INTO registration_pending (id, name, email, phone, password_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW(3))',
      [id, name, email, phone, passwordHash, expiresAt]
    );

    return {
      id,
      name,
      email,
      phone,
      expiresAt: expiresAt.toISOString(),
    };
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      await ensureOtpTables();
      await runQuery(
        'INSERT INTO registration_pending (id, name, email, phone, password_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW(3))',
        [id, name, email, phone, passwordHash, expiresAt]
      );

      return {
        id,
        name,
        email,
        phone,
        expiresAt: expiresAt.toISOString(),
      };
    }

    if (error.code === 'ER_DUP_ENTRY') {
      throw new ApiError(409, 'Email or phone already registered');
    }
    throw new ApiError(500, 'Failed to create pending registration');
  }
}

async function getPendingRegistration(registrationId) {
  const rows = await runQuery('SELECT * FROM registration_pending WHERE id = ? LIMIT 1', [registrationId]);
  
  if (!rows.length) {
    return null;
  }

  const reg = rows[0];
  return {
    id: reg.id,
    name: reg.name,
    email: reg.email,
    phone: reg.phone,
    passwordHash: reg.password_hash,
    emailOtpVerified: Boolean(reg.email_otp_verified),
    phoneOtpVerified: Boolean(reg.phone_otp_verified),
    emailOtpId: reg.email_otp_id,
    phoneOtpId: reg.phone_otp_id,
    expiresAt: reg.expires_at,
    createdAt: reg.created_at,
  };
}

async function getPendingRegistrationByEmailOrPhone(email, phone) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedPhone = String(phone || '').trim();

  if (!normalizedEmail && !normalizedPhone) {
    return null;
  }

  const rows = await runQuery(
    `SELECT * FROM registration_pending
     WHERE email = ? OR phone = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [normalizedEmail || null, normalizedPhone || null]
  );

  if (!rows.length) {
    return null;
  }

  const reg = rows[0];
  return {
    id: reg.id,
    name: reg.name,
    email: reg.email,
    phone: reg.phone,
    passwordHash: reg.password_hash,
    emailOtpVerified: Boolean(reg.email_otp_verified),
    phoneOtpVerified: Boolean(reg.phone_otp_verified),
    emailOtpId: reg.email_otp_id,
    phoneOtpId: reg.phone_otp_id,
    expiresAt: reg.expires_at,
    createdAt: reg.created_at,
  };
}

async function updatePendingRegistrationOTP(registrationId, otpId, otpType) {
  const reg = await getPendingRegistration(registrationId);
  if (!reg) {
    throw new ApiError(404, 'Pending registration not found');
  }

  if (otpType === 'email') {
    await runQuery('UPDATE registration_pending SET email_otp_id = ? WHERE id = ?', [otpId, registrationId]);
  } else if (otpType === 'phone') {
    await runQuery('UPDATE registration_pending SET phone_otp_id = ? WHERE id = ?', [otpId, registrationId]);
  }
}

async function markPendingRegistrationOTPVerified(registrationId, otpType) {
  if (otpType === 'email') {
    await runQuery('UPDATE registration_pending SET email_otp_verified = 1 WHERE id = ?', [registrationId]);
  } else if (otpType === 'phone') {
    await runQuery('UPDATE registration_pending SET phone_otp_verified = 1 WHERE id = ?', [registrationId]);
  }
}

async function completePendingRegistration(registrationId) {
  const reg = await getPendingRegistration(registrationId);
  if (!reg) {
    throw new ApiError(404, 'Pending registration not found');
  }

  if (!reg.emailOtpVerified) {
    throw new ApiError(400, 'Email OTP must be verified before completing registration');
  }

  // Create user
  const user = await createUser(reg.name, reg.email, reg.phone, reg.passwordHash, 'user', true);

  // Delete pending registration
  await runQuery('DELETE FROM registration_pending WHERE id = ?', [registrationId]);

  return user;
}

async function getPendingRegistrationByEmailAndPhone(email, phone) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedPhone = String(phone || '').trim();

  if (!normalizedEmail || !normalizedPhone) {
    return null;
  }

  const rows = await runQuery(
    'SELECT * FROM registration_pending WHERE email = ? AND phone = ? LIMIT 1',
    [normalizedEmail, normalizedPhone]
  );

  if (!rows.length) {
    return null;
  }

  const reg = rows[0];
  return {
    id: reg.id,
    name: reg.name,
    email: reg.email,
    phone: reg.phone,
    passwordHash: reg.password_hash,
    emailOtpVerified: Boolean(reg.email_otp_verified),
    phoneOtpVerified: Boolean(reg.phone_otp_verified),
    emailOtpId: reg.email_otp_id,
    phoneOtpId: reg.phone_otp_id,
    expiresAt: reg.expires_at,
    createdAt: reg.created_at,
  };
}

async function updatePendingRegistrationDetails(registrationId, name, passwordHash) {
  await runQuery(
    'UPDATE registration_pending SET name = ?, password_hash = ? WHERE id = ?',
    [name, passwordHash, registrationId]
  );
}

async function deletePendingRegistration(registrationId) {
  await runQuery('DELETE FROM registration_pending WHERE id = ?', [registrationId]);
}

async function ensureSeedAdminUserMysql() {
  const { adminSeedEmail, adminSeedPassword, adminSeedName } = env;

  if (!adminSeedEmail || !adminSeedPassword) {
    return;
  }

  if (adminSeedPassword.length < 8) {
    throw new Error('ADMIN_SEED_PASSWORD must be at least 8 characters');
  }

  const normalizedEmail = adminSeedEmail.trim().toLowerCase();
  const passwordHash = await bcryptjs.hash(adminSeedPassword, 10);
  const existing = await getUserByEmail(normalizedEmail);

  if (existing) {
    await runQuery(
      'UPDATE profiles SET app_role = ?, password_hash = ?, email_verified = 1, verified_at = COALESCE(verified_at, NOW(3)), name = ?, updated_at = NOW(3) WHERE email = ?',
      ['admin', passwordHash, adminSeedName, normalizedEmail]
    );
  } else {
    await createUser(adminSeedName, normalizedEmail, null, passwordHash, 'admin', true);
  }

  console.log(`[mysql] Admin seed user ready: ${normalizedEmail}`);
}

async function expireSubscriptions() {
  const today = toUtcDateKey(new Date());
  await runQuery(
    "UPDATE subscriptions SET status = 'expired', updated_at = NOW(3) WHERE status = 'active' AND end_date < ?",
    [today]
  );
}

module.exports = {
  initializeMysqlSchema,
  ensureSeedAdminUserMysql,
  expireSubscriptions,
  seedDefaultSettings,
  getAppSettings,
  updateAppSettings,
  getGalleryImages,
  replaceGalleryImages,
  deleteGalleryImage,
  getAvailability,
  listCourtBlocks,
  createCourtBlockRecord,
  deleteCourtBlock,
  createBookingRecord,
  listBookings,
  getBookingById,
  cancelBooking,
  updateBooking,
  createSubscriptionRecord,
  listSubscriptions,
  getSubscriptionById,
  cancelSubscription,
  updateSubscription,
  getDashboardStats,
  getRevenueSeries,
  listUsers,
  deleteUser,
  createContactMessage,
  listContactMessages,
  listContactMessagesByEmail,
  replyToContactMessage,
  listReviews,
  createReview,
  replyToReview,
  deleteReview,
  storeVerificationToken,
  verifyEmail,
  checkEmailVerification,
  createUser,
  getUserByEmail,
  getUserByPhone,
  getUserById,
  updateUserProfile,
  markEmailVerified,
  updateUserPassword,
  generateOTP,
  createOTPToken,
  verifyOTP,
  getOTPToken,
  createPendingRegistration,
  getPendingRegistration,
  getPendingRegistrationByEmailOrPhone,
  getPendingRegistrationByEmailAndPhone,
  updatePendingRegistrationDetails,
  updatePendingRegistrationOTP,
  markPendingRegistrationOTPVerified,
  completePendingRegistration,
  deletePendingRegistration,
};
