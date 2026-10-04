// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { GlassView as BlurView } from '@/components/GlassView';
import { supabase } from '../lib/supabase';
import { useThemeStore } from '../store/themeStore';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

interface EditPlaylistModalProps {
  visible: boolean;
  onClose: () => void;
  playlistId: string;
  initialTitle: string;
  initialDescription?: string;
  initialCoverUrl?: string;
  onUpdated: () => void;
}

export default function EditPlaylistModal({ visible, onClose, playlistId, initialTitle, initialDescription, initialCoverUrl, onUpdated }: EditPlaylistModalProps) {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);

  const [title, setTitle] = useState(initialTitle || '');
  const [description, setDescription] = useState(initialDescription || '');
  const [coverUrl, setCoverUrl] = useState(initialCoverUrl || '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTitle(initialTitle || '');
    setDescription(initialDescription || '');
    setCoverUrl(initialCoverUrl || '');
  }, [visible, initialTitle, initialDescription, initialCoverUrl]);

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setLoading(true);
      try {
        const filePath = `playlists/${playlistId}_${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage.from('images').upload(filePath, decode(result.assets[0].base64), { contentType: 'image/jpeg' });
        
        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage.from('images').getPublicUrl(filePath);
        setCoverUrl(publicUrlData.publicUrl);
        Alert.alert("Success", "Album artwork uploaded successfully!");
      } catch (e: any) {
        Alert.alert("Upload Error", e.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }
    setLoading(true);
    const { error } = await supabase.from('playlists').update({
      title: title.trim(),
      description: description.trim(),
      cover_url: coverUrl
    }).eq('id', playlistId);
    
    setLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      onUpdated();
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <BlurView intensity={70} tint="dark" style={styles.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
          <View style={styles.modalContent}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Edit Album</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
              {/* Cover Art Picker */}
              <View style={{ alignItems: 'center', marginBottom: 24 }}>
                <TouchableOpacity onPress={handlePickImage} disabled={loading} style={styles.coverWrap}>
                  {coverUrl ? (
                    <Image source={{ uri: coverUrl }} style={styles.coverImage} />
                  ) : (
                    <View style={styles.coverPlaceholder}>
                      <Ionicons name="musical-notes" size={48} color={COLORS.textTertiary} />
                    </View>
                  )}
                  <View style={styles.cameraIconWrap}>
                    <Ionicons name="camera" size={18} color={COLORS.black} />
                  </View>
                </TouchableOpacity>
                <Text style={{ color: COLORS.textSecondary, fontSize: 13, marginTop: 12 }}>Tap to change artwork</Text>
              </View>

              <Text style={styles.label}>Title</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Album Title"
                placeholderTextColor={COLORS.textTertiary}
              />

              <Text style={styles.label}>Description (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="What's this album about?"
                placeholderTextColor={COLORS.textTertiary}
                multiline
                textAlignVertical="top"
              />

              <TouchableOpacity style={[styles.saveBtn, loading && { opacity: 0.7 }]} onPress={handleSave} disabled={loading}>
                {loading ? <ActivityIndicator color={COLORS.black} /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </BlurView>
    </Modal>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: '70%',
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
  },
  coverWrap: {
    width: 160,
    height: 160,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverImage: {
    width: 160,
    height: 160,
    borderRadius: 12,
  },
  coverPlaceholder: {
    width: 160,
    height: 160,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraIconWrap: {
    position: 'absolute',
    bottom: -10,
    right: -10,
    backgroundColor: COLORS.gold,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.card,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.cardAlt,
    color: COLORS.textPrimary,
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  textArea: {
    height: 100,
    paddingTop: 16,
  },
  saveBtn: {
    backgroundColor: COLORS.gold,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  saveBtnText: {
    color: COLORS.black,
    fontSize: 16,
    fontWeight: '700',
  }
});
