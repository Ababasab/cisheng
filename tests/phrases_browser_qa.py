from pathlib import Path
import os
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1];out=root/'qa';out.mkdir(exist_ok=True)
url=os.environ.get('QA_URL','http://127.0.0.1:4183/')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True)
 page=b.new_page(viewport={'width':390,'height':844});errors=[];external=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('request',lambda r:external.append(r.url) if 'oxford' in r.url else None)
 page.goto(url);page.locator('#manual').click();page.locator('#review-text').fill('keep ... quick、keep…quiet、keep sth. quiet、look forward to')
 expect(page.locator('#review-input-summary')).to_contain_text('4 个词条');page.locator('#save-review').click();expect(page.locator('#count')).to_have_text('4')
 row=lambda text:page.locator('.word-row').filter(has=page.get_by_text(text,exact=True))
 expect(row('keep … quick').locator('.meaning-text')).to_contain_text('不等于短语翻译',timeout=25000)
 expect(row('keep … quick').locator('.meaning-text')).to_contain_text('quick：')
 expect(row('keep … quiet').locator('.meaning-text')).to_contain_text('相关词典词条',timeout=25000)
 expect(row('keep sth. quiet').locator('.meaning-text')).to_have_text('将某事保密',timeout=25000)
 expect(row('look forward to').locator('.meaning-text')).to_contain_text('盼望',timeout=25000)
 expect(row('keep … quick').locator('.ipa')).to_have_text('暂无完整短语音标')
 link=row('keep … quick').locator('.dictionary-link');assert link.get_attribute('href').startswith('https://www.oxfordlearnersdictionaries.com/search/english/?q=')
 assert link.get_attribute('target')=='_blank';assert not external
 row('keep … quick').scroll_into_view_if_needed();page.screenshot(path=str(out/'phrase-mobile.png'))
 page.reload();expect(page.locator('#count')).to_have_text('4');expect(row('keep … quick').locator('.meaning-text')).to_contain_text('不等于短语翻译')
 for width in [390,320]:page.set_viewport_size({'width':width,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 assert not errors,errors;b.close()
print('PASS: ellipsis/placeholder input, exact and related phrase lookup, labelled component references, no fabricated IPA, Oxford link without scraping, persistence and mobile layout.')
