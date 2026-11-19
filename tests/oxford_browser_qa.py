"""Synthetic Oxford responses exercise inline UI; does not call a real licensed API."""
from pathlib import Path
import os,json
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1];out=root/'qa/oxford';out.mkdir(parents=True,exist_ok=True)
url=os.environ.get('QA_URL','http://127.0.0.1:4184/')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True)
 for width in [1280,390,320]:
  context=b.new_context(viewport={'width':width,'height':900});page=context.new_page();errors=[];queries=[]
  page.on('pageerror',lambda error:errors.append(str(error)))
  page.route('**/oxford-config.js',lambda route:route.fulfill(content_type='text/javascript',body='export const OXFORD_CONFIG={enabled:true};'))
  page.route('**/account.js',lambda route:route.fulfill(content_type='text/javascript',body='export function setupAccount(){return {changed(){},dictionaryToken:async()=>"fixture-session"};}'))
  def lookup(route):
   queries.append(json.loads(route.request.post_data));assert route.request.headers['authorization']=='Bearer fixture-session'
   if len(queries)==3:route.fulfill(status=404,content_type='application/json',body='{}');return
   result={'source':'oxford','language':'zh' if len(queries)==1 else 'en','definitions':['合成中文释义（测试）' if len(queries)==1 else 'Synthetic English definition.']}
   route.fulfill(content_type='application/json',body=json.dumps(result))
  page.route('**/functions/v1/oxford-lookup',lookup)
  page.goto(url);page.locator('#manual').click();page.locator('#review-text').fill('have trouble doing');page.locator('#save-review').click()
  row=page.locator('.word-row');expect(row.locator('.meaning-text')).to_have_text('做某事有困难',timeout=20000)
  assert not queries;row.locator('.lookup-oxford').click();expect(row.locator('.oxford-definition')).to_have_text('合成中文释义（测试）')
  expect(row.locator('.oxford-result .definition-source')).to_have_text('牛津');expect(row.locator('.meaning-text')).to_have_text('做某事有困难')
  row.locator('.toggle-chinese').click();expect(row.locator('.meaning-body')).to_be_hidden();row.locator('.toggle-chinese').click();expect(row.locator('.oxford-result')).to_be_visible()
  row.locator('.lookup-oxford').click();expect(row.locator('.oxford-definition')).to_have_text('Synthetic English definition.');expect(row.locator('.oxford-language')).to_have_text('英文释义')
  page.screenshot(path=str(out/f'inline-{width}.png'));row.locator('.lookup-oxford').click();expect(row.locator('.oxford-result')).to_contain_text('未返回这条完整词条')
  expect(row.locator('.meaning-text')).to_have_text('做某事有困难');assert not row.locator('.oxford-result .definition-source').count()
  assert len(context.pages)==1;assert queries==[{'word':'have trouble doing'}]*3;assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert not errors,errors
  context.close()
 b.close()
print('PASS: mocked official adapter shows Chinese/English inline, honest Oxford tag only on success, errors, hide/reveal, no navigation and desktop/mobile layout.')
