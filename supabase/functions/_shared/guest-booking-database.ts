type Json=string|number|boolean|null|{[key:string]:Json|undefined}|Json[];
type Table<Row,Insert=Partial<Row>>={Row:Row;Insert:Insert;Update:Partial<Row>;Relationships:[]};
type Enquiry={id:string;receipt_hash:string;submission_id:string;email:string;contact_name:string;postcode_area:string;start_date:string;followup_consent:boolean;consent_version:string;consent_at:string;expires_at:string};
export type GuestBookingDatabase={app:{
 Tables:{
  guest_booking_enquiries:Table<Enquiry,Omit<Enquiry,'id'|'consent_at'|'expires_at'>&Partial<Pick<Enquiry,'id'|'consent_at'|'expires_at'>>>;
  clients:Table<{id:string;user_id:string;is_active:boolean|null}>;
  jobs:Table<{id:string;client_id:string;submission_id:string|null;is_draft:boolean|null;status:string|null}>;
 };
 Views:Record<string,never>;
 Functions:{
  is_active_admin:{Args:Record<string,never>;Returns:boolean};
  guest_booking_enquiry_change:{Args:{p_hash:string;p_action:string;p_data?:Json;p_submission?:string};Returns:Json};
  guest_booking_rate_limit:{Args:{p_bucket:string};Returns:boolean};
  purge_expired_guest_enquiries:{Args:Record<string,never>;Returns:number};
  guest_booking_match_count:{Args:{p_lat:number;p_lng:number;p_date:string;p_days:number;p_from:string;p_to:string;p_licence:string;p_venue:string;p_rate:number};Returns:number};
 };
 Enums:Record<string,never>;CompositeTypes:Record<string,never>;
}};
