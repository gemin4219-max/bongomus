// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, FlatList, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useThemeStore } from '../store/themeStore';

import { Image } from 'expo-image';

type CollaboratorModalProps = {
  visible: boolean;
  onClose: () => void;
  playlistId: string;
};

export default function CollaboratorModal({ visible, onClose, playlistId }: CollaboratorModalProps) {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (visible && playlistId) {
      fetchCollaborators();
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [visible, playlistId]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim().length > 2) {
        searchUsers();
      } else {
        setSearchResults([]);
      }
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const fetchCollaborators = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('playlist_collaborators')
      .select('*, profile:profiles(*)')
      .eq('playlist_id', playlistId);
    
    if (data) {
      setCollaborators(data);
    }
    setLoading(false);
  };

  const searchUsers = async () => {
    setSearching(true);
    const term = `%${searchQuery.trim()}%`;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .or(`username.ilike.${term},display_name.ilike.${term}`)
      .limit(5);
      
    if (data) {
      // Filter out people who are already collaborators
      const existingIds = collaborators.map(c => c.user_id);
      setSearchResults(data.filter(u => !existingIds.includes(u.id)));
    }
    setSearching(false);
  };

  const addCollaborator = async (userId: string) => {
    const { error } = await supabase.from('playlist_collaborators').insert({
      playlist_id: playlistId,
      user_id: userId,
      role: 'editor'
    });
    
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setSearchQuery('');
      setSearchResults([]);
      fetchCollaborators();
    }
  };

  const removeCollaborator = async (userId: string) => {
    Alert.alert("Remove Access", "Are you sure you want to remove this collaborator?", [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Remove", 
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase
            .from('playlist_collaborators')
            .delete()
            .eq('playlist_id', playlistId)
            .eq('user_id', userId);
            
          if (!error) {
            fetchCollaborators();
          }
        }
      }
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Manage Access</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>Invite friends or your partner to add songs to this playlist.</Text>

          <View style={styles.searchBox}>
            <Ionicons name="search" size={20} color={COLORS.textSecondary} />
            <TextInput
              style={styles.input}
              placeholder="Search by @username or name..."
              placeholderTextColor={COLORS.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
            />
            {searching && <ActivityIndicator size="small" color={COLORS.gold} />}
          </View>

          {searchResults.length > 0 && (
            <View style={styles.resultsContainer}>
              <Text style={styles.sectionTitle}>Search Results</Text>
              {searchResults.map(user => (
                <View key={user.id} style={styles.userRow}>
                  <View style={styles.avatar}>
                    {user.avatar_url ? (
                      <Image source={{ uri: user.avatar_url }} style={StyleSheet.absoluteFill} />
                    ) : (
                      <Ionicons name="person" size={16} color={COLORS.gold} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userName}>{user.display_name}</Text>
                    <Text style={styles.userHandle}>@{user.username}</Text>
                  </View>
                  <TouchableOpacity style={styles.addBtn} onPress={() => addCollaborator(user.id)}>
                    <Text style={styles.addBtnText}>Add</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Current Collaborators</Text>
          {loading ? (
            <ActivityIndicator color={COLORS.gold} style={{ marginTop: 20 }} />
          ) : collaborators.length === 0 ? (
            <Text style={styles.emptyText}>No collaborators added yet. This playlist is private to you.</Text>
          ) : (
            <FlatList
              data={collaborators}
              keyExtractor={item => item.user_id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <View style={styles.userRow}>
                  <View style={styles.avatar}>
                    {item.profile.avatar_url ? (
                      <Image source={{ uri: item.profile.avatar_url }} style={StyleSheet.absoluteFill} />
                    ) : (
                      <Ionicons name="person" size={16} color={COLORS.gold} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userName}>{item.profile.display_name}</Text>
                    <Text style={styles.userHandle}>@{item.profile.username}</Text>
                  </View>
                  <TouchableOpacity style={styles.removeBtn} onPress={() => removeCollaborator(item.user_id)}>
                    <Text style={styles.removeBtnText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  container: { backgroundColor: COLORS.black, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 20, minHeight: '70%', maxHeight: '90%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '800' },
  closeBtn: { padding: 4 },
  subtitle: { color: COLORS.textSecondary, fontSize: 14, marginBottom: 20 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: COLORS.divider, marginBottom: 20 },
  input: { flex: 1, color: COLORS.textPrimary, paddingVertical: 14, paddingHorizontal: 12, fontSize: 16 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700', textTransform: 'uppercase', marginBottom: 12, letterSpacing: 1 },
  resultsContainer: { backgroundColor: COLORS.cardAlt, padding: 16, borderRadius: 16, marginBottom: 10 },
  userRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.card, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginRight: 12 },
  userName: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '600' },
  userHandle: { color: COLORS.textSecondary, fontSize: 13 },
  addBtn: { backgroundColor: COLORS.gold, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  addBtnText: { color: COLORS.black, fontWeight: '700', fontSize: 13 },
  removeBtn: { backgroundColor: 'rgba(255,82,82,0.1)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  removeBtnText: { color: COLORS.error, fontWeight: '600', fontSize: 13 },
  emptyText: { color: COLORS.textTertiary, fontSize: 14, fontStyle: 'italic' },
});
