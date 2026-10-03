DO $migration$
DECLARE changed integer;
BEGIN
UPDATE app.email_templates SET body_html=replace(body_html,'<p style="margin:0;color:#ffffff;font-size:24px;font-weight:bold">QuickGuard</p>','<img src="https://public.readdy.ai/ai/img_res/c10b9a7b-68d7-4ace-860f-4fe6cdb37c9d.png" alt="QuickGuard" width="220" style="display:block;width:220px;max-width:100%;height:auto;border:0;color:#ffffff;font-size:24px">') WHERE strpos(body_html,'<p style="margin:0;color:#ffffff;font-size:24px;font-weight:bold">QuickGuard</p>')>0;
GET DIAGNOSTICS changed=ROW_COUNT;
IF changed <> 43 THEN RAISE EXCEPTION 'Expected 43 email headers, found %',changed; END IF;
END;
$migration$;