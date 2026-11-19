from pathlib import Path
import os
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1];out=root/'qa';out.mkdir(exist_ok=True)
url=os.environ.get('QA_URL','http://127.0.0.1:4183/')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True)
 page=b.new_page(viewport={'width':390,'height':844});errors=[];external=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('request',lambda r:external.append(r.url) if 'oxforddictionaries.com' in r.url or '/functions/v1/oxford-lookup' in r.url else None)
 page.add_init_script('localStorage.setItem("word-notes-dictionary-v1",JSON.stringify({"have trouble doing":{zh:"旧的逐词参考",ipa:"",kind:"components"}}))')
 page.goto(url);page.locator('#manual').click();page.locator('#review-text').fill('keep ... quick、keep…quiet、keep sth. quiet、look forward to、have trouble doing、have difficulty in doing')
 expect(page.locator('#review-input-summary')).to_contain_text('6 个词条');page.locator('#save-review').click();expect(page.locator('#count')).to_have_text('6')
 row=lambda text:page.locator('.word-row').filter(has=page.get_by_text(text,exact=True))
 expect(row('keep … quick').locator('.meaning-text')).to_contain_text('不等于短语翻译',timeout=25000)
 expect(row('keep … quick').locator('.meaning-text')).to_contain_text('quick：')
 expect(row('keep … quiet').locator('.meaning-text')).to_contain_text('相关词典词条',timeout=25000)
 expect(row('keep sth. quiet').locator('.meaning-text')).to_have_text('将某事保密',timeout=25000)
 row('look forward to').scroll_into_view_if_needed();expect(row('look forward to').locator('.meaning-text')).to_contain_text('盼望',timeout=25000)
 expect(row('keep … quick').locator('.ipa')).to_have_text('暂无完整短语音标')
 for phrase in ['have trouble doing','have difficulty in doing']:
  row(phrase).scroll_into_view_if_needed()
  expect(row(phrase).locator('.meaning-text')).to_have_text('做某事有困难',timeout=25000)
  expect(row(phrase).locator('.definition-source').first).to_have_text('ECDICT')
 target=row('have trouble doing');target.locator('.generate-example').click();expect(target.locator('.sentence-en')).to_have_count(2,timeout=10000)
 assert not external;assert not page.locator('.lookup-oxford').count()
 assert not page.locator('a.dictionary-link').count();assert len(page.context.pages)==1
 row('keep … quick').scroll_into_view_if_needed();page.screenshot(path=str(out/'phrase-mobile.png'))
 page.reload();expect(page.locator('#count')).to_have_text('6');expect(row('keep … quick').locator('.meaning-text')).to_contain_text('不等于短语翻译')
 row('have trouble doing').scroll_into_view_if_needed();expect(row('have trouble doing').locator('.meaning-text')).to_have_text('做某事有困难')
 for width in [390,320]:page.set_viewport_size({'width':width,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 assert not errors,errors;b.close()
print('PASS: complete grammar phrase meaning replaces old component cache; examples, ellipses, honest source labels, no unconfigured Oxford controls or requests, persistence and mobile layout.')
