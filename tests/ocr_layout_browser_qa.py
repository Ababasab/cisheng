"""Real local OCR for varied unseen layouts; optionally validate the user's 89-line photo."""
from pathlib import Path
import os,sys
from PIL import Image,ImageDraw,ImageFont
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1];out=root/'qa/ocr-layouts';out.mkdir(parents=True,exist_ok=True)
url=os.environ.get('QA_URL','http://127.0.0.1:4173/')
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',34)
cn=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',30)
groups=[['apple','passport','look forward to','take care of','beautiful','journey'],['banana','concert','get ready for','keep in touch','garden','travel'],['gallery','musician','turn off','put away','river','window'],['practice','homework','give up','take part in','school','teacher']]
fixtures=[]
for n,colour,table in [(1,'black',False),(2,'black',False),(3,'black',False),(4,'black',False),(2,'#164eaa',True)]:
 im=Image.new('RGB',(n*650,900),'white');d=ImageDraw.Draw(im)
 d.text((35,30),'词汇学习 / Vocabulary',font=cn,fill='#64448a')
 for col in range(n):
  for i,word in enumerate(groups[col]):
   x=col*650+30;y=170+i*100
   d.text((x,y),f'{i+1}. {word}',font=font,fill=colour)
   d.text((x+370,y),'学习词汇',font=cn,fill='black')
  if table:d.line((col*650+5,125,col*650+5,850),fill='black',width=2)
 if table:
  for y in [125,260,360,460,560,660,760,850]:d.line((5,y,n*650-5,y),fill='black',width=2)
  d.line((n*650-5,125,n*650-5,850),fill='black',width=2)
 path=out/f'{n}-columns-{colour.replace("#","")}-{table}.png';im.save(path)
 fixtures.append((path,sum(groups[:n],[])))
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True)
 page=b.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(url);expect(page.locator('#extract')).to_have_value('auto')
 for path,expected in fixtures:
  page.locator('#file').set_input_files(path)
  page.wait_for_function("document.getElementById('review').open",timeout=120000)
  actual=page.locator('#review-text').input_value().splitlines();print(path.name,actual)
  assert actual==expected,(path.name,expected,actual)
  page.locator('#review').get_by_role('button',name='取消',exact=True).click()
 # The additional local model must fail visibly and remain cancellable on slow mobile networks.
 page.route('**/chi_sim-fast-v1.traineddata.gz',lambda route:route.fulfill(status=404,body='missing'))
 page.locator('#file').set_input_files(fixtures[0][0])
 expect(page.locator('#ocr-error')).to_contain_text('中英混排模型下载失败',timeout=20000)
 expect(page.locator('#upload')).to_be_enabled();page.unroute('**/chi_sim-fast-v1.traineddata.gz')
 page.route('**/chi_sim-fast-v1.traineddata.gz',lambda route:None)
 page.locator('#file').set_input_files(fixtures[0][0])
 expect(page.locator('#ocr-state')).to_contain_text('下载中英混排模型',timeout=20000)
 page.locator('#cancel-ocr').click();expect(page.locator('#recognizing')).to_be_hidden(timeout=3000)
 expect(page.locator('#upload')).to_be_enabled();page.unroute('**/chi_sim-fast-v1.traineddata.gz')
 if len(sys.argv)>1:
  page.locator('#file').set_input_files(sys.argv[1]);page.wait_for_function("document.getElementById('review').open",timeout=180000)
  actual=page.locator('#review-text').input_value().splitlines()
  (out/'user-phrase-result.txt').write_text('\n'.join(actual),encoding='utf-8')
  assert len(actual)==89,len(actual)
  expected=(root/'tests/fixtures/phrase-photo-expected.txt').read_text(encoding='utf-8').splitlines()
  assert actual==expected,[(i,a,e) for i,(a,e) in enumerate(zip(actual,expected),1) if a!=e]
  page.screenshot(path=str(out/'mobile-review.png'))
  page.locator('#save-review').click();expect(page.locator('#count')).to_have_text('88')
  assert 'keep … down' in page.locator('.word-text').all_text_contents()
  assert 'turn left/right' in page.locator('.word-text').all_text_contents()
 assert not errors,errors
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 b.close()
print('PASS: default auto OCR for 1–4 columns and coloured ruled tables; second-model failure/cancel/retry; mobile viewport. Not a real iPhone test.')
