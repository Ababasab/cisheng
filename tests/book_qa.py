from pathlib import Path
import sys
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1];out=root/'qa';out.mkdir(exist_ok=True)
if len(sys.argv)!=3: raise SystemExit('Usage: python tests/book_qa.py PHOTO_PATH EXPECTED_WORDS_TXT')
photo=Path(sys.argv[1]);expected=Path(sys.argv[2]).read_text(encoding='utf-8').splitlines()
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True)
 page=browser.new_page();page.goto('http://127.0.0.1:4173')
 page.locator('#file').set_input_files(photo)
 page.wait_for_function("document.getElementById('review').open",timeout=120000)
 actual=page.locator('#review-text').input_value().splitlines()
 (out/'book-recognition.txt').write_text('\n'.join(actual),encoding='utf-8')
 (out/'book-corrected.txt').write_text('\n'.join(expected),encoding='utf-8')
 missing=[w for w in expected if w not in actual];extra=[w for w in actual if w not in expected]
 print({'expected':len(expected),'actual':len(actual),'correct':len(expected)-len(missing),'missing':missing,'extra':extra})
 page.screenshot(path=str(out/'book-review.png'))
 assert actual==expected, 'Book recognition differs from the checked reference; inspect qa/book-recognition.txt'
 browser.close()
