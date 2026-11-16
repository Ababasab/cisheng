from pathlib import Path
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1];out=root/'qa';out.mkdir(exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True)
 page=browser.new_page(viewport={'width':1440,'height':1100});errors=[];requests=[]
 page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url))
 page.add_init_script("""window.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};window.__spoken=[];Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[{name:'Test US',lang:'en-US'},{name:'Test UK',lang:'en-GB'}],cancel:()=>{},addEventListener:()=>{},speak:u=>{__spoken.push({text:u.text,lang:u.lang,rate:u.rate});setTimeout(()=>u.onend?.(),20)}}});""")
 page.goto('http://127.0.0.1:4173');page.locator('#manual').click();page.locator('#review-text').fill('passport\nconscious\napple');page.locator('#save-review').click()
 passport=page.locator('.word-row').filter(has=page.get_by_text('passport',exact=True))
 expect(passport.locator('.meaning-text')).to_contain_text('护照',timeout=15000)
 expect(passport.locator('.ipa')).not_to_contain_text('暂无')
 assert not any('example-seeds' in url or 'api.tatoeba.org' in url for url in requests)
 passport.locator('.toggle-chinese').click();expect(passport.locator('.meaning-body')).to_be_hidden()
 page.reload();passport=page.locator('.word-row').filter(has=page.get_by_text('passport',exact=True));expect(passport.locator('.meaning-body')).to_be_hidden()
 passport.locator('.toggle-chinese').click();expect(passport.locator('.meaning-body')).to_be_visible()
 passport.locator('.generate-example').click();expect(passport.locator('.sentence-en')).to_have_count(2,timeout=45000)
 before=passport.locator('.sentence-en').all_text_contents();assert all('passport' in t.lower() for t in before)
 expect(passport.locator('.sentence-zh').first).to_be_visible()
 passport.locator('.sentence-speak').first.click();page.wait_for_timeout(100);assert page.evaluate('__spoken.at(-1).text')==before[0]
 assert page.evaluate('__spoken.at(-1).lang')=='en-US'
 page.locator('#uk').click();page.locator('#speed').select_option('0.7');passport.locator('.sentence-speak').first.click();page.wait_for_timeout(100)
 assert page.evaluate('__spoken.at(-1).lang')=='en-GB';assert page.evaluate('__spoken.at(-1).rate')==0.7
 passport.locator('.generate-example').click();expect(passport.locator('.generate-example')).to_be_enabled();after=passport.locator('.sentence-en').all_text_contents();assert not set(before)&set(after),(before,after)
 page.locator('#toggle-all-chinese').click()
 assert page.locator('.meaning-body:visible').count()==0;assert page.locator('.sentence-zh:visible').count()==0
 passport.locator('.toggle-chinese').click();expect(passport.locator('.meaning-body')).to_be_visible();expect(passport.locator('.sentence-zh').first).to_be_visible()
 page.screenshot(path=str(out/'learning-desktop.png'),full_page=True)
 page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(out/'learning-mobile.png'),full_page=True)
 assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
 # Reload keeps the old word list and individual/global Chinese visibility choices.
 page.reload();expect(page.locator('#count')).to_have_text('3');passport=page.locator('.word-row').filter(has=page.get_by_text('passport',exact=True));expect(passport.locator('.meaning-body')).to_be_visible()
 assert page.locator('.sentence-en').count()==0
 assert not errors,errors
 browser.close()
print('PASS: actual dictionary and IPA, individual/all Chinese hiding and persistence, on-demand random bilingual examples and attribution, sentence speech parameters, existing words, mobile overflow; audible speech not tested.')
