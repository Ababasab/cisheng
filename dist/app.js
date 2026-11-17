import { cleanEntries, extractWords, extractHeadwords, visibleWords,parseEntryInput } from './words.js';
import { findGutter, headwordInset } from './layout.js';
import { lookupWord, loadExamples, pickExamples } from './learning.js';
import {migrateFolders,folderWords,addToFolder,folderName} from './folders.js';
import {SpeechPlayer,matchingVoices,voiceId} from './speech.js';
import {OcrWorker,loadingProgress} from './ocr.js';
import {documentType,extractFileEntries} from './file-words.js';
import {ReadingQueue,readingList,numberedWords,SPEECH_RATES} from './reading.js';
const $ = id => document.getElementById(id);
const KEY = 'word-notes-v1';
let words = [], accent = 'en-US', rate = 1, worker = null, ocrRun = 0, editing = null, playing = null, previewURL = null;
let noticeTimer;
let voicePreferences={};
let folders=[],activeFolderId=null,editingFolderId=null,clearFolderId=null;
let hideAllChinese=false;
let documentAbort=null,fileReview=null,readingSpeechPhase='loading';
const chineseOverrides=new Map(),definitions=new Map(),exampleStates=new Map();
function notice(text) { $('notice').textContent = text; $('notice').hidden = false; clearTimeout(noticeTimer); noticeTimer = setTimeout(() => $('notice').hidden = true, 5000); }
try { const stored = JSON.parse(localStorage.getItem(KEY) || '{}')||{};({folders,words,activeFolderId}=migrateFolders(stored));if(['en-US','en-GB'].includes(stored.accent)) accent = stored.accent; if([...SPEECH_RATES,.7,.9,1.1].includes(stored.rate)) rate=stored.rate; } catch {({folders,words,activeFolderId}=migrateFolders());notice('无法读取本地记录，请导出备份后继续使用。'); }
try {const stored=JSON.parse(localStorage.getItem(KEY)||'{}');hideAllChinese=stored.hideAllChinese===true;for(const [id,hidden] of Object.entries(stored.chineseOverrides||{}))if(typeof hidden==='boolean')chineseOverrides.set(id,hidden);}catch{}
try{const stored=JSON.parse(localStorage.getItem(KEY)||'{}');for(const lang of ['en-US','en-GB'])if(typeof stored?.voicePreferences?.[lang]==='string')voicePreferences[lang]=stored.voicePreferences[lang];}catch{}
function persist() { try { localStorage.setItem(KEY, JSON.stringify({schemaVersion:3,folders,activeFolderId,words,accent,rate,hideAllChinese,chineseOverrides:Object.fromEntries(chineseOverrides),voicePreferences})); } catch { notice('浏览器未能保存记录，请导出单词备份。'); } }
const currentFolder=()=>folders.find(f=>f.id===activeFolderId);
function voice(){const voices=matchingVoices(window.speechSynthesis?.getVoices()||[],accent);return voices.find(v=>voiceId(v)===voicePreferences[accent])||voices.find(v=>!speechPlayer.failed.has(voiceId(v)))||null;}
function updateVoice(){
 const voices=matchingVoices(window.speechSynthesis?.getVoices()||[],accent);$('voice-choice').replaceChildren();
 const auto=document.createElement('option');auto.value='';auto.textContent='自动选择（本机语音优先）';$('voice-choice').append(auto);
 const system=document.createElement('option');system.value='__system__';system.textContent='浏览器默认英语声音';$('voice-choice').append(system);
 for(const v of voices){const option=document.createElement('option');option.value=voiceId(v);option.textContent=`${v.name} · ${v.localService===true?'本机':'在线/系统服务'}`;$('voice-choice').append(option);}
 $('voice-choice').value=voicePreferences[accent]==='__system__'||voices.some(v=>voiceId(v)===voicePreferences[accent])?voicePreferences[accent]:'';
 const v=voicePreferences[accent]==='__system__'?null:voice();$('voice-status').textContent=v?`当前声音：${v.name} · ${v.localService===true?'本机语音':'在线/系统服务，可能需要联网'}`:'将尝试浏览器默认英语声音；若无声，请选择其他声音或安装对应英语语音包。';
}
const speechPlayer=new SpeechPlayer(window.speechSynthesis,window.SpeechSynthesisUtterance,(state,detail)=>{
 if(readingQueue.active&&['loading','speaking','retry'].includes(state)){readingSpeechPhase=state;$('reading-current-label').textContent=state==='speaking'?'正在朗读':state==='retry'?'正在切换声音':'准备朗读';}
 if(state==='loading')$('voice-status').textContent=`正在准备：${detail.voice?.name||'浏览器默认英语声音'}…`;
 if(state==='speaking')$('voice-status').textContent=`正在朗读：${detail.voice?.name||'浏览器默认英语声音'}`;
 if(state==='retry')$('voice-status').textContent=`${detail.message}，正在尝试其他声音…`;
 readingQueue.handleSpeechState(state);
 if(['done','idle','error'].includes(state)&&!readingQueue.active){playing=null;paintPlaying();}
 if(state==='done')$('voice-status').textContent=`播放完成 · ${detail.voice?.name||'浏览器默认英语声音'}`;
 if(state==='error'){$('voice-status').textContent=`${detail.message}。可换一个声音后点“试听”。`;notice(detail.message);$('speech-help').open=true;$('voice-info').open=true;}
});
const readingQueue=new ReadingQueue({
 play:word=>speechPlayer.play(word.text,{lang:accent,rate,preferred:voicePreferences[accent]||''}),
 cancel:()=>speechPlayer.cancel(),
 onChange:state=>{if(state.status==='reading')readingSpeechPhase='loading';playing=state.current?.id||null;updateReadingControls(state);paintPlaying(state.status==='reading');}
});
function paintPlaying(scroll=false){
 const row=playing?$('word-list').querySelector(`[data-word-id="${CSS.escape(playing)}"]`):null;
 for(const old of $('word-list').querySelectorAll('.playing'))if(old!==row){old.classList.remove('playing');old.removeAttribute('aria-current');}
 if(row){row.classList.add('playing');row.setAttribute('aria-current','true');if(scroll){const list=$('word-list'),box=list.getBoundingClientRect(),r=row.getBoundingClientRect();if(r.top<box.top||r.bottom>box.bottom)list.scrollTop+=r.top-box.top;}}
}
function updateReadingControls(state=readingQueue.snapshot()){
 const current=folderWords(words,activeFolderId),empty=!current.length;
 for(const id of ['read-forward','read-reverse','read-range'])$(id).disabled=empty;
 $('stop-reading').disabled=!state.active;$('resume-reading').hidden=!state.canResume;
 $('reading-now').hidden=!state.active;
 if(state.active){$('reading-current-number').textContent=`${state.current.number}.`;$('reading-current-word').textContent=state.current.text;$('reading-current-label').textContent=state.status==='waiting'?'刚刚读完':readingSpeechPhase==='speaking'?'正在朗读':readingSpeechPhase==='retry'?'正在切换声音':'准备朗读';}
 $('reading-progress').textContent=state.active?`连读进度 ${state.index+1} / ${state.total}`:state.status==='complete'?`连读完成 · 共 ${state.total} 个单词`:state.status==='error'?'连读已停止，请检查上方声音提示后重试。':state.status==='stopped'?`已停止连读${state.total?` · ${Math.min(state.index+1,state.total)} / ${state.total}`:''}`:'选择顺读、倒读，或输入编号范围。';
 $('reading-number-info').textContent=current.length?`当前按${$('sort').value==='az'?'字母排序':'录入顺序'}编号：1-${current.length}。搜索时保留该编号。`:'添加单词后按当前排序显示编号。';
}
function startReading(mode){
 $('reading-error').textContent='';
 try{
  const list=readingList(folderWords(words,activeFolderId),{mode,query:$('search').value,sort:$('sort').value,range:$('reading-range').value});
  if(mode==='range'&&$('search').value){$('search').value='';render();}
  readingQueue.start(list);
 }catch(error){$('reading-error').textContent=error.message;}
}
$('read-forward').onclick=()=>startReading('forward');$('read-reverse').onclick=()=>startReading('reverse');$('read-range').onclick=()=>startReading('range');
$('stop-reading').onclick=()=>stop();$('resume-reading').onclick=()=>readingQueue.resume();
$('reading-range').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();startReading('range');}});
$('reading-range').oninput=()=>{$('reading-error').textContent='';};
window.addEventListener('resize',()=>{if(readingQueue.active)paintPlaying(true);});
function stop() { readingQueue.stop();playing = null;paintPlaying(); }
function speak(word) {
 speakText(word.text,word.id);
}
function speakText(text,id) {
 readingQueue.stop();
 playing=id;render();speechPlayer.play(text,{lang:accent,rate,preferred:voicePreferences[accent]||''});
}
const speaker = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4zM17 8c3 2 3 6 0 8M20 5c5 4 5 10 0 14"/></svg>';
const hiddenChinese=id=>chineseOverrides.has(id)?chineseOverrides.get(id):hideAllChinese;
const element=(tag,className,text)=>{const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e;};
const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){const w=words.find(w=>w.id===entry.target.dataset.wordId);if(w)enrich(w);observer.unobserve(entry.target);}},{root:$('word-list'),rootMargin:'120px'});
async function enrich(w,retry=false){
 const key=w.text.toLowerCase();let state=definitions.get(key);
 if(state&&!retry){paintDefinition(w);return;}
 state={status:'loading'};definitions.set(key,state);paintDefinition(w);
 try{state.data=await lookupWord(w.text);state.status=state.data?'ready':'missing';}catch{state.status='error';}
 for(const word of words)if(word.text.toLowerCase()===key)paintDefinition(word);
}
function paintDefinition(w,row=null){
 row ||= $('word-list').querySelector(`[data-word-id="${CSS.escape(w.id)}"]`);if(!row)return;
 const state=definitions.get(w.text.toLowerCase());const ipa=row.querySelector('.ipa'),meaning=row.querySelector('.meaning-text'),retry=row.querySelector('.retry-definition');
 ipa.textContent=state?.data?.ipa?`/${state.data.ipa.replace(/^\[|\]$/g,'')}/`:state?.status==='loading'?'加载音标…':'暂无音标';
 ipa.title='词典参考音标，以英式为主；朗读使用上方选择的口音。';
 meaning.textContent=state?.data?.zh|| (state?.status==='error'?'词典加载失败':state?.status==='missing'?'词典暂未收录，请检查拼写':'正在查释义…');
 retry.hidden=state?.status!=='error';
}
async function generateExamples(w){
 const key=w.text.toLowerCase(),old=exampleStates.get(key);if(old?.status==='loading')return;
 const state={...old,status:'loading'};exampleStates.set(key,state);render();
 try{
  if(!state.pool){let entry=definitions.get(key)?.data;if(!entry)try{entry=await lookupWord(w.text);}catch{}state.pool=await loadExamples(w.text,entry?.forms||'');}
  state.shown=pickExamples(state.pool,state.shown||[]);state.status=state.shown.length?'ready':'empty';
 }catch{state.status='error';}
 render();
}
function paintExamples(w,row){
 const state=exampleStates.get(w.text.toLowerCase());if(!state)return;
 const area=element('div','example-area');area.setAttribute('aria-live','polite');
 if(state.status==='loading'&&!state.shown?.length)area.append(element('p','example-message','正在挑选双语例句…'));
 if(state.status==='empty')area.append(element('p','example-message','暂未找到适合该词的双语例句。请检查拼写，例句库会持续补充。'));
 if(state.status==='error')area.append(element('p','example-message','例句加载失败，请检查网络后再点一次重试。'));
 for(const s of state.shown||[]){
  const card=element('div','example-card');
  const line=element('div','example-line');line.append(element('p','sentence-en',s.en));
  const say=element('button','sentence-speak','朗读');say.setAttribute('aria-label',`朗读例句：${s.en}`);say.onclick=()=>speakText(s.en,w.id);line.append(say);card.append(line);
  const translation=element('p','sentence-zh',s.zh);translation.hidden=hiddenChinese(w.id);card.append(translation);
  const details=element('details','example-credit');details.append(element('summary','','例句来源与许可'));
  const credit=element('span','',`英文：${s.owner} · ${s.license}；中文：${s.translationOwner} · ${s.translationLicense||'CC BY 2.0 FR'}。`);
  const source=element('a','',s.local?'原创例句说明':'查看原句');source.href=s.local?'./sources.html#curated':`https://tatoeba.org/en/sentences/show/${encodeURIComponent(s.id)}`;source.target='_blank';source.rel='noopener noreferrer';
  details.append(credit,source);
  if(!s.local){const translatedSource=element('a','','查看译文');translatedSource.href=`https://tatoeba.org/en/sentences/show/${encodeURIComponent(s.translationId)}`;translatedSource.target='_blank';translatedSource.rel='noopener noreferrer';details.append(translatedSource);}
  card.append(details);area.append(card);
 }
 if(state.status==='ready')area.append(element('p','example-message',`随机选自双语例句库 · 当前有 ${state.pool.length} 句可选${state.pool.length<=2?'，已全部展示':''}`));
 const collapse=element('button','text-button','收起例句');collapse.onclick=()=>{exampleStates.delete(w.text.toLowerCase());render();};area.append(collapse);row.append(area);
}
function switchFolder(id){readingQueue.reset();playing=null;activeFolderId=id;exampleStates.clear();$('search').value='';$('reading-error').textContent='';$('reading-range').value='';$('word-list').scrollTop=0;persist();render();}
function renderFolders(){
 const active=document.createDocumentFragment(),archived=document.createDocumentFragment();
 for(const folder of folders){
  const row=element('div','folder-item'+(folder.id===activeFolderId?' active':''));row.dataset.folderId=folder.id;
  const select=element('button','folder-select');select.setAttribute('aria-label',`打开文件夹 ${folder.name}`);select.setAttribute('aria-current',String(folder.id===activeFolderId));
  select.append(element('span','folder-icon',folder.archived?'▤':'▱'),element('span','folder-name',folder.name),element('span','folder-count',String(folderWords(words,folder.id).length)));select.onclick=()=>switchFolder(folder.id);
  const rename=element('button','folder-rename','✎');rename.setAttribute('aria-label',`重命名文件夹 ${folder.name}`);rename.title='重命名';rename.onclick=()=>openFolderDialog(folder.id);
  const archive=element('button','folder-archive',folder.archived?'↶':'↓');archive.setAttribute('aria-label',`${folder.archived?'恢复':'归档'}文件夹 ${folder.name}`);archive.title=folder.archived?'恢复':'归档';archive.onclick=()=>setArchived(folder.id,!folder.archived);
  row.append(select,rename,archive);(folder.archived?archived:active).append(row);
 }
 $('folder-list').replaceChildren(active);$('archived-folders').replaceChildren(archived);
 $('no-folders').hidden=folders.some(f=>!f.archived);$('archived-count').textContent=folders.filter(f=>f.archived).length;
 $('folder-total').textContent=`${folders.filter(f=>!f.archived).length} 个文件夹`;
}
function setArchived(id,archived){
 const folder=folders.find(f=>f.id===id);if(!folder)return;folder.archived=archived;
 if(archived){$('archive-section').open=true;if(activeFolderId===id)switchFolder(folders.find(f=>!f.archived)?.id||null);}
 else switchFolder(id);
 persist();render();notice(archived?`已归档“${folder.name}”，词汇仍保留。`:`已恢复“${folder.name}”。`);
}
function nameError(name,id=null){if(!name)return '请给文件夹起个名字。';if(folders.some(f=>f.id!==id&&f.name.toLocaleLowerCase()===name.toLocaleLowerCase()))return '已有同名文件夹，请换个名字；已归档的文件夹可直接恢复。';return '';}
function openFolderDialog(id=null){
 editingFolderId=id;const folder=folders.find(f=>f.id===id);$('folder-dialog-title').textContent=folder?'重命名文件夹':'新建文件夹';$('folder-name-input').value=folder?.name||'';$('folder-name-error').textContent='';$('folder-dialog').showModal();$('folder-name-input').focus();$('folder-name-input').select();
}
$('new-folder').onclick=()=>openFolderDialog();
$('save-folder').onclick=()=>{
 const name=folderName($('folder-name-input').value),error=nameError(name,editingFolderId);if(error){$('folder-name-error').textContent=error;return;}
 if(editingFolderId){const folder=folders.find(f=>f.id===editingFolderId);if(folder)folder.name=name;persist();render();}
 else{const folder={id:crypto.randomUUID(),name,archived:false};folders.push(folder);switchFolder(folder.id);}
 $('folder-dialog').close();
};
$('folder-name-input').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();$('save-folder').click();}});
$('restore-current').onclick=()=>{if(currentFolder())setArchived(activeFolderId,false);};
function render() {
 observer.disconnect();
 const folder=currentFolder(),current=folderWords(words,activeFolderId),archived=folder?.archived===true;
 renderFolders();$('folder-title').textContent=folder?.name||'选择或新建文件夹';$('archived-banner').hidden=!archived;
 $('count').textContent = current.length;$('clear').disabled=!current.length||archived;$('export').disabled=!current.length;
 const shown = visibleWords(numberedWords(current,$('sort').value),$('search').value,'original');
 $('empty').hidden=current.length>0; $('no-results').hidden=!current.length||shown.length>0;
 $('empty-title').textContent=folder?'下一次遇到生词，点一下就会读':'给这一组新单词起个名字';
 const frag=document.createDocumentFragment(),rowsById=new Map();
 shown.forEach(w=>{
  const row=document.createElement('div');row.className='word-row'+(playing===w.id?' playing':'');row.dataset.wordId=w.id;
  const summary=element('div','word-summary');
  const number=document.createElement('span');number.className='word-number';number.textContent=`${w.number}.`;number.title='当前排序编号';row.dataset.wordNumber=String(w.number);
  const text=document.createElement('span');text.className='word-text';text.textContent=w.text;
  const main=element('div','word-main');main.append(text,element('span','ipa','加载音标…'));
  const meaning=element('div','word-meaning'),meaningBody=element('div','meaning-body');meaningBody.hidden=hiddenChinese(w.id);
  const meaningText=element('span','meaning-text','正在查释义…');meaningBody.append(meaningText);
  const retry=element('button','retry-definition','重试');retry.hidden=true;retry.onclick=()=>enrich(w,true);meaningBody.append(retry);
  const toggle=element('button','toggle-chinese',hiddenChinese(w.id)?'显示中文':'隐藏中文');toggle.setAttribute('aria-label',`${hiddenChinese(w.id)?'显示':'隐藏'} ${w.text} 的中文`);toggle.setAttribute('aria-pressed',String(hiddenChinese(w.id)));toggle.onclick=()=>{chineseOverrides.set(w.id,!hiddenChinese(w.id));persist();render();};meaning.append(meaningBody,toggle);
  const edit=document.createElement('button');edit.className='edit';edit.textContent='编辑';edit.setAttribute('aria-label',`编辑 ${w.text}`);edit.onclick=()=>openReview(w.text,w.id);
  edit.disabled=archived;
  const play=document.createElement('button');play.className='speak';play.innerHTML=speaker;play.setAttribute('aria-label',`朗读 ${w.text}`);play.onclick=()=>speak(w);
  const remove=document.createElement('button');remove.className='remove';remove.textContent='×';remove.setAttribute('aria-label',`删除 ${w.text}`);remove.onclick=()=>{if(readingQueue.items.length)readingQueue.reset();else if(playing===w.id)stop();words=words.filter(x=>x.id!==w.id);chineseOverrides.delete(w.id);persist();render();};
  remove.disabled=archived;
  const actions=element('div','word-actions');actions.append(play,edit,remove);
  summary.append(number,main,meaning,actions);row.append(summary);
  const state=exampleStates.get(w.text.toLowerCase()),generate=element('button','generate-example',state?.status==='loading'?'正在准备…':state?.status==='ready'?'换一组例句 ↻':'生成例句 ✧');generate.disabled=state?.status==='loading';generate.setAttribute('aria-label',`生成 ${w.text} 的例句`);generate.onclick=()=>generateExamples(w);row.append(generate);
  paintExamples(w,row);frag.append(row);rowsById.set(w.id,row);
 });$('word-list').replaceChildren(frag);
 for(const w of shown){const row=rowsById.get(w.id);if(definitions.has(w.text.toLowerCase()))paintDefinition(w,row);else observer.observe(row);}
 $('toggle-all-chinese').textContent=hideAllChinese?'显示全部中文':'隐藏全部中文';$('toggle-all-chinese').setAttribute('aria-pressed',String(hideAllChinese));
 updateReadingControls();paintPlaying();
}
$('toggle-all-chinese').onclick=()=>{hideAllChinese=!hideAllChinese;chineseOverrides.clear();persist();render();};
function selectAccent(value) { stop();accent=value;$('us').classList.toggle('selected',value==='en-US');$('uk').classList.toggle('selected',value==='en-GB');$('us').setAttribute('aria-pressed',String(value==='en-US'));$('uk').setAttribute('aria-pressed',String(value==='en-GB'));updateVoice();persist(); }
$('us').onclick=()=>selectAccent('en-US');$('uk').onclick=()=>selectAccent('en-GB');
const rates=[...new Set([...SPEECH_RATES,rate])].sort((a,b)=>a-b);$('speed').replaceChildren(...rates.map(value=>{const option=element('option','',`${value}×`);option.value=String(value);return option;}));$('speed').value=String(rate);$('speed').onchange=()=>{stop();rate=Number($('speed').value);persist();};
$('search').oninput=$('sort').onchange=()=>{readingQueue.reset();render();};
function updateReviewSummary(){
 const {entries,invalid}=parseEntryInput($('review-text').value);
 $('review-input-summary').textContent=$('review-text').value.trim()?`已识别 ${entries.length} 个词条${invalid.length?`，${invalid.length} 项需要修改`:'，重复项已自动合并'}。`:'';
 $('review-input-error').textContent='';
}
$('review-text').addEventListener('input',updateReviewSummary);
function openReview(text='',id=null,ocr=false,targetFolderId=activeFolderId) {
 if(readingQueue.active)stop();
 fileReview=null;$('file-review-options').hidden=true;$('review').classList.remove('file-review');
 editing=id;$('review-title').textContent=id?'修改单词':ocr?'校对识别结果':'添加单词';$('review-tip').textContent=ocr?'请删掉音标、页眉和多余内容，修正识别有误的单词。识别出的短语可能被拆开，可手动合并。':'支持顿号、中英文逗号、分号或换行分隔，空格保留为短语；在所选文件夹中自动去重。';
 $('review-destination').hidden=!!id;$('destination-folder').replaceChildren();
 for(const folder of folders.filter(f=>!f.archived)){const option=element('option','',folder.name);option.value=folder.id;$('destination-folder').append(option);}
 const create=element('option','','＋ 新建文件夹并添加');create.value='__new__';$('destination-folder').append(create);
 $('destination-folder').value=folders.some(f=>f.id===targetFolderId&&!f.archived)?targetFolderId:folders.find(f=>!f.archived)?.id||'__new__';
 $('destination-name').value='';$('destination-name-wrap').hidden=$('destination-folder').value!=='__new__';$('review-error').textContent='';
 $('review-text').value=text;updateReviewSummary();$('review').showModal();$('review-text').focus();$('review-text').setSelectionRange(0,0);$('review-text').scrollTop=0;
}
$('destination-folder').onchange=()=>{$('destination-name-wrap').hidden=$('destination-folder').value!=='__new__';$('review-error').textContent='';if($('destination-folder').value==='__new__')$('destination-name').focus();};
$('destination-name').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();$('save-review').click();}});
$('manual').onclick=()=>openReview();
function updateFileColumns(){
 const source=$('file-source').value,selected=fileReview.sources.filter((_,i)=>source==='all'||String(i)===source);
 $('file-column-wrap').hidden=!selected.some(s=>s.type==='table');
 $('file-column').replaceChildren();
 for(const [value,label] of [['auto','自动选择英文词列'],['all','所有列']]){const option=element('option','',label);option.value=value;$('file-column').append(option);}
 let width=0;for(const s of selected)for(const row of s.rows)width=Math.max(width,row.length);
 for(let i=0;i<Math.min(width,100);i++){const option=element('option','',`第 ${i+1} 列`);option.value=String(i);$('file-column').append(option);}
}
function updateFileReview(){
 if(!fileReview)return;
 try{
  const entries=extractFileEntries(fileReview.sources,{source:$('file-source').value,column:$('file-column-wrap').hidden?'all':$('file-column').value,mode:$('file-mode').value});
  $('review-text').value=entries.join('\n');updateReviewSummary();
  $('file-summary').textContent=`提取到 ${entries.length} 个词条，已去重${fileReview.scannedPages?`；${fileReview.scannedPages} 页使用图片识别`:''}。${entries.length?'可在下方修改后添加。':'请换一列或提取方式，再检查文件内容。'}`;
 }catch(error){$('review-text').value='';updateReviewSummary();$('file-summary').textContent=error.message;}
}
$('file-source').onchange=()=>{updateFileColumns();updateFileReview();};
$('file-column').onchange=$('file-mode').onchange=updateFileReview;
function cancelDocument(){documentAbort?.abort();documentAbort=null;$('document-loading').close();$('import-document').disabled=false;}
$('document-cancel').onclick=cancelDocument;
$('document-loading').addEventListener('cancel',event=>{event.preventDefault();cancelDocument();});
$('import-document').onclick=()=>$('document-file').click();
$('document-file').onchange=()=>{const file=$('document-file').files[0];$('document-file').value='';if(file)importDocument(file);};
async function importDocument(file){
 if(documentAbort||document.body.classList.contains('busy'))return notice('正在处理另一个文件，请完成或取消后再导入。');
 $('document-error').hidden=true;
 try{documentType(file);}catch(error){$('document-error').textContent=error.message;$('document-error').hidden=false;return;}
 const controller=new AbortController(),target=activeFolderId;documentAbort=controller;
 $('import-document').disabled=true;$('document-filename').textContent=file.name;$('document-state').textContent='准备读取…';$('document-progress').value=0;$('document-loading').showModal();
 try{
  const {readDocument}=await import('./file-import.js');
  const data=await readDocument(file,{signal:controller.signal,onProgress:(label,value)=>{if(documentAbort===controller){$('document-state').textContent=label;$('document-progress').value=value;}}});
  if(documentAbort!==controller||controller.signal.aborted)return;
  $('document-loading').close();openReview('',null,false,target);fileReview=data;$('review').classList.add('file-review');
  $('review-title').textContent='校对文件词表';$('review-tip').textContent=`来自：${file.name}。请核对英文词条；原文件不会上传。切换下方选项会重新提取并替换下方清单。`;
  $('file-source').replaceChildren();const all=element('option','','全部内容');all.value='all';$('file-source').append(all);
  data.sources.forEach((s,i)=>{const option=element('option','',s.name);option.value=String(i);$('file-source').append(option);});
  $('file-source-wrap').hidden=data.sources.length<2;$('file-mode').value='entries';$('file-review-options').hidden=false;updateFileColumns();updateFileReview();
 }catch(error){if(documentAbort===controller&&!controller.signal.aborted){$('document-error').textContent=error.message||'导入失败，请检查文件格式后重试。';$('document-error').hidden=false;}}
 finally{if(documentAbort===controller){documentAbort=null;$('import-document').disabled=false;$('document-loading').close();}}
}
$('save-review').onclick=()=>{
 const {entries,invalid}=parseEntryInput($('review-text').value);
 if(!entries.length)return $('review-input-error').textContent='请填写英文单词或短语，可用顿号、逗号或换行分隔。';
 if(invalid.length)return $('review-input-error').textContent=`有 ${invalid.length} 项包含数字、音标或非英文字母，请修改后再保存。`;
 if(editing && entries.length!==1)return $('review-input-error').textContent='编辑时请只保留一个词条；添加多个单词请使用“直接输入”。';
 if(editing){const w=words.find(w=>w.id===editing);if(!w||folders.find(f=>f.id===w.folderId)?.archived)return notice('请先恢复文件夹再编辑。');if(words.some(other=>other.id!==editing&&other.folderId===w.folderId&&other.text.toLowerCase()===entries[0].toLowerCase()))return notice('这个文件夹中已经有这个单词。');w.text=entries[0];readingQueue.reset();playing=null;}
 else {
  let target=$('destination-folder').value;
  if(target==='__new__'){const name=folderName($('destination-name').value),error=nameError(name);if(error){$('review-error').textContent=error;return;}const folder={id:crypto.randomUUID(),name,archived:false};folders.push(folder);target=folder.id;}
  if(!folders.some(f=>f.id===target&&!f.archived))return notice('请选择一个未归档的文件夹。');
  const folder=folders.find(f=>f.id===target),added=addToFolder(words,entries,target,undefined,folder.nextNumber);if(added.length)folder.nextNumber=added.at(-1).number+1;words.push(...added);switchFolder(target);
  notice(added.length?`已向“${currentFolder().name}”加入 ${added.length} 个单词，重复项已跳过。`:'这些单词已在所选文件夹中。');
 }
 persist();render();$('review').close();
};
$('demo').onclick=()=>openReview('beautiful\ncuriosity\ndiscover\njourney\npronunciation\nwonderful');
$('clear').onclick=()=>{const folder=currentFolder();if(!folder||folder.archived)return;clearFolderId=folder.id;$('clear-title').textContent=`清空“${folder.name}”里的单词？`;$('confirm-clear').showModal();};
$('confirm-clear').addEventListener('close',()=>{if($('confirm-clear').returnValue==='clear'&&clearFolderId&&!folders.find(f=>f.id===clearFolderId)?.archived){readingQueue.reset();playing=null;for(const w of folderWords(words,clearFolderId))chineseOverrides.delete(w.id);words=words.filter(w=>w.folderId!==clearFolderId);folders.find(f=>f.id===clearFolderId).nextNumber=1;exampleStates.clear();persist();render();}clearFolderId=null;});
$('export').onclick=()=>{const blob=new Blob([visibleWords(folderWords(words,activeFolderId),'',$('sort').value).map(w=>w.text).join('\n')],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`词声-${(currentFolder()?.name||'单词本').replace(/[\\/:*?"<>|]/g,'_')}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('upload').onclick=()=>$('file').click();$('camera').onclick=()=>$('camera-file').click();
for(const id of ['file','camera-file'])$(id).onchange=()=>{const file=$(id).files[0];$(id).value='';if(file)recognize(file);};
const dz=$('dropzone');['dragenter','dragover'].forEach(e=>dz.addEventListener(e,event=>{event.preventDefault();dz.classList.add('drag');}));dz.addEventListener('dragleave',()=>dz.classList.remove('drag'));dz.addEventListener('drop',event=>{event.preventDefault();dz.classList.remove('drag');const file=event.dataTransfer.files[0];if(file){if(file.type.startsWith('image/'))recognize(file);else importDocument(file);}});
function finishOCR(){document.body.classList.remove('busy');$('recognizing').hidden=true;$('upload').disabled=$('camera').disabled=false;if(previewURL){URL.revokeObjectURL(previewURL);previewURL=null;}}
async function cancelOCR(){ocrRun++;if(worker){const old=worker;worker=null;await old.terminate().catch(()=>{});}finishOCR();}
$('cancel-ocr').onclick=cancelOCR;
async function recognize(file){
 if(document.body.classList.contains('busy')||documentAbort)return;
 if(!/^image\/(jpeg|png|webp)$/.test(file.type))return notice('请选择 JPG、PNG 或 WebP 图片；HEIC 请先转为 JPG。');
 if(file.size>20*1024*1024)return notice('图片超过 20 MB，请压缩后重试。');
 const layout=$('layout').value, extraction=$('extract').value,importFolderId=activeFolderId;
 $('ocr-error').hidden=true;
 const run=++ocrRun;document.body.classList.add('busy');$('recognizing').hidden=false;$('upload').disabled=$('camera').disabled=true;$('ocr-state').textContent='准备识别…';$('progress').value=0;
 previewURL=URL.createObjectURL(file);$('preview').src=previewURL;
 let activeWorker;
 try{
  const image=new Image();image.src=previewURL;await image.decode();if(run!==ocrRun)return;
  const scale=Math.min(2,3200/Math.max(image.width,image.height));const canvas=document.createElement('canvas');canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
  const split=layout==='single'?null:layout==='double'?Math.round(canvas.width/2):findGutter(canvas);
  const columns=split?[{left:0,top:0,width:split,height:canvas.height},{left:split,top:0,width:canvas.width-split,height:canvas.height}]:[{left:0,top:0,width:canvas.width,height:canvas.height}];
  if(extraction==='headwords')for(const rect of columns){const inset=headwordInset(canvas,rect);rect.left+=inset;rect.width-=inset;}
  let columnIndex=0;
  activeWorker=new OcrWorker(m=>{if(run!==ocrRun)return;const isText=m.status==='recognizing text',stage=loadingProgress(m);$('ocr-state').textContent=isText?`识别第 ${columnIndex+1}/${columns.length} 栏 · ${Math.round(m.progress*100)}%`:stage.label;$('progress').value=isText?(columnIndex+m.progress)/columns.length:stage.value;});worker=activeWorker;
  await activeWorker.initialize();if(run!==ocrRun)return;
  await activeWorker.setParameters({tessedit_pageseg_mode:'6',preserve_interword_spaces:'1',user_defined_dpi:'300'});
  const texts=[];
  for(columnIndex=0;columnIndex<columns.length;columnIndex++){
   const rectangle=columns[columnIndex];const result=await activeWorker.recognize(canvas,rectangle?{rectangle}:{});if(run!==ocrRun)return;
   texts.push(extraction==='headwords'?extractHeadwords(result.data.text):extractWords(result.data.text));
  }
  const extracted=texts.join('\n');
  if(!extracted.trim())notice('没有识别到英文单词，请拍清楚一些，或直接输入。');else openReview(extracted,null,true,importFolderId);
 }catch(error){if(run===ocrRun){const message=error.message||'识别失败，请检查网络或更换图片。';$('ocr-error').textContent=message;$('ocr-error').hidden=false;notice(message);}}
 finally{if(run===ocrRun){if(activeWorker)await activeWorker.terminate().catch(()=>{});worker=null;finishOCR();}}
}
$('voice-choice').onchange=()=>{stop();voicePreferences[accent]=$('voice-choice').value;speechPlayer.failed.clear();persist();updateVoice();};
$('test-voice').onclick=()=>speakText('Hello! This is your English pronunciation practice.',null);
$('stop-voice').onclick=()=>{stop();updateVoice();};
$('refresh-voices').onclick=()=>{speechPlayer.failed.clear();updateVoice();notice('已重新读取设备声音列表。');};
window.speechSynthesis?.addEventListener('voiceschanged',updateVoice);window.addEventListener('pagehide',()=>{readingQueue.stop();worker?.terminate();documentAbort?.abort();});
selectAccent(accent);render();
