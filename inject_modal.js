const fs = require('fs');
const filePath = 'C:/Users/Dragon fly/.gemini/antigravity-ide/scratch/bongo/app/(tabs)/ai-studio.tsx';
let code = fs.readFileSync(filePath, 'utf8');

const modalCode = `
      {/* Song Options Modal */}
      <Modal visible={isSongOptionsOpen} transparent animationType="slide" onRequestClose={() => setIsSongOptionsOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setIsSongOptionsOpen(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
            <TouchableWithoutFeedback>
              <View style={styles.advancedSheet}>
                <View style={styles.advancedSheetHandle} />
                <Text style={styles.advancedSheetTitle}>Song Options</Text>
                
                <TouchableOpacity style={styles.plusMenuItem} onPress={() => { setIsSongOptionsOpen(false); Alert.alert('Coming Soon', 'Video Generation is in development!'); }}>
                  <Ionicons name="videocam-outline" size={20} color="#FFF" />
                  <Text style={styles.plusMenuItemText}>Make Music Video</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.plusMenuItem} onPress={() => { setIsSongOptionsOpen(false); }}>
                  <Ionicons name="share-outline" size={20} color="#FFF" />
                  <Text style={styles.plusMenuItemText}>Share</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.plusMenuItem} onPress={() => { setIsSongOptionsOpen(false); }}>
                  <Ionicons name="pencil-outline" size={20} color="#FFF" />
                  <Text style={styles.plusMenuItemText}>Edit Details</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.plusMenuItem} onPress={() => { setIsSongOptionsOpen(false); }}>
                  <Ionicons name="list-outline" size={20} color="#FFF" />
                  <Text style={styles.plusMenuItemText}>Add to Playlist</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.plusMenuItem} onPress={() => { setIsSongOptionsOpen(false); }}>
                  <Ionicons name="download-outline" size={20} color="#FFF" />
                  <Text style={styles.plusMenuItemText}>Download Audio</Text>
                </TouchableOpacity>

                <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 10 }} />

                <TouchableOpacity style={styles.plusMenuItem} onPress={() => { setIsSongOptionsOpen(false); }}>
                  <Ionicons name="arrow-forward-outline" size={20} color="#FF2A75" />
                  <Text style={[styles.plusMenuItemText, { color: '#FF2A75' }]}>Extend (Advanced)</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.plusMenuItem} onPress={() => { setIsSongOptionsOpen(false); }}>
                  <Ionicons name="refresh-outline" size={20} color="#FF2A75" />
                  <Text style={[styles.plusMenuItemText, { color: '#FF2A75' }]}>Remix / Cover</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.plusMenuItem} onPress={() => { setIsSongOptionsOpen(false); }}>
                  <Ionicons name="git-branch-outline" size={20} color="#FF2A75" />
                  <Text style={[styles.plusMenuItemText, { color: '#FF2A75' }]}>Create Stems (Separation)</Text>
                </TouchableOpacity>

              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

    </View>
  );
}
`;

if (!code.includes('Song Options Modal')) {
  code = code.replace(/    <\/View>\s*\n\s*\);\s*\n\s*\}\s*\n+const getStyles/s, modalCode + "\n\nconst getStyles");
  fs.writeFileSync(filePath, code);
  console.log('Injected modal');
} else {
  console.log('Modal already exists');
}
