from pathlib import Path
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True)
 page=browser.new_page(viewport={'width':390,'height':844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script("""window.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};window.__spoken=[];Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[{name:'Ava Online',lang:'en-US',voiceURI:'ava',localService:false},{name:'Zira Local',lang:'en-US',voiceURI:'zira',localService:true}],cancel(){},addEventListener(){},speak(u){__spoken.push({text:u.text,voice:u.voice?.name,lang:u.lang,rate:u.rate});setTimeout(()=>{if(u.voice?.name==='Ava Online')u.onerror?.({error:'network'});else{u.onstart?.();setTimeout(()=>u.onend?.(),30)}},10)}}});""")
 page.goto('http://127.0.0.1:4173');expect(page.locator('#voice-status')).to_contain_text('Zira Local')
 page.locator('#test-voice').click();expect(page.locator('#voice-status')).to_contain_text('播放完成');assert page.evaluate('__spoken.at(-1).voice')=='Zira Local'
 page.locator('#voice-choice').select_option('ava');page.locator('#test-voice').click();expect(page.locator('#voice-status')).to_contain_text('播放完成');assert page.evaluate('__spoken.slice(-2).map(s=>s.voice)')==['Ava Online','Zira Local']
 page.locator('#voice-choice').select_option('__system__');page.reload();expect(page.locator('#voice-choice')).to_have_value('__system__');page.locator('#test-voice').click();expect(page.locator('#voice-status')).to_contain_text('播放完成')
 assert page.evaluate('__spoken.at(-1).voice') is None
 page.screenshot(path=str(root/'qa/speech-mobile.png'),full_page=True);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert not errors,errors;browser.close()
print('PASS: local-first voice UI, online failure fallback, manual browser-default, saved voice choice, mobile layout. Simulated engine; actual audibility requires device verification.')
