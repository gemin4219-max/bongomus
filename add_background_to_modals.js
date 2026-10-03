const fs = require('fs');
const filePath = 'app/(tabs)/ai-studio.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Audio Editor Modal
content = content.replace(
  /<Modal\n\s*visible=\{isAudioEditorOpen\}\n\s*animationType="slide"\n\s*presentationStyle="pageSheet"\n\s*>/g,
  `<Modal
              visible={isAudioEditorOpen}
              animationType="slide"
              transparent={true}
            >`
);

content = content.replace(
  /<View\n\s*style=\{\{\n\s*flex: 1,\n\s*backgroundColor: "#09090B",/g,
  `<View
                style={{
                  flex: 1,
                  backgroundColor: "transparent",`
);

if (content.includes('visible={isAudioEditorOpen}')) {
  // Add AnimatedBackground right inside the modal view
  const audioEditorViewStart = `style={{
                  flex: 1,
                  backgroundColor: "transparent",
                  paddingTop: 24,
                  paddingHorizontal: 24,
                }}
              >`;
  content = content.replace(
    audioEditorViewStart,
    audioEditorViewStart + `\n                <AnimatedBackground />`
  );
}

// 2. Voice Wizard Modal
content = content.replace(
  /<Modal\n\s*visible=\{isVoiceWizardOpen\}\n\s*animationType="slide"\n\s*presentationStyle="pageSheet"/g,
  `<Modal
        visible={isVoiceWizardOpen}
        animationType="slide"
        transparent={true}`
);

content = content.replace(
  /<View style=\{\{ flex: 1, backgroundColor: "#1A1A1D", paddingTop: 20 \}\}>/g,
  `<View style={{ flex: 1, backgroundColor: "transparent", paddingTop: 20 }}>\n          <AnimatedBackground />`
);

// 3. Main record modal inside AI Studio
content = content.replace(
  /<Modal\n\s*visible=\{isRecordModalOpen\}\n\s*animationType="slide"\n\s*transparent=\{true\}\n\s*onRequestClose=\{.*?\}\n\s*>\n\s*<View style=\{\{ flex: 1, backgroundColor: "rgba\(0,0,0,0\.9\)" \}\}>/g,
  `<Modal
            visible={isRecordModalOpen}
            animationType="slide"
            transparent={true}
            onRequestClose={() => {
              if (isRecording) stopRecording(true);
              setIsRecordModalOpen(false);
            }}
          >
            <View style={{ flex: 1, backgroundColor: "transparent" }}>
              <AnimatedBackground />`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully injected AnimatedBackground into all modals.');
