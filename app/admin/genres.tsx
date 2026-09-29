import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useThemeStore } from '../../store/themeStore';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

export default function AdminGenresScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();

  const [genres, setGenres] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [color, setColor] = useState('#E91E63');
  const [icon, setIcon] = useState('musical-note');
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    fetchGenres();
  }, []);

  const fetchGenres = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('genres').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error(error);
    } else {
      setGenres(data || []);
    }
    setLoading(false);
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setIsUploadingImage(true);
        const fileName = `genres/${Date.now()}.jpg`;
        const { error } = await supabase.storage.from('covers').upload(
          fileName,
          decode(result.assets[0].base64),
          { contentType: 'image/jpeg' }
        );

        if (error) throw error;
        
        const { data: { publicUrl } } = supabase.storage.from('covers').getPublicUrl(fileName);
        setImageUrl(publicUrl);
        setIsUploadingImage(false);
      }
    } catch (error: any) {
      setIsUploadingImage(false);
      Alert.alert('Upload Error', error.message);
    }
  };

  const handleAddGenre = async () => {
    if (!name.trim()) return Alert.alert('Error', 'Name is required');
    
    // Pick a random nice color for the genre
    const niceColors = ['#FF2A75', '#4A90E2', '#50E3C2', '#F5A623', '#BD10E0', '#7ED321'];
    const randomColor = niceColors[Math.floor(Math.random() * niceColors.length)];

    setIsSubmitting(true);
    const { error } = await supabase.from('genres').insert([{
      name: name.trim(),
      color: randomColor,
      icon: 'musical-note',
      image_url: imageUrl.trim() || null
    }]);

    setIsSubmitting(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Success', 'Genre added successfully!');
      setName('');
      setImageUrl('');
      fetchGenres();
    }
  };

  const handleDeleteGenre = async (id: string, genreName: string) => {
    Alert.alert('Delete Genre', `Are you sure you want to delete ${genreName}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('genres').delete().eq('id', id);
        if (error) Alert.alert('Error', error.message);
        else fetchGenres();
      }}
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Genres</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={genres}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={() => (
          <View style={styles.formContainer}>
            <Text style={styles.sectionTitle}>Add New Genre</Text>
            
            <Text style={styles.label}>Genre Name</Text>
            <TextInput style={styles.input} placeholder="e.g. Bongo Flava" placeholderTextColor={COLORS.textTertiary} value={name} onChangeText={setName} />
            
            <Text style={styles.label}>Cover Image</Text>
            <TouchableOpacity 
              style={[styles.input, { alignItems: 'center', justifyContent: 'center', height: 120, borderStyle: 'dashed' }]} 
              onPress={pickImage}
              disabled={isUploadingImage}
            >
              {isUploadingImage ? (
                <ActivityIndicator color={COLORS.gold} />
              ) : imageUrl ? (
                <Image source={{ uri: imageUrl }} style={{ width: '100%', height: '100%', borderRadius: 8, resizeMode: 'cover' }} />
              ) : (
                <View style={{ alignItems: 'center' }}>
                  <Ionicons name="image-outline" size={32} color={COLORS.textTertiary} />
                  <Text style={{ color: COLORS.textTertiary, marginTop: 8 }}>Tap to Upload Image</Text>
                </View>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.submitBtn} onPress={handleAddGenre} disabled={isSubmitting || isUploadingImage}>
              {isSubmitting ? <ActivityIndicator color={COLORS.black} /> : <Text style={styles.submitBtnText}>Add Genre</Text>}
            </TouchableOpacity>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={styles.genreCard}>
            <View style={[styles.colorIndicator, { backgroundColor: item.color || COLORS.textTertiary }]} />
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={styles.genreName}>{item.name}</Text>
              <Text style={styles.genreMeta}>Icon: {item.icon}</Text>
            </View>
            <TouchableOpacity style={{ padding: 8 }} onPress={() => handleDeleteGenre(item.id, item.name)}>
              <Ionicons name="trash" size={20} color={COLORS.error} />
            </TouchableOpacity>
          </View>
        )}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        ListEmptyComponent={loading ? <ActivityIndicator color={COLORS.gold} /> : <Text style={styles.emptyText}>No genres found.</Text>}
      />
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  headerTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' },
  formContainer: { backgroundColor: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 16, marginBottom: 24 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 16 },
  label: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600', marginBottom: 6 },
  input: { backgroundColor: 'rgba(0,0,0,0.3)', color: COLORS.textPrimary, padding: 12, borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  submitBtn: { backgroundColor: COLORS.gold, padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  submitBtnText: { color: COLORS.black, fontSize: 16, fontWeight: '800' },
  genreCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 12, marginBottom: 12 },
  colorIndicator: { width: 40, height: 40, borderRadius: 20 },
  genreName: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
  genreMeta: { color: COLORS.textTertiary, fontSize: 12, marginTop: 4 },
  emptyText: { color: COLORS.textTertiary, textAlign: 'center', marginTop: 40 }
});
