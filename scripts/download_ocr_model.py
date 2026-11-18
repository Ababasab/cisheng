"""Fetch pinned local English and mixed-Chinese OCR models."""
from pathlib import Path
import hashlib,urllib.request,gzip
url='https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int/eng.traineddata.gz'
with urllib.request.urlopen(url,timeout=90) as r:data=r.read()
assert data[:2]==b'\x1f\x8b'
target=Path(__file__).resolve().parents[1]/'dist/vendor/lang/eng-lstm-v1.traineddata.gz'
target.write_bytes(data)
print({'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})

revision='87416418657359cb625c412a48b6e1d6d41c29bd'
url=f'https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/{revision}/chi_sim.traineddata'
with urllib.request.urlopen(url,timeout=90) as r:data=r.read()
assert hashlib.sha256(data).hexdigest()=='a5fcb6f0db1e1d6d8522f39db4e848f05984669172e584e8d76b6b3141e1f730'
target.with_name('chi_sim-fast-v1.traineddata.gz').write_bytes(gzip.compress(data,mtime=0))
with urllib.request.urlopen(f'https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/{revision}/LICENSE',timeout=60) as r:
 target.with_name('CHI-SIM-LICENSE.txt').write_bytes(r.read())
print({'model':'chi_sim-fast-v1','bytes':len(data),'revision':revision})
