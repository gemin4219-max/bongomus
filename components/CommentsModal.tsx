import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassView as BlurView } from '@/components/GlassView';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profile: {
    display_name: string;
    avatar_url: string | null;
  };
}

interface CommentsModalProps {
  visible: boolean;
  onClose: () => void;
  trackId: string;
}

export default function CommentsModal({ visible, onClose, trackId }: CommentsModalProps) {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const session = useAuthStore(s => s.session);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [isPosting, setIsPosting] = useState(false);

  useEffect(() => {
    if (visible && trackId) {
      fetchComments();

      // Subscribe to real-time changes
      const channel = supabase
        .channel(`public:track_comments:${trackId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'track_comments', filter: `track_id=eq.${trackId}` },
          (payload) => {
            // Only refetch if the comment is from SOMEONE ELSE (we handle our own optimistically)
            if (payload.new.user_id !== session?.user?.id) {
              fetchComments();
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'track_comments', filter: `track_id=eq.${trackId}` },
          (payload) => {
            setComments(prev => prev.filter(c => c.id !== payload.old.id));
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [visible, trackId]);

  const fetchComments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('track_comments')
      .select('*')
      .eq('track_id', trackId)
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error('Error fetching comments:', error);
    } else if (data && data.length > 0) {
      const userIds = [...new Set(data.map(c => c.user_id))];
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', userIds);

      if (!profileError && profiles) {
        const profileMap = profiles.reduce((acc: any, p: any) => {
          acc[p.id] = p;
          return acc;
        }, {});
        const commentsWithProfiles = data.map(c => ({
          ...c,
          profile: profileMap[c.user_id]
        }));
        setComments(commentsWithProfiles);
      } else {
        setComments(data);
      }
    } else {
      setComments([]);
    }
    setLoading(false);
  };

  const handlePost = async () => {
    if (!newComment.trim()) return;
    if (!session) {
      Alert.alert('Login Required', 'You must be logged in to comment.');
      return;
    }

    setIsPosting(true);
    const { data, error } = await supabase
      .from('track_comments')
      .insert({
        track_id: trackId,
        user_id: session.user.id,
        content: newComment.trim()
      })
      .select('*')
      .single();

    if (error) {
      Alert.alert('Error', error.message);
    } else if (data) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .eq('id', session.user.id)
        .single();
      setComments([{ ...data, profile }, ...comments]);
      setNewComment('');
    }
    setIsPosting(false);
  };

  const handleDelete = (commentId: string, userId: string) => {
    if (session?.user.id !== userId) return;
    Alert.alert('Delete Comment', 'Are you sure you want to delete this comment?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Delete', 
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('track_comments').delete().eq('id', commentId);
          if (error) {
            Alert.alert('Error', error.message);
          } else {
            setComments(comments.filter(c => c.id !== commentId));
          }
        }
      }
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.container}>
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.7)' }]} />
        
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.content}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Comments</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={{ padding: 20 }}>
              {[1, 2, 3, 4].map((i) => (
                <View key={i} style={styles.commentCard}>
                  <View style={[styles.avatar, { backgroundColor: 'rgba(255,255,255,0.08)' }]} />
                  <View style={[styles.commentBody, { backgroundColor: 'rgba(255,255,255,0.03)', height: 60, borderRadius: 16 }]} />
                </View>
              ))}
            </View>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={item => item.id}
              contentContainerStyle={{ padding: 20 }}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="chatbubbles-outline" size={64} color={COLORS.textTertiary} />
                  <Text style={styles.emptyText}>No comments yet. Be the first to share your thoughts!</Text>
                </View>
              }
              renderItem={({ item }) => (
                <View style={styles.commentCard}>
                  <Image 
                    source={item.profile?.avatar_url ? { uri: item.profile.avatar_url } : require('../assets/icon.png')} 
                    style={styles.avatar} 
                  />
                  <View style={styles.commentBody}>
                    <View style={styles.commentHeaderRow}>
                      <Text style={styles.commentName}>{item.profile?.display_name || 'User'}</Text>
                      {session?.user.id === item.user_id && (
                        <TouchableOpacity onPress={() => handleDelete(item.id, item.user_id)}>
                          <Ionicons name="trash-outline" size={16} color={COLORS.error} />
                        </TouchableOpacity>
                      )}
                    </View>
                    <Text style={styles.commentText}>{item.content}</Text>
                  </View>
                </View>
              )}
            />
          )}

          <View style={styles.inputArea}>
            <TextInput
              style={styles.input}
              placeholder="Add a comment..."
              placeholderTextColor={COLORS.textTertiary}
              value={newComment}
              onChangeText={setNewComment}
              multiline
            />
            <TouchableOpacity 
              style={[styles.postBtn, !newComment.trim() && { opacity: 0.5 }]} 
              onPress={handlePost}
              disabled={isPosting || !newComment.trim()}
            >
              {isPosting ? (
                <ActivityIndicator size="small" color={COLORS.black} />
              ) : (
                <Ionicons name="send" size={20} color={COLORS.black} />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  content: { backgroundColor: COLORS.darkSurface, height: '75%', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  title: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '800' },
  closeBtn: { padding: 4 },
  commentCard: { flexDirection: 'row', marginBottom: 20 },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12, backgroundColor: 'rgba(255,255,255,0.1)' },
  commentBody: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 16, borderTopLeftRadius: 4 },
  commentHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  commentName: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '700' },
  commentText: { color: COLORS.textPrimary, fontSize: 15, lineHeight: 22 },
  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 60 },
  emptyText: { color: COLORS.textSecondary, marginTop: 16, textAlign: 'center', fontSize: 15, paddingHorizontal: 40, lineHeight: 22 },
  inputArea: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 32, backgroundColor: 'transparent' },
  input: { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', color: COLORS.textPrimary, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 24, fontSize: 15, maxHeight: 100 },
  postBtn: { backgroundColor: COLORS.gold, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginLeft: 12 }
});
