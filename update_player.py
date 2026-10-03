import sys

def modify_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    import_target = "import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator, Modal, Alert, Animated, Easing, PanResponder } from 'react-native';"
    import_replace = "import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator, Modal, Alert, Animated, Easing, PanResponder, TextInput, KeyboardAvoidingView, Platform } from 'react-native';"
    content = content.replace(import_target, import_replace)

    state_target = "  const [myPlaylists, setMyPlaylists] = useState<any[]>([]);"
    state_replace = "  const [myPlaylists, setMyPlaylists] = useState<any[]>([]);\n  const [remixPrompt, setRemixPrompt] = useState('');"
    content = content.replace(state_target, state_replace)

    lyrics_target = '''          {/* Lyrics Section */}
          <View style={{ marginBottom: 40 }}>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 16 }}>Lyrics</Text>
            <BlurView intensity={20} tint="dark" style={{ padding: 20, borderRadius: 16, overflow: 'hidden' }}>
              <Text style={{ color: COLORS.textSecondary, fontSize: 16, lineHeight: 24, fontWeight: '500' }}>
                {currentTrack.lyrics || currentTrack.lyrics_swahili || currentTrack.lyrics_english || "Lyrics aren't available for this song yet. Check back later!"}
              </Text>
            </BlurView>
          </View>'''
    
    lyrics_replace = '''          {/* Lyrics Section & AI Song Section */}
          <View style={{ marginBottom: currentTrack?.is_ai ? 120 : 40 }}>
            {currentTrack?.is_ai ? (
              <>
                {/* About this song Card */}
                <View style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 24, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 8 }}>About this song</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
                    Created on {new Date(currentTrack.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </Text>
                </View>

                {/* Style Description Card */}
                <View style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 24, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Style Description</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 8 }}>
                        <Ionicons name="musical-notes-outline" size={16} color="rgba(255,255,255,0.6)" />
                      </TouchableOpacity>
                      <TouchableOpacity style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 8 }}>
                        <Ionicons name="copy-outline" size={16} color="rgba(255,255,255,0.6)" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  <Text style={{ color: '#fff', fontSize: 15, lineHeight: 24, marginBottom: 20, fontWeight: '500' }}>
                    {(currentTrack as any).ai_prompt || currentTrack.description || "No style description available."}
                  </Text>
                  
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                    <Text style={{ color: '#fff', fontSize: 15 }}>Weirdness</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15 }}>{(currentTrack as any).ai_weirdness || '50%'}</Text>
                  </View>
                  
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                    <Text style={{ color: '#fff', fontSize: 15 }}>Style Influence</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15 }}>{(currentTrack as any).ai_influence || '50%'}</Text>
                  </View>
                  
                  <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 16 }} />
                  
                  <TouchableOpacity>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', fontWeight: '500' }}>See Less</Text>
                  </TouchableOpacity>
                </View>

                {/* Lyrics Card */}
                <View style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 24, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Lyrics</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 8 }}>
                        <Ionicons name="musical-notes-outline" size={16} color="rgba(255,255,255,0.6)" />
                      </TouchableOpacity>
                      <TouchableOpacity style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 8 }}>
                        <Ionicons name="copy-outline" size={16} color="rgba(255,255,255,0.6)" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text style={{ color: '#fff', fontSize: 16, lineHeight: 28, fontWeight: '500' }}>
                    {currentTrack.lyrics || currentTrack.lyrics_swahili || currentTrack.lyrics_english || "Lyrics aren't available for this song yet. Check back later!"}
                  </Text>
                </View>
              </>
            ) : (
              <>
                <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 16 }}>Lyrics</Text>
                <BlurView intensity={20} tint="dark" style={{ padding: 20, borderRadius: 16, overflow: 'hidden' }}>
                  <Text style={{ color: COLORS.textSecondary, fontSize: 16, lineHeight: 24, fontWeight: '500' }}>
                    {currentTrack.lyrics || currentTrack.lyrics_swahili || currentTrack.lyrics_english || "Lyrics aren't available for this song yet. Check back later!"}
                  </Text>
                </BlurView>
              </>
            )}
          </View>'''

    # normalize newlines to avoid mismatch
    content = content.replace(lyrics_target, lyrics_replace)
    content = content.replace(lyrics_target.replace('\n', '\r\n'), lyrics_replace)
    
    input_target = '''      </BlurView>
      </ScrollView>'''
      
    input_replace = '''      </BlurView>
      </ScrollView>

      {/* Floating Remix Input for AI Songs */}
      {currentTrack?.is_ai && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{
            position: 'absolute',
            bottom: 40,
            left: 20,
            right: 20,
            zIndex: 100
          }}
        >
          <BlurView intensity={60} tint="dark" style={{
            flexDirection: 'row',
            alignItems: 'center',
            borderRadius: 30,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.1)',
            backgroundColor: 'rgba(0,0,0,0.5)'
          }}>
            <TextInput
              placeholder="Make it chopped and screwed"
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={{ flex: 1, color: '#fff', fontSize: 16, height: 40, outlineStyle: 'none' }}
              value={remixPrompt}
              onChangeText={setRemixPrompt}
            />
            <TouchableOpacity 
              style={{ backgroundColor: '#D9534F', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginLeft: 8 }}
              onPress={() => { Alert.alert("Remixing...", "Your remix request has been sent."); setRemixPrompt(''); }}
            >
              <Ionicons name="arrow-up" size={20} color="#fff" />
            </TouchableOpacity>
          </BlurView>
        </KeyboardAvoidingView>
      )}'''
      
    content = content.replace(input_target, input_replace)
    content = content.replace(input_target.replace('\n', '\r\n'), input_replace)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

modify_file('app/player.tsx')
