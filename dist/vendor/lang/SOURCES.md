# Local OCR models

- `eng-lstm-v1.traineddata.gz`: `@tesseract.js-data/eng@1.0.0`, `4.0.0_best_int/eng.traineddata.gz`, Apache 2.0.
- `chi_sim-fast-v1.traineddata.gz`: [tesseract-ocr/tessdata_fast](https://github.com/tesseract-ocr/tessdata_fast), revision `87416418657359cb625c412a48b6e1d6d41c29bd`, `chi_sim.traineddata`, Apache 2.0 (see `CHI-SIM-LICENSE.txt`).
  Uncompressed SHA-256: `a5fcb6f0db1e1d6d8522f39db4e848f05984669172e584e8d76b6b3141e1f730`.

Reproduce downloads with `python scripts/download_ocr_model.py`. Models are served from this site; user photos are processed locally.
