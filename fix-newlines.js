const fs = require('fs');
const file = 'C:\\Users\\Dragon fly\\.gemini\\antigravity-ide\\scratch\\bongo\\app\\(tabs)\\ai-studio.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace the literal string '\n' with actual newline
content = content.replace(/\\n/g, '\n');

fs.writeFileSync(file, content);
console.log('Fixed literal newlines');
