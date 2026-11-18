"""Ephemeral hosted Auth users; no passwords or privileged keys printed or written."""
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
import subprocess,json,secrets,uuid,urllib.request,urllib.error,os,re
root=Path(__file__).resolve().parents[1];url=os.environ.get('QA_URL','http://127.0.0.1:4184/')
cli=r'D:/CodexTools/supabase-cli/supabase.exe';ref='bmelpvnezfuxaagyhduo';base='https://'+ref+'.supabase.co'
r=subprocess.run([cli,'projects','api-keys','--project-ref',ref,'--output','json','--agent','yes'],capture_output=True,text=True,encoding='utf-8');r.check_returncode()
keys=json.loads(r.stdout);secret=next(k.get('api_key') or k.get('key') for k in keys if k.get('name')=='service_role');created=[]
def admin(path,body=None,method=None):
 req=urllib.request.Request(base+'/auth/v1/admin/'+path,data=json.dumps(body).encode() if body is not None else None,headers={'apikey':secret,'Authorization':'Bearer '+secret,'Content-Type':'application/json'},method=method)
 with urllib.request.urlopen(req,timeout=30) as response:
  data=response.read();return json.loads(data) if data else {}
def seed(word,id):return {'schemaVersion':3,'folders':[{'id':id,'name':'云同步测试'}],'activeFolderId':id,'words':[{'id':str(uuid.uuid4()),'text':word,'folderId':id,'number':1}]}
def start(context,state):
 context.add_init_script('if(!localStorage.getItem("word-notes-v1"))localStorage.setItem("word-notes-v1",'+json.dumps(json.dumps(state))+');')
 page=context.new_page();page.goto(url);return page
def login(page,email,password):
 page.locator('#account-open').click();page.locator('#account-email').fill(email);page.locator('#account-password').fill(password);page.locator('#account-submit').click()
 expect(page.locator('#account-email-display')).to_have_text(email,timeout=25000);expect(page.locator('#sync-status')).to_have_text('已同步',timeout=30000);page.locator('#account-close').click()
def sync(page):
 page.locator('#account-open').click();page.locator('#sync-now').click();expect(page.locator('#sync-status')).to_have_text('已同步',timeout=30000);page.locator('#account-close').click()
def words(page):return page.locator('.word-text').all_text_contents()
try:
 accounts=[]
 for _ in range(2):
  email='codex-qa-'+uuid.uuid4().hex+'@example.test';password=secrets.token_urlsafe(24)+'A1'
  user=admin('users',{'email':email,'password':password,'email_confirm':True,'app_metadata':{'purpose':'temporary-codex-sync-test'}})
  created.append(user['id']);accounts.append((email,password))
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True)
  mobile=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);desktop=b.new_context(viewport={'width':1280,'height':900})
  phone=start(mobile,seed('apple','phone'));computer=start(desktop,seed('banana','desktop'));errors=[]
  for page in [phone,computer]:page.on('pageerror',lambda e:errors.append(str(e)))
  login(phone,*accounts[0]);login(computer,*accounts[0]);sync(phone)
  assert set(words(phone))=={'apple','banana'};assert set(words(computer))=={'apple','banana'}
  computer.locator('#manual').click();computer.locator('#review-text').fill('concert');computer.locator('#save-review').click();expect(computer.locator('#sync-status')).to_have_text('已同步',timeout=30000)
  sync(phone);assert set(words(phone))=={'apple','banana','concert'}
  phone.get_by_role('button',name='删除 apple',exact=True).click();expect(phone.locator('#sync-status')).to_have_text('已同步',timeout=30000);sync(computer);assert set(words(computer))=={'banana','concert'}
  # Folder deletion includes contents; another device cannot restore it from a stale draft.
  computer.locator('#new-folder').click();computer.locator('#folder-name-input').fill('临时同步目录');computer.locator('#save-folder').click()
  computer.locator('#manual').click();computer.locator('#review-text').fill('journey');computer.locator('#save-review').click();expect(computer.locator('#sync-status')).to_have_text('已同步',timeout=30000);sync(phone)
  phone.get_by_role('button',name='删除文件夹 临时同步目录',exact=True).click();expect(phone.locator('#delete-folder-summary')).to_contain_text('1 个单词')
  computer.locator('#manual').click();computer.locator('#review-text').fill('garden');computer.locator('#save-review').click();expect(computer.locator('#sync-status')).to_have_text('已同步',timeout=30000)
  phone.evaluate('window.dispatchEvent(new Event("online"))');expect(phone.locator('[data-folder-id]').filter(has_text='临时同步目录').locator('.folder-count')).to_have_text('2',timeout=30000)
  phone.locator('#delete-folder-confirm').click();expect(phone.locator('#confirm-delete-folder')).to_be_visible();expect(phone.locator('#delete-folder-summary')).to_contain_text('2 个单词')
  phone.locator('#delete-folder-confirm').click();expect(phone.locator('#sync-status')).to_have_text('已同步',timeout=30000);sync(computer)
  assert computer.get_by_role('button',name='打开文件夹 临时同步目录',exact=True).count()==0;assert set(words(computer))=={'banana','concert'}
  phone.get_by_role('button',name='删除文件夹 云同步测试',exact=True).click();phone.locator('#delete-folder-confirm').click();expect(phone.locator('#sync-status')).to_have_text('已同步',timeout=30000);sync(computer)
  assert computer.locator('.folder-item').count()==0;computer.reload();expect(computer.locator('#sync-status')).to_have_text('已同步',timeout=30000);assert computer.locator('.folder-item').count()==0
  fresh=b.new_context();new_device=start(fresh,{'schemaVersion':3,'folders':[{'id':'default','name':'默认单词本'}],'words':[]});login(new_device,*accounts[0]);assert new_device.locator('.folder-item').count()==0;fresh.close()
  computer.locator('#account-open').click();computer.locator('#account-signout').click();expect(computer.locator('#account-auth')).to_be_visible(timeout=20000);assert words(computer)==['banana'];computer.locator('#account-close').click()
  login(computer,*accounts[1]);assert words(computer)==['banana']
  # Bypass UI filters deliberately: actual database RLS must still isolate users.
  anon=next(k.get('api_key') or k.get('key') for k in keys if k.get('name')=='anon')
  req=urllib.request.Request(base+'/auth/v1/token?grant_type=password',data=json.dumps({'email':accounts[0][0],'password':accounts[0][1]}).encode(),headers={'apikey':anon,'Content-Type':'application/json'})
  with urllib.request.urlopen(req,timeout=30) as response:token=json.load(response)['access_token']
  headers={'apikey':anon,'Authorization':'Bearer '+token,'Content-Type':'application/json'}
  with urllib.request.urlopen(urllib.request.Request(base+'/rest/v1/word_notes_snapshots?select=user_id',headers=headers),timeout=30) as response:visible=json.load(response)
  assert len(visible)==1 and visible[0]['user_id']==created[0]
  request=urllib.request.Request(base+'/rest/v1/word_notes_snapshots',data=json.dumps({'user_id':created[1]}).encode(),headers=headers,method='POST')
  try:urllib.request.urlopen(request,timeout=30);raise AssertionError('Cross-account write allowed')
  except urllib.error.HTTPError as error:assert error.code in [401,403]
  request=urllib.request.Request(base+'/rest/v1/word_notes_snapshots?select=user_id',headers={'apikey':anon})
  try:urllib.request.urlopen(request,timeout=30);raise AssertionError('Anonymous read allowed')
  except urllib.error.HTTPError as error:assert error.code in [401,403]
  assert not errors,errors
  assert phone.evaluate('document.documentElement.scrollWidth<=innerWidth')
  b.close()
 print('PASS: LIVE Supabase Auth + PostgreSQL RPC/RLS; two browser profiles merged, word/folder deletions propagated, changed-content reconfirmation, empty folder state survives reload/new device, signout and separate accounts isolated. Phone viewport; not physical iPhone or mainland no-VPN test.')
except Exception as error:
 message=str(error)
 for email,password in locals().get('accounts',[]):message=message.replace(password,'[test password redacted]').replace(email,'[temporary QA email]')
 print(message);raise SystemExit(1)
finally:
 for id in created:
  try:admin('users/'+id,method='DELETE')
  except Exception:print('Temporary QA user cleanup needs retry for id '+id)
 print('Temporary hosted QA users removed; cascade deletes only their test snapshots.')
