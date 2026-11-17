"""Download licensed dictionary/corpus and prepare same-origin learning data."""
import concurrent.futures,csv,json,re,urllib.request,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];CACHE=ROOT/'data-cache';OUT=ROOT/'dist'/'data'
CACHE.mkdir(exist_ok=True);OUT.mkdir(exist_ok=True)
def download(name,url):
 p=CACHE/name
 if not p.exists():
  with urllib.request.urlopen(url,timeout=180) as r:p.write_bytes(r.read())
 print(name,p.stat().st_size,flush=True)
 return p
sources=[('ecdict.csv','https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv'),('ECDICT-LICENSE.txt','https://raw.githubusercontent.com/skywind3000/ECDICT/master/LICENSE')]
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool: files=list(pool.map(lambda args:download(*args),sources))
buckets={a+b:{} for a in 'abcdefghijklmnopqrstuvwxyz' for b in 'abcdefghijklmnopqrstuvwxyz_'};common={}
with files[0].open(encoding='utf-8-sig',newline='') as f:
 for row in csv.DictReader(f):
  word=row['word'].lower().replace('’',"'").strip()
  if not re.fullmatch(r"[a-z]+(?:[ '-][a-z]+)*",word) or len(word)>100:continue
  translation=row['translation'].replace('\\n','\n').strip()
  if not translation:continue
  value={'zh':translation,'ipa':row['phonetic'].strip(),'forms':row.get('exchange','')}
  key=re.sub('[^a-z]','_', (word+'__')[:2])
  if word not in buckets[key] or not buckets[key][word]['ipa']:buckets[key][word]=value
  if any(0<int(row.get(rank) or '0')<=30000 for rank in ['bnc','frq']) or row.get('tag'):common[word]=value
for c,bucket in buckets.items():(OUT/f'dict-{c}.json').write_text(json.dumps(bucket,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(OUT/'ECDICT-LICENSE.txt').write_bytes(files[1].read_bytes())
(OUT/'dict-common.json').write_text(json.dumps(common,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
manifest={'dictionaryEntries':sum(map(len,buckets.values())),'commonEntries':len(common),'sources':[{'url':url,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p,(_,url) in zip(files,sources)]}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print({k:v for k,v in manifest.items() if k!='sources'},flush=True)

# Keep the mobile lookup shards in sync whenever source dictionary data is rebuilt.
import runpy
runpy.run_path(str(ROOT/"scripts/split_common_dictionary.py"))
