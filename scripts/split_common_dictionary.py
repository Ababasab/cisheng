"""Derive small same-origin common-word shards from the existing licensed dictionary."""
from pathlib import Path
import json,re
root=Path(__file__).resolve().parents[1]
common=json.loads((root/'dist/data/dict-common.json').read_text(encoding='utf-8'))
parts={a+b:{} for a in 'abcdefghijklmnopqrstuvwxyz' for b in 'abcdefghijklmnopqrstuvwxyz_'}
for word,entry in common.items():parts[re.sub('[^a-z]','_',(word+'__')[:2])][word]=entry
out=root/'dist/data/common';out.mkdir(exist_ok=True)
for key,entries in parts.items():(out/f'{key}.json').write_text(json.dumps(entries,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print(f'Wrote {len(parts)} common-word shards ({len(common)} entries).')
