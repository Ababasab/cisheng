"""Real vendored Supabase SDK against isolated Auth/REST fixtures, two browser profiles."""
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
import os,json,time,base64,urllib.parse,uuid
root=Path(__file__).resolve().parents[1];out=root/'qa/sync';out.mkdir(parents=True,exist_ok=True)
url=os.environ.get('QA_URL','http://127.0.0.1:4184/')
users={email:{'id':str(uuid.uuid4()),'email':email,'aud':'authenticated','role':'authenticated','app_metadata':{'provider':'email'},'user_metadata':{},'created_at':'2026-11-18T00:00:00Z'} for email in ['alice@example.test','bob@example.test']}
rows={};tokens={};calls=[]
def session(email):
 user=users[email];encode=lambda x:base64.urlsafe_b64encode(json.dumps(x).encode()).decode().rstrip('=')
 token=encode({'alg':'HS256','typ':'JWT'})+'.'+encode({'sub':user['id'],'aud':'authenticated','role':'authenticated','exp':int(time.time())+3600})+'.test'
 tokens[token]=user
 return {'access_token':token,'refresh_token':'refresh-'+user['id'],'expires_in':3600,'expires_at':int(time.time())+3600,'token_type':'bearer','user':user}
def seed(word,folder):return {'schemaVersion':3,'folders':[{'id':folder,'name':'四级'}],'activeFolderId':folder,'words':[{'id':str(uuid.uuid4()),'text':word,'folderId':folder,'number':1}]}
def route_api(route,offline):
 req=route.request;u=urllib.parse.urlparse(req.url);path=u.path;query=urllib.parse.parse_qs(u.query);body=req.post_data_json if req.post_data else {}
 respond=lambda data,status=200:route.fulfill(status=status,content_type='application/json',body=json.dumps(data))
 if req.method=='OPTIONS':return route.fulfill(status=204,headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'})
 if path=='/auth/v1/token':
  if query.get('grant_type')==['pkce']:return respond(session('alice@example.test'))
  if body.get('email') in users:return respond(session(body['email']))
  return respond({'error_code':'invalid_credentials','msg':'Invalid login credentials'},400)
 if path=='/auth/v1/signup':return respond({'id':str(uuid.uuid4()),'email':body['email'],'identities':[{'id':str(uuid.uuid4())}]})
 if path=='/auth/v1/recover':return respond({})
 token=req.headers.get('authorization','').replace('Bearer ','');user=tokens.get(token)
 if path=='/auth/v1/logout':return route.fulfill(status=204,body='')
 if path=='/auth/v1/user':return respond(user or {},200 if user else 401)
 if not user:return respond({'message':'Authentication required'},401)
 if offline[0]:return respond({'message':'Offline fixture'},503)
 owner=user['id'];calls.append((path,owner))
 if path=='/rest/v1/word_notes_snapshots':
  if query.get('user_id')!=['eq.'+owner]:return respond({},403)
  value=rows.get(owner)
  return respond([] if value is None else [{k:value[k] for k in query['select'][0].split(',')}])
 if path=='/rest/v1/rpc/word_notes_commit':
  current=rows.get(owner,{'revision':0,'payload':{'folders':[],'words':[]}})
  if body['p_expected_revision']!=current['revision']:return respond({**current,'saved':False})
  rows[owner]={'revision':current['revision']+1,'payload':body['p_payload']}
  return respond({**rows[owner],'saved':True})
 raise AssertionError(path)
def setup(context,initial):
 offline=[False];context.route('**/cloud-config.js',lambda r:r.fulfill(content_type='text/javascript',body="export const CLOUD_CONFIG={url:'https://sync.word-notes.test',publishableKey:'sb_publishable_fixture'};"))
 context.route('https://sync.word-notes.test/**',lambda r:route_api(r,offline))
 context.add_init_script('if(!localStorage.getItem("word-notes-v1"))localStorage.setItem("word-notes-v1",'+json.dumps(json.dumps(initial))+');')
 page=context.new_page();page.goto(url);return page,offline
def login(page,email):
 page.locator('#account-open').click();page.locator('#account-email').fill(email);page.locator('#account-password').fill('FixturePass123');page.locator('#account-submit').click()
 expect(page.locator('#account-email-display')).to_have_text(email);expect(page.locator('#sync-status')).to_have_text('已同步',timeout=20000)
 page.locator('#account-close').click()
def sync(page):
 page.locator('#account-open').click();page.locator('#sync-now').click();expect(page.locator('#sync-status')).to_have_text('已同步',timeout=20000);page.locator('#account-close').click()
def add(page,word):
 page.locator('#manual').click();page.locator('#review-text').fill(word);page.locator('#save-review').click();expect(page.get_by_text(word,exact=True).first).to_be_visible()
def words(page):return page.locator('.word-text').all_text_contents()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True)
 mobile=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);desktop=b.new_context(viewport={'width':1280,'height':900})
 phone,phone_off=setup(mobile,seed('apple','phone'));computer,computer_off=setup(desktop,seed('banana','computer'))
 errors=[]
 for page in [phone,computer]:page.on('pageerror',lambda e:errors.append(str(e)))
 login(phone,'alice@example.test');login(computer,'alice@example.test');sync(phone)
 assert set(words(phone))=={'apple','banana'};assert set(words(computer))=={'apple','banana'}
 add(computer,'concert');expect(computer.locator('#sync-status')).to_have_text('已同步',timeout=20000);sync(phone);assert 'concert' in words(phone)
 phone.get_by_role('button',name='删除 apple',exact=True).click();expect(phone.locator('#sync-status')).to_have_text('已同步',timeout=20000);sync(computer);assert 'apple' not in words(computer)
 computer_off[0]=True;add(computer,'garden');expect(computer.locator('#sync-status')).to_contain_text('暂时无法同步',timeout=20000)
 add(phone,'river');expect(phone.locator('#sync-status')).to_have_text('已同步',timeout=20000)
 computer_off[0]=False;computer.evaluate('window.dispatchEvent(new Event("online"))');expect(computer.locator('#sync-status')).to_have_text('已同步',timeout=20000);sync(phone)
 assert set(words(phone))=={'banana','concert','garden','river'};assert set(words(computer))==set(words(phone))
 computer.reload();expect(computer.locator('#sync-status')).to_have_text('已同步',timeout=20000);assert set(words(computer))==set(words(phone))
 computer.locator('#account-open').click();computer.locator('#account-signout').click();expect(computer.locator('#account-auth')).to_be_visible();assert words(computer)==['banana'];computer.locator('#account-close').click()
 login(computer,'bob@example.test');assert words(computer)==['banana'];assert not any(w['text']=='concert' for w in rows[users['bob@example.test']['id']]['payload']['words'])
 computer.locator('#account-open').click();computer.locator('#account-signout').click();computer.locator('#account-close').click();login(computer,'alice@example.test');assert set(words(computer))==set(words(phone))
 phone.locator('#account-open').click();phone.screenshot(path=str(out/'mobile-account.png'));assert phone.evaluate('document.documentElement.scrollWidth<=innerWidth')
 assert all('FixturePass123' not in v for v in computer.evaluate('Object.values(localStorage)'))
 computer.locator('#account-open').click();computer.locator('#account-signout').click();expect(computer.locator('#account-password')).to_be_enabled()
 computer.locator('#account-mode').click();computer.locator('#account-email').fill('new@example.test');computer.locator('#account-password').fill('short');computer.locator('#account-submit').click();expect(computer.locator('#account-message')).to_contain_text('至少 8 位')
 computer.locator('#account-password').fill('FixturePass123');computer.locator('#account-submit').click();expect(computer.locator('#account-message')).to_contain_text('确认邮件会发送');expect(computer.locator('#account-password')).to_have_value('')
 computer.locator('#account-mode').click();computer.locator('#account-forgot').click();computer.locator('#account-email').fill('alice@example.test');computer.locator('#account-submit').click();expect(computer.locator('#account-message')).to_contain_text('找回邮件会发送')
 computer.goto(url+'?code=fixture-recovery');expect(computer.locator('#account-title')).to_have_text('设置新密码',timeout=20000)
 computer.locator('#account-password').fill('UpdatedFixture123');computer.locator('#account-submit').click();expect(computer.locator('#account-message')).to_have_text('密码已更新。')
 assert not errors,errors
 b.close()
print('PASS: real SDK; independent phone/desktop guest merge, additions, deletion, offline edits/reconnect, saved session, signout/account isolation, registration, PKCE recovery/password update, no password persistence, mobile layout. Auth/REST server is a fixture, not live Supabase.')
