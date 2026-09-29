import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Image, Modal, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Dimensions, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAIStore } from '../store/aiStore';
import { generateCoverImage } from '../lib/sunoApi';

const { width } = Dimensions.get('window');

interface CoverArtModalProps {
  visible: boolean;
  onClose: () => void;
  songTask: any;
}

export const CoverArtModal: React.FC<CoverArtModalProps> = ({ visible, onClose, songTask }) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const { updateTrack } = useAIStore();

  // Reset state when song changes
  React.useEffect(() => {
    if (visible) {
      // Pre-fill a helpful prompt based on the song's title/genre
      const track = songTask?.tracks?.[0] || songTask;
      const autoPrompt = [
        track?.genre || track?.tags,
        track?.title,
        'album cover art, vibrant, professional music artwork',
      ].filter(Boolean).join(', ');
      setPrompt(autoPrompt);
      setGeneratedImages([]);
      setIsGenerating(false);
      setActiveIndex(0);
    }
  }, [visible, songTask]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setGeneratedImages([]);
    try {
      const images = await generateCoverImage(prompt.trim(), 2);
      if (!images || images.length === 0) throw new Error('No images returned.');
      setGeneratedImages(images);
      setActiveIndex(0);
    } catch (e: any) {
      Alert.alert(
        'Cover Art Failed',
        e.message || 'Could not generate cover art. Please try again.',
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (generatedImages.length > 0 && songTask) {
      const selectedImage = generatedImages[activeIndex];
      const trackId = songTask.tracks?.[0]?.id || songTask.id || songTask.taskId;
      
      if (!trackId) {
        onClose();
        return;
      }

      // Optimistic update
      updateTrack(songTask.taskId || songTask.id, trackId, { imageUrl: selectedImage });
      
      // Close modal instantly
      onClose();

      // Update Supabase
      const { error } = await supabase
        .from('tracks')
        .update({ cover_url: selectedImage }) 
        .eq('id', trackId);

      if (error) {
        console.error('Failed to update cover art in DB', error);
        // It might be 'cover_url' or 'image_url'. Let's update both just in case or depend on DB schema.
      }
    } else {
      onClose();
    }
  };

  const handleScroll = (event: any) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = event.nativeEvent.contentOffset.x / slideSize;
    setActiveIndex(Math.round(index));
  };

  const songTitle = songTask?.tracks?.[0]?.title || songTask?.title || 'Unknown';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <View style={styles.modalContent}>
          
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
            
            <View style={styles.headerTitles}>
              <Text style={styles.title}>Cover Art</Text>
              <Text style={styles.subtitle}>{songTitle}</Text>
            </View>

            <TouchableOpacity 
              style={[styles.saveBtn, generatedImages.length === 0 && styles.saveBtnDisabled]} 
              onPress={handleSave}
              disabled={generatedImages.length === 0}
            >
              <Text style={[styles.saveBtnText, generatedImages.length === 0 && styles.saveBtnTextDisabled]}>Save</Text>
            </TouchableOpacity>
          </View>

          {/* Main Content Area */}
          <View style={styles.mainArea}>
            {isGenerating ? (
              <View style={styles.generatingState}>
                <ActivityIndicator size="large" color="#FFB300" />
                <Text style={styles.generatingText}>Creating your vision...</Text>
              </View>
            ) : generatedImages.length > 0 ? (
              <View style={styles.resultsArea}>
                <ScrollView 
                  horizontal 
                  pagingEnabled 
                  showsHorizontalScrollIndicator={false}
                  onScroll={handleScroll}
                  scrollEventThrottle={16}
                  contentContainerStyle={{ paddingHorizontal: 20 }}
                >
                  {generatedImages.map((img, index) => (
                    <View key={index} style={[styles.imageWrapper, { width: width - 40, marginRight: index === generatedImages.length - 1 ? 0 : 20 }]}>
                      <Image source={{ uri: img }} style={styles.generatedImage} />
                      <View style={styles.dotsMenu}>
                        <Ionicons name="ellipsis-horizontal" size={20} color="#FFF" />
                      </View>
                      <View style={styles.editPill}>
                        <Ionicons name="pencil" size={14} color="#FFF" />
                        <Text style={styles.editPillText}>Edit</Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
                <View style={styles.pagination}>
                  {generatedImages.map((_, i) => (
                    <View key={i} style={[styles.dot, activeIndex === i && styles.dotActive]} />
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="sparkles" size={32} color="#888" style={{ marginBottom: 16 }} />
                <Text style={styles.emptyText}>Describe the cover art you'd like to create</Text>
              </View>
            )}
          </View>

          {/* Input Area */}
          <View style={styles.inputContainer}>
            <TouchableOpacity style={styles.plusBtn}>
              <Ionicons name="add" size={24} color="#FFF" />
            </TouchableOpacity>
            
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.textInput}
                placeholder="Make me an image of..."
                placeholderTextColor="#888"
                value={prompt}
                onChangeText={setPrompt}
                multiline
                maxLength={200}
              />
              {prompt.length > 0 && (
                <TouchableOpacity style={styles.clearBtn} onPress={() => setPrompt('')}>
                  <Ionicons name="close-circle" size={18} color="#888" />
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                style={[styles.sendBtn, !prompt.trim() && { opacity: 0.5 }]} 
                onPress={handleGenerate}
                disabled={!prompt.trim() || isGenerating}
              >
                <Ionicons name="sparkles" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>

        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  modalContent: {
    flex: 1,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitles: {
    alignItems: 'center',
  },
  title: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  subtitle: {
    color: '#888',
    fontSize: 14,
    marginTop: 2,
  },
  saveBtn: {
    backgroundColor: '#FFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  saveBtnDisabled: {
    backgroundColor: '#2A2A2A',
  },
  saveBtnText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 16,
  },
  saveBtnTextDisabled: {
    color: '#666',
  },
  mainArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#888',
    fontSize: 16,
  },
  generatingState: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  generatingText: {
    color: '#FFF',
    marginTop: 16,
    fontSize: 16,
  },
  resultsArea: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageWrapper: {
    aspectRatio: 1,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  generatedImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  dotsMenu: {
    position: 'absolute',
    top: 15,
    right: 15,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editPill: {
    position: 'absolute',
    bottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  editPillText: {
    color: '#FFF',
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
  },
  pagination: {
    flexDirection: 'row',
    marginTop: 20,
    marginBottom: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#333',
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: '#FFF',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 30,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  plusBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    borderRadius: 24,
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  textInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 16,
    maxHeight: 100,
    marginRight: 8,
  },
  clearBtn: {
    marginRight: 10,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFB300',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
