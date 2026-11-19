# Browser speech resources

These assets are served by this website. The browser does not fetch a model,
script, or dictionary from an external CDN, Hugging Face, or a TTS API.
No text or uploaded vocabulary is transmitted to a speech service.

## Voice models

Unmodified ONNX models/configurations from `rhasspy/piper-voices`, pinned revision
`04ca88f5685ca5253c701af3687e155b113bd512`:

- US: `en/en_US/joe/medium/en_US-joe-medium.onnx`. Joe, US English,
  22,050 Hz. Model card and dataset attribution: [US card](models/us-MODEL_CARD.md).
  The card identifies the dataset as CC0, from [OHF Voice datasets](https://github.com/OHF-Voice/voice-datasets).
  Phonemization uses the model's `en-us` configuration.
- UK: `en/en_GB/alba/medium/en_GB-alba-medium.onnx`. Alba, UK English,
  22,050 Hz. [Model card](models/gb-MODEL_CARD.md),
  [Alba speech corpus, University of Edinburgh](https://datashare.ed.ac.uk/handle/10283/3270),
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
  Phonemization uses the model's `en-gb-x-rp` configuration.
- The publisher's [repository metadata](https://huggingface.co/rhasspy/piper-voices/tree/04ca88f5685ca5253c701af3687e155b113bd512)
  labels the voice repository MIT; the per-model cards and dataset notices are retained separately.
  No voice model weights are modified here. The model's length scale is adjusted
  at inference time for the requested speed, without changing playback pitch.

## Inference runtime

ONNX Runtime Web **1.20.1**, Microsoft Corporation, MIT.
Distributed npm archive: `https://registry.npmjs.org/onnxruntime-web/-/onnxruntime-web-1.20.1.tgz`.
Only the single-thread-capable WASM runtime and its corresponding loaders are used;
no WebGPU extension or third-party network loader is used.
[MIT notice](ort/LICENSE.txt),
[upstream source and third-party notices](https://github.com/microsoft/onnxruntime/tree/v1.20.1).

## Phonemizer

`@diffusionstudio/piper-wasm` **1.0.0**, distributed npm archive:
`https://registry.npmjs.org/@diffusionstudio/piper-wasm/-/piper-wasm-1.0.0.tgz`.
Unmodified `piper_phonemize.js`, `.wasm` and `.data` files run in a dedicated
worker and communicate with the page using messages. Package metadata identifies
the wrapper as MIT; this does not replace the underlying component licenses:

- Piper phonemize: [MIT notice](phonemizer/LICENSE-piper-phonemize.txt),
  [source](https://github.com/wide-video/piper-phonemize).
- eSpeak NG and its data: [GNU GPL v3 notice](phonemizer/COPYING-espeak-ng.txt),
  [source](https://github.com/rhasspy/espeak-ng).
- [Distributor's source/build instructions](phonemizer/BUILD-SOURCE.md),
  [distributed binary repository](https://github.com/diffusion-studio/piper-wasm),
  [upstream WebAssembly build project](https://github.com/wide-video/piper-wasm).

`manifest.json` records SHA-256 and byte length for the delivered files.
Development download archives stay outside the repository; no installer or CLI is shipped to users.

## Loading and storage

All large resources are lazy-loaded when needed. The common runtime/phonemizer
plus one voice needs roughly 90 MB of downloads; another accent adds roughly
60 MB. Cached models/data use `word-notes-speech-v1` in the browser Cache API
when available; storage failures do not prevent playback. Only one inference
session is retained to limit device memory. Up to 8 MiB of recent generated
audio is cached in page memory. Models/text are not written into cloud vocabulary
snapshots. No account, operating-system voice installation, or per-request fee
is required for the built-in voices.
