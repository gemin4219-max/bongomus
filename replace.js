const fs = require('fs');
const file = 'app/(tabs)/ai-studio.tsx';
const content = fs.readFileSync(file, 'utf8');
const lines = content.split(/\r?\n/);

const newContent = `        {/* Audio Editor Modal - Minimalist Redesign */}
        <Modal visible={isAudioEditorOpen} animationType="slide" presentationStyle="pageSheet">
          <View style={{ flex: 1, backgroundColor: '#09090B', paddingTop: 24, paddingHorizontal: 24 }}>
            {/* Minimal Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-start', marginBottom: 40 }}>
              <TouchableOpacity 
                style={{ padding: 12, marginLeft: -12 }}
                onPress={() => { setIsAudioEditorOpen(false); setIsInputExpanded(true); }}
              >
                <Ionicons name="close" size={24} color="#A1A1AA" />
              </TouchableOpacity>
            </View>

            {/* Title Input */}
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: -40 }}>
              <TextInput
                style={{ color: '#FAFAFA', fontSize: 32, fontWeight: '600', textAlign: 'center', letterSpacing: 0.5, marginBottom: 8 }}
                value={audioTitle}
                onChangeText={setAudioTitle}
                placeholder="Name your track"
                placeholderTextColor="#52525B"
                maxLength={40}
                selectionColor="#FAFAFA"
              />
              <View style={{ width: 40, height: 2, backgroundColor: '#3F3F46', marginTop: 12, borderRadius: 1 }} />

              {/* Minimal Player */}
              <View style={{ marginTop: 80, alignItems: 'center' }}>
                <TouchableOpacity 
                  style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 1, borderColor: '#3F3F46', justifyContent: 'center', alignItems: 'center', backgroundColor: isPlaying ? '#18181B' : '#FAFAFA' }}
                  onPress={handlePlayPause}
                >
                  <Ionicons name={isPlaying ? "pause" : "play"} size={32} color={isPlaying ? "#FAFAFA" : "#09090B"} style={{ marginLeft: isPlaying ? 0 : 4 }} />
                </TouchableOpacity>
                <Text style={{ color: '#A1A1AA', marginTop: 24, fontSize: 12, letterSpacing: 2, fontWeight: '500' }}>{isPlaying ? 'PLAYING' : 'READY'}</Text>
              </View>
            </View>

            {/* Bottom Actions */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 50, alignItems: 'center' }}>
              <TouchableOpacity style={{ padding: 16 }} onPress={() => {
                Alert.alert("Discard", "Are you sure you want to discard this audio?", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Discard", style: "destructive", onPress: () => {
                    setAudioTitle('');
                    setSelectedAudioUri(null);
                    setIsAudioEditorOpen(false);
                    setIsInputExpanded(true);
                  }}
                ]);
              }}>
                <Text style={{ color: '#71717A', fontSize: 16, fontWeight: '500' }}>Discard</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={{ backgroundColor: '#FAFAFA', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 30 }} onPress={() => { 
                setIsAudioEditorOpen(false); 
                setIsInputExpanded(true);
                const newTaskId = \`upload-\${Date.now()}\`;
                addTask(newTaskId, audioTitle || 'Uploaded Audio', 'GENERATE');
                updateTask(newTaskId, 'SUCCESS', [{
                  id: newTaskId,
                  audioUrl: selectedAudioUri || '',
                  videoUrl: '',
                  imageUrl: '',
                  title: audioTitle || 'Uploaded Audio',
                  prompt: 'uploaded',
                  tags: 'uploaded',
                  status: 'SUCCESS',
                  createdAt: Date.now()
                }]);
              }}>
                <Text style={{ color: '#09090B', fontSize: 16, fontWeight: '600' }}>Save Audio</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>`;

// Find where exactly the audio editor starts
const startIdx = lines.findIndex(l => l.includes('{/* Audio Editor Modal */}'));
if (startIdx !== -1) {
    // Find where it ends
    let endIdx = startIdx;
    for (let i = startIdx; i < lines.length; i++) {
        if (lines[i].includes('</Modal>') && i > startIdx) {
            endIdx = i;
            break;
        }
    }
    
    // Splice new content
    lines.splice(startIdx, (endIdx - startIdx) + 1, newContent);
    fs.writeFileSync(file, lines.join('\\n'));
    console.log('Successfully replaced audio editor block');
} else {
    console.log('Could not find starting tag');
}
