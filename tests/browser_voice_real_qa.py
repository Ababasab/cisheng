"""Real local models and Web Audio, with native speech intentionally unavailable."""
from pathlib import Path
import os,json
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1];out=root/'qa/browser-voice';out.mkdir(parents=True,exist_ok=True)
url=os.environ.get('QA_URL','http://127.0.0.1:4184/')
mock="""
window.__nativeCalls=0;Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[],addEventListener(){},removeEventListener(){},cancel(){},speak(){__nativeCalls++;throw Error('Native speech must not be used')}}});
window.__buffers=[];const original=AudioContext.prototype.createBuffer;AudioContext.prototype.createBuffer=function(...args){const buffer=original.apply(this,args);__buffers.push(buffer);return buffer;};
"""
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True)
 context=b.new_context(viewport={'width':1280,'height':950});context.add_init_script(mock);page=context.new_page();errors=[];downloads=[];external=[]
 page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:downloads.append(r.url) if '/vendor/speech/' in r.url else None)
 page.on('request',lambda r:external.append(r.url) if any(host in r.url for host in ['huggingface.co','jsdelivr.net','cdnjs.cloudflare','onnxruntime.ai']) else None)
 page.goto(url);page.locator('#manual').click();page.locator('#review-text').fill('passport、car');page.locator('#save-review').click();page.locator('#sort').select_option('original')
 row=page.locator('.word-row').filter(has=page.get_by_text('passport',exact=True));expect(page.locator('#accent-status')).to_contain_text('网页美式')
 row.locator('.speak').click();expect(page.locator('#voice-status')).to_contain_text('播放完成',timeout=240000);assert page.evaluate('__nativeCalls')==0
 first=page.evaluate('({duration:__buffers.at(-1).duration,nonzero:__buffers.at(-1).getChannelData(0).some(x=>Math.abs(x)>.01)})');assert first['nonzero'];assert first['duration']>.1
 page.locator('#uk').click();row.locator('.speak').click();expect(page.locator('#voice-status')).to_contain_text('播放完成',timeout=240000);expect(page.locator('#accent-status')).to_contain_text('网页英式')
 uk=page.evaluate('__buffers.at(-1).duration');assert uk>.1
 page.locator('#speed').select_option('0.25');row.locator('.speak').click();expect(page.locator('#voice-status')).to_contain_text('播放完成',timeout=120000);slow=page.evaluate('__buffers.at(-1).duration');assert slow>uk*2.5,(uk,slow)
 page.locator('#speed').select_option('2');row.locator('.generate-example').click();expect(row.locator('.sentence-speak').first).to_be_visible(timeout=40000);row.locator('.sentence-speak').first.click();expect(page.locator('#voice-status')).to_contain_text('播放完成',timeout=120000)
 page.locator('#read-forward').click();expect(page.locator('#reading-progress')).to_contain_text('连读完成 · 共 2 个单词',timeout=120000)
 page.locator('#read-forward').click();page.locator('#stop-reading').click();expect(page.locator('#resume-reading')).to_be_visible();page.locator('#resume-reading').click();expect(page.locator('#reading-progress')).to_contain_text('连读完成',timeout=120000)
 # Cancel a fresh utterance while synthesis is pending: stale results must stay silent.
 page.locator('#test-voice').click();page.locator('#stop-voice').click();count=page.evaluate('__buffers.length');page.wait_for_timeout(1800);assert page.evaluate('__buffers.length')==count
 assert not external,external;assert page.evaluate('__nativeCalls')==0
 # Cache API retains both models: a new page must not fetch them again.
 page.locator('#voice-choice').select_option('__builtin__');page.reload();expect(page.locator('#voice-choice')).to_have_value('__builtin__');page.route('**/vendor/speech/models/**',lambda route:route.abort());before=len([u for u in downloads if '/models/' in u]);row=page.locator('.word-row').filter(has=page.get_by_text('passport',exact=True));row.locator('.speak').click();expect(page.locator('#voice-status')).to_contain_text('播放完成',timeout=120000);assert len([u for u in downloads if '/models/' in u])==before
 for width in [390,320]:page.set_viewport_size({'width':width,'height':950});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.locator('#accent-status').scroll_into_view_if_needed();page.screenshot(path=str(out/'built-in-mobile.png'))
 (out/'real-audio-metrics.json').write_text(json.dumps({'us':first,'gbSeconds':uk,'gbQuarterSpeedSeconds':slow,'nativeCalls':page.evaluate('__nativeCalls'),'externalTtsRequests':external},indent=2),encoding='utf-8')
 assert not errors,errors;context.close();b.close()
print('PASS: real US/GB models generate nonzero PCM and complete Web Audio playback with no native voices; quarter speed lengthens audio; sentences, batch/stop/resume, stale suppression, model cache and mobile layout. Physical speakers not measured.')
