const fs = require('fs');
const file = 'C:\\Users\\Dragon fly\\.gemini\\antigravity-ide\\scratch\\bongo\\app\\(tabs)\\ai-studio.tsx';
let content = fs.readFileSync(file, 'utf8');

const target1 = `                  <TouchableOpacity style={styles.plusMenuItem} onPress={() => {
                    setIsInputExpanded(false);
                    setTimeout(() => {
                      setIsAudioMenuOpen(false);
                      setIsRecordModalOpen(true);
                    }, 400);
                  }}>`;

const target2 = target1.replace(/\n/g, '\r\n');

const replacement = `                  <TouchableOpacity style={styles.plusMenuItem} onPress={() => {
                    setIsAudioMenuOpen(false);
                    setIsPlusMenuOpen(false);
                    setIsRecordModalOpen(true);
                  }}>`;

if (content.includes(target1)) {
    content = content.replace(target1, replacement);
    console.log("Replaced target1");
} else if (content.includes(target2)) {
    content = content.replace(target2, replacement);
    console.log("Replaced target2");
} else {
    console.log("Not found.");
}

fs.writeFileSync(file, content);
