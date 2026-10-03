const fs = require('fs');
const file = 'C:\\Users\\Dragon fly\\.gemini\\antigravity-ide\\scratch\\bongo\\app\\(tabs)\\ai-studio.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = '</View>\r\n      )}';
const target2 = '</View>\n      )}';

if (content.includes(target)) {
    content = content.replace(target, '</View>\n      </>\n      )}');
} else if (content.includes(target2)) {
    content = content.replace(target2, '</View>\n      </>\n      )}');
} else {
    console.log("Could not find target!");
}

fs.writeFileSync(file, content);
