import {test} from 'node:test';
import assert from 'node:assert/strict';
import {entryFromLine,readOcrEntries,mergeOcrEntries} from '../dist/ocr-entries.js';
import {findColumns} from '../dist/layout.js';
import {parseEntryInput} from '../dist/words.js';
const line=(words,top=100)=>({text:words.map(w=>w[0]).join(' '),words:words.map(([text,confidence=95])=>({text,confidence})),top,height:30});

test('mixed OCR preserves complete phrases, placeholders and slash alternatives before Chinese',()=>{
 assert.equal(entryFromLine(line([['1.'],['look'],['forward'],['to'],['盼望']])).text,'look forward to');
 assert.equal(entryFromLine(line([['5.'],['keep...down'],['控制']])).text,'keep … down');
 assert.equal(entryFromLine(line([['6.'],['keep'],['healthy/fit'],['保持健康']])).text,'keep healthy/fit');
 assert.deepEqual(parseEntryInput('keep healthy/fit、turn left/right').entries,['keep healthy/fit','turn left/right']);
 assert.equal(entryFromLine(line([['2.'],['passport'],['(考频24次)'],['n.'],['护照']])).text,'passport');
});
test('Chinese-lookalike fragments, headers and POS are not added as English',()=>{
 assert.equal(entryFromLine(line([['20.'],['get'],['down'],['BT,',26],['HE',10]])).text,'get down');
 assert.equal(entryFromLine(line([['6.'],['take'],['out'],['EH',65]])).text,'take out');
 assert.equal(entryFromLine(line([['三、'],['get'],['短语']])),null);
 assert.equal(entryFromLine(line([['RIG',27]])),null);
 assert.equal(entryFromLine(line([['1.'],['United'],['Nations'],['联合国']])).text,'United Nations');
 assert.equal(entryFromLine(line([['NASA',96],['美国宇航局']])).text,'NASA');
 assert.equal(entryFromLine(line([['apple'],['n.'],['苹果']])).text,'apple');
 assert.equal(entryFromLine(line([['word'],['单词']])).text,'word');
 assert.equal(entryFromLine(line([['phrase'],['短语']])).text,'phrase');
 assert.equal(entryFromLine(line([['—.'],['look'],['短语']])),null);
});
test('colour repair requires matching lines and cannot truncate phrases or delete placeholders',()=>{
 const original=['puton','keep … down','get married','take care'].map((text,i)=>({...line([[text]],i*60),text,confidence:i===0?70:90}));
 const colour=['put on','keep','get marmed','take care'].map((text,i)=>({...original[i],text,confidence:96}));
 assert.deepEqual(mergeOcrEntries(original,colour).map(l=>l.text),['put on','keep … down','get married','take care']);
 // A strong reading isn't replaced by an alternative with a lower confidence.
 original[2].confidence=97;assert.equal(mergeOcrEntries(original,colour)[2].text,'get married');
 assert.equal(mergeOcrEntries(original,[colour[0]]),original);
});
test('TSV retains line confidence and positions, while text-only fallback preserves phrases',()=>{
 const tsv='5\t1\t1\t1\t1\t1\t20\t100\t80\t30\t96\tlook\n5\t1\t1\t1\t1\t2\t110\t100\t40\t30\t95\tup\n5\t1\t1\t1\t1\t3\t160\t100\t60\t30\t90\t查阅';
 const entries=readOcrEntries({tsv});assert.equal(entries[0].text,'look up');assert.equal(entries[0].top,100);
 assert.deepEqual(readOcrEntries({text:'1. take care of 照顾\n2. apple 苹果'}).map(e=>e.text),['take care of','apple']);
});
test('automatic projection finds single, double, triple and four columns without splitting number margins',()=>{
 const w=1200,h=1000;
 for(let n=1;n<=4;n++){
  const data=new Uint8ClampedArray(w*h*4).fill(255);
  for(let col=0;col<n;col++)for(let y=200;y<900;y+=60)for(let dy=0;dy<24;dy++)for(let x=Math.round(col*w/n+15);x<Math.round((col+1)*w/n-25);x++){
   const i=((y+dy)*w+x)*4;data[i]=data[i+1]=data[i+2]=0;
  }
  const canvas={width:w,height:h,getContext:()=>({getImageData:()=>({data})})};
  assert.equal(findColumns(canvas).length,n);
  assert.equal(findColumns(canvas,'single').length,1);
 }
});
