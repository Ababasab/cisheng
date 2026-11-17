import os
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True)
 page=browser.new_page();errors=[];remote=[]
 page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:remote.append(r.url) if 'api.tatoeba.org' in r.url else None)
 page.route('**/data/common/**',lambda route:route.fulfill(status=503,body='unavailable'))
 page.route('**/data/dict-*.json',lambda route:route.fulfill(status=503,body='unavailable'))
 page.goto(os.environ.get('QA_URL','http://127.0.0.1:4183/'));page.locator('#manual').click();page.locator('#review-text').fill('umbrella\nzzzdictionarymissing');page.locator('#save-review').click()
 umbrella=page.locator('.word-row').filter(has=page.get_by_text('umbrella',exact=True))
 expect(umbrella.locator('.meaning-text')).to_have_text('词典加载失败',timeout=15000)
 page.unroute('**/data/common/**');page.unroute('**/data/dict-*.json');umbrella.locator('.retry-definition').click();expect(umbrella.locator('.meaning-text')).to_contain_text('伞',timeout=15000)
 assert not remote
 umbrella.locator('.generate-example').click();expect(umbrella.locator('.sentence-en')).to_have_count(2,timeout=45000);assert remote
 missing=page.locator('.word-row').filter(has=page.get_by_text('zzzdictionarymissing',exact=True));missing.locator('.retry-definition').click();expect(missing.locator('.meaning-text')).to_contain_text('暂未收录',timeout=15000)
 page.route('https://api.tatoeba.org/**',lambda route:route.abort());missing.locator('.generate-example').click();expect(missing.locator('.example-message')).to_contain_text('例句加载失败',timeout=45000)
 page.unroute('https://api.tatoeba.org/**');page.route('https://api.tatoeba.org/**',lambda route:route.fulfill(status=200,content_type='application/json',body='{"data":[]}'))
 missing.locator('.generate-example').click();expect(missing.locator('.example-message')).to_contain_text('暂未找到',timeout=45000)
 assert not errors,errors
 browser.close()
print('PASS: dictionary fetch failure and retry; real cross-origin Tatoeba lookup for a non-seed word; missing-word, example network failure and retry/empty states; no browser exceptions.')
