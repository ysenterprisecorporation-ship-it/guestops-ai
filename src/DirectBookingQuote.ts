// ④の直販用見積計算。予約確定・在庫変更・Square課金は行わない。
export interface NightInventory {
  date: string;
  available: boolean;
  rate: number;
}
function utcDay(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("DATE_INVALID");
  const d = Date.parse(date + "T00:00:00Z");
  if (!Number.isFinite(d) || new Date(d).toISOString().slice(0, 10) !== date)
    throw new Error("DATE_INVALID");
  return d;
}
export function directBookingQuote(input: {
  checkin: string;
  checkout: string;
  guests: number;
  maxGuests: number;
  minimumNights: number;
  cleaningFee: number;
  inventory: NightInventory[];
  inventoryVersion: string;
  validUntil: string;
  now: Date;
}) {
  const start = utcDay(input.checkin),
    end = utcDay(input.checkout);
  const nights = (end - start) / 86400000;
  if (!Number.isInteger(nights) || nights < 1 || nights > 31)
    throw new Error("STAY_INVALID");
  if (
    !Number.isInteger(input.minimumNights) ||
    input.minimumNights < 1 ||
    nights < input.minimumNights
  )
    throw new Error("MINIMUM_STAY_UNMET");
  if (
    !Number.isInteger(input.maxGuests) ||
    input.maxGuests < 1 ||
    !Number.isInteger(input.guests) ||
    input.guests < 1 ||
    input.guests > input.maxGuests
  )
    throw new Error("OCCUPANCY_INVALID");
  const expiry = Date.parse(input.validUntil);
  if (
    !input.inventoryVersion.trim() ||
    !Number.isFinite(input.now.getTime()) ||
    !Number.isFinite(expiry) ||
    expiry <= input.now.getTime()
  )
    throw new Error("INVENTORY_STALE");
  if (!Number.isSafeInteger(input.cleaningFee) || input.cleaningFee < 0)
    throw new Error("FEE_INVALID");
  const rows: NightInventory[] = [];
  for (let time = start; time < end; time += 86400000) {
    const date = new Date(time).toISOString().slice(0, 10);
    const matches = input.inventory.filter((row) => row.date === date);
    if (matches.length !== 1 || !matches[0].available)
      throw new Error("INVENTORY_UNAVAILABLE");
    if (!Number.isSafeInteger(matches[0].rate) || matches[0].rate < 0)
      throw new Error("RATE_INVALID");
    rows.push({ ...matches[0] });
  }
  const accommodation = rows.reduce((sum, row) => sum + row.rate, 0);
  const total = accommodation + input.cleaningFee;
  if (!Number.isSafeInteger(total)) throw new Error("TOTAL_INVALID");
  return {
    nights,
    accommodation,
    cleaningFee: input.cleaningFee,
    total,
    currency: "JPY",
    inventoryVersion: input.inventoryVersion,
    validUntil: input.validUntil,
    requiresInventoryRecheck: true,
    bookingConfirmed: false,
    nightsDetail: rows,
  };
}
