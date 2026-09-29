import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Image,
  Modal, KeyboardAvoidingView, Platform, ScrollView, Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAIStore } from '../store/aiStore';

interface EditSongDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  songTask: any;
  onRequestCoverArtEdit?: () => void;
}

type Screen = 'main' | 'style' | 'lyrics' | 'moreOptions';

export const EditSongDetailsModal: React.FC<EditSongDetailsModalProps> = ({
  visible, onClose, songTask, onRequestCoverArtEdit
}) => {
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [allowComments, setAllowComments] = useState(true);
  const [allowRemix, setAllowRemix] = useState(true);
  const [styleTags, setStyleTags] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [screen, setScreen] = useState<Screen>('main');
  const { updateTrack } = useAIStore();

  const getTrackId = () => songTask?.tracks?.[0]?.id || songTask?.id || songTask?.taskId;

  useEffect(() => {
    if (visible && songTask) {
      const track = songTask.tracks?.[0] || songTask;
      setTitle(track.title || 'Untitled');
      setCaption(track.caption || track.description || '');
      setIsPublished(track.is_public || false);
      setAllowComments(track.allow_comments !== false);
      setAllowRemix(track.allow_remix !== false);
      setStyleTags(track.genre || track.tags || '');
      setLyrics(track.lyrics || track.prompt || '');
      setScreen('main');
    }
  }, [visible, songTask]);

  const saveField = async (fields: Record<string, any>) => {
    const trackId = getTrackId();
    if (!trackId) {
      console.warn('[EditSongDetailsModal] No trackId found, cannot save. songTask:', JSON.stringify(songTask));
      return;
    }
    console.log('[EditSongDetailsModal] Saving fields:', fields, 'for trackId:', trackId);
    updateTrack(songTask.taskId || songTask.id, trackId, fields);
    const { error } = await supabase.from('tracks').update(fields).eq('id', trackId);
    if (error) {
      console.error('[EditSongDetailsModal] Supabase update error:', error);
    } else {
      console.log('[EditSongDetailsModal] Saved successfully');
    }
  };

  const handlePublishToggle = async (value: boolean) => {
    setIsPublished(value);
    // Save only is_public — guaranteed column
    const trackId = getTrackId();
    if (!trackId) { console.warn('[EditSongDetailsModal] No trackId for publish toggle'); return; }
    updateTrack(songTask.taskId || songTask.id, trackId, { is_public: value });
    const { error } = await supabase.from('tracks').update({ is_public: value }).eq('id', trackId);
    if (error) console.error('[EditSongDetailsModal] publish error:', error);
    else console.log('[EditSongDetailsModal] is_public saved:', value);
  };

  const handleAllowCommentsToggle = async (value: boolean) => {
    setAllowComments(value);
    try { await saveField({ allow_comments: value }); } catch (e) { console.warn('allow_comments column may not exist yet', e); }
  };

  const handleAllowRemixToggle = async (value: boolean) => {
    setAllowRemix(value);
    try { await saveField({ allow_remix: value }); } catch (e) { console.warn('allow_remix column may not exist yet', e); }
  };

  const handleSave = async () => {
    const trackId = getTrackId();
    if (!trackId) { onClose(); return; }
    updateTrack(songTask.taskId || songTask.id, trackId, {
      title, caption, genre: styleTags, lyrics, is_public: isPublished
    });
    // Save guaranteed columns
    const { error } = await supabase.from('tracks').update({
      title, description: caption, genre: styleTags, lyrics, is_public: isPublished
    }).eq('id', trackId);
    if (error) console.error('[EditSongDetailsModal] handleSave error:', error);
    // Try saving optional columns (may not exist yet in DB)
    try {
      await supabase.from('tracks').update({ allow_comments: allowComments, allow_remix: allowRemix }).eq('id', trackId);
    } catch (e) { /* columns may not exist yet */ }
    onClose();
  };

  const track = songTask?.tracks?.[0] || songTask;
  const coverImage = track?.imageUrl || track?.cover_url || 'https://picsum.photos/400';

  const renderStyleScreen = () => (
    <View style={styles.modalContent}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => setScreen('main')}>
          <Ionicons name="chevron-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Style Summary</Text>
        <TouchableOpacity style={[styles.closeBtn, { backgroundColor: '#2A2A2A' }]} onPress={async () => { await saveField({ genre: styleTags }); setScreen('main'); }}>
          <Ionicons name="checkmark" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>
      <ScrollView style={{ padding: 20, flex: 1 }}>
        <TextInput style={styles.styleInput} value={styleTags} onChangeText={setStyleTags} multiline placeholder="folk, uplifting, group vocals, acoustic guitar" placeholderTextColor="#888" autoFocus />
      </ScrollView>
    </View>
  );

  const renderLyricsScreen = () => (
    <View style={styles.modalContent}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => setScreen('main')}>
          <Ionicons name="chevron-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Displayed Lyrics</Text>
        <TouchableOpacity style={[styles.closeBtn, { backgroundColor: '#2A2A2A' }]} onPress={async () => { await saveField({ lyrics }); setScreen('main'); }}>
          <Ionicons name="checkmark" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>
      <ScrollView style={{ padding: 20, flex: 1 }}>
        <TextInput style={styles.styleInput} value={lyrics} onChangeText={setLyrics} multiline placeholder="Enter lyrics here..." placeholderTextColor="#888" autoFocus />
      </ScrollView>
    </View>
  );

  const renderMoreOptionsScreen = () => (
    <View style={styles.modalContent}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => setScreen('main')}>
          <Ionicons name="chevron-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>More Options</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={{ paddingTop: 20 }}>
        <View style={styles.divider} />
        <View style={styles.listItem}>
          <Ionicons name="chatbubble-outline" size={24} color="#FFF" style={styles.listIcon} />
          <View style={styles.listItemContent}>
            <Text style={styles.listItemTitle}>Allow Comments</Text>
          </View>
          <Switch value={allowComments} onValueChange={handleAllowCommentsToggle} trackColor={{ false: '#444', true: '#FF2A75' }} thumbColor="#FFF" />
        </View>
        <View style={styles.divider} />
        <View style={styles.listItem}>
          <Ionicons name="sync-circle-outline" size={24} color="#FFF" style={styles.listIcon} />
          <View style={styles.listItemContent}>
            <Text style={styles.listItemTitle}>Allow Remix</Text>
          </View>
          <Switch value={allowRemix} onValueChange={handleAllowRemixToggle} trackColor={{ false: '#444', true: '#FF2A75' }} thumbColor="#FFF" />
        </View>
        <View style={styles.divider} />
      </View>
    </View>
  );

  const renderMainScreen = () => (
    <View style={styles.modalContent}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeBtn} onPress={handleSave}>
          <Ionicons name="close" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Song Details</Text>
        {isPublished ? (
          <TouchableOpacity style={[styles.closeBtn, { backgroundColor: '#FFF' }]} onPress={handleSave}>
            <Ionicons name="checkmark" size={22} color="#000" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <ScrollView style={styles.scrollArea}>
        <View style={styles.coverArea}>
          <View style={styles.coverImageContainer}>
            <Image source={{ uri: coverImage }} style={styles.coverImage} />
            <TouchableOpacity style={styles.editCoverPill} onPress={() => { if (onRequestCoverArtEdit) onRequestCoverArtEdit(); }}>
              <Text style={styles.editCoverText}>Edit Cover Art</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.titleArea}>
          <TextInput style={styles.titleInput} value={title} onChangeText={setTitle} placeholder="Song Title" placeholderTextColor="#888" />
          <Ionicons name="pencil" size={16} color="#888" style={{ marginLeft: 8 }} />
        </View>

        <View style={styles.captionArea}>
          <TextInput style={styles.captionInput} value={caption} onChangeText={setCaption} placeholder="Add a caption..." placeholderTextColor="#888" multiline maxLength={500} />
          <Text style={styles.charCount}>{caption.length}/500</Text>
        </View>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.listItem} onPress={() => setScreen('style')}>
          <Ionicons name="musical-note" size={24} color="#FFF" style={styles.listIcon} />
          <View style={styles.listItemContent}>
            <View style={styles.listItemTitleRow}>
              <Text style={styles.listItemTitle}>Edit Style Summary</Text>
              <Ionicons name="help-circle" size={16} color="#FFF" style={{ marginLeft: 4 }} />
            </View>
            <Text style={styles.listItemSubtitle} numberOfLines={1}>{styleTags}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.listItem} onPress={() => setScreen('lyrics')}>
          <Ionicons name="musical-notes" size={24} color="#FFF" style={styles.listIcon} />
          <View style={styles.listItemContent}>
            <Text style={styles.listItemTitle}>Edit Displayed Lyrics</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>

        <View style={styles.divider} />

        <View style={styles.listItem}>
          <Ionicons name="earth" size={24} color="#FFF" style={styles.listIcon} />
          <View style={styles.listItemContent}>
            <Text style={styles.listItemTitle}>Publish</Text>
            <Text style={styles.listItemSubtitle}>Shows up on Search, Feed, and Profile</Text>
          </View>
          <Switch value={isPublished} onValueChange={handlePublishToggle} trackColor={{ false: '#444', true: '#FF2A75' }} thumbColor="#FFF" />
        </View>

        {isPublished && (
          <>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.listItem} onPress={() => setScreen('moreOptions')}>
              <Ionicons name="settings-outline" size={24} color="#FFF" style={styles.listIcon} />
              <View style={styles.listItemContent}>
                <Text style={styles.listItemTitle}>More Options</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
          </>
        )}

        <View style={styles.divider} />
      </ScrollView>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        {screen === 'style' ? renderStyleScreen()
          : screen === 'lyrics' ? renderLyricsScreen()
          : screen === 'moreOptions' ? renderMoreOptionsScreen()
          : renderMainScreen()}
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  modalContent: { flex: 1, paddingTop: 50 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 20 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '600' },
  scrollArea: { flex: 1 },
  coverArea: { alignItems: 'center', marginTop: 10, marginBottom: 30 },
  coverImageContainer: { position: 'relative', width: 140, height: 140, borderRadius: 16, overflow: 'hidden' },
  coverImage: { width: '100%', height: '100%' },
  editCoverPill: { position: 'absolute', bottom: 10, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  editCoverText: { color: '#FFF', fontSize: 12, fontWeight: '500' },
  titleArea: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 10 },
  titleInput: { color: '#FFF', fontSize: 24, fontWeight: '700', flex: 1 },
  captionArea: { paddingHorizontal: 20, marginBottom: 10 },
  captionInput: { color: '#FFF', fontSize: 16, minHeight: 40 },
  charCount: { color: '#666', fontSize: 12, textAlign: 'right', marginTop: 8 },
  divider: { height: 0 },
  listItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  listIcon: { width: 32, marginRight: 12 },
  listItemContent: { flex: 1 },
  listItemTitleRow: { flexDirection: 'row', alignItems: 'center' },
  listItemTitle: { color: '#FFF', fontSize: 16, fontWeight: '500' },
  listItemSubtitle: { color: '#888', fontSize: 13, marginTop: 4 },
  styleInput: { color: '#FFF', fontSize: 16, lineHeight: 24, minHeight: 150, textAlignVertical: 'top' },
});
