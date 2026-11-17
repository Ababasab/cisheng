export function splitEntryInput(text) {
 const numbered=text.replace(/(^|[,，;；\r\n\t])\s*\d+\s*[.、)]\s*(?=[A-Za-z])/g,'$1');
 return numbered.split(/[,，、;；\r\n\t]+/).map(s=>s.trim()).filter(Boolean);
}
export function parseEntryInput(text) {
 const parts=splitEntryInput(text);
 return {entries:cleanEntries(parts.join('\n')),invalid:parts.filter(part=>!cleanEntries(part).length)};
}
export function cleanEntries(text) {
 const seen = new Set();
 return text.split(/\r?\n/).map(s => s.trim().replace(/[’‘]/g, "'").replace(/^[\d.、)\s•·-]+/, '').replace(/\s+/g, ' ')).filter(s => {
  if (!/^[a-zA-Z]+(?:[ '-][a-zA-Z]+)*$/.test(s) || s.length > 100) return false;
  const key = s.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true;
 });
}
export function extractWords(text) {
 return text.split(/\r?\n/).flatMap(line => {
  // 音标与中文释义不进入发音单词；识别结果仍须由用户校对。
  const withoutIPA = line.replace(/\/[^/\n]*\//g, ' ').replace(/\[[^\]\n]*\]/g, ' ');
  return withoutIPA.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) || [];
 }).filter(word => word.length > 1 || /^[aAiI]$/.test(word)).join('\n');
}
export function extractHeadwords(text) {
 return text.split(/\r?\n/).flatMap(line => {
  const entry=line.trim().replace(/^[\d\s.,、:;|)({}\[\]•·-]+/, '');
  const match=entry.match(/^([A-Za-z]+(?:['’-][A-Za-z]+)*)/);
  if(!match || /^(?:n|v|a|adj|adv|vt|vi|ad|pron|prep|conj)$/i.test(match[1]))return [];
  return [match[1]];
 }).join('\n');
}
export function visibleWords(words, query, sort) {
 const result = words.filter(w => w.text.toLowerCase().includes(query.toLowerCase()));
 return sort === 'az' ? result.sort((a,b) => a.text.localeCompare(b.text, 'en', {sensitivity:'base'})) : result;
}
