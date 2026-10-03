import React, { useCallback, useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Alert, Modal, TextInput, Switch, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { Track } from '../../constants';
import { usePlayerStore } from '../../store/playerStore';
import { useOfflineStore } from '../../store/offlineStore';
import { useAIStore } from '../../store/aiStore';
import { useLayoutStore } from '../../store/layoutStore';
import TrackItem from '../../components/TrackItem';
import { TaskItem } from '../../components/ai/WorkspaceTab';
import * as MediaLibrary from 'expo-media-library';
import * as DocumentPicker from 'expo-document-picker';
import AppBannerAd from '../../components/ads/AppBannerAd';

export default function LibraryScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  const session = useAuthStore(s => s.session);
  const playTrack = usePlayerStore(s => s.playTrack);
  const currentTrack = usePlayerStore(s => s.currentTrack);

  const [likedTracks, setLikedTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'ai_songs' | 'liked' | 'playlists' | 'uploads' | 'downloads'>('ai_songs');
  const [uploads, setUploads] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [aiTracks, setAiTracks] = useState<Track[]>([]);
  
  const { tasks } = useAIStore();
  const [isPublishing, setIsPublishing] = useState<Record<string, boolean>>({});
  const [isDownloading, setIsDownloading] = useState<Record<string, boolean>>({});
  const [isGeneratingVideo, setIsGeneratingVideo] = useState<Record<string, boolean>>({});
  const [isSeparating, setIsSeparating] = useState<Record<string, boolean>>({});
  
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('');
  const [newPlaylistIsPublic, setNewPlaylistIsPublic] = useState(true);
  const { downloadedTracks } = useOfflineStore();
  const [localTracks, setLocalTracks] = useState<Track[]>([]);
  const [hasMediaPermission, setHasMediaPermission] = useState<boolean | null>(null);

  useEffect(() => {
    if (tab === 'downloads') {
      (async () => {
        const { status, canAskAgain } = await MediaLibrary.getPermissionsAsync();
        setHasMediaPermission(status === 'granted');
        if (status === 'granted') {
          loadLocalAudio();
        }
      })();
    }
  }, [tab]);

  const requestMediaPermission = async () => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    setHasMediaPermission(status === 'granted');
    if (status === 'granted') loadLocalAudio();
  };

  const loadLocalAudio = async () => {
    try {
      const media = await MediaLibrary.getAssetsAsync({ mediaType: MediaLibrary.MediaType.audio, first: 100, sortBy: [MediaLibrary.SortBy.creationTime] });
      const mapped: Track[] = media.assets.map(a => ({
        id: `local_${a.id}`, user_id: 'local_device', title: a.filename.replace(/\.[^/.]+$/, ""), artist_name: 'Local Music', genre: 'Local', cover_url: null, audio_url: a.uri, description: null, is_public: false, created_at: new Date(a.creationTime || Date.now()).toISOString(),
      }));
      setLocalTracks(mapped);
    } catch (e) {
      console.log('Error loading local music:', e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (session) loadLibrary();
    }, [session, tab])
  );

  const loadLibrary = async () => {
    if (!session) return;
    setLoading(true);
    try {
      if (tab === 'liked') {
        const { data: likes } = await supabase.from('likes').select('track_id').eq('user_id', session.user.id);
        if (likes && likes.length > 0) {
          const ids = likes.map(l => l.track_id);
          const { data } = await supabase.from('tracks').select('*, profile:profiles!tracks_user_id_fkey(*)').in('id', ids).order('created_at', { ascending: false });
          if (data) setLikedTracks(data as Track[]);
        } else {
          setLikedTracks([]);
        }
      } else if (tab === 'playlists') {
        const { data: colabs } = await supabase.from('playlist_collaborators').select('playlist_id').eq('user_id', session.user.id);
        const colabIds = colabs?.map(c => c.playlist_id) || [];
        
        const { data } = await supabase
          .from('playlists')
          .select('*')
          .or(`user_id.eq.${session.user.id},id.in.(${colabIds.length ? colabIds.join(',') : '00000000-0000-0000-0000-000000000000'})`)
          .order('created_at', { ascending: false });
        if (data) setPlaylists(data);
      } else if (tab === 'uploads') {
        const { data } = await supabase.from('tracks').select('*, profile:profiles!tracks_user_id_fkey(*)').eq('user_id', session.user.id).order('created_at', { ascending: false });
        if (data) setUploads(data as Track[]);
      } else if (tab === 'ai_songs') {
        const { data } = await supabase.from('tracks').select('*, profile:profiles!tracks_user_id_fkey(*)').eq('user_id', session.user.id).eq('is_ai', true).order('created_at', { ascending: false });
        if (data) setAiTracks(data as Track[]);
      }
    } catch (error) {
      console.log("Offline or network error fetching library", error);
    } finally {
      setLoading(false);
    }
  };

  const openCreatePlaylist = () => {
    setNewPlaylistTitle('');
    setNewPlaylistIsPublic(true);
    setCreateModalVisible(true);
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistTitle.trim()) {
      Alert.alert("Required", "Please enter a name for your playlist");
      return;
    }
    
    setCreateModalVisible(false);
    
    const { error } = await supabase.from('playlists').insert({
      user_id: session!.user.id,
      title: newPlaylistTitle.trim(),
      is_public: newPlaylistIsPublic
    });
    
    if (error) {
      Alert.alert("Error", error.message);
    } else {
      loadLibrary();
    }
  };

  const handleDeleteTrack = (track: Track) => {
    import('react-native').then(({ Alert }) => {
      Alert.alert(
        "Delete Song",
        `Are you sure you want to permanently delete "${track.title}"?`,
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Delete", 
            style: "destructive", 
            onPress: async () => {
              const { error } = await supabase.from('tracks').delete().eq('id', track.id);
              if (error) {
                Alert.alert("Error", error.message);
              } else {
                setUploads(prev => prev.filter(t => t.id !== track.id));
              }
            }
          }
        ]
      );
    });
  };

  useEffect(() => {
    if (!session && tab !== 'downloads') {
      setTab('downloads');
    }
  }, [session]);

  const isArtist = session?.user?.user_metadata?.role === 'artist';
  const tracks = tab === 'liked' ? likedTracks : tab === 'uploads' ? uploads : [...Object.values(downloadedTracks), ...localTracks];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Workspace</Text>

      <View style={{ marginBottom: 12 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cardsScroll} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
          <TouchableOpacity onPress={() => setTab('downloads')} activeOpacity={0.8}>
            <LinearGradient colors={['#004d40', '#00251a']} style={styles.topCard}>
              <Ionicons name="cloud-download" size={28} color="#FFF" style={{ marginBottom: 8 }} />
              <Text style={styles.topCardText}>Offline Songs</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setTab('ai_songs')} activeOpacity={0.8}>
            <LinearGradient colors={['#6B21A8', '#3B0764']} style={styles.topCard}>
              <Ionicons name="sparkles" size={28} color="#FFF" style={{ marginBottom: 8 }} />
              <Text style={styles.topCardText}>My AI Songs</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/ai-studio?tool=Create')} activeOpacity={0.8}>
            <LinearGradient colors={['#D946EF', '#8B5CF6']} style={styles.topCard}>
              <Ionicons name="musical-notes" size={28} color="#FFF" style={{ marginBottom: 8 }} />
              <Text style={styles.topCardText}>Create Music</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/ai-studio?tool=Personas')} activeOpacity={0.8}>
            <LinearGradient colors={['#F59E0B', '#EA580C']} style={styles.topCard}>
              <Ionicons name="people" size={28} color="#FFF" style={{ marginBottom: 8 }} />
              <Text style={styles.topCardText}>Voice Personas</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/ai-studio?tool=Cover')} activeOpacity={0.8}>
            <LinearGradient colors={['#10B981', '#059669']} style={styles.topCard}>
              <Ionicons name="mic" size={28} color="#FFF" style={{ marginBottom: 8 }} />
              <Text style={styles.topCardText}>Cover Songs</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/ai-studio?tool=Sound')} activeOpacity={0.8}>
            <LinearGradient colors={['#3B82F6', '#1D4ED8']} style={styles.topCard}>
              <Ionicons name="volume-medium" size={28} color="#FFF" style={{ marginBottom: 8 }} />
              <Text style={styles.topCardText}>Sound Effects</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setTab('playlists')} activeOpacity={0.8}>
            <LinearGradient colors={['#A81A8A', '#571096']} style={styles.topCard}>
              <Ionicons name="albums" size={28} color="#FFF" style={{ marginBottom: 8 }} />
              <Text style={styles.topCardText}>Playlists</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setTab('uploads')} activeOpacity={0.8}>
            <LinearGradient colors={['#E59400', '#D34D00']} style={styles.topCard}>
              <Ionicons name="cloud-upload" size={28} color="#FFF" style={{ marginBottom: 8 }} />
              <Text style={styles.topCardText}>Uploads</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setTab('liked')} activeOpacity={0.8}>
            <LinearGradient colors={['#C41427', '#800B17']} style={styles.topCard}>
              <Ionicons name="heart" size={28} color="#FFF" style={{ marginBottom: 8 }} />
              <Text style={styles.topCardText}>Liked Songs</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {tab === 'ai_songs' ? (
        <ScrollView style={{ flex: 1, paddingHorizontal: 16 }} contentContainerStyle={{ paddingBottom: 160 }}>
          {tasks.length === 0 && aiTracks.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="folder-open-outline" size={64} color="rgba(255,255,255,0.2)" />
              <Text style={styles.emptyText}>Your workspace is empty.</Text>
            </View>
          ) : (
            <>
              {tasks.map(task => (
                <TaskItem 
                  key={task.taskId} 
                  task={task} 
                  isPublishing={isPublishing} 
                  setIsPublishing={setIsPublishing} 
                  isDownloading={isDownloading} 
                  setIsDownloading={setIsDownloading} 
                  isGeneratingVideo={isGeneratingVideo} 
                  setIsGeneratingVideo={setIsGeneratingVideo} 
                  isSeparating={isSeparating} 
                  setIsSeparating={setIsSeparating} 
                  openPersonaModal={(id, taskId) => router.push(`/ai-studio?tool=Personas&audioId=${id}&taskId=${taskId}`)} 
                  openExtendModal={(id, title) => {}} 
                />
              ))}
              {aiTracks.filter(track => !tasks.some(t => t.tracks?.some(sunoTrack => track.audio_url?.includes(sunoTrack.id)))).map(track => (
                <TrackItem
                  key={`cloud_ai_${track.id}`}
                  track={track}
                  isPlaying={currentTrack?.id === track.id}
                  onPress={() => {
                    playTrack(track, aiTracks);
                    router.push('/player');
                  }}
                  onArtistPress={() => router.push({ pathname: '/artist/[id]', params: { id: track.user_id } })}
                  onDelete={() => handleDeleteTrack(track)}
                />
              ))}
            </>
          )}
        </ScrollView>
      ) : loading ? (
        <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} />
      ) : tab === 'playlists' ? (
        <View style={{ flex: 1 }}>
          <TouchableOpacity style={styles.createPlaylistBtn} onPress={openCreatePlaylist}>
            <Ionicons name="add-circle" size={24} color={COLORS.gold} />
            <Text style={styles.createPlaylistText}>Create New Playlist</Text>
          </TouchableOpacity>
          <FlatList
            data={playlists}
            keyExtractor={p => p.id}
            contentContainerStyle={{ paddingBottom: 160, paddingHorizontal: 16 }}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.playlistCard} onPress={() => router.push({ pathname: '/playlist/[id]', params: { id: item.id } })}>
                <View style={styles.playlistIcon}>
                  <Ionicons name="musical-notes" size={24} color={COLORS.textTertiary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.playlistTitle}>{item.title}</Text>
                  <Text style={styles.playlistSub}>
                    {item.is_public ? 'Public 🌍' : 'Private 🔒'} • {item.user_id === session?.user.id ? 'Owned by you' : 'Collaborative'} • {item.track_count || 0} Tracks
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={COLORS.textTertiary} />
              </TouchableOpacity>
            )}
            ListEmptyComponent={() => (
              <View style={styles.empty}>
                <Ionicons name="list" size={64} color={COLORS.textSecondary} />
                <Text style={styles.emptyText}>You haven't created any playlists yet</Text>
              </View>
            )}
            ListFooterComponent={() => (
              <View style={{ alignItems: 'center', marginTop: 20 }}>
                <AppBannerAd />
              </View>
            )}
          />
        </View>
      ) : (
        <View style={{ flex: 1, paddingHorizontal: 16 }}>
          {tab === 'downloads' && hasMediaPermission === false && (
            <TouchableOpacity 
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(217, 160, 91, 0.1)', padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(217, 160, 91, 0.3)', marginTop: 16 }}
              onPress={requestMediaPermission}
            >
              <Ionicons name="phone-portrait-outline" size={24} color={COLORS.gold} />
              <View style={{ flex: 1, marginLeft: 16 }}>
                <Text style={{ color: COLORS.gold, fontSize: 15, fontWeight: '700' }}>Find Local Device Music</Text>
                <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 2 }}>Allow access to play MP3s from your phone</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.gold} />
            </TouchableOpacity>
          )}

          {tracks.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name={tab === 'liked' ? 'heart-dislike' : tab === 'uploads' ? 'folder-open' : 'cloud-offline'} size={64} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>
                {tab === 'liked' ? 'Bado hujapenda wimbo wowote' : tab === 'uploads' ? 'Bado hujapakia wimbo wowote' : 'Hujapakua nyimbo zozote za kusikiliza nje ya mtandao'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={tracks}
              keyExtractor={t => t.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 160 }}
              renderItem={({ item }) => (
                <TrackItem
                  track={item}
                  isPlaying={currentTrack?.id === item.id}
                  onPress={() => {
                    playTrack(item, tracks);
                    router.push('/player');
                  }}
                  onArtistPress={() => router.push({ pathname: '/artist/[id]', params: { id: item.user_id } })}
                  onDelete={tab === 'uploads' ? () => handleDeleteTrack(item) : undefined}
                />
              )}
              ListFooterComponent={() => (
                <View style={{ alignItems: 'center', marginTop: 20 }}>
                  <AppBannerAd />
                </View>
              )}
            />
          )}
        </View>
      )}
      
      <Modal visible={createModalVisible} transparent animationType="slide" onRequestClose={() => setCreateModalVisible(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Playlist</Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <TextInput 
              style={styles.modalInput}
              placeholder="Playlist Name"
              placeholderTextColor={COLORS.textTertiary}
              value={newPlaylistTitle}
              onChangeText={setNewPlaylistTitle}
              autoFocus
            />
            
            <View style={styles.privacyRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.privacyLabel}>Public Playlist</Text>
                <Text style={styles.privacySub}>
                  {newPlaylistIsPublic ? 'Anyone can find and listen to this playlist.' : 'Only you and invited collaborators can view.'}
                </Text>
              </View>
              <Switch 
                value={newPlaylistIsPublic} 
                onValueChange={setNewPlaylistIsPublic}
                trackColor={{ false: COLORS.divider, true: COLORS.gold + '80' }}
                thumbColor={newPlaylistIsPublic ? COLORS.gold : COLORS.textSecondary}
              />
            </View>
            
            <TouchableOpacity style={styles.modalBtn} onPress={handleCreatePlaylist}>
              <Text style={styles.modalBtnText}>Create Playlist</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black, paddingTop: 60 },
  title: { color: COLORS.gold, fontSize: 26, fontWeight: '900', marginHorizontal: 16, marginBottom: 16 },
  
  cardsScroll: { marginBottom: 4 },
  topCard: { width: 140, height: 100, borderRadius: 12, padding: 12, justifyContent: 'center', alignItems: 'center' },
  topCardText: { color: '#FFF', fontSize: 16, fontWeight: '800', textAlign: 'center' },

  tabs: { paddingHorizontal: 16, gap: 10 },
  tab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 8, backgroundColor: COLORS.card, borderRadius: 20, borderWidth: 1, borderColor: COLORS.divider },
  tabActive: { backgroundColor: COLORS.gold + '20', borderColor: COLORS.gold },
  tabText: { color: COLORS.textTertiary, fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: COLORS.gold },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyText: { color: COLORS.textSecondary, fontSize: 15 },
  noAuth: { flex: 1, backgroundColor: COLORS.black, justifyContent: 'center', alignItems: 'center', gap: 12 },
  noAuthTitle: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '700' },
  noAuthText: { color: COLORS.textSecondary, fontSize: 14 },
  loginBtn: { backgroundColor: COLORS.gold, borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14, marginTop: 8 },
  loginBtnText: { color: COLORS.black, fontWeight: '800', fontSize: 16 },
  createPlaylistBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(212,175,55,0.1)', marginHorizontal: 16, marginBottom: 16, padding: 12, borderRadius: 12, gap: 12 },
  createPlaylistText: { color: COLORS.gold, fontSize: 16, fontWeight: '700' },
  playlistCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, padding: 16, borderRadius: 16, marginBottom: 12, gap: 16 },
  playlistIcon: { width: 56, height: 56, borderRadius: 12, backgroundColor: COLORS.cardAlt, justifyContent: 'center', alignItems: 'center' },
  playlistTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  playlistSub: { color: COLORS.textSecondary, fontSize: 13 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '800' },
  modalInput: { backgroundColor: COLORS.black, color: COLORS.textPrimary, borderRadius: 12, padding: 16, fontSize: 16, borderWidth: 1, borderColor: COLORS.divider, marginBottom: 20 },
  privacyRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardAlt, padding: 16, borderRadius: 12, marginBottom: 24 },
  privacyLabel: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '600', marginBottom: 4 },
  privacySub: { color: COLORS.textSecondary, fontSize: 12 },
  modalBtn: { backgroundColor: COLORS.gold, padding: 16, borderRadius: 12, alignItems: 'center' },
  modalBtnText: { color: COLORS.black, fontSize: 16, fontWeight: '700' },
});
