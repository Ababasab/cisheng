"""Cache attributed Tatoeba examples for seed vocabulary; no keys or AI."""
import concurrent.futures,json,urllib.request,urllib.parse,time
from pathlib import Path
root=Path(__file__).resolve().parents[1];cache=root/'data-cache'/'sentences';cache.mkdir(exist_ok=True)
words=(root/'scripts/seed_words.txt').read_text().split()
words=[w for w in words if w not in ['look','forward','to']]+['look forward to']
def fetch(word):
 path=cache/(word.replace(' ','_')+'.json')
 if path.exists():return word,json.loads(path.read_text(encoding='utf-8'))
 params={'lang':'eng','q':word,'sort':'relevance','limit':30,'word_count':'6-27','trans:lang':'cmn','trans:is_direct':'yes','showtrans':'matching','is_unapproved':'no','is_orphan':'no','is_native':'yes'}
 url='https://api.tatoeba.org/v1/sentences?'+urllib.parse.urlencode(params)
 try:
  with urllib.request.urlopen(url,timeout=35) as r:result=json.load(r)
  path.write_text(json.dumps(result,ensure_ascii=False),encoding='utf-8')
  return word,result
 except Exception as e:print(word,type(e).__name__,flush=True);return word,{'data':[]}
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool: results=dict(pool.map(fetch,dict.fromkeys(words)))
(root/'dist/data/example-seeds.json').write_text(json.dumps(results,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('Cached',sum(len(v['data']) for v in results.values()),'sentences for',len(results),'words',flush=True)
print('Sparse words:',{w:len(v['data']) for w,v in results.items() if len(v['data'])<3},flush=True)
