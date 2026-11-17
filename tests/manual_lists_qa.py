from pathlib import Path
import os
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1];out=root/'qa';out.mkdir(exist_ok=True)
url=os.environ.get('QA_URL','http://127.0.0.1:4183/')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True)
 page=b.new_page(viewport={'width':390,'height':844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(url);page.locator('#manual').click()
 page.locator('#review-text').fill('theatre、 concert、 musician、 gallery')
 expect(page.locator('#review-input-summary')).to_contain_text('4 个词条')
 page.screenshot(path=str(out/'manual-list-mobile.png'))
 page.locator('#destination-folder').select_option('__new__');page.locator('#destination-name').fill('随记单词')
 page.locator('#save-review').click();expect(page.locator('#count')).to_have_text('4');expect(page.locator('#folder-title')).to_have_text('随记单词')
 page.locator('#sort').select_option('original');expect(page.locator('.word-text')).to_have_text(['theatre','concert','musician','gallery'])
 page.locator('#manual').click();page.locator('#review-text').fill("Theatre，look forward to;well-known；it’s\tapple\nbanana、、")
 expect(page.locator('#review-input-summary')).to_contain_text('6 个词条');page.locator('#save-review').click();expect(page.locator('#count')).to_have_text('9')
 expect(page.locator('.word-text')).to_have_text(['theatre','concert','musician','gallery','look forward to','well-known',"it's",'apple','banana'])
 page.locator('#manual').click();page.locator('#review-text').fill('cat、中文，dog123');page.locator('#save-review').click()
 expect(page.locator('#review-input-error')).to_contain_text('2 项');expect(page.locator('#review')).to_be_visible();expect(page.locator('#count')).to_have_text('9')
 page.locator('#review-text').fill('cat、dog');expect(page.locator('#review-input-error')).to_be_empty();page.locator('#save-review').click();expect(page.locator('#count')).to_have_text('11')
 page.get_by_role('button',name='编辑 cat',exact=True).click();page.locator('#review-text').fill('cat,dog');page.locator('#save-review').click();expect(page.locator('#review-input-error')).to_contain_text('一个词条')
 page.locator('#review-text').fill('black cat');page.locator('#save-review').click();expect(page.get_by_text('black cat',exact=True)).to_be_visible()
 page.reload();expect(page.locator('#count')).to_have_text('11');expect(page.locator('#folder-title')).to_have_text('随记单词')
 for width in [390,320]:
  page.set_viewport_size({'width':width,'height':844});page.locator('#manual').click();page.locator('#review-text').fill('theatre、concert、musician、gallery')
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.locator('#review button[value="cancel"]').click()
 assert not errors,errors;b.close()
print('PASS: screenshot-style lists, separators, phrase/contraction preservation, counts, folder creation/dedup, invalid input blocking, single-entry editing, persistence and mobile layout.')
