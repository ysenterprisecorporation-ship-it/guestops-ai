export interface CleaningPlan {
  bookingId: string; date: string; title: string;
  action: "PROPOSE_UPSERT" | "REVIEW"; reason?: string;
}
export function planCleaning(input: {
  bookingId:string; departure?:string; status?:string;
  propertyVerified:boolean; existingCalendarEventId?:string;
}): CleaningPlan {
  if(!input.propertyVerified || !input.departure ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.departure) ||
    /cancel|no.?show/i.test(input.status ?? "")) {
    return {bookingId:input.bookingId,date:input.departure ?? "",
      title:"清掃候補 "+input.bookingId,action:"REVIEW",
      reason:"UNVERIFIED_OR_CANCELLED_BOOKING"};
  }
  return {bookingId:input.bookingId,date:input.departure,
    title:"葛西清掃｜予約 "+input.bookingId, action:"PROPOSE_UPSERT"};
}
