"""Exercise actual utterance voice bindings; simulated audio cannot verify audible accents."""
from pathlib import Path
import os,json
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1];out=root/'qa/accent';out.mkdir(parents=True,exist_ok=True)
url=os.environ.get('QA_URL','http://127.0.0.1:4184/')
mock="""
window.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};
window.__us={name:'US local',lang:'en-US',voiceURI:'us',localService:true,default:true};
window.__uk={name:'UK local',lang:'en-GB',voiceURI:'uk',localService:true};
window.__online={name:'UK online',lang:'en-GB',voiceURI:'uk-online',localService:false};
window.__voices=[__us,__uk,__online];window.__calls=[];window.__utterances=[];window.__current=null;window.__listeners=new Set();
window.__voicesChanged=()=>{for(const fn of [...__listeners])fn()};window.__finish=()=>{const u=__current;__current=null;u?.onend?.()};
Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>__voices,addEventListener:(name,fn)=>__listeners.add(fn),removeEventListener:(name,fn)=>__listeners.delete(fn),cancel(){__current=null},speak(u){__current=u;__utterances.push(u);__calls.push({text:u.text,lang:u.lang,voice:u.voice?.voiceURI,voiceLang:u.voice?.lang,rate:u.rate});u.onstart?.()}}});
"""
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True)
 for width in [1280,390]:
  context=b.new_context(viewport={'width':width,'height':950});context.add_init_script(mock);page=context.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
  page.goto(url);page.locator('#manual').click();page.locator('#review-text').fill('passport、tomato');page.locator('#save-review').click()
  row=page.locator('.word-row').filter(has=page.get_by_text('passport',exact=True))
  page.locator('#test-voice').click();assert page.evaluate('__calls.at(-1).voice')=='us';page.evaluate('__finish()')
  page.locator('#uk').click();expect(page.locator('#accent-status')).to_have_text('英式 · UK local')
  # A legacy saved global-default preference must now bind an actual GB voice.
  page.locator('#voice-choice').select_option('__system__');page.locator('#test-voice').click();assert page.evaluate('__calls.at(-1).voice')=='uk';assert 'tomato' in page.evaluate('__calls.at(-1).text');page.evaluate('__finish()')
  row.locator('.speak').click();assert page.evaluate('__calls.at(-1)')=={'text':'passport','lang':'en-GB','voice':'uk','voiceLang':'en-GB','rate':1};page.evaluate('__finish()')
  row.locator('.generate-example').click();expect(row.locator('.sentence-speak').first).to_be_visible(timeout=40000)
  row.locator('.sentence-speak').first.click();assert page.evaluate('__calls.at(-1).voice')=='uk';page.evaluate('__finish()')
  page.locator('#read-forward').click();assert page.evaluate('__calls.at(-1).voice')=='uk';page.evaluate('__finish()');expect(page.locator('#reading-progress')).to_contain_text('2 / 2');assert page.evaluate('__calls.at(-1).voice')=='uk';page.locator('#stop-reading').click()
  page.locator('#us').click();row.locator('.speak').click();assert page.evaluate('__calls.at(-1).voice')=='us';page.evaluate('__finish()')
  page.locator('#uk').click();page.reload();expect(page.locator('#uk')).to_have_attribute('aria-pressed','true');expect(page.locator('#voice-choice')).to_have_value('__system__')
  # GB network failure retries GB local, never the US global default.
  page.locator('#voice-choice').select_option('uk-online');page.locator('#test-voice').click();page.evaluate('__current.onerror({error:"network"})');assert page.evaluate('__calls.slice(-2).map(x=>x.voice)')==['uk-online','uk'];page.evaluate('__finish()')
  # An empty/delayed device list starts built-in GB; late list updates must not relabel playback.
  page.evaluate('__voices=[];__voicesChanged()');before=page.evaluate('__calls.length');page.locator('#test-voice').click();page.evaluate('__voices=[__us,__uk];__voicesChanged()');expect(page.locator('#voice-status')).to_contain_text('播放完成',timeout=120000);expect(page.locator('#accent-status')).to_contain_text('网页英式');assert page.evaluate('__calls.length')==before
  # Only US remains: generate real browser GB audio, never a US native request.
  page.evaluate('__voices=[__us];__voicesChanged()');before=page.evaluate('__calls.length');page.locator('#test-voice').click();expect(page.locator('#voice-status')).to_contain_text('播放完成',timeout=120000);assert page.evaluate('__calls.length')==before
  expect(page.locator('#accent-status')).to_contain_text('网页英式');assert '安装' not in page.locator('#voice-status').inner_text()
  # Installing a GB voice then refreshing restores playback without changing accent.
  page.evaluate('__voices=[__us,__uk];__voicesChanged()');page.locator('#speech-help').evaluate('el=>el.open=true');page.locator('#refresh-voices').click();page.locator('#test-voice').click();assert page.evaluate('__calls.at(-1).voice')=='uk';page.evaluate('__finish()')
  page.locator('#voice-info').evaluate('el=>el.open=false');page.locator('#speech-help').evaluate('el=>el.open=false');page.locator('#accent-status').scroll_into_view_if_needed();page.screenshot(path=str(out/f'voices-{width}.png'))
  for theme in ['codex','green','blue']:
   page.locator('#theme-choice').select_option(theme)
   for size in [390,320]:page.set_viewport_size({'width':size,'height':950});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  assert not errors,errors;context.close()
 b.close()
print('PASS: US/GB bindings for preview/word/sentence/batch; saved accent choices; native failures stay within accent or use real browser synthesis; missing/delayed voices, refresh and mobile themes. Native voices simulated; built-in fallback uses actual models.')
