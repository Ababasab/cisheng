"""Fetch the smaller LSTM-only English model used by the pinned Tesseract.js worker."""
from pathlib import Path
import hashlib,urllib.request
url='https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int/eng.traineddata.gz'
with urllib.request.urlopen(url,timeout=90) as r:data=r.read()
assert data[:2]==b'\x1f\x8b'
target=Path(__file__).resolve().parents[1]/'dist/vendor/lang/eng-lstm-v1.traineddata.gz'
target.write_bytes(data)
print({'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
