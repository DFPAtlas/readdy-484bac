import { supabase } from './supabase';
export { BOOKING_FOLLOWUP_TEXT,BOOKING_FOLLOWUP_VERSION } from './guest-booking-policy';
export interface GuestAvailability {count:number;checkedAt:string;scope:string;daysChecked:number;}
interface EnquiryReceipt {token:string;submissionId:string;expiresAt:string;}
const KEY='qg_booking_enquiry_receipt_v1';
export async function guestBookingRequest(body:Record<string,unknown>,accessToken?:string):Promise<Record<string,unknown>> {
 const base=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!base||!key)throw new Error('Booking enquiry service is unavailable.');
 const response=await fetch(base+'/functions/v1/guest-booking',{method:'POST',headers:{'Content-Type':'application/json',apikey:key,...(accessToken?{Authorization:'Bearer '+accessToken}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
 const data:unknown=await response.json();
 if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('Booking enquiry service is unavailable.');
 const result=data as Record<string,unknown>;
 if(!response.ok)throw new Error(typeof result.error==='string'?result.error:'Please retry the booking enquiry.');return result;
}
export async function checkGuestAvailability(input:Record<string,unknown>):Promise<GuestAvailability>{
 const fields=['postcode','startDate','startTime','endTime','numberOfDays','numberOfGuards','bookingType','hourlyRate','requiredLicenseType','venueCategory'];
 const safe=Object.fromEntries(fields.map(key=>[key,input[key]]));
 const data=await guestBookingRequest({...safe,action:'availability'});
 if(typeof data.count!=='number'||!Number.isSafeInteger(data.count)||data.count<0||typeof data.checkedAt!=='string'||!Number.isFinite(Date.parse(data.checkedAt))||!['first_shift','requested_shifts'].includes(String(data.scope))||typeof data.daysChecked!=='number'||!Number.isInteger(data.daysChecked)||data.daysChecked<1||data.daysChecked>90)throw new Error('Availability could not be confirmed. Please retry.');
 return {count:data.count,checkedAt:data.checkedAt,scope:String(data.scope),daysChecked:data.daysChecked};
}
export function createEnquiryReceipt(submissionId:string):EnquiryReceipt{
 const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);return{token:Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join(''),submissionId,expiresAt:new Date(Date.now()+30*86400000).toISOString()};
}
export function readEnquiryReceipt():EnquiryReceipt|null{
 try{const r:unknown=JSON.parse(localStorage.getItem(KEY)||'null');if(!r||typeof r!=='object'||Array.isArray(r))return null;const v=r as Record<string,unknown>;if(typeof v.token!=='string'||!/^[a-f0-9]{64}$/.test(v.token)||typeof v.submissionId!=='string'||!/^qgb_[a-zA-Z0-9]{10,80}$/.test(v.submissionId)||typeof v.expiresAt!=='string'||!Number.isFinite(Date.parse(v.expiresAt))||Date.parse(v.expiresAt)<=Date.now()){localStorage.removeItem(KEY);return null;}return{token:v.token,submissionId:v.submissionId,expiresAt:v.expiresAt};}catch{return null;}
}
export function rememberEnquiryReceipt(receipt:EnquiryReceipt):boolean{try{localStorage.setItem(KEY,JSON.stringify(receipt));return true;}catch{return false;}}
export async function withdrawGuestEnquiry(){const r=readEnquiryReceipt();if(!r)return;await guestBookingRequest({action:'withdraw_enquiry',receipt:r.token});if(readEnquiryReceipt()?.token===r.token)localStorage.removeItem(KEY);}
export async function finishGuestEnquiry(jobId:string,submissionId:string):Promise<boolean>{
 const r=readEnquiryReceipt();if(!r||r.submissionId!==submissionId)return true;
 const auth=await supabase.auth.getSession();if(auth.error||!auth.data.session)return false;
 try{await guestBookingRequest({action:'complete_enquiry',receipt:r.token,jobId},auth.data.session.access_token);if(readEnquiryReceipt()?.token===r.token)localStorage.removeItem(KEY);return true;}catch{return false;}
}
