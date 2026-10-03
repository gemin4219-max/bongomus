const fs = require('fs');
let code = fs.readFileSync('C:/Users/Dragon fly/.gemini/antigravity-ide/scratch/bongo/app/(tabs)/ai-studio.tsx', 'utf8');

// 1. Add states
if(!code.includes('isSongOptionsOpen')) {
    code = code.replace(
        /const \[isRecordModalOpen, setIsRecordModalOpen\] = useState\(false\);/,
        'const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);\n  const [isSongOptionsOpen, setIsSongOptionsOpen] = useState(false);\n  const [selectedSongTask, setSelectedSongTask] = useState<any>(null);'
    );
}

// 2. Add onPress to moreButton
code = code.replace(
    /<TouchableOpacity style=\{styles\.moreButton\}>/g,
    '<TouchableOpacity style={styles.moreButton} onPress={() => { setSelectedSongTask(task); setIsSongOptionsOpen(true); }}>'
);

// 3. Add Modal
const modalCode = `

      {/* Song Options Bottom Sheet Modal */}
      <Modal visible={isSongOptionsOpen} animationType="slide" transparent={true} onRequestClose={() => setIsSongOptionsOpen(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setIsSongOptionsOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.songOptionsSheet}>
            <View style={styles.sheetHandle} />
            
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.songOptionsScroll}>
              {/* Header info */}
              <View style={styles.songOptionsHeader}>
                 <Image source={{uri: selectedSongTask?.tracks?.[0]?.imageUrl || 'https://picsum.photos/100'}} style={styles.songOptionsImage} />
                 <View style={styles.songOptionsTitleContainer}>
                   <Text style={styles.songOptionsTitle} numberOfLines={1}>{selectedSongTask?.title || 'Untitled'}</Text>
                   <Text style={styles.songOptionsArtist} numberOfLines={1}>by {profile?.username || 'meshackdapaz'}</Text>
                 </View>
                 <TouchableOpacity style={styles.moreInfoBadge}>
                   <Text style={styles.moreInfoText}>More Info</Text>
                 </TouchableOpacity>
              </View>

              {/* Grid Buttons */}
              <View style={styles.songOptionsGrid}>
                <TouchableOpacity style={styles.gridBtn}>
                  <Ionicons name="add" size={24} color="#FFF" />
                  <Text style={styles.gridBtnText}>Add to Playlist</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.gridBtn}>
                  <Ionicons name="thumbs-up" size={24} color="#FFF" />
                  <Text style={styles.gridBtnText}>Like Song</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.gridBtn}>
                  <Ionicons name="share-social" size={24} color="#FFF" />
                  <Text style={styles.gridBtnText}>Share Song</Text>
                </TouchableOpacity>
              </View>

              {/* Option List */}
              <View style={styles.optionsList}>
                <TouchableOpacity style={styles.optionItem}>
                  <Ionicons name="download-outline" size={20} color="#FFF" />
                  <Text style={styles.optionText}>Download Song</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.optionItem}>
                  <Ionicons name="information-circle-outline" size={20} color="#FFF" />
                  <Text style={styles.optionText}>Edit Song Details</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.optionItem}>
                  <Ionicons name="color-wand-outline" size={20} color="#FFF" />
                  <Text style={styles.optionText}>Create Cover Art</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.optionItem}>
                  <Ionicons name="play-circle-outline" size={20} color="#FFF" />
                  <Text style={styles.optionText}>Create Hook</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.optionItem}>
                  <Ionicons name="refresh-outline" size={20} color="#FFF" />
                  <Text style={styles.optionText}>Reuse Styles & Lyrics</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.optionItem}>
                  <Ionicons name="sync-outline" size={20} color="#FFF" />
                  <Text style={styles.optionText}>Remix</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.optionItem}>
                  <Ionicons name="arrow-forward-outline" size={20} color="#FFF" />
                  <Text style={styles.optionText}>Extend</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.optionItem}>
                  <Ionicons name="sparkles-outline" size={20} color="#FFF" />
                  <Text style={styles.optionText}>Remaster</Text>
                  <View style={styles.upgradeBadge}>
                    <Text style={styles.upgradeBadgeText}>Upgrade to v6</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.optionItem, { opacity: 0.5 }]}>
                  <Ionicons name="person-outline" size={20} color="#FFF" />
                  <Text style={styles.optionText}>Create Voice</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.optionItem}>
                  <Ionicons name="radio-outline" size={20} color="#FFF" />
                  <Text style={styles.optionText}>Start Song Radio</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.optionItem}>
                  <Ionicons name="thumbs-down-outline" size={20} color="#FFF" />
                  <Text style={styles.optionText}>Dislike Song</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.optionItem}>
                  <Ionicons name="flag-outline" size={20} color="#FFF" />
                  <Text style={styles.optionText}>Report Inappropriate</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.optionItem}>
                  <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                  <Text style={[styles.optionText, { color: '#FF3B30' }]}>Delete Song</Text>
                </TouchableOpacity>
                
                <View style={{ height: 100 }} />
              </View>
            </ScrollView>

            {/* Floating Publish Button */}
            <LinearGradient
              colors={['transparent', '#1A1A1A', '#1A1A1A']}
              style={styles.publishContainer}
            >
              <TouchableOpacity style={styles.publishBtn}>
                <Ionicons name="earth" size={20} color="#000" />
                <Text style={styles.publishBtnText}>Publish Song</Text>
              </TouchableOpacity>
            </LinearGradient>

          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      </View>
    </SafeAreaView>
`;

code = code.replace(/<\/View>\s*<\/SafeAreaView>/, modalCode);

// 4. Add Styles
const stylesCode = `
  songOptionsSheet: {
    backgroundColor: '#1E1E1E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '85%',
    marginTop: 'auto',
    overflow: 'hidden',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#666',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  songOptionsScroll: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  songOptionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  songOptionsImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 16,
  },
  songOptionsTitleContainer: {
    flex: 1,
  },
  songOptionsTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  songOptionsArtist: {
    color: '#888',
    fontSize: 14,
  },
  moreInfoBadge: {
    borderWidth: 1,
    borderColor: '#444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  moreInfoText: {
    color: '#888',
    fontSize: 12,
    fontWeight: '500',
  },
  songOptionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  gridBtn: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  gridBtnText: {
    color: '#FFF',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  optionsList: {
    gap: 8,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
  },
  optionText: {
    color: '#FFF',
    fontSize: 16,
    marginLeft: 16,
    fontWeight: '500',
  },
  upgradeBadge: {
    backgroundColor: 'rgba(255, 42, 117, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 'auto',
  },
  upgradeBadgeText: {
    color: '#FF2A75',
    fontSize: 12,
    fontWeight: 'bold',
  },
  publishContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingTop: 40,
    paddingBottom: 40,
  },
  publishBtn: {
    backgroundColor: '#FFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 24,
  },
  publishBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
`;

code = code.replace(/const styles = StyleSheet\.create\({/, 'const styles = StyleSheet.create({' + stylesCode);

fs.writeFileSync('C:/Users/Dragon fly/.gemini/antigravity-ide/scratch/bongo/app/(tabs)/ai-studio.tsx', code);
console.log('Done!');
