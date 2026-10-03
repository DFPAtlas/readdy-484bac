"""Generate a guarded migration from an exported active-template snapshot.
Requires beautifulsoup4. Run: python scripts/email/redesign_templates.py snapshot.json
"""
import sys,json,re,html,pathlib,hashlib
from bs4 import BeautifulSoup
rows=json.load(open(sys.argv[1])); root=pathlib.Path('.')
updates=[]; previews=[]
for t in rows:
 old=t['body_html']; s=BeautifulSoup(old,'html.parser'); b=s.body or s
 cards=b.find_all('table',width='600')
 if cards:
  card=cards[0]; trs=card.find_all('tr',recursive=False)
  # Retain headings/subtitles, all body rows and their original data tables.
  content=''.join(str(x) for x in trs[:-1])
  content='<table role="presentation" width="100%" cellpadding="0" cellspacing="0">'+content+'</table>'
 else:
  content=''.join(str(x) for x in b.contents)
 c=BeautifulSoup(content,'html.parser')
 heading=c.find('h1')
 email_title=t['name']
 if heading and heading.get_text(strip=True)!='QuickGuard':
  email_title=heading.get_text(' ',strip=True);heading.decompose()
 for paragraph in list(c.find_all('p')):
  if paragraph.get_text(strip=True)==email_title:paragraph.decompose()
 for tag in list(c.find_all(['h1','div'])):
  if tag.get_text(strip=True)=='QuickGuard' and not tag.find(['p','a']): tag.decompose()
 for tag in c.find_all(True):
  styles={}
  for part in tag.get('style','').split(';'):
   if ':' in part:
    k,v=part.split(':',1);styles[k.strip().lower()]=v.strip()
  for k in ['background','background-color','box-shadow','font-family','color','max-width','width','opacity']:
   styles.pop(k,None)
  if tag.name in ['td','div'] and 'padding' in styles:styles['padding']='16px 0'
  if tag.name in ['p','li']:styles.update({'font-size':'16px','line-height':'1.65','color':'#334155'})
  if tag.name in ['h1','h2','h3']:styles.update({'font-size':'22px' if tag.name=='h1' else '18px','line-height':'1.3','color':'#0B1933','margin':'0 0 16px'})
  if tag.name=='a' and ('background' in tag.get('style','').lower() or 'padding' in styles):
   styles={'display':'inline-block','background':'#0F766E','color':'#ffffff','padding':'14px 24px','border-radius':'6px','font-weight':'bold','font-size':'16px','line-height':'1.4','text-decoration':'none','text-align':'center'}
  elif tag.name=='a': styles.update({'color':'#0F766E','text-decoration':'underline'})
  if tag.name=='table':
   tag['width']='100%';tag['cellpadding']='0';tag['cellspacing']='0'
  if tag.name=='div' and re.search('background',tag.get('style',''),re.I) and tag.find(['p','strong']) and not tag.find('a'):
   styles.update({'background':'#F1F5F9','padding':'20px','border':'1px solid #E2E8F0','border-radius':'6px','margin':'20px 0','color':'#334155'})
  tag['style']=';'.join(k+':'+v for k,v in styles.items())
 title=html.escape(email_title); slug=t['template_slug']
 status=None
 if any(x in slug for x in ['failed','rejection','declined','cancelled','password_reset_alert']):status=('Action or status update','#FEF2F2','#991B1B')
 elif any(x in slug for x in ['shortlisted','maintenance','nudge']):status=('Review needed','#FFFBEB','#92400E')
 elif any(x in slug for x in ['success','complete','accepted','receipt','approval']):status=('Confirmation','#ECFDF5','#065F46')
 panel='' if not status else f'<p style="background:{status[1]};color:{status[2]};padding:12px 16px;border-radius:6px;font-size:14px;font-weight:bold;margin:0 0 24px">{status[0]}</p>'
 new=f'''<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>{title} | QuickGuard</title></head><body style="margin:0;padding:0;background:#F1F5F9;font-family:Arial,Helvetica,sans-serif;color:#334155"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #E2E8F0;border-radius:8px"><tr><td style="background:#0B1933;padding:24px 28px;border-bottom:4px solid #14B8A6"><p style="margin:0;color:#ffffff;font-size:24px;font-weight:bold">QuickGuard</p></td></tr><tr><td style="padding:28px"><h1 style="margin:0 0 20px;color:#0B1933;font-size:26px;line-height:1.3">{title}</h1>{panel}{c}</td></tr><tr><td style="padding:22px 28px;background:#F8FAFC;border-top:1px solid #E2E8F0"><p style="margin:0;color:#475569;font-size:13px;line-height:1.6">QuickGuard · Professional security staffing<br><a href="https://quickguard.uk" style="color:#0F766E">quickguard.uk</a></p></td></tr></table></td></tr></table></body></html>'''
 # Restore any variables from the old footer in a neutral footer note.
 missing=set(re.findall(r'{{[^{}]+}}',old))-set(re.findall(r'{{[^{}]+}}',new))
 if missing:new=new.replace('</body>', '<p style="text-align:center;font-size:13px;color:#475569">'+' '.join(sorted(missing))+'</p></body>')
 assert set(re.findall(r'{{[^{}]+}}',old))==set(re.findall(r'{{[^{}]+}}',new)),slug
 oldlinks={x.get('href') for x in s.find_all('a')};newlinks={x.get('href') for x in BeautifulSoup(new,'html.parser').find_all('a')}
 assert oldlinks<=newlinks,slug
 quote=lambda v:"'"+v.replace("'","''")+"'"
 updates.append(f"update app.email_templates set body_html={quote(new)} where template_slug={quote(slug)} and md5(body_html)={quote(hashlib.md5(old.encode()).hexdigest())};\nGET DIAGNOSTICS changed = ROW_COUNT;\nIF changed <> 1 THEN RAISE EXCEPTION 'Template snapshot changed: {slug}'; END IF;")
 if slug in ['client_welcome','payment_receipt','payment_failed']:
  sample=re.sub(r'{{([^{}]+)}}',lambda m:{'client_name':'Alex','amount':'92.00','job_title':'Evening venue security','dashboard_url':'https://quickguard.uk/client/dashboard','year':'2026','invoice_number':'QG-TEST-0042','payment_date':'3 October 2026','subscription_plan':'Client Free','billing_period':'October 2026'}.get(m[1],m[1].replace('_',' ').title()),new)
  (root/'docs/email-preview'/f'{slug}.html').write_text(sample)
(root/'supabase/migrations/20261003210000_email_design_refresh.sql').write_text('-- Visual refresh only; abort if a template changed since the reviewed snapshot.\nDO $migration$\nDECLARE changed integer;\nBEGIN\n'+'\n'.join(updates)+'\nEND;\n$migration$;\n')
print(f'Generated {len(rows)} guarded template updates and 3 previews.')
