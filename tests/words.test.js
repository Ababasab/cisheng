import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cleanEntries,extractWords,extractHeadwords,visibleWords,parseEntryInput} from '../dist/words.js';

test('manual vocabulary lists split Chinese and English separators while preserving phrases',()=>{
 assert.deepEqual(parseEntryInput('theatre、 concert、 musician、 gallery').entries,['theatre','concert','musician','gallery']);
 assert.deepEqual(parseEntryInput("Apple，apple;look forward to；it’s\twell-known\r\nbanana,,、;").entries,['Apple','look forward to',"it's",'well-known','banana']);
 assert.deepEqual(parseEntryInput('look forward to').entries,['look forward to']);
 assert.deepEqual(parseEntryInput('1、apple\n2. look forward to，3、banana').entries,['apple','look forward to','banana']);
});
test('invalid list segments stay visible for correction and never silently disappear',()=>{
 assert.deepEqual(parseEntryInput('apple、中文，banana;abc123').invalid,['中文','abc123']);
 assert.deepEqual(parseEntryInput('、、,;；\n\t'),{entries:[],invalid:[]});
});
test('deduplicate without changing phrases, contractions or case',()=>assert.deepEqual(cleanEntries("Apple\napple\nlook forward to\nit’s\nwell-known\n中文\n<svg>\n"),['Apple','look forward to',"it's",'well-known']));
test('remove IPA and Chinese, keep words in reading order',()=>assert.equal(extractWords('1. apple /ˈæpl/ 苹果\n2. banana [bəˈnɑːnə] 香蕉'), 'apple\nbanana'));
test('sorting never mutates import order; search ignores case',()=>{const w=[{text:'Zoo'},{text:'apple'},{text:'banana'}];assert.deepEqual(visibleWords(w,'','az').map(w=>w.text),['apple','banana','Zoo']);assert.equal(w[0].text,'Zoo');assert.equal(visibleWords(w,'APP','original')[0].text,'apple');});
test('book entries keep headwords and discard definitions, frequency and POS',()=>assert.equal(extractHeadwords('601. passport (考频24次) n.护照\n602 conscious (Ea 19 X) a.意识到的\n651. option (考频16次) n.选择权\nn. noun\n\n'), 'passport\nconscious\noption'));
test('all-English mode still keeps multiple words; entry mode preserves compounds',()=>{assert.equal(extractWords('apple banana'), 'apple\nbanana');assert.equal(extractHeadwords("23. well-known adj. 著名的\n24. don't v."),"well-known\ndon't");});
