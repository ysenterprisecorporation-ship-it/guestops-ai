import { BookingTransition } from "./BookingState";
export interface CleaningCalendarEvent {
  eventId: string; bookingId: string; date: string; title: string;
}
export interface CleaningCalendar {
  findByBookingId(bookingId:string): CleaningCalendarEvent[];
  create(event:Omit<CleaningCalendarEvent,"eventId">):string;
  update(eventId:string,event:Omit<CleaningCalendarEvent,"eventId">):void;
}
export type CalendarWriteResult = {action:"CREATED"|"UPDATED"|"UNCHANGED"|"BLOCKED"; reason:string};
function validDate(date:string):boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed=new Date(date+"T00:00:00Z");
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0,10)===date;
}
// Calendar writes are impossible without explicit deployment opt-in and a verified booking.
export function applyCleaningTransition(
  calendar:CleaningCalendar,
  transition:BookingTransition,
  options:{enableWrites:boolean; calendarVerified:boolean; propertyVerified:boolean},
):CalendarWriteResult {
  if (!options.enableWrites || !options.calendarVerified || !options.propertyVerified)
    return {action:"BLOCKED",reason:"CALENDAR_WRITE_NOT_AUTHORIZED"};
  if (!["CREATE_CLEANING_DRAFT","UPDATE_CLEANING_DRAFT"].includes(transition.action))
    return {action:"BLOCKED",reason:"TRANSITION_NOT_WRITABLE"};
  const bookingId=transition.next.bookingId;
  if (!/^\d{10}$/.test(bookingId) || !validDate(transition.next.departure??""))
    return {action:"BLOCKED",reason:"INVALID_BOOKING_OR_DATE"};
  const existing=calendar.findByBookingId(bookingId);
  if(existing.length>1) return {action:"BLOCKED",reason:"DUPLICATE_CALENDAR_EVENTS"};
  const payload={bookingId,date:transition.next.departure!,title:"葛西清掃｜予約 "+bookingId};
  if(existing.length===1) {
    if(existing[0].date===payload.date && existing[0].title===payload.title)
      return {action:"UNCHANGED",reason:"ALREADY_SYNCHRONIZED"};
    calendar.update(existing[0].eventId,payload);
    return {action:"UPDATED",reason:"CHECKOUT_CHANGED"};
  }
  calendar.create(payload);
  return {action:"CREATED",reason:"NEW_VERIFIED_RESERVATION"};
}
