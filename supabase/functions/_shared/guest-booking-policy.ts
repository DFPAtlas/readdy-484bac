export const BOOKING_FOLLOWUP_VERSION = 'booking-followup-2026-11-25';
export const BOOKING_FOLLOWUP_TEXT = 'Email me about this booking enquiry if I do not finish it. Keep my enquiry for up to 30 days, or until the requested shift has passed.';
const licences: Record<string,string> = {door_supervisor:'Door Supervisor',security_guard:'Security Guard',cctv:'CCTV Operator',close_protection:'Close Protection',dog_handler:'Dog Handler',any:'any'};
const venues = ['nightclub_bar','retail_shop','construction_site','private_event','festival_public_event','warehouse_property','office_building','other'];
export function record(value: unknown): Record<string,unknown> {
 if (!value || typeof value!=='object' || Array.isArray(value)) throw new Error('Invalid request');
 return value as Record<string,unknown>;
}
export function textField(value: unknown,max: number): string {
 if(typeof value!=='string'||value.length>max||/[\u0000-\u001f]/.test(value))throw new Error('Invalid text');return value.trim();
}
export function availabilityInput(value: unknown) {
 const r=record(value);const postcode=textField(r.postcode,10).toUpperCase().replace(/\s/g,'');
 if(!/^(GIR0AA|[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2})$/.test(postcode))throw new Error('Enter a full UK postcode.');
 const date=textField(r.startDate,10),from=textField(r.startTime,5),to=textField(r.endTime,5);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw new Error('Enter a valid start date.');
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(from)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(to))throw new Error('Enter valid shift times.');
 const minutes=(s:string)=>Number(s.slice(0,2))*60+Number(s.slice(3));const duration=(minutes(to)-minutes(from)+1440)%1440;
 if(duration<30||duration>960)throw new Error('Choose a shift between 30 minutes and 16 hours.');
 const rawDays=typeof r.numberOfDays==='string'&&/^\d+$/.test(r.numberOfDays)?Number(r.numberOfDays):r.numberOfDays;
 const guards=typeof r.numberOfGuards==='string'&&/^\d+$/.test(r.numberOfGuards)?Number(r.numberOfGuards):r.numberOfGuards;
 if(typeof rawDays!=='number'||!Number.isInteger(rawDays)||rawDays<1||rawDays>90||typeof guards!=='number'||!Number.isInteger(guards)||guards<1||guards>50)throw new Error('Check the number of days and guards.');
 const type=textField(r.bookingType,24);if(!['one_off_shift','multi_day','weekly_recurring','ongoing'].includes(type))throw new Error('Choose a booking type.');
 const rate=typeof r.hourlyRate==='string'&&/^\d+(\.\d{1,2})?$/.test(r.hourlyRate)?Number(r.hourlyRate):r.hourlyRate;
 if(typeof rate!=='number'||!Number.isFinite(rate)||rate<10||rate>1000)throw new Error('Enter an hourly rate between £10 and £1,000.');
 const licence=textField(r.requiredLicenseType,24),venue=textField(r.venueCategory,30);
 if(!licences[licence]||!venues.includes(venue))throw new Error('Choose a licence and venue type.');
 const firstShift=type==='weekly_recurring'||type==='ongoing';
 return {postcode,date,from,to,days:firstShift?1:rawDays,guards,rate,licence:licences[licence],venue,scope:firstShift?'first_shift':'requested_shifts'};
}
export function receiptToken(value: unknown): string {const token=textField(value,64);if(!/^[a-f0-9]{64}$/.test(token))throw new Error('Invalid enquiry receipt.');return token;}
export function enquiryInput(value: unknown) {
 const r=record(value);if(r.followupConsent!==true||r.consentVersion!==BOOKING_FOLLOWUP_VERSION)throw new Error('Choose whether you want booking follow-up.');
 const email=textField(r.email,254).toLowerCase(),name=textField(r.contactName,100),submission=textField(r.submissionId,84),area=textField(r.postcodeArea,4).toUpperCase(),date=textField(r.startDate,10);
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!name||!/^qgb_[a-zA-Z0-9]{10,80}$/.test(submission)||!/^([A-Z]{1,2}\d[A-Z\d]?|GIR)$/.test(area)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw new Error('Check your contact and booking details.');
 return {email,contact_name:name,submission_id:submission,postcode_area:area,start_date:date,followup_consent:true,consent_version:BOOKING_FOLLOWUP_VERSION};
}
