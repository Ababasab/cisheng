import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync,createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
const base=new URL('../dist/vendor/speech/',import.meta.url);
test('pinned speech binaries have complete bytes, valid hashes and distinct US/GB phonemizer configurations',async()=>{
 const manifest=JSON.parse(readFileSync(new URL('manifest.json',base),'utf8'));
 for(const [path,expected] of Object.entries(manifest.files)){
  assert.ok(!path.includes('..'));const file=new URL(path,base);assert.equal(statSync(file).size,expected.bytes,path);
  const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);assert.equal(hash.digest('hex'),expected.sha256,path);
 }
 const us=JSON.parse(readFileSync(new URL('models/us-amy-v2.onnx.json',base),'utf8')),gb=JSON.parse(readFileSync(new URL('models/gb.onnx.json',base),'utf8'));
 assert.equal(us.espeak.voice,'en-us');assert.match(gb.espeak.voice,/^en-gb/);assert.equal(us.audio.sample_rate,22050);assert.equal(gb.audio.sample_rate,22050);
});
