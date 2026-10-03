const fs = require('fs');
const filePath = 'app/(tabs)/ai-studio.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Remove AnimatedBackground definition
content = content.replace(/const AnimatedBackground = \(\) => \{[\s\S]*?return \([\s\S]*?\}\);\n\};\n/g, '');

// 2. Undo Main return background
content = content.replace(
  /<View style=\{\{ flex: 1, backgroundColor: '#05001a' \}\}>\n\s*<AnimatedBackground \/>\n\s*<SafeAreaView\n\s*style=\{\[styles\.container, \{ backgroundColor: 'transparent' \}\]\}/g,
  `<SafeAreaView
      style={[styles.container, { backgroundColor: COLORS.black }]}`
);

// Close SafeAreaView
content = content.replace(/<\/SafeAreaView>\n\s*<\/View>\n\s*\);\n\}/g, `</SafeAreaView>\n  );\n}`);

// 3. Undo Expanded Input Modal
content = content.replace(
  /<TouchableWithoutFeedback onPress=\{Keyboard\.dismiss\}>\n\s*<View\n\s*style=\{\{\n\s*flex: 1,\n\s*backgroundColor: 'transparent',\n\s*\}\}>\n\s*<AnimatedBackground \/>/g,
  `<TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View
            style={{
              flex: 1,
              backgroundColor: COLORS.black,
            }}>`
);

// 4. Undo Voice Wizard Modal
content = content.replace(
  /<Modal\n\s*visible=\{isVoiceWizardOpen\}\n\s*animationType="slide"\n\s*transparent=\{true\}\n\s*>\n\s*<View style=\{\{ flex: 1, backgroundColor: "transparent", paddingTop: 20 \}\}>\n\s*<AnimatedBackground \/>/g,
  `<Modal
        visible={isVoiceWizardOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsVoiceWizardOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: "#1A1A1D", paddingTop: 20 }}>`
);

content = content.replace(
  /<Modal\n\s*visible=\{isVoiceWizardOpen\}\n\s*animationType="slide"\n\s*transparent=\{true\}/g,
  `<Modal
        visible={isVoiceWizardOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsVoiceWizardOpen(false)}`
);

content = content.replace(
  /<View style=\{\{ flex: 1, backgroundColor: "transparent", paddingTop: 20 \}\}>\n\s*<AnimatedBackground \/>/g,
  `<View style={{ flex: 1, backgroundColor: "#1A1A1D", paddingTop: 20 }}>`
);


// 5. Undo Audio Editor Modal
content = content.replace(
  /<Modal\n\s*visible=\{isAudioEditorOpen\}\n\s*animationType="slide"\n\s*transparent=\{true\}\n\s*>/g,
  `<Modal
              visible={isAudioEditorOpen}
              animationType="slide"
              presentationStyle="pageSheet"
            >`
);

content = content.replace(
  /style=\{\{\n\s*flex: 1,\n\s*backgroundColor: "transparent",\n\s*paddingTop: 24,\n\s*paddingHorizontal: 24,\n\s*\}\}\n\s*>\n\s*<AnimatedBackground \/>/g,
  `style={{
                  flex: 1,
                  backgroundColor: "#09090B",
                  paddingTop: 24,
                  paddingHorizontal: 24,
                }}
              >`
);

// 6. Undo Record Modal
content = content.replace(
  /<Modal\n\s*visible=\{isRecordModalOpen\}\n\s*animationType="slide"\n\s*transparent=\{true\}\n\s*onRequestClose=\{\(\) => \{\n\s*if \(isRecording\) stopRecording\(true\);\n\s*setIsRecordModalOpen\(false\);\n\s*\}\}\n\s*>\n\s*<View style=\{\{ flex: 1, backgroundColor: "transparent" \}\}>\n\s*<AnimatedBackground \/>/g,
  `<Modal
            visible={isRecordModalOpen}
            animationType="slide"
            transparent={true}
            onRequestClose={() => {
              if (isRecording) stopRecording(true);
              setIsRecordModalOpen(false);
            }}
          >
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.9)" }}>`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully reverted background changes.');
