from pathlib import Path
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1];out=root/'qa';out.mkdir(exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True)
 page=browser.new_page(viewport={'width':1440,'height':1100});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script("""if(!localStorage.getItem('word-notes-v1'))localStorage.setItem('word-notes-v1',JSON.stringify({words:[{id:'legacy-apple',text:'apple'},{id:'legacy-passport',text:'passport'}],accent:'en-GB',rate:.7,chineseOverrides:{'legacy-apple':true}}));""")
 page.goto('http://127.0.0.1:4173');expect(page.locator('#count')).to_have_text('2');expect(page.locator('#folder-title')).to_have_text('默认单词本')
 assert page.evaluate("JSON.parse(localStorage.getItem('word-notes-v1')).words[0].id")=='legacy-apple'
 expect(page.locator('.word-row').filter(has=page.get_by_text('apple',exact=True)).locator('.meaning-body')).to_be_hidden();expect(page.locator('#uk')).to_have_attribute('aria-pressed','true')
 def add(text,target=None,name=None):
  page.locator('#manual').click();page.locator('#review-text').fill(text)
  if target:page.locator('#destination-folder').select_option(target)
  if name is not None:page.locator('#destination-name').fill(name)
  page.locator('#save-review').click()
 add('apple\nbanana\nAPPLE');expect(page.locator('#count')).to_have_text('3')
 # New folder is created only when the import is saved; cross-folder duplicate stays.
 add('apple\njourney','__new__','旅行英语');expect(page.locator('#folder-title')).to_have_text('旅行英语');expect(page.locator('#count')).to_have_text('2')
 travel=page.evaluate("JSON.parse(localStorage.getItem('word-notes-v1')).activeFolderId")
 add('beautiful','default');expect(page.locator('#folder-title')).to_have_text('默认单词本');expect(page.locator('#count')).to_have_text('4')
 page.get_by_role('button',name='打开文件夹 旅行英语',exact=True).click();expect(page.locator('#count')).to_have_text('2')
 page.get_by_role('button',name='重命名文件夹 旅行英语',exact=True).click();page.locator('#folder-name-input').fill('默认单词本');page.locator('#save-folder').click();expect(page.locator('#folder-name-error')).to_contain_text('同名')
 name='旅行 <假期> 🧳';page.locator('#folder-name-input').fill(name);page.locator('#save-folder').click();expect(page.locator('#folder-title')).to_have_text(name)
 with page.expect_download() as dl:page.locator('#export').click()
 dl.value.save_as(out/'folder-export.txt');assert set((out/'folder-export.txt').read_text(encoding='utf-8').splitlines())=={'apple','journey'}
 page.get_by_role('button',name=f'归档文件夹 {name}',exact=True).click();expect(page.locator('#folder-title')).to_have_text('默认单词本');expect(page.locator('#archived-count')).to_have_text('1')
 page.get_by_role('button',name=f'打开文件夹 {name}',exact=True).click();expect(page.locator('#archived-banner')).to_be_visible();expect(page.locator('#clear')).to_be_disabled();expect(page.get_by_role('button',name='编辑 apple',exact=True)).to_be_disabled();expect(page.locator('#count')).to_have_text('2')
 page.locator('#restore-current').click();expect(page.locator('#archived-banner')).to_be_hidden();expect(page.locator('#clear')).to_be_enabled();expect(page.locator('#count')).to_have_text('2')
 # Cancelled imports/new-folder dialogs make no empty folders and add no words.
 before=page.evaluate("localStorage.getItem('word-notes-v1')");page.locator('#manual').click();page.locator('#destination-folder').select_option('__new__');page.locator('#destination-name').fill('不应保存');page.locator('#review').get_by_role('button',name='取消',exact=True).click();assert page.evaluate("localStorage.getItem('word-notes-v1')")==before
 page.locator('#new-folder').click();page.locator('#folder-name-input').fill('四级第2单元');page.locator('#save-folder').click();expect(page.locator('#count')).to_have_text('0');add('option');expect(page.locator('#count')).to_have_text('1')
 page.screenshot(path=str(out/'folders-desktop.png'),full_page=True)
 page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(out/'folders-mobile.png'),full_page=True);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 # Clearing the selected folder never clears other folders, including archived words.
 page.locator('#clear').click();page.get_by_role('button',name='确认清空',exact=True).click();expect(page.locator('#count')).to_have_text('0');assert page.evaluate("JSON.parse(localStorage.getItem('word-notes-v1')).words.length")==6
 for title in ['四级第2单元',name,'默认单词本']:page.get_by_role('button',name=f'归档文件夹 {title}',exact=True).click()
 expect(page.locator('#folder-title')).to_have_text('选择或新建文件夹');page.reload();expect(page.locator('#folder-title')).to_have_text('选择或新建文件夹');assert page.evaluate("JSON.parse(localStorage.getItem('word-notes-v1')).folders.length")==3
 page.locator('#manual').click();expect(page.locator('#destination-folder')).to_have_value('__new__');page.locator('#review-text').fill('category');page.locator('#save-review').click();expect(page.locator('#review-error')).to_contain_text('名字');page.locator('#destination-name').fill('新的开始');page.locator('#save-review').click();expect(page.locator('#count')).to_have_text('1')
 page.locator('#archive-section').evaluate('(el)=>el.open=true');page.get_by_role('button',name=f'恢复文件夹 {name}',exact=True).click();expect(page.locator('#count')).to_have_text('2');page.reload();expect(page.locator('#folder-title')).to_have_text(name);expect(page.locator('#count')).to_have_text('2')
 assert not errors,errors
 browser.close()
print('PASS: legacy migration and hidden/accent preservation; named folders, per-folder dedup, explicit import destination, rename validation, archive/read-only/restore, scoped export/clear, cancelled imports, all-archived persistence, mobile overflow and reload.')
