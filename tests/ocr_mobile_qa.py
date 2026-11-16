from pathlib import Path
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1];sample=root/'qa/ocr-sample.png'
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True)
 context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
 page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:4173')
 # Model request fails; persistent error appears and another upload is possible.
 page.route('**/eng-lstm-v1.traineddata.gz',lambda route:route.fulfill(status=404,body='missing'))
 page.locator('#file').set_input_files(sample);expect(page.locator('#ocr-error')).to_contain_text('HTTP 404',timeout=15000);expect(page.locator('#upload')).to_be_enabled();expect(page.locator('#recognizing')).to_be_hidden()
 page.unroute('**/eng-lstm-v1.traineddata.gz')
 # Hold the large download, cancel it, and verify that cancellation isn't delayed by initialization.
 page.route('**/eng-lstm-v1.traineddata.gz',lambda route:None)
 page.locator('#file').set_input_files(sample);expect(page.locator('#ocr-state')).to_contain_text('下载英语模型',timeout=15000);page.locator('#cancel-ocr').click();expect(page.locator('#recognizing')).to_be_hidden(timeout=3000);expect(page.locator('#upload')).to_be_enabled()
 page.unroute('**/eng-lstm-v1.traineddata.gz')
 page.locator('#file').set_input_files(sample);page.wait_for_function("document.getElementById('review').open",timeout=90000);text=page.locator('#review-text').input_value();assert all(word in text for word in ['banana','apple','beautiful','journey'])
 page.locator('#review').get_by_role('button',name='取消',exact=True).click()
 # A corrupt/cached HTML response never reaches the WASM model loader.
 page.route('**/eng-lstm-v1.traineddata.gz',lambda route:route.fulfill(status=200,body='<html>blocked</html>'))
 page.locator('#file').set_input_files(sample);expect(page.locator('#ocr-error')).to_contain_text('模型内容不完整',timeout=15000)
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert not errors,errors
 browser.close()
print('PASS: mobile viewport; model HTTP failure and corrupt response; cancel stalled download immediately; retry then real OCR; no page exceptions. Actual iPhone network is not simulated.')
