from pathlib import Path
import os,json
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1];out=root/'qa';out.mkdir(exist_ok=True)
url=os.environ.get('QA_URL','http://127.0.0.1:4173/')
mock="""
window.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};
window.__spoken=[];window.__utterances=[];window.__current=null;
window.__finish=()=>{const u=__current;__current=null;u?.onend?.()};
Object.defineProperty(window,'speechSynthesis',{value:{
 getVoices:()=>[{name:'Test Local US',lang:'en-US',voiceURI:'us',localService:true},{name:'Test Local UK',lang:'en-GB',voiceURI:'uk',localService:true}],
 cancel(){__current=null},addEventListener(){},
 speak(u){__current=u;__utterances.push(u);__spoken.push({text:u.text,lang:u.lang,rate:u.rate});u.onstart?.()}
}});
"""
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True)
 context=browser.new_context(viewport={'width':1440,'height':1100});context.add_init_script(mock)
 context.add_init_script("if(!localStorage.getItem('word-notes-v1'))localStorage.setItem('word-notes-v1',JSON.stringify({words:[{id:'z',text:'zoo'},{id:'a',text:'apple'},{id:'b',text:'banana'}]}));")
 page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(url)
 def current(text,number):
  expect(page.locator('#reading-current-word')).to_have_text(text)
  expect(page.locator('#reading-current-number')).to_have_text(f'{number}.')
  expect(page.locator(f'.word-row[data-word-number="{number}"]')).to_have_class('word-row playing')
  expect(page.locator(f'.word-row[data-word-number="{number}"]')).to_have_attribute('aria-current','true')
 expect(page.locator('.word-number')).to_have_text(['1.','2.','3.'])
 page.locator('#read-forward').click();current('apple',1)
 expect(page.locator('#reading-current-label')).to_have_text('正在朗读')
 page.evaluate('__finish()');current('banana',2);page.evaluate('__finish()');current('zoo',3);page.evaluate('__finish()')
 expect(page.locator('#reading-progress')).to_contain_text('连读完成');expect(page.locator('#stop-reading')).to_be_disabled()
 assert page.evaluate('__spoken.map(s=>s.text)')==['apple','banana','zoo']
 page.locator('#read-reverse').click();current('zoo',3)
 page.evaluate('__finish()');page.locator('#stop-reading').click();before=page.evaluate('__spoken.length');page.wait_for_timeout(450);assert page.evaluate('__spoken.length')==before
 page.locator('#sort').select_option('original');expect(page.locator('.word-number')).to_have_text(['1.','2.','3.'])
 page.locator('#read-forward').click();current('zoo',1)
 old=page.evaluate('__utterances.length-1');page.get_by_role('button',name='朗读 banana',exact=True).click()
 expect(page.locator('#stop-reading')).to_be_disabled();assert page.evaluate('__spoken.at(-1).text')=='banana'
 page.evaluate(f'__utterances[{old}].onend()');page.evaluate('__finish()');before=page.evaluate('__spoken.length');page.wait_for_timeout(450);assert page.evaluate('__spoken.length')==before
 page.locator('#uk').click();page.locator('#speed').select_option('0.7')
 page.locator('#reading-range').fill('2-3');page.locator('#read-range').click();current('apple',2)
 assert page.evaluate('__spoken.at(-1)')=={'text':'apple','lang':'en-GB','rate':.7}
 page.evaluate('__finish()');current('banana',3);page.evaluate('__finish()');expect(page.locator('#reading-progress')).to_contain_text('连读完成')
 for bad in ['abc','0-2','1-4']:
  before=page.evaluate('__spoken.length');page.locator('#reading-range').fill(bad);page.locator('#read-range').click();expect(page.locator('#reading-error')).to_be_visible();assert page.evaluate('__spoken.length')==before
 page.locator('#search').fill('banana');expect(page.locator('.word-number')).to_have_text(['3.']);page.locator('#read-forward').click();current('banana',3);page.evaluate('__finish()')
 page.locator('#reading-range').fill('2-1');page.locator('#reading-range').press('Enter');current('apple',2);expect(page.locator('#search')).to_have_value('')
 page.evaluate('__finish()');current('zoo',1);page.evaluate('__finish()')
 page.get_by_role('button',name='编辑 zoo',exact=True).click();page.locator('#review-text').fill('zebra');page.locator('#save-review').click()
 expect(page.locator('.word-row').filter(has=page.get_by_text('zebra',exact=True)).locator('.word-number')).to_have_text('1.')
 page.get_by_role('button',name='删除 banana',exact=True).click()
 page.locator('#manual').click();page.locator('#review-text').fill('cat');page.locator('#save-review').click()
 expect(page.locator('.word-number')).to_have_text(['1.','2.','3.']);page.reload();expect(page.locator('.word-number')).to_have_text(['1.','2.','3.']);expect(page.locator('.word-text')).to_have_text(['apple','cat','zebra']);page.locator('#sort').select_option('original');expect(page.locator('.word-text')).to_have_text(['zebra','apple','cat'])
 page.locator('#read-forward').click();page.evaluate("__current.onerror({error:'audio-hardware'})")
 expect(page.locator('#reading-progress')).to_contain_text('已停止');expect(page.locator('#stop-reading')).to_be_disabled()
 before=page.evaluate('__spoken.length');page.wait_for_timeout(450);assert page.evaluate('__spoken.length')==before
 page.locator('#manual').click();page.locator('#review-text').fill('option\nconscious');page.locator('#destination-folder').select_option('__new__');page.locator('#destination-name').fill('第二组');page.locator('#save-review').click()
 expect(page.locator('.word-number')).to_have_text(['1.','2.'])
 page.locator('#read-forward').click();current('option',1);page.get_by_role('button',name='打开文件夹 默认单词本',exact=True).click()
 expect(page.locator('#reading-now')).to_be_hidden();expect(page.locator('#stop-reading')).to_be_disabled()
 assert not errors,errors
 # Reverse the import order so alphabetic positions disagree with every stored import number.
 many=[{'id':f'w{i}','text':'vocab'+chr(97+(i-1)//26)+chr(97+(i-1)%26)} for i in range(300,0,-1)]
 ordered=sorted(many,key=lambda w:w['text'])
 big=browser.new_context(viewport={'width':1440,'height':1100});big.add_init_script(mock)
 big.add_init_script("const timer=setTimeout;window.setTimeout=(fn,ms,...args)=>timer(fn,ms===300?1:ms,...args);")
 big.add_init_script("if(!localStorage.getItem('word-notes-v1'))localStorage.setItem('word-notes-v1',"+json.dumps(json.dumps({'words':many}))+');')
 page=big.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.goto(url)
 expect(page.locator('.word-number').first).to_have_text('1.')
 expect(page.locator('.word-text').first).to_have_text(ordered[0]['text'])
 assert page.evaluate("JSON.parse(localStorage.getItem('word-notes-v1')).words[0].text")==many[0]['text']
 page.locator('#reading-range').fill('203-260');page.locator('#read-range').click();current(ordered[202]['text'],203)
 expect(page.locator('#reading-progress')).to_contain_text('1 / 58')
 assert page.locator('#word-list').evaluate('el=>el.scrollTop')>0
 page.screenshot(path=str(out/'reading-desktop.png'),full_page=True)
 for width in [390,320]:
  page.set_viewport_size({'width':width,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.locator('.reading-controls').scroll_into_view_if_needed();page.screenshot(path=str(out/'reading-mobile.png'))
 for number in range(203,261):
  current(ordered[number-1]['text'],number);page.evaluate('__finish()')
 expect(page.locator('#reading-progress')).to_contain_text('连读完成 · 共 58 个单词')
 assert page.evaluate('__spoken.map(s=>s.text)')==[w['text'] for w in ordered[202:260]]
 page.locator('#sort').select_option('original');expect(page.locator('.word-text').first).to_have_text(many[0]['text']);expect(page.locator('.word-number').first).to_have_text('1.')
 page.locator('#reading-range').fill('203-204');page.locator('#read-range').click();current(many[202]['text'],203);page.evaluate('__finish()');current(many[203]['text'],204);page.evaluate('__finish()');expect(page.locator('#stop-reading')).to_be_disabled()
 # Stop via the existing voice toolbar also prevents any queued continuation.
 page.locator('#read-forward').click();page.evaluate('__finish()');page.locator('#stop-voice').click();before=page.evaluate('__spoken.length');page.wait_for_timeout(100);assert page.evaluate('__spoken.length')==before
 assert not errors,errors;browser.close()
print('PASS: consecutive numbers for AZ/import sorts, retained search positions, correct sorted ranges 203-260 and import range 203-204, current word/number/highlight/scroll/progress, stop/interruption/error, US/UK/rate, folders, reload and mobile layout. Speech engine simulated; actual device audio not tested.')
