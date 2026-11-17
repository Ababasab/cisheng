from pathlib import Path
import os
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1];out=root/'qa';out.mkdir(exist_ok=True)
url=os.environ.get('QA_URL','http://127.0.0.1:4173/')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True)
 page=b.new_page(viewport={'width':390,'height':844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script("""window.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};window.__calls=[];window.__u=null;Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[],cancel(){__u=null},addEventListener(){},speak(u){__u=u;__calls.push({text:u.text,rate:u.rate});u.onstart?.()}}});window.__end=()=>{let u=__u;__u=null;u?.onend?.()};""")
 page.goto(url)
 assert page.locator('#speed option').all_text_contents()==['0.1×','0.2×','0.25×','0.5×','0.75×','1×','1.25×','1.5×','1.75×','2×']
 expect(page.locator('#speed')).to_have_value('1')
 for rate in ['0.1','0.2','0.25','0.5','0.75','1','1.25','1.5','1.75','2']:
  page.locator('#speed').select_option(rate);page.locator('#test-voice').click();assert page.evaluate('__calls.at(-1).rate')==float(rate);page.evaluate('__end()')
 page.reload();expect(page.locator('#speed')).to_have_value('2')
 assert page.locator('.help-drawer[open]').count()==0
 assert page.locator('.reading-help:visible,.import-panel>.ocr-hint:visible,.privacy:visible,.learning-note:visible').count()==0
 drawer=page.locator('.reading-controls .help-drawer');drawer.locator('summary').click();expect(page.locator('#reading-number-info')).to_be_visible();drawer.locator('summary').click()
 page.locator('#manual').click();page.locator('#review-text').fill('apple\nbanana\ncat');page.locator('#save-review').click()
 row=page.locator('.word-row').filter(has=page.get_by_text('apple',exact=True))
 row.locator('.generate-example').click();expect(row.locator('.sentence-speak')).to_have_count(2,timeout=45000)
 for rate in ['0.25','0.2','0.1']:
  page.locator('#speed').select_option(rate)
  row.locator('.speak').click();assert page.evaluate('__calls.at(-1).rate')==float(rate);page.evaluate('__end()')
  row.locator('.sentence-speak').first.click();assert page.evaluate('__calls.at(-1).rate')==float(rate);page.evaluate('__end()')
  page.locator('#read-forward').click();assert page.evaluate('__calls.at(-1).rate')==float(rate)
  page.locator('#stop-reading').click();page.locator('#resume-reading').click();assert page.evaluate('__calls.at(-1).rate')==float(rate)
  page.locator('#stop-reading').click()
 page.reload();expect(page.locator('#speed')).to_have_value('0.1')
 page.locator('#speed').select_option('1.5');page.locator('#read-forward').click();expect(page.locator('#reading-current-word')).to_have_text('apple')
 page.locator('#stop-reading').click();expect(page.locator('#resume-reading')).to_be_visible();page.locator('#resume-reading').click();expect(page.locator('#reading-current-word')).to_have_text('apple')
 assert page.evaluate('__calls.at(-1).rate')==1.5
 page.evaluate('__end()');expect(page.locator('#reading-current-word')).to_have_text('banana')
 page.locator('#stop-voice').click();expect(page.locator('#resume-reading')).to_be_visible();page.locator('#speed').select_option('0.75');page.locator('#resume-reading').click();expect(page.locator('#reading-current-word')).to_have_text('banana');assert page.evaluate('__calls.at(-1).rate')==.75
 page.evaluate('__end()');expect(page.locator('#reading-current-word')).to_have_text('cat');page.evaluate('__end()');expect(page.locator('#resume-reading')).to_be_hidden()
 page.locator('#reading-range').fill('2-3');page.locator('#read-range').click();page.locator('#stop-reading').click();page.locator('#resume-reading').click();expect(page.locator('#reading-current-number')).to_have_text('2.')
 page.locator('#stop-reading').click();page.locator('#sort').select_option('original');expect(page.locator('#resume-reading')).to_be_hidden()
 page.locator('#read-reverse').click();page.locator('#stop-reading').click();page.locator('#resume-reading').click();expect(page.locator('#reading-current-word')).to_have_text('cat')
 for theme in ['codex','green','blue']:
  page.locator('#theme-choice').select_option(theme)
  for width in [390,320]:
   page.set_viewport_size({'width':width,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.locator('#theme-choice').select_option('codex')
 page.locator('.reading-controls').scroll_into_view_if_needed();page.screenshot(path=str(out/'playback-clean-mobile.png'),animations='disabled')
 page.locator('#stop-reading').click();page.set_viewport_size({'width':1440,'height':1100});page.screenshot(path=str(out/'playback-clean-desktop.png'),full_page=True,animations='disabled')
 assert not errors,errors;b.close()
print('PASS: all standard rates, saved speed, stop/resume forward/reverse/range, new speed on resume, completed/reset safety, folded hints, three themes and mobile layout. Simulated speech.')
