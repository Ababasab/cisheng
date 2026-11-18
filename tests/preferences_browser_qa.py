"""Word 28 actions preserve DOM/position, durable UI choices survive refresh and folder changes."""
from pathlib import Path
import os,json
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1];out=root/'qa/preferences';out.mkdir(parents=True,exist_ok=True)
(out/'columns.csv').write_text('word,other\napple,banana\npassport,concert\n',encoding='utf-8')
words=[{'id':str(i),'text':'research' if i==28 else 'passport' if i==29 else 'word'+chr(97+(i-1)//26)+chr(97+(i-1)%26),'folderId':'default','number':i} for i in range(1,81)]
words += [{'id':'other-a','text':'banana','folderId':'other','number':1},{'id':'other-b','text':'concert','folderId':'other','number':2}]
seed={'schemaVersion':3,'folders':[{'id':'default','name':'默认单词本'},{'id':'other','name':'第二组'}],'words':words,'activeFolderId':'default'}
mock="""window.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};window.__spoken=[];window.__current=null;window.__end=()=>{const u=__current;__current=null;u?.onend?.()};Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[{name:'US test',voiceURI:'us',lang:'en-US',localService:true},{name:'UK test',voiceURI:'uk',lang:'en-GB',localService:true}],addEventListener(){},cancel(){__current=null},speak(u){__current=u;__spoken.push({text:u.text,lang:u.lang,rate:u.rate});u.onstart?.()}}});"""
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True)
 for width in [1280,390]:
  context=b.new_context(viewport={'width':width,'height':900},is_mobile=width==390,has_touch=width==390);context.add_init_script(mock)
  context.add_init_script('if(!localStorage.getItem("word-notes-v1"))localStorage.setItem("word-notes-v1",'+json.dumps(json.dumps(seed))+');')
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(os.environ.get('QA_URL','http://127.0.0.1:4184/'))
  page.locator('#sort').select_option('original');row=page.locator('[data-word-id="28"]');button=row.locator('.speak');button.scroll_into_view_if_needed()
  page.wait_for_timeout(400)
  position=lambda:page.evaluate("({list:document.getElementById('word-list').scrollTop,page:scrollY,row:document.querySelector('[data-word-id=\"28\"]').getBoundingClientRect().top})")
  before=position();button.evaluate('(e)=>window.__button=e');button.click();page.wait_for_timeout(200)
  assert page.evaluate('__button.isConnected'),'Single-word playback rebuilt the list DOM'
  assert page.evaluate('__spoken.at(-1).text')=='research'
  after=position();assert abs(after['list']-before['list'])<3,(before,after);assert abs(after['page']-before['page'])<3,(before,after);assert abs(after['row']-before['row'])<3,(before,after)
  page.evaluate('__end()');before=position();row.locator('.toggle-chinese').click();after=position();assert abs(after['row']-before['row'])<3,(before,after)
  passport=page.locator('[data-word-id="29"]');passport.locator('.generate-example').scroll_into_view_if_needed();before=position();passport.locator('.generate-example').click();expect(passport.locator('.example-area')).to_be_visible(timeout=20000);after=position();assert abs(after['list']-before['list'])<3,(before,after)
  sentence=passport.locator('.sentence-speak').first
  if sentence.count():sentence.evaluate('(e)=>window.__sentenceButton=e');sentence.click();assert page.evaluate('__sentenceButton.isConnected');page.evaluate('__end()')
  page.locator('#theme-choice').select_option('blue');page.locator('#uk').click();page.locator('#speed').select_option('0.25');page.locator('#voice-choice').select_option('__system__');page.locator('#layout').select_option('triple');page.locator('#extract').select_option('all');page.locator('#reading-range').fill('28-32')
  page.locator('#toggle-all-chinese').click();page.locator('#voice-info').evaluate('(e)=>e.open=true');page.locator('#reading-help').evaluate('(e)=>e.open=true')
  page.locator('#document-file').set_input_files(out/'columns.csv');page.wait_for_function("document.getElementById('review').open");page.locator('#file-mode').select_option('all');page.locator('#file-column').select_option('1');page.locator('#review').get_by_role('button',name='取消',exact=True).click()
  button=page.locator('[data-word-id="28"] .speak');button.scroll_into_view_if_needed();page.wait_for_timeout(500);saved=page.locator('#word-list').evaluate('e=>e.scrollTop');page.reload()
  expect(page.locator('#sort')).to_have_value('original');expect(page.locator('#layout')).to_have_value('triple');expect(page.locator('#extract')).to_have_value('all');expect(page.locator('#speed')).to_have_value('0.25');expect(page.locator('#voice-choice')).to_have_value('__system__');expect(page.locator('#uk')).to_have_attribute('aria-pressed','true');expect(page.locator('#theme-choice')).to_have_value('blue');expect(page.locator('#reading-range')).to_have_value('28-32');expect(page.locator('#toggle-all-chinese')).to_have_text('显示全部中文')
  assert page.locator('#voice-info').evaluate('e=>e.open');assert page.locator('#reading-help').evaluate('e=>e.open');assert abs(page.locator('#word-list').evaluate('e=>e.scrollTop')-saved)<4
  page.locator('#document-file').set_input_files(out/'columns.csv');page.wait_for_function("document.getElementById('review').open");expect(page.locator('#file-mode')).to_have_value('all');expect(page.locator('#file-column')).to_have_value('1');page.locator('#review').get_by_role('button',name='取消',exact=True).click()
  page.locator('#search').fill('research');page.wait_for_timeout(400);page.reload();expect(page.locator('#search')).to_have_value('research');expect(page.locator('.word-text')).to_have_text(['research'])
  page.get_by_role('button',name='打开文件夹 第二组',exact=True).click();expect(page.locator('#search')).to_have_value('');page.locator('#search').fill('banana');page.locator('#reading-range').fill('1-1');page.get_by_role('button',name='打开文件夹 默认单词本',exact=True).click();expect(page.locator('#search')).to_have_value('research');expect(page.locator('#reading-range')).to_have_value('28-32');page.get_by_role('button',name='打开文件夹 第二组',exact=True).click();expect(page.locator('#search')).to_have_value('banana');expect(page.locator('#reading-range')).to_have_value('1-1');expect(page.locator('#sort')).to_have_value('original')
  page.screenshot(path=str(out/f'preferences-{width}.png'));assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert not errors,errors;context.close()
 b.close()
print('PASS: desktop/mobile word 28 playback preserves button DOM and scroll; Chinese/examples/whole-sentence actions; sort, voice/rate/accent/theme, OCR/file options, details, per-folder search/range/position survive reload.')
