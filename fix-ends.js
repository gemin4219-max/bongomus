const fs = require('fs');
const file = 'C:\\Users\\Dragon fly\\.gemini\\antigravity-ide\\scratch\\bongo\\app\\(tabs)\\ai-studio.tsx';
let content = fs.readFileSync(file, 'utf8');

// The lines in the file are currently:
// 165: if (text.endsWith('\n') || text.endsWith('
// 166: ')) {
content = content.replace(/endsWith\('[\r\n]+'\)/g, "endsWith('\\n')");
content = content.replace(/endsWith\('\\n'\) \|\| text\.endsWith\('[\r\n]+'\)/g, "endsWith('\\n')");

// Delete line 1252 `</>`
content = content.replace(/<\/>\r?\n/g, '');

fs.writeFileSync(file, content);
console.log('Fixed ending newlines');
