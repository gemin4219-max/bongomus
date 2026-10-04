// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../lib/supabase';
import { useThemeStore } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import { useRouter } from 'expo-router';

export default function AdminEventsScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  const session = useAuthStore(s => s.session);

  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [dateStr, setDateStr] = useState(''); // YYYY-MM-DD
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    checkAdminAndLoad();
  }, []);

  const checkAdminAndLoad = async () => {
    if (!session) {
      router.replace('/');
      return;
    }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
    if (profile?.role !== 'admin') {
      Alert.alert('Access Denied', 'You must be an admin to view this page.');
      router.replace('/');
      return;
    }
    loadEvents();
  };

  const loadEvents = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('events').select('*').order('event_date', { ascending: true });
    if (data) setEvents(data);
    if (error) Alert.alert('Error loading events', error.message);
    setLoading(false);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ 
      mediaTypes: ImagePicker.MediaTypeOptions.Images, 
      quality: 0.8, 
      allowsEditing: true, 
      aspect: [16, 9] 
    });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const handleCreateEvent = async () => {
    if (!title || !location || !dateStr) {
      Alert.alert('Missing Fields', 'Please fill in the title, location, and date (YYYY-MM-DD).');
      return;
    }
    
    // Validate date format (simple check)
    const dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) {
      Alert.alert('Invalid Date', 'Please enter a valid date in YYYY-MM-DD format.');
      return;
    }

    setSubmitting(true);
    let finalImageUrl = 'https://images.unsplash.com/photo-1540039155733-d7696d8dd9b4?w=500&q=80';

    if (imageUri) {
      try {
        const base64 = await FileSystem.readAsStringAsync(imageUri, { encoding: 'base64' });
        const fileName = `${session?.user.id}/event_${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage.from('covers').upload(
          fileName,
          decode(base64),
          { contentType: 'image/jpeg', upsert: false }
        );
        if (!uploadError) {
          const { data } = supabase.storage.from('covers').getPublicUrl(fileName);
          finalImageUrl = data.publicUrl;
        }
      } catch (err) {
        console.error('Image upload failed', err);
      }
    }

    const { error } = await supabase.from('events').insert({
      title,
      location,
      event_date: dateObj.toISOString(),
      image_url: finalImageUrl,
      created_by: session?.user.id
    });

    setSubmitting(false);

    if (error) {
      Alert.alert('Error creating event', error.message);
    } else {
      Alert.alert('Success', 'Event created successfully!');
      setTitle('');
      setLocation('');
      setDateStr('');
      setImageUri(null);
      loadEvents(); // Reload the list
    }
  };

  const handleDeleteEvent = async (id: string) => {
    Alert.alert('Delete Event', 'Are you sure you want to delete this event?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Delete', 
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('events').delete().eq('id', id);
          if (error) {
            Alert.alert('Error', error.message);
          } else {
            loadEvents();
          }
        }
      }
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={COLORS.gold} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.headerTitle}>Manage Events</Text>
      
      {/* Create Event Form */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Add New Event</Text>
        
        <Text style={styles.label}>Event Title</Text>
        <TextInput 
          style={styles.input} 
          placeholder="e.g. Wasafi Festival" 
          placeholderTextColor={COLORS.textTertiary}
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.label}>Location</Text>
        <TextInput 
          style={styles.input} 
          placeholder="e.g. Dar es Salaam" 
          placeholderTextColor={COLORS.textTertiary}
          value={location}
          onChangeText={setLocation}
        />

        <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
        <TextInput 
          style={styles.input} 
          placeholder="e.g. 2026-12-12" 
          placeholderTextColor={COLORS.textTertiary}
          value={dateStr}
          onChangeText={setDateStr}
        />

        <Text style={styles.label}>Event Image</Text>
        <TouchableOpacity style={styles.imagePickerBtn} onPress={pickImage}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.pickedImage} />
          ) : (
            <>
              <Ionicons name="image-outline" size={32} color={COLORS.textSecondary} />
              <Text style={{ color: COLORS.textSecondary, marginTop: 8, fontSize: 13 }}>Tap to pick an image</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.submitBtn} 
          onPress={handleCreateEvent}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={COLORS.black} />
          ) : (
            <Text style={styles.submitBtnText}>Create Event</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Existing Events List */}
      <Text style={[styles.headerTitle, { marginTop: 30, fontSize: 20 }]}>Current Events</Text>
      {events.length === 0 ? (
        <Text style={{ color: COLORS.textSecondary, marginTop: 10 }}>No upcoming events.</Text>
      ) : (
        events.map(event => (
          <View key={event.id} style={styles.eventItem}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eventItemTitle}>{event.title}</Text>
              <Text style={styles.eventItemSub}>{event.location} • {new Date(event.event_date).toLocaleDateString()}</Text>
            </View>
            <TouchableOpacity onPress={() => handleDeleteEvent(event.id)} style={{ padding: 8 }}>
              <Ionicons name="trash" size={24} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  headerTitle: { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 20 },
  card: { backgroundColor: COLORS.card, padding: 20, borderRadius: 16 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 16 },
  label: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 6, fontWeight: '600' },
  input: { backgroundColor: COLORS.background, color: COLORS.textPrimary, padding: 14, borderRadius: 12, marginBottom: 16, fontSize: 15 },
  submitBtn: { backgroundColor: COLORS.gold, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  submitBtnText: { color: COLORS.black, fontWeight: '800', fontSize: 16 },
  
  eventItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, padding: 16, borderRadius: 12, marginBottom: 12 },
  eventItemTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  eventItemSub: { color: COLORS.textSecondary, fontSize: 13 },
  imagePickerBtn: { backgroundColor: 'rgba(255,255,255,0.05)', height: 160, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderStyle: 'dashed' },
  pickedImage: { width: '100%', height: '100%', borderRadius: 12 },
});
