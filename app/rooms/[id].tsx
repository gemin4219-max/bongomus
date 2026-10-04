// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useThemeStore } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import { usePlayerStore } from '../../store/playerStore';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import GlassBackButton from '../../components/GlassBackButton';

export default function LiveRoomScreen() {
  const { id } = useLocalSearchParams();
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  const session = useAuthStore(s => s.session);
  const playTrack = usePlayerStore(s => s.playTrack);
  const currentTrack = usePlayerStore(s => s.currentTrack);

  const [room, setRoom] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageInput, setMessageInput] = useState('');
  
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    loadRoom();
    loadMessages();

    // Subscribe to new messages
    const messageSub = supabase
      .channel(`public:room_messages:room_id=eq.${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'room_messages', filter: `room_id=eq.${id}` }, payload => {
        loadMessages(); // Reload messages to get the profile data (or we could fetch just the profile for the new message)
      })
      .subscribe();
      
    // Subscribe to room status changes
    const roomSub = supabase
      .channel(`public:rooms:id=eq.${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${id}` }, payload => {
        loadRoom();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(messageSub);
      supabase.removeChannel(roomSub);
    };
  }, [id]);

  const loadRoom = async () => {
    const { data } = await supabase
      .from('rooms')
      .select('*, artist:profiles!artist_id(*), track:tracks!track_id(*)')
      .eq('id', id)
      .single();
      
    if (data) {
      setRoom(data);
      // If room is live and we aren't playing the track yet, play it!
      if (data.status === 'live' && currentTrack?.id !== data.track_id) {
        playTrack(data.track, [data.track]);
      }
    }
    setLoading(false);
  };

  const loadMessages = async () => {
    const { data } = await supabase
      .from('room_messages')
      .select('*, profile:profiles!user_id(*)')
      .eq('room_id', id)
      .order('created_at', { ascending: true });
      
    if (data) {
      setMessages(data);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 500);
    }
  };

  const sendMessage = async () => {
    if (!messageInput.trim() || !session) return;
    
    const content = messageInput.trim();
    setMessageInput(''); // clear instantly for good UX
    
    await supabase.from('room_messages').insert({
      room_id: id,
      user_id: session.user.id,
      content: content
    });
  };

  if (loading || !room) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={COLORS.gold} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Top Header / Player Area */}
      <View style={styles.topHalf}>
        <Image source={{ uri: room.track?.cover_url || undefined }} style={StyleSheet.absoluteFill} blurRadius={10} />
        <LinearGradient colors={['rgba(0,0,0,0.5)', COLORS.black]} style={StyleSheet.absoluteFill} />
        
        <View style={styles.header}>
          <GlassBackButton onPress={() => router.back()} />
          <View style={styles.liveBadge}>
            <View style={styles.pulseDot} />
            <Text style={styles.liveBadgeText}>{room.status === 'live' ? 'LIVE' : 'WAITING'}</Text>
          </View>
        </View>

        <View style={styles.playerInfo}>
          <Image source={{ uri: room.track?.cover_url || undefined }} style={styles.coverImage} />
          <Text style={styles.title}>{room.title}</Text>
          <Text style={styles.artist}>Hosted by {room.artist?.display_name}</Text>
          
          {room.status === 'waiting' && (
            <View style={styles.waitingBox}>
              <ActivityIndicator color={COLORS.gold} />
              <Text style={styles.waitingText}>Waiting for artist to start...</Text>
            </View>
          )}
        </View>
      </View>

      {/* Bottom Chat Area */}
      <View style={styles.bottomHalf}>
        <View style={styles.chatHeader}>
          <Text style={styles.chatTitle}>Live Chat</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="people" size={16} color={COLORS.textSecondary} />
            <Text style={styles.listenerCount}>{room.listener_count}</Text>
          </View>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 10 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.messageRow}>
              <Image source={{ uri: item.profile?.avatar_url || undefined }} style={styles.avatar} />
              <View style={styles.messageBubble}>
                <Text style={styles.messageName}>{item.profile?.display_name || 'User'}</Text>
                <Text style={styles.messageText}>{item.content}</Text>
              </View>
            </View>
          )}
        />

        {/* Input Box */}
        {session ? (
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Say something nice..."
              placeholderTextColor={COLORS.textTertiary}
              value={messageInput}
              onChangeText={setMessageInput}
              onSubmitEditing={sendMessage}
              returnKeyType="send"
            />
            <TouchableOpacity 
              style={[styles.sendBtn, !messageInput.trim() && { opacity: 0.5 }]} 
              onPress={sendMessage}
              disabled={!messageInput.trim()}
            >
              <Ionicons name="send" size={18} color={COLORS.black} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.loginPrompt}>
            <Text style={{ color: COLORS.textSecondary }}>Log in to chat</Text>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.black },
  
  // Top Half
  topHalf: { height: '45%', justifyContent: 'center', alignItems: 'center' },
  header: { position: 'absolute', top: 50, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 59, 48, 0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,59,48,0.5)' },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B30', marginRight: 6 },
  liveBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  
  playerInfo: { alignItems: 'center', marginTop: 40 },
  coverImage: { width: 160, height: 160, borderRadius: 24, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } },
  title: { color: '#fff', fontSize: 24, fontWeight: '900', textAlign: 'center', marginBottom: 4 },
  artist: { color: COLORS.gold, fontSize: 16, fontWeight: '600' },
  waitingBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, marginTop: 16, gap: 12 },
  waitingText: { color: '#fff', fontWeight: '600' },

  // Bottom Half
  bottomHalf: { flex: 1, backgroundColor: COLORS.black, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  chatTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '800' },
  listenerCount: { color: COLORS.textSecondary, marginLeft: 6, fontWeight: '700' },
  
  messageRow: { flexDirection: 'row', marginBottom: 16 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.card, marginRight: 12 },
  messageBubble: { flex: 1, backgroundColor: COLORS.card, padding: 12, borderRadius: 16, borderTopLeftRadius: 4 },
  messageName: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 4 },
  messageText: { color: COLORS.textPrimary, fontSize: 14, lineHeight: 20 },
  
  inputContainer: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: Platform.OS === 'ios' ? 32 : 16, borderTopWidth: 1, borderTopColor: COLORS.divider },
  input: { flex: 1, backgroundColor: COLORS.card, color: COLORS.textPrimary, height: 48, borderRadius: 24, paddingHorizontal: 20, marginRight: 12 },
  sendBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.gold, justifyContent: 'center', alignItems: 'center' },
  loginPrompt: { padding: 20, alignItems: 'center', borderTopWidth: 1, borderTopColor: COLORS.divider, paddingBottom: Platform.OS === 'ios' ? 32 : 20 },
});
