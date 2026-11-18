"""Deletion confirmations, large/archived/default/last folders and reload on a mobile viewport."""
from pathlib import Path
import os,json
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1];out=root/'qa/folder-delete';out.mkdir(parents=True,exist_ok=True)
def letters(i):
 s=''
 while True:
  s=chr(97+i%26)+s;i=i//26-1
  if i<0:return s
folders=[{'id':'default','name':'默认单词本'},{'id':'empty','name':'四级单词'},{'id':'book','name':'四级1000词'},{'id':'notes','name':'随记单词'},{'id':'archived','name':'旧词','archived':True}]
words=[{'id':'book-'+str(i),'text':'word'+letters(i),'folderId':'book','number':i+1} for i in range(1001)]+[{'id':'notes-'+str(i),'text':'note'+letters(i),'folderId':'notes','number':i+1} for i in range(18)]+[{'id':'archive','text':'apple','folderId':'archived','number':1}]
state={'schemaVersion':3,'folders':folders,'words':words,'activeFolderId':'empty'}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True)
 page=b.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
 page.add_init_script('if(!localStorage.getItem("word-notes-v1"))localStorage.setItem("word-notes-v1",'+json.dumps(json.dumps(state))+');')
 page.add_init_script("window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[{name:'Test US',lang:'en-US',localService:true}],cancel:()=>{},addEventListener:()=>{},speak:u=>setTimeout(()=>u.onstart?.(),10)}});")
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(os.environ.get('QA_URL','http://127.0.0.1:4184/'))
 def open_delete(name):page.get_by_role('button',name='删除文件夹 '+name,exact=True).click();expect(page.locator('#confirm-delete-folder')).to_be_visible()
 open_delete('四级单词');expect(page.locator('#delete-folder-summary')).to_contain_text('空文件夹');page.get_by_role('button',name='保留文件夹',exact=True).click();assert page.locator('.folder-item').count()==5
 open_delete('四级单词');page.keyboard.press('Escape');expect(page.locator('#confirm-delete-folder')).not_to_be_visible();assert page.locator('.folder-item').count()==5
 open_delete('四级单词');page.locator('#delete-folder-confirm').click();assert page.locator('.folder-item').count()==4;expect(page.locator('#folder-title')).to_have_text('默认单词本')
 page.get_by_role('button',name='打开文件夹 四级1000词',exact=True).click();page.locator('#read-forward').click();expect(page.locator('#reading-now')).to_be_visible()
 open_delete('默认单词本');page.locator('#delete-folder-confirm').click();expect(page.locator('#reading-now')).to_be_visible();expect(page.locator('#count')).to_have_text('1001')
 open_delete('四级1000词');expect(page.locator('#delete-folder-summary')).to_contain_text('1001');page.screenshot(path=str(out/'mobile-confirm.png'));page.locator('#delete-folder-confirm').click()
 expect(page.locator('#folder-title')).to_have_text('随记单词');expect(page.locator('#count')).to_have_text('18');expect(page.locator('#reading-now')).not_to_be_visible();expect(page.locator('#resume-reading')).not_to_be_visible()
 page.locator('#archive-section').evaluate('(e)=>e.open=true');open_delete('旧词');page.locator('#delete-folder-confirm').click();expect(page.locator('#archived-count')).to_have_text('0');expect(page.locator('#count')).to_have_text('18')
 open_delete('随记单词');page.locator('#delete-folder-confirm').click();assert page.locator('.folder-item').count()==0;expect(page.locator('#folder-title')).to_have_text('选择或新建文件夹');page.reload();assert page.locator('.folder-item').count()==0
 assert page.evaluate("JSON.parse(localStorage.getItem('word-notes-v1')).words.length")==0
 page.locator('#new-folder').click();page.locator('#folder-name-input').fill('新词库');page.locator('#save-folder').click();expect(page.locator('#folder-title')).to_have_text('新词库')
 page.locator('#manual').click();page.locator('#review-text').fill('banana');page.locator('#save-review').click();expect(page.locator('#count')).to_have_text('1')
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert not errors,errors;b.close()
print('PASS: cancel/Escape, empty/default/archived/1001-word deletion, active fallback, reading stopped only for deleted active folder, last-folder reload, new folder after empty, mobile layout.')
