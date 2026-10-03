const fs = require('fs');
const file = 'C:\\Users\\Dragon fly\\.gemini\\antigravity-ide\\scratch\\bongo\\app\\(tabs)\\ai-studio.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove the old Modal for Record
const recordModalStart = content.indexOf('{/* Record Modal */}');
const recordModalEnd = content.indexOf('</Modal>', recordModalStart) + 8;
const recordModalBlock = content.slice(recordModalStart, recordModalEnd);
content = content.slice(0, recordModalStart) + content.slice(recordModalEnd);

// 2. Modify the block to be a View instead of a Modal
let newRecordOverlay = recordModalBlock
  .replace('<Modal visible={isRecordModalOpen} animationType="slide" transparent={false}>', '{isRecordModalOpen && (')
  .replace("<View style={{ flex: 1, paddingTop: insets.top + 20, backgroundColor: '#18181A' }}>", "<View style={[StyleSheet.absoluteFill, { paddingTop: insets.top + 20, backgroundColor: '#18181A', zIndex: 1000 }]}>")
  .replace('</Modal>', ')}');

// 3. Remove all setIsInputExpanded(true) and setTimeout from inside the Record Modal overlay
newRecordOverlay = newRecordOverlay.replace(/setIsInputExpanded\(true\);\s*/g, '');
newRecordOverlay = newRecordOverlay.replace(/setTimeout\(\(\) => setIsAudioMenuOpen\(true\), 400\);/g, 'setIsAudioMenuOpen(true);');

// 4. Inject it right before the closing of the isInputExpanded Modal
const inputModalEnd = content.indexOf('</KeyboardAvoidingView>');
content = content.slice(0, inputModalEnd + 21) + '\n\n' + newRecordOverlay + '\n\n' + content.slice(inputModalEnd + 21);

// 5. Update the Record Audio button onPress handler to not close isInputExpanded
const oldBtn = `setIsInputExpanded(false);
                    setTimeout(() => {
                      setIsAudioMenuOpen(false);
                      setIsRecordModalOpen(true);
                    }, 400);`;
const newBtn = `setIsAudioMenuOpen(false);
                    setIsPlusMenuOpen(false);
                    setIsRecordModalOpen(true);`;

content = content.replace(oldBtn, newBtn);

fs.writeFileSync(file, content);
console.log('Done!');
