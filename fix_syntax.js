const fs = require('fs');
const filePath = 'app/(tabs)/ai-studio.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Undo the mistaken injection at the first occurrence
content = content.replace(
  /<\/BlurView>\n\s*<\/View>\n\s*<\/Modal>\n\s*<\/View>\n\s*<\/TouchableWithoutFeedback>\n\s*<\/Modal>/,
  `</View>\n      </Modal>\n          </View>\n        </TouchableWithoutFeedback>\n      </Modal>`
);

// Apply it properly to the Voice Wizard Modal at the very end
content = content.replace(
  /<\/View>\n\s*<\/Modal>\n\s*<\/SafeAreaView>/,
  `</BlurView>\n        </View>\n      </Modal>\n    </SafeAreaView>`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed syntax errors.');
