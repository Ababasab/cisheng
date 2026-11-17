from pathlib import Path
import os,re
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1];out=root/'qa';out.mkdir(exist_ok=True)
url=os.environ.get('QA_URL','http://127.0.0.1:4183/')
vocab=['concert','gallery','musician','theatre']
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True)
 context=b.new_context(viewport={'width':390,'height':844});page=context.new_page();errors=[];requests=[]
 page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url))
 # Reproduce delayed/broken observers on mobile. Essential visible rows must still load.
 page.add_init_script("window.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}}")
 page.route('**/dict-common.json',lambda route:route.abort())
 page.goto(url);page.locator('#manual').click();page.locator('#review-text').fill('、'.join(vocab));page.locator('#save-review').click()
 for word in vocab:
  row=page.locator('.word-row').filter(has=page.get_by_text(word,exact=True))
  expect(row.locator('.ipa')).to_have_text(re.compile('^/.+/$'),timeout=20000)
  expect(row.locator('.meaning-text')).not_to_have_text('正在查释义…')
 assert not any('dict-common.json' in r for r in requests)
 page.wait_for_function("Object.keys(JSON.parse(localStorage.getItem('word-notes-dictionary-v1')||'{}')).length>=4")
 page.route('**/data/common/**',lambda route:route.abort());page.route('**/data/dict-*.json',lambda route:route.abort());page.reload()
 for word in vocab:expect(page.locator('.word-row').filter(has=page.get_by_text(word,exact=True)).locator('.ipa')).to_have_text(re.compile('^/.+/$'))
 page.screenshot(path=str(out/'dictionary-offline-mobile.png'),full_page=True)
 # Fail both lookup routes on a fresh page; retry must recover without a reload.
 failed=b.new_context(viewport={'width':390,'height':844});f=failed.new_page();f.on('pageerror',lambda e:errors.append(str(e)))
 f.route('**/data/common/**',lambda route:route.abort());f.route('**/data/dict-*.json',lambda route:route.abort())
 f.goto(url);f.locator('#manual').click();f.locator('#review-text').fill('concert');f.locator('#save-review').click()
 expect(f.locator('.ipa')).to_have_text('音标加载失败',timeout=15000);expect(f.locator('.retry-definition')).to_be_visible()
 f.locator('#toggle-all-chinese').click();expect(f.locator('.retry-definition')).to_be_visible()
 f.unroute('**/data/common/**');f.unroute('**/data/dict-*.json');f.locator('.retry-definition').click();expect(f.locator('.ipa')).to_have_text(re.compile('^/.+/$'),timeout=20000)
 # A never-settling network must exit loading within the bounded two-route deadline.
 hung=b.new_context();h=hung.new_page();h.add_init_script("const orig=fetch;window.fetch=(url,opts)=>String(url).includes('/data/common/')||String(url).includes('/data/dict-')?new Promise(()=>{}):orig(url,opts)")
 h.goto(url);h.locator('#manual').click();h.locator('#review-text').fill('concert');h.locator('#save-review').click()
 expect(h.locator('.ipa')).to_have_text('音标加载失败',timeout=25000)
 assert not errors,errors;b.close()
print('PASS: screenshot words and IPA, no 4MB prerequisite, stalled observer fallback, persisted offline definitions, failure/retry and bounded hanging-request timeout; mobile viewport simulated.')
