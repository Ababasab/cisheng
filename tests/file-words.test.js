import test from 'node:test';
import assert from 'node:assert/strict';
import {documentType,decodeFileText,parseDelimited,fileEntry,autoColumns,extractFileEntries,pdfTextRows} from '../dist/file-words.js';

test('file validation rejects old binaries, empty, oversized and unsupported documents',()=>{
 assert.equal(documentType({name:'CET4.XLSX',size:100}),'xlsx');
 for(const [name,size] of [['x.doc',10],['x.xls',10],['x.html',10],['x.pdf',0],['x.txt',21*1024*1024]])assert.throws(()=>documentType({name,size}));
});
test('text decoding preserves UTF8, UTF16 and GB18030 bilingual word lists',()=>{
 const text='apple 苹果';assert.equal(decodeFileText(new TextEncoder().encode(text)),text);
 assert.equal(decodeFileText(new Uint8Array([255,254,97,0,112,0,112,0,108,0,101,0])),'apple');
 assert.equal(decodeFileText(new Uint8Array([97,112,112,108,101,32,198,187,185,251])),text);
});
test('CSV handles quoted commas, escaped quotes, multiline cells, CRLF and empty rows',()=>{
 assert.deepEqual(parseDelimited('word,meaning\r\napple,"fruit, red"\r\n"look forward to","期盼\n期待"\r\n"say ""hi""",问好\r\n\r\n'),[['word','meaning'],['apple','fruit, red'],['look forward to','期盼\n期待'],['say "hi"','问好']]);
 assert.throws(()=>parseDelimited('apple,"broken'));
});
test('word list extraction keeps phrases and contractions, excluding numbering, IPA, POS and headings',()=>{
 assert.equal(fileEntry('651. option /ˈɒpʃn/ n. 选择'),'option');
 assert.equal(fileEntry('look forward to 盼望'),'look forward to');
 assert.equal(fileEntry('take part in vi. 参加'),'take part in');
 assert.equal(fileEntry("don't [dəʊnt] 不要"),"don't");
 assert.equal(fileEntry('a'),'a');
 for(const line of ['word','Unit 1','CET-4 Vocabulary','Page 12','adj.','这是中文','A complete example sentence.'])assert.equal(fileEntry(line),'');
});
test('table automatic columns prefer headers and preserve words rather than English definitions',()=>{
 const rows=[['序号','单词','meaning'],['1','apple','a red fruit'],['2','look forward to','expect something'],['3','Apple','duplicate']];
 assert.deepEqual(autoColumns(rows),[1]);
 assert.deepEqual(extractFileEntries([{type:'table',rows}]),['apple','look forward to']);
 assert.deepEqual(extractFileEntries([{type:'table',rows}],{column:'2'}),['a red fruit','expect something','duplicate']);
 const noHeader=[['1','passport','护照'],['2','conscious','有意识的']];assert.deepEqual(autoColumns(noHeader),[1]);
});
test('source selection includes every chosen sheet, while text preserves one phrase per line',()=>{
 const sources=[{type:'table',rows:[['word'],['apple']]},{type:'text',rows:[['take part in 参加'],['apple 苹果'],['passport 护照']]}];
 assert.deepEqual(extractFileEntries(sources),['apple','take part in','passport']);
 assert.deepEqual(extractFileEntries(sources,{source:'1'}),['take part in','apple','passport']);
 assert.deepEqual(extractFileEntries(sources,{source:'1',mode:'all'}),['take','part','in','apple','passport']);
});
test('PDF text layout joins glyph fragments, preserves phrase spacing and splits distant columns',()=>{
 const item=(str,x,y,width)=>({str,transform:[10,0,0,10,x,y],width});
 const rows=pdfTextRows([item('port',75,100,20),item('pass',55,100,20),item('option',320,100,40),item('forward',81,80,40),item('look',55,80,23),item('to',124,80,10)]);
 assert.deepEqual(rows,[['passport','option'],['look forward to']]);
});
