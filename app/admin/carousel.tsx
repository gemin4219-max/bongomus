// @ts-nocheck
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useThemeStore } from '../../store/themeStore';

export default function AdminCarouselScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();

  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadCards();
    }, [])
  );

  const loadCards = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('system_settings').select('value').eq('key', 'carousel_cards').single();
      if (data && data.value) {
        setCards(JSON.parse(data.value));
      } else {
        // Default cards if none exist
        setCards([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Upsert the array to system_settings
      const { error } = await supabase.from('system_settings').upsert({ 
        key: 'carousel_cards', 
        value: JSON.stringify(cards),
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });
      
      if (error) throw error;
      Alert.alert('Success', 'Carousel cards updated successfully!');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const addCard = () => {
    setCards([...cards, {
      id: Date.now().toString(),
      type: 'custom',
      title: 'New Card',
      tag: 'New',
      tagColor: '#ffcc00',
      icon: 'star',
      iconColor: '#ffcc00',
      imageUrl: '',
      gradientColors: ['#000000', '#222222']
    }]);
  };

  const removeCard = (index: number) => {
    const newCards = [...cards];
    newCards.splice(index, 1);
    setCards(newCards);
  };

  const updateCard = (index: number, field: string, value: any) => {
    const newCards = [...cards];
    if (field === 'gradientColor0') {
      newCards[index].gradientColors[0] = value;
    } else if (field === 'gradientColor1') {
      newCards[index].gradientColors[1] = value;
    } else {
      newCards[index][field] = value;
    }
    setCards(newCards);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Carousel</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveBtn}>
          <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <Text style={styles.infoText}>These cards appear in the "Get Inspired" carousel on the home screen.</Text>
        
        {cards.map((card, index) => (
          <View key={card.id} style={styles.cardEditor}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardIndex}>Card {index + 1}</Text>
              <TouchableOpacity onPress={() => removeCard(index)}>
                <Ionicons name="trash" size={20} color={COLORS.error} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Title (e.g. Write a Birthday\nAnthem)</Text>
            <TextInput style={styles.input} value={card.title} onChangeText={(v) => updateCard(index, 'title', v)} multiline />
            
            <Text style={styles.label}>Action Type (e.g. birthday, roast)</Text>
            <TextInput style={styles.input} value={card.type} onChangeText={(v) => updateCard(index, 'type', v)} />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Tag (e.g. Popular)</Text>
                <TextInput style={styles.input} value={card.tag} onChangeText={(v) => updateCard(index, 'tag', v)} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Tag Color (Hex)</Text>
                <TextInput style={styles.input} value={card.tagColor} onChangeText={(v) => updateCard(index, 'tagColor', v)} />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Ionicons Icon Name</Text>
                <TextInput style={styles.input} value={card.icon} onChangeText={(v) => updateCard(index, 'icon', v)} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Icon Color (Hex)</Text>
                <TextInput style={styles.input} value={card.iconColor} onChangeText={(v) => updateCard(index, 'iconColor', v)} />
              </View>
            </View>

            <Text style={styles.label}>Background Image URL (Optional)</Text>
            <TextInput style={styles.input} value={card.imageUrl} onChangeText={(v) => updateCard(index, 'imageUrl', v)} placeholder="https://..." placeholderTextColor={COLORS.textTertiary} />

            <Text style={styles.label}>Gradient Colors (if no image, or for overlay)</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TextInput style={[styles.input, { flex: 1 }]} value={card.gradientColors?.[0] || ''} onChangeText={(v) => updateCard(index, 'gradientColor0', v)} />
              <TextInput style={[styles.input, { flex: 1 }]} value={card.gradientColors?.[1] || ''} onChangeText={(v) => updateCard(index, 'gradientColor1', v)} />
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.addBtn} onPress={addCard}>
          <Ionicons name="add" size={20} color={COLORS.black} />
          <Text style={styles.addBtnText}>Add New Card</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black, paddingTop: 60 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backBtn: { padding: 8, marginLeft: -8 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' },
  saveBtn: { backgroundColor: COLORS.gold, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  saveBtnText: { color: COLORS.black, fontWeight: '700' },
  infoText: { color: COLORS.textSecondary, marginBottom: 20 },
  cardEditor: { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardIndex: { color: COLORS.textPrimary, fontWeight: '700', fontSize: 16 },
  label: { color: COLORS.textSecondary, fontSize: 12, marginBottom: 4, marginTop: 8 },
  input: { backgroundColor: COLORS.cardAlt, color: COLORS.textPrimary, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, fontSize: 14 },
  addBtn: { backgroundColor: COLORS.gold, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, gap: 8, marginTop: 8 },
  addBtnText: { color: COLORS.black, fontWeight: '800', fontSize: 16 }
});
