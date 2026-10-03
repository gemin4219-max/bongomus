const fs = require('fs');
const filePath = 'C:/Users/Dragon fly/.gemini/antigravity-ide/scratch/bongo/app/(tabs)/ai-studio.tsx';
let code = fs.readFileSync(filePath, 'utf8');

if (!code.includes(' Share,')) {
  code = code.replace('Modal, TouchableWithoutFeedback }', 'Modal, TouchableWithoutFeedback, Share }');
}
if (!code.includes('removeTask } = useAIStore')) {
  code = code.replace('setTasks } = useAIStore', 'setTasks, removeTask } = useAIStore');
}

const newModalCode = `      {/* Detailed Song Options Modal */}
      <Modal visible={isSongOptionsOpen} transparent animationType="slide" onRequestClose={() => setIsSongOptionsOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <TouchableWithoutFeedback onPress={() => setIsSongOptionsOpen(false)}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <View style={styles.songOptionsSheet}>
            <View style={styles.sheetHandle} />
            
            <ScrollView contentContainerStyle={styles.songOptionsScroll} showsVerticalScrollIndicator={false}>
              
              {/* Header Info */}
              <View style={styles.songOptionsHeader}>
                <View style={{ position: 'relative' }}>
                  <Image 
                    source={{ uri: selectedSongTask?.imageUrl || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=300&auto=format&fit=crop' }} 
                    style={styles.songOptionsImage} 
                  />
                  <View style={{ position: 'absolute', top: -4, right: 10, backgroundColor: '#1A1A1A', borderRadius: 10, padding: 4, borderWidth: 1, borderColor: '#333' }}>
                    <Ionicons name="pencil" size={10} color="#FFF" />
                  </View>
                </View>
                <View style={styles.songOptionsTitleContainer}>
                  <Text style={styles.songOptionsTitle}>{selectedSongTask?.title || 'Unknown Title'}</Text>
                  <Text style={styles.songOptionsArtist}>by {selectedSongTask?.username || 'user'}</Text>
                </View>
                <TouchableOpacity style={styles.moreInfoBadge} onPress={() => Alert.alert('Song Info', \`Duration: \${selectedSongTask?.duration || 'Unknown'}\\nStatus: \${selectedSongTask?.status || 'Unknown'}\`)}>
                  <Text style={styles.moreInfoText}>More Info</Text>
                </TouchableOpacity>
              </View>

              {/* 3 Buttons Row */}
              <View style={styles.songOptionsGrid}>
                <TouchableOpacity style={styles.gridBtn} onPress={() => { setIsSongOptionsOpen(false); Alert.alert('Add to Playlist', 'Choose a playlist to add this song to.'); }}>
                  <Ionicons name="add" size={24} color="#FFF" />
                  <Text style={styles.gridBtnText}>Add to Playlist</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.gridBtn} onPress={() => { setIsSongOptionsOpen(false); Alert.alert('Added', 'Added to your Liked Songs.'); }}>
                  <Ionicons name="thumbs-up-outline" size={24} color="#FFF" />
                  <Text style={styles.gridBtnText}>Like Song</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.gridBtn} onPress={() => { 
                  setIsSongOptionsOpen(false); 
                  if (selectedSongTask?.audioUrl) {
                    Share.share({ message: \`Check out my AI song '\${selectedSongTask.title}': \${selectedSongTask.audioUrl}\` });
                  } else {
                    Alert.alert('Not Ready', 'Audio URL is not available yet.');
                  }
                }}>
                  <Ionicons name="arrow-redo-outline" size={24} color="#FFF" />
                  <Text style={styles.gridBtnText}>Share Song</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.optionsList}>
                {/* Download */}
                <TouchableOpacity style={styles.optionItem} onPress={() => { setIsSongOptionsOpen(false); Alert.alert('Download', 'Downloading song to your device...'); }}>
                  <Ionicons name="download-outline" size={22} color="#FFF" />
                  <Text style={styles.optionText}>Download Song</Text>
                </TouchableOpacity>

                <View style={{ height: 16 }} />

                {/* Group 1 */}
                <View style={{ backgroundColor: '#2A2A2A', borderRadius: 12, overflow: 'hidden' }}>
                  <TouchableOpacity style={[styles.optionItem, { borderRadius: 0, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }]} onPress={() => { setIsSongOptionsOpen(false); Alert.alert('Edit Details', 'Open metadata editor...'); }}>
                    <Ionicons name="information-circle-outline" size={22} color="#FFF" />
                    <Text style={styles.optionText}>Edit Song Details</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.optionItem, { borderRadius: 0, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }]} onPress={() => { 
                    setIsSongOptionsOpen(false); 
                    Alert.alert('Create Cover Art', 'Generate a new AI cover art for 500 TSH?', [{text: 'Cancel'}, {text: 'Generate'}]); 
                  }}>
                    <Ionicons name="sparkles-outline" size={22} color="#FFF" />
                    <Text style={styles.optionText}>Create Cover Art</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.optionItem, { borderRadius: 0 }]} onPress={() => { setIsSongOptionsOpen(false); Alert.alert('Create Hook', 'Generating a hook for this track...'); }}>
                    <Ionicons name="play-circle-outline" size={22} color="#FFF" />
                    <Text style={styles.optionText}>Create Hook</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ height: 16 }} />

                {/* Group 2 */}
                <View style={{ backgroundColor: '#2A2A2A', borderRadius: 12, overflow: 'hidden' }}>
                  <TouchableOpacity style={[styles.optionItem, { borderRadius: 0, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }]} onPress={() => { 
                    setIsSongOptionsOpen(false); 
                    setPrompt(selectedSongTask?.prompt || '');
                  }}>
                    <Ionicons name="time-outline" size={22} color="#FFF" />
                    <Text style={styles.optionText}>Reuse Styles & Lyrics</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.optionItem, { borderRadius: 0, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }]} onPress={() => { setIsSongOptionsOpen(false); Alert.alert('Remix', 'Loading remix studio...'); }}>
                    <Ionicons name="sync-outline" size={22} color="#FFF" />
                    <Text style={styles.optionText}>Remix</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.optionItem, { borderRadius: 0, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }]} onPress={() => { 
                    setIsSongOptionsOpen(false);
                    setPrompt('[Extend] ' + (selectedSongTask?.prompt || ''));
                  }}>
                    <Ionicons name="arrow-forward-outline" size={22} color="#FFF" />
                    <Text style={styles.optionText}>Extend</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.optionItem, { borderRadius: 0, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }]} onPress={() => {
                    setIsSongOptionsOpen(false);
                    Alert.alert('Remaster Audio', 'Enhance audio quality? This will cost 500 TSH.', [{text: 'Cancel'}, {text: 'Pay 500 TSH'}]);
                  }}>
                    <Ionicons name="sparkles" size={22} color="#FFF" />
                    <Text style={styles.optionText}>Remaster</Text>
                    <View style={styles.upgradeBadge}>
                      <Text style={styles.upgradeBadgeText}>500 TSH</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.optionItem, { borderRadius: 0, opacity: 0.5 }]} disabled={true}>
                    <Ionicons name="person-circle-outline" size={22} color="#FFF" />
                    <Text style={styles.optionText}>Create Voice</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ height: 16 }} />

                {/* Radio */}
                <TouchableOpacity style={styles.optionItem} onPress={() => { setIsSongOptionsOpen(false); Alert.alert('Song Radio', 'Starting infinite radio based on this track...'); }}>
                  <Ionicons name="radio-outline" size={22} color="#FFF" />
                  <Text style={styles.optionText}>Start Song Radio</Text>
                </TouchableOpacity>

                <View style={{ height: 16 }} />

                {/* Dislike / Report */}
                <View style={{ backgroundColor: '#2A2A2A', borderRadius: 12, overflow: 'hidden' }}>
                  <TouchableOpacity style={[styles.optionItem, { borderRadius: 0, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }]} onPress={() => { setIsSongOptionsOpen(false); Alert.alert('Noted', 'We will show fewer songs like this.'); }}>
                    <Ionicons name="thumbs-down-outline" size={22} color="#FFF" />
                    <Text style={styles.optionText}>Dislike Song</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.optionItem, { borderRadius: 0 }]} onPress={() => { setIsSongOptionsOpen(false); Alert.alert('Reported', 'Thanks for keeping the community safe.'); }}>
                    <Ionicons name="flag-outline" size={22} color="#FFF" />
                    <Text style={styles.optionText}>Report Inappropriate</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ height: 16 }} />

                {/* Delete */}
                <TouchableOpacity style={styles.optionItem} onPress={() => {
                  Alert.alert('Delete Song', 'Are you sure you want to delete this song?', [
                    { text: 'Cancel', style: 'cancel' },
                    { 
                      text: 'Delete', 
                      style: 'destructive', 
                      onPress: () => {
                        if (selectedSongTask) {
                          removeTask(selectedSongTask.id);
                          setIsSongOptionsOpen(false);
                        }
                      }
                    }
                  ]);
                }}>
                  <Ionicons name="trash-outline" size={22} color="#FF3B30" />
                  <Text style={[styles.optionText, { color: '#FF3B30' }]} >Delete Song</Text>
                </TouchableOpacity>

                <View style={{ height: 100 }} />
              </View>
            </ScrollView>

            {/* Sticky Publish Button */}
            <View style={[styles.publishContainer, { paddingBottom: 30, paddingTop: 10, backgroundColor: '#1E1E1E' }]}>
              <TouchableOpacity style={styles.publishBtn} onPress={() => { setIsSongOptionsOpen(false); Alert.alert('Publish', 'Publishing to global feed...'); }}>
                <Ionicons name="globe-outline" size={20} color="#000" />
                <Text style={styles.publishBtnText}>Publish Song</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>`;

const startIdx = code.indexOf('{/* Detailed Song Options Modal */}');
const endIdx = code.indexOf('</SafeAreaView>');
if (startIdx !== -1 && endIdx !== -1) {
  code = code.substring(0, startIdx) + newModalCode + '\n\n      ' + code.substring(endIdx);
  fs.writeFileSync(filePath, code);
  console.log('Replaced modal successfully');
} else {
  console.log('Could not find modal markers');
}
