"""Real document fixtures. Install reportlab/python-docx/openpyxl in qa/python-deps or your Python env."""
from pathlib import Path
import sys, os, time, json, zipfile
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'qa/python-deps'))
from docx import Document
from openpyxl import Workbook
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from PIL import Image,ImageDraw,ImageFont
from playwright.sync_api import sync_playwright,expect

out=root/'qa/documents';out.mkdir(parents=True,exist_ok=True)
url=os.environ.get('QA_URL','http://127.0.0.1:4173/')
(out/'words.txt').write_text('1. apple 苹果\npassport /pɑːspɔːt/ n.护照\nlook forward to 盼望\napple\n',encoding='utf-8')
(out/'words-utf16.txt').write_text('apple 苹果\npassport 护照',encoding='utf-16')
(out/'words-gbk.txt').write_bytes('apple 苹果\npassport 护照'.encode('gb18030'))
(out/'words.csv').write_text('序号,word,meaning\n1,apple,"a red, sweet fruit"\n2,passport,护照\n3,look forward to,"期待\n盼望"\n',encoding='utf-8-sig')
(out/'words.tsv').write_text('序号\t英文单词\t中文\n1\tapple\t苹果\n2\tpassport\t护照',encoding='utf-8')
book=Workbook();sheet=book.active;sheet.title='第一单元'
for row in [['序号','word','meaning'],[1,'apple','a red fruit'],[2,'passport','护照'],[3,'look forward to','盼望'],[4,'Apple','duplicate']]:sheet.append(row)
other=book.create_sheet('第二单元');other.append(['word','meaning']);other.append(['conscious','有意识的']);other.append(['option','选择'])
hidden=book.create_sheet('隐藏内容');hidden.append(['hiddenword']);hidden.sheet_state='hidden';book.save(out/'words.xlsx')
doc=Document();doc.add_heading('四级单词表',0)
table=doc.add_table(rows=1,cols=3)
for cell,value in zip(table.rows[0].cells,['序号','word','meaning']):cell.text=value
for row in [['1','apple','苹果'],['2','passport','护照'],['3','look forward to','盼望']]:
 for cell,value in zip(table.add_row().cells,row):cell.text=value
doc.add_paragraph('conscious adj. 有意识的');doc.save(out/'words.docx')
pdf=canvas.Canvas(str(out/'text.pdf'))
for x,words in [(55,['passport','conscious']),(320,['option','anonymous'])]:
 for i,word in enumerate(words):pdf.drawString(x,760-i*30,word)
pdf.showPage();pdf.drawString(55,760,'look forward to');pdf.save()
pdf=canvas.Canvas(str(out/'locked.pdf'),encrypt='test-password');pdf.drawString(50,700,'passport');pdf.save()
image=Image.new('RGB',(1300,1700),'white');draw=ImageDraw.Draw(image);font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',48)
for i,word in enumerate(['passport','conscious','option','anonymous']):draw.text((100,120+i*130),word,font=font,fill='black')
pdf=canvas.Canvas(str(out/'scan.pdf'));pdf.drawImage(ImageReader(image),0,0,width=595,height=780);pdf.save()
pdf=canvas.Canvas(str(out/'mixed.pdf'));pdf.drawString(55,760,'apple');pdf.showPage();pdf.drawImage(ImageReader(image),0,0,width=595,height=780);pdf.drawString(50,810,'Vocabulary');pdf.save()
pdf=canvas.Canvas(str(out/'long-scan.pdf'))
for i in range(10):pdf.drawImage(ImageReader(image),0,0,width=595,height=780);pdf.showPage()
pdf.save()
with zipfile.ZipFile(out/'shared.xlsx','w') as z:
 z.writestr('xl/workbook.xml','<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Shared" r:id="rId1"/></sheets></workbook>')
 z.writestr('xl/_rels/workbook.xml.rels','<Relationships><Relationship Id="rId1" Target="/xl/worksheets/sheet1.xml"/></Relationships>')
 z.writestr('xl/sharedStrings.xml','<sst><si><t>word</t></si><si><t>passport</t></si><si><r><t>look </t></r><r><t>forward to</t></r></si></sst>')
 z.writestr('xl/worksheets/sheet1.xml','<worksheet><sheetData><row><c r="B1" t="s"><v>0</v></c></row><row><c r="B2" t="s"><v>1</v></c></row><row><c r="B3" t="s"><v>2</v></c></row></sheetData></worksheet>')
for name in ['broken.pdf','broken.docx','broken.xlsx']:(out/name).write_bytes(b'not a document')
def vocabulary(index):
 suffix=''
 while True:
  suffix=chr(97+index%26)+suffix;index=index//26-1
  if index<0:return 'vocab'+suffix
large=[vocabulary(i) for i in range(4500)]
(out/'cet4500.txt').write_text('\n'.join(large),encoding='utf-8')

with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True)
 context=browser.new_context(viewport={'width':1440,'height':1100});page=context.new_page();errors=[];external=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('request',lambda r:external.append(r.url) if not r.url.startswith(url.rstrip('/')) and not r.url.startswith(('blob:','data:')) else None)
 page.goto(url)
 def upload(name):page.locator('#document-file').set_input_files(str(out/name))
 def preview(name,expected):
  upload(name);expect(page.locator('#review')).to_be_visible(timeout=90000)
  expect(page.locator('#review-text')).to_have_value('\n'.join(expected),timeout=90000)
  assert not page.locator('#file-review-options').is_hidden()
 def close():page.locator('#review button[value="cancel"]').click()
 base=['apple','passport','look forward to']
 for name,expected in [('words.txt',base),('words-utf16.txt',base[:2]),('words-gbk.txt',base[:2]),('words.csv',base),('words.tsv',base[:2]),('words.docx',base+['conscious']),('shared.xlsx',['passport','look forward to']),('text.pdf',['passport','option','conscious','anonymous','look forward to'])]:
  preview(name,expected);close();print('PASS fixture:',name,flush=True)
 with page.expect_file_chooser() as chooser:page.locator('#import-document').click()
 chooser.value.set_files(str(out/'words.txt'));expect(page.locator('#review')).to_be_visible();expect(page.locator('#review-text')).to_have_value('\n'.join(base));close()
 page.evaluate("""() => {const file=new File(['apple\\npassport'],'drop.txt',{type:'text/plain'});const data=new DataTransfer();data.items.add(file);document.getElementById('dropzone').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:data}));}""")
 expect(page.locator('#review')).to_be_visible();expect(page.locator('#review-text')).to_have_value('apple\npassport');close()
 preview('words.xlsx',base+['conscious','option'])
 page.locator('#file-source').select_option('1');expect(page.locator('#review-text')).to_have_value('conscious\noption')
 page.locator('#file-source').select_option('0');page.locator('#file-column').select_option('2')
 expect(page.locator('#review-text')).to_have_value('a red fruit\nduplicate')
 page.locator('#file-column').select_option('auto');page.locator('#file-mode').select_option('all')
 expect(page.locator('#review-text')).to_have_value('apple\npassport\nlook\nforward\nto')
 page.locator('#file-mode').select_option('entries')
 page.locator('#destination-folder').select_option('__new__');page.locator('#destination-name').fill('四级文件词表')
 page.locator('#save-review').click();expect(page.locator('#count')).to_have_text('3')
 expect(page.locator('#folder-title')).to_have_text('四级文件词表')
 before=page.evaluate("localStorage.getItem('word-notes-v1')")
 preview('words.txt',base);page.locator('#save-review').click();expect(page.locator('#count')).to_have_text('3')
 for name in ['broken.pdf','broken.docx','broken.xlsx','locked.pdf']:
  upload(name);expect(page.locator('#document-error')).to_be_visible(timeout=30000)
  expect(page.locator('#document-loading')).to_be_hidden();assert not page.locator('#review').is_visible()
  assert page.evaluate("localStorage.getItem('word-notes-v1')")==before
 for name in ['old.doc','old.xls','bad.html']:
  page.locator('#document-file').set_input_files({'name':name,'mimeType':'application/octet-stream','buffer':b'not supported'})
  expect(page.locator('#document-error')).to_be_visible()
 page.locator('#document-file').set_input_files({'name':'large.txt','mimeType':'text/plain','buffer':b'a'*(20*1024*1024+1)})
 expect(page.locator('#document-error')).to_contain_text('20 MB')
 # Cancel a worker load before it can finish, then immediately retry.
 pending=[];page.route('**/file-reader.worker.js',lambda route:pending.append(route))
 upload('words.xlsx');expect(page.locator('#document-loading')).to_be_visible();page.locator('#document-cancel').click()
 expect(page.locator('#document-loading')).to_be_hidden();page.unroute('**/file-reader.worker.js')
 preview('words.txt',base);close()
 preview('scan.pdf',['passport','conscious','option','anonymous'])
 expect(page.locator('#file-summary')).to_contain_text('1 页使用图片识别');close()
 print('PASS: real scanned PDF OCR',flush=True)
 upload('mixed.pdf');expect(page.locator('#review')).to_be_visible(timeout=90000)
 mixed=page.locator('#review-text').input_value().splitlines()
 assert set(['apple','passport','conscious','option','anonymous']).issubset(mixed),mixed
 expect(page.locator('#file-summary')).to_contain_text('1 页使用图片识别');close()
 upload('long-scan.pdf');expect(page.locator('#document-state')).to_contain_text('扫描页',timeout=30000)
 page.locator('#document-cancel').click();expect(page.locator('#document-loading')).to_be_hidden()
 preview('words.txt',base);close();assert page.evaluate("localStorage.getItem('word-notes-v1')")==before
 # Full CET-size list must not spend quadratic time finding every DOM row.
 started=time.monotonic();preview('cet4500.txt',large)
 page.locator('#destination-folder').select_option('__new__');page.locator('#destination-name').fill('完整四级词表')
 page.locator('#save-review').click();expect(page.locator('#count')).to_have_text('4500',timeout=30000)
 elapsed=time.monotonic()-started;assert elapsed<30,elapsed
 page.screenshot(path=str(out/'import-desktop.png'),full_page=True)
 page.set_viewport_size({'width':390,'height':844});preview('words.xlsx',base);expect(page.locator('#file-source')).to_have_value('0');page.locator('#file-source').select_option('all');expect(page.locator('#review-text')).to_have_value('\n'.join(base+['conscious','option']))
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.screenshot(path=str(out/'import-mobile.png'));close()
 page.reload();expect(page.locator('#count')).to_have_text('4500',timeout=30000)
 assert not errors,errors
 assert not external,external
 browser.close()
 print(f'PASS: file formats, selected sheets/columns/modes, folders/dedup, errors, cancel/retry, no external requests, mobile layout and 4500-word persistence ({elapsed:.2f}s).')
