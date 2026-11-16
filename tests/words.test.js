import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cleanEntries,extractWords,extractHeadwords,visibleWords} from '../dist/words.js';
test('deduplicate without changing phrases, contractions or case',()=>assert.deepEqual(cleanEntries("Apple\napple\nlook forward to\nit’s\nwell-known\n中文\n<svg>\n"),['Apple','look forward to',"it's",'well-known']));
test('remove IPA and Chinese, keep words in reading order',()=>assert.equal(extractWords('1. apple /ˈæpl/ 苹果\n2. banana [bəˈnɑːnə] 香蕉'), 'apple\nbanana'));
test('sorting never mutates import order; search ignores case',()=>{const w=[{text:'Zoo'},{text:'apple'},{text:'banana'}];assert.deepEqual(visibleWords(w,'','az').map(w=>w.text),['apple','banana','Zoo']);assert.equal(w[0].text,'Zoo');assert.equal(visibleWords(w,'APP','original')[0].text,'apple');});
test('book entries keep headwords and discard definitions, frequency and POS',()=>assert.equal(extractHeadwords('601. passport (考频24次) n.护照\n602 conscious (Ea 19 X) a.意识到的\n651. option (考频16次) n.选择权\nn. noun\n\n'), 'passport\nconscious\noption'));
test('all-English mode still keeps multiple words; entry mode preserves compounds',()=>{assert.equal(extractWords('apple banana'), 'apple\nbanana');assert.equal(extractHeadwords("23. well-known adj. 著名的\n24. don't v."),"well-known\ndon't");});
