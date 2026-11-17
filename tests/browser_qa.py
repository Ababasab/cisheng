from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
out=root/'qa';out.mkdir(exist_ok=True)
image=Image.new('RGB',(1400,700),'white');draw=ImageDraw.Draw(image)
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',70)
draw.multiline_text((90,70),'banana\napple\nbeautiful\njourney',font=font,fill='black',spacing=25)
image.save(out/'ocr-sample.png')
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True)
    page=browser.new_page(viewport={'width':1440,'height':1050},device_scale_factor=1)
    errors=[]; page.on('pageerror',lambda e:errors.append(str(e)))
    page.add_init_script("""window.SpeechSynthesisUtterance=class { constructor(text){this.text=text;} }; window.__spoken=[]; Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[{name:'Test US',lang:'en-US'},{name:'Test UK',lang:'en-GB'}],cancel:()=>{},addEventListener:()=>{},speak:u=>{window.__spoken.push({text:u.text,lang:u.lang,rate:u.rate,voice:u.voice.name});setTimeout(()=>u.onend?.(),20)}}});""")
    page.goto('http://127.0.0.1:4173');page.locator('#manual').click()
    page.locator('#review-text').fill('Zoo\napple\nAPPLE\nlook forward to');page.locator('#save-review').click()
    assert page.locator('#count').inner_text()=='3'
    assert page.locator('.word-text').all_text_contents()==['apple','look forward to','Zoo']
    page.get_by_role('button',name='朗读 apple',exact=True).click()
    page.wait_for_timeout(100)
    assert page.evaluate('window.__spoken[0].lang')=='en-US'
    page.locator('#uk').click();page.locator('#speed').select_option('0.75')
    page.get_by_role('button',name='朗读 apple',exact=True).click();page.wait_for_timeout(100)
    assert page.evaluate('window.__spoken.at(-1).lang')=='en-GB'
    assert page.evaluate('window.__spoken.at(-1).rate')==0.75
    page.reload(); assert page.locator('#count').inner_text()=='3'
    assert page.locator('#uk').get_attribute('aria-pressed')=='true'
    page.locator('#sort').select_option('original');assert page.locator('.word-text').first.inner_text()=='Zoo'
    page.locator('#search').fill('APP');assert page.locator('.word-row').count()==1
    page.locator('#search').fill('');page.locator('#sort').select_option('az')
    with page.expect_download() as download: page.locator('#export').click()
    download.value.save_as(out/'export.txt');assert 'look forward to' in (out/'export.txt').read_text(encoding='utf-8')
    page.screenshot(path=str(out/'desktop.png'),full_page=True)
    page.locator('#file').set_input_files(out/'ocr-sample.png')
    page.wait_for_function("document.getElementById('review').open",timeout=120000)
    text=page.locator('#review-text').input_value().lower()
    assert all(w in text for w in ['banana','apple','beautiful','journey']),text
    page.locator('#save-review').click();assert page.locator('#count').inner_text()=='6'
    page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(out/'mobile.png'),full_page=True)
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.locator('#clear').click();page.get_by_role('button',name='确认清空').click();page.wait_for_function("document.getElementById('count').textContent === '0'")
    page.reload();assert page.locator('#count').inner_text()=='0'
    assert not errors,errors
    browser.close()
print('PASS: real image OCR; review, deduplication, sorting, searching, export, persistence, clearing, US/UK and rate dispatch (mock speech); mobile overflow; no browser exceptions. Actual audible speech requires device verification.')
