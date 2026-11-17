"""Theme choices must persist without changing the user's vocabulary data."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1]
out = root / 'qa'
out.mkdir(exist_ok=True)
url = os.environ.get('QA_URL', 'http://127.0.0.1:4173/')

with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe', headless=True)
    context = browser.new_context(viewport={'width': 1440, 'height': 1100})
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(url)
    expect(page.locator('html')).to_have_attribute('data-theme', 'codex')
    expect(page.locator('#theme-choice')).to_have_value('codex')
    page.locator('#manual').click()
    page.locator('#review-text').fill('passport\napple')
    page.locator('#save-review').click()
    expect(page.locator('#count')).to_have_text('2')
    words = page.evaluate("localStorage.getItem('word-notes-v1')")
    assert words
    passport = page.locator('.word-row').filter(has=page.get_by_text('passport', exact=True))
    passport.locator('.generate-example').click()
    expect(passport.locator('.sentence-en')).to_have_count(2, timeout=45000)
    themes = {'codex': 'rgb(24, 24, 24)', 'green': 'rgb(247, 248, 243)', 'blue': 'rgb(245, 248, 255)'}
    accents = {'codex': 'rgb(237, 237, 237)', 'green': 'rgb(36, 79, 66)', 'blue': 'rgb(36, 91, 192)'}
    for theme, background in themes.items():
        page.set_viewport_size({'width': 1440, 'height': 1100})
        page.locator('#theme-choice').select_option(theme)
        expect(page.locator('html')).to_have_attribute('data-theme', theme)
        assert page.evaluate('getComputedStyle(document.documentElement).backgroundColor') == background
        expect(page.locator('#upload')).to_have_css('background-color', accents[theme])
        page.screenshot(path=str(out / f'theme-{theme}-desktop.png'), full_page=True, animations='disabled')
        for width in [390, 320]:
            page.set_viewport_size({'width': width, 'height': 844})
            expect(page.locator('#theme-choice')).to_be_visible()
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (theme, width)
            rect = page.locator('#theme-choice').bounding_box()
            assert rect['x'] >= 0 and rect['x'] + rect['width'] <= width
        page.screenshot(path=str(out / f'theme-{theme}-mobile.png'), full_page=True, animations='disabled')
        page.locator('#manual').click()
        page.screenshot(path=str(out / f'theme-{theme}-dialog.png'), animations='disabled')
        page.locator('#review button[value="cancel"]').click()
        page.reload()
        expect(page.locator('#theme-choice')).to_have_value(theme)
        expect(page.locator('#count')).to_have_text('2')
        assert page.evaluate("localStorage.getItem('word-notes-v1')") == words
    # Another tab receives theme changes; auxiliary pages use the same preference.
    other = context.new_page()
    other.goto(url)
    page.locator('#theme-choice').select_option('codex')
    expect(other.locator('html')).to_have_attribute('data-theme', 'codex')
    other.goto(url.rstrip('/') + '/sources.html')
    expect(other.locator('html')).to_have_attribute('data-theme', 'codex')
    assert page.evaluate("localStorage.getItem('word-notes-v1')") == words
    page.evaluate("localStorage.setItem('word-notes-theme', 'unknown')")
    page.reload()
    expect(page.locator('#theme-choice')).to_have_value('codex')
    assert not errors, errors
    # Private/restricted storage still permits switching in the current page.
    blocked = browser.new_context()
    blocked.add_init_script("Object.defineProperty(Storage.prototype, 'getItem', {value(){throw new Error('disabled')}});Object.defineProperty(Storage.prototype, 'setItem', {value(){throw new Error('disabled')}});")
    private = blocked.new_page()
    private.goto(url)
    expect(private.locator('#theme-choice')).to_have_value('codex')
    private.locator('#theme-choice').select_option('blue')
    expect(private.locator('html')).to_have_attribute('data-theme', 'blue')
    browser.close()

print('PASS: three themes, default and persistence, unchanged vocabulary, 320/390px layout, dialogs, cross-tab sync, sources page, invalid preference and restricted storage.')
