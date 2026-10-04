// @ts-nocheck
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, Animated } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useThemeStore } from '../store/themeStore';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassView as BlurView } from '@/components/GlassView';
import { Track, Profile, GENRES } from '../constants';
import { usePlayerStore } from '../store/playerStore';
import TrackItem from '../components/TrackItem';
import { debounce } from '../utils/helpers';
import { Swipeable } from 'react-native-gesture-handler';

const { width } = Dimensions.get('window');
const CATEGORY_WIDTH = (width - 48) / 2;

export default function SearchScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  const { q } = useLocalSearchParams<{ q?: string }>();
  const playTrack = usePlayerStore(s => s.playTrack);
  const addTrackToQueue = usePlayerStore(s => s.addTrackToQueue);
  const currentTrack = usePlayerStore(s => s.currentTrack);

  const [query, setQuery] = useState(q || '');
  const [artists, setArtists] = useState<Profile[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [dynamicType, setDynamicType] = useState<'artists' | 'trending_songs' | 'top_10'>('artists');
  const [dynamicItems, setDynamicItems] = useState<any[]>([]);
  const [suggestedAccounts, setSuggestedAccounts] = useState<Profile[]>([]);
  const [dbGenres, setDbGenres] = useState<any[]>([]);

  useEffect(() => {
    loadRecent();
    const types: ('artists' | 'trending_songs' | 'top_10')[] = ['artists', 'trending_songs', 'top_10'];
    const selectedType = types[Math.floor(Math.random() * types.length)];
    setDynamicType(selectedType);
    fetchDynamicContent(selectedType);
    if (q) performSearch(q);
  }, []);

  const fetchDynamicContent = async (type: 'artists' | 'trending_songs' | 'top_10') => {
    try {
      // Fetch genres
      const { data: genresData, error: genresError } = await supabase.from('genres').select('*').order('created_at', { ascending: true });
      if (genresData && genresData.length > 0) {
        setDbGenres(genresData);
      } else {
        setDbGenres(GENRES);
      }

      if (type === 'artists') {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('role', 'artist')
          .order('follower_count', { ascending: false })
          .limit(10);
        if (data) setDynamicItems(data);
      } else if (type === 'trending_songs') {
        const { data } = await supabase
          .from('tracks')
          .select('*, profile:profiles!tracks_user_id_fkey(*)')
          .eq('is_public', true)
          .order('created_at', { ascending: false })
          .limit(10);
        if (data) setDynamicItems(data);
      } else if (type === 'top_10') {
        const { data } = await supabase
          .from('tracks')
          .select('*, profile:profiles!tracks_user_id_fkey(*)')
          .eq('is_public', true)
          .order('play_count', { ascending: false })
          .limit(10);
        if (data) setDynamicItems(data);
      }
    } catch (e) {}
  };

  const loadRecent = async () => {
    const saved = await AsyncStorage.getItem('@search_history');
    if (saved) setRecentSearches(JSON.parse(saved));
  };

  const saveRecent = async (term: string) => {
    if (!term.trim()) return;
    const updated = [term, ...recentSearches.filter(t => t !== term)].slice(0, 8);
    setRecentSearches(updated);
    await AsyncStorage.setItem('@search_history', JSON.stringify(updated));
  };

  const performSearch = async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setArtists([]);
      setTracks([]);
      return;
    }
    setLoading(true);
    try {
      const [artistsRes, tracksRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .ilike('display_name', `%${searchTerm}%`)
          .eq('role', 'artist')
          .limit(5),
        supabase
          .from('tracks')
          .select('*, profile:profiles!tracks_user_id_fkey(*)')
          .ilike('title', `%${searchTerm}%`)
          .eq('is_public', true)
          .limit(15)
      ]);
      const foundArtists = artistsRes.data as Profile[] || [];
      const foundTracks = tracksRes.data as Track[] || [];
      
      setArtists(foundArtists);
      setTracks(foundTracks);

      if (foundArtists.length === 0 && foundTracks.length === 0) {
        const { data: suggestions } = await supabase
          .from('profiles')
          .select('*')
          .eq('role', 'artist')
          .order('follower_count', { ascending: false })
          .limit(5);
        setSuggestedAccounts(suggestions as Profile[] || []);
      } else {
        setSuggestedAccounts([]);
      }
    } catch (e) {
      console.log('Search error:', e);
    } finally {
      setLoading(false);
    }
  };

  const debouncedSearch = useCallback(debounce(performSearch, 500), []);

  const onChangeQuery = (text: string) => {
    setQuery(text);
    debouncedSearch(text);
  };

  const renderRightActions = (track: Track) => {
    return (
      <View style={{ justifyContent: 'center', alignItems: 'flex-end', paddingRight: 16, height: 60 }}>
        <View style={{ backgroundColor: COLORS.gold, padding: 8, borderRadius: 20 }}>
          <Ionicons name="add" size={20} color={COLORS.black} />
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>

      <View style={{ paddingTop: 0, paddingBottom: 20 }}>
        <Text style={styles.title}>Search</Text>

        {/* Luxury Search Bar */}
        <BlurView intensity={30} tint="dark" style={[styles.searchBar, { marginTop: 0 }]}>
          <Ionicons name="search" size={22} color={COLORS.textSecondary} />
          <TextInput
            style={styles.input}
            placeholder="Artists, songs, or genres"
            placeholderTextColor={COLORS.textTertiary}
            value={query}
            onChangeText={onChangeQuery}
            onSubmitEditing={() => saveRecent(query)}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => onChangeQuery('')} style={{ padding: 4 }}>
              <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </BlurView>
      </View>

      {loading && <ActivityIndicator color={COLORS.gold} style={{ marginTop: 24 }} />}

      <FlatList 
        showsVerticalScrollIndicator={false}
        data={[]}
        renderItem={null}
        ListHeaderComponent={
          <>
            {/* Custom Discover State */}
            {query.length === 0 && (
              <View style={{ flex: 1, paddingBottom: 40 }}>
                {/* Dynamic Trending Section */}
                <Text style={[styles.sectionLabel, { paddingHorizontal: 16 }]}>
                  {dynamicType === 'artists' ? 'Trending Artists' : dynamicType === 'trending_songs' ? 'Trending Songs' : 'Top 10 Songs'}
                </Text>
                {dynamicItems.length > 0 ? (
                  <FlatList
                    data={dynamicItems}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 16, gap: 20, marginTop: 16, marginBottom: 32 }}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => {
                      if (dynamicType === 'artists') {
                        return (
                          <TouchableOpacity 
                            style={{ alignItems: 'center', width: 80 }}
                            onPress={() => router.push({ pathname: '/artist/[id]', params: { id: item.id } })}
                          >
                            <View style={{ width: 80, height: 80, borderRadius: 40, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)', marginBottom: 12, justifyContent: 'center', alignItems: 'center' }}>
                              {item.avatar_url ? (
                                <Image source={{ uri: item.avatar_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                              ) : (
                                <Ionicons name="person" size={32} color={COLORS.textSecondary} />
                              )}
                            </View>
                            <Text style={{ color: COLORS.textPrimary, fontSize: 13, fontWeight: '600', textAlign: 'center' }} numberOfLines={1}>
                              {item.display_name}
                            </Text>
                          </TouchableOpacity>
                        );
                      } else {
                        return (
                          <TouchableOpacity 
                            style={{ alignItems: 'flex-start', width: 120 }}
                            onPress={() => playTrack(item, dynamicItems)}
                          >
                            <View style={{ width: 120, height: 120, borderRadius: 12, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)', marginBottom: 12, justifyContent: 'center', alignItems: 'center' }}>
                              {item.cover_url || item.profile?.avatar_url ? (
                                <Image source={{ uri: item.cover_url || item.profile?.avatar_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                              ) : (
                                <Ionicons name="musical-notes" size={32} color={COLORS.textSecondary} />
                              )}
                            </View>
                            <Text style={{ color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
                              {item.title}
                            </Text>
                            <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                              {item.artist_name || item.profile?.display_name}
                            </Text>
                          </TouchableOpacity>
                        );
                      }
                    }}
                  />
                ) : (
                  <ActivityIndicator color={COLORS.gold} style={{ marginVertical: 32 }} />
                )}

                {/* Browse Genres Grid */}
                <Text style={[styles.sectionLabel, { paddingHorizontal: 16 }]}>Browse All</Text>
                <View style={{ flexDirection: 'column', gap: 16, paddingHorizontal: 16, marginTop: 16 }}>
                  {dbGenres.map((cat, idx) => (
                    <TouchableOpacity 
                      key={`genre-${cat.name || cat.id}-${idx}`} 
                      style={{
                        width: '100%',
                        height: 110,
                        borderRadius: 16,
                        overflow: 'hidden',
                        backgroundColor: 'rgba(0,0,0,0.3)',
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.1)',
                      }}
                      onPress={() => onChangeQuery(cat.name || cat.id)}
                    >
                      <LinearGradient
                        colors={[cat.color || '#E91E63', 'rgba(0,0,0,0.8)']}
                        style={{ flex: 1, paddingHorizontal: 24, justifyContent: 'center', position: 'relative' }}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                      >
                        <Ionicons name={(cat.icon as any) || 'musical-note'} size={80} color="rgba(255,255,255,0.15)" style={{ position: 'absolute', right: 0, top: 15, transform: [{ rotate: '10deg' }] }} />
                        <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: 0.5 }}>{(cat.name || cat.title || '').toUpperCase()}</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Active Search Results */}
            {query.length > 0 && (
              <>
                {artists.length > 0 && (
                  <View style={{ marginBottom: 20 }}>
                    <Text style={[styles.sectionLabel, { paddingHorizontal: 16, marginBottom: 12 }]}>Top result</Text>
                    <View style={{ paddingHorizontal: 16 }}>
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}
                        onPress={() => router.push({ pathname: '/artist/[id]', params: { id: artists[0].id } })}
                      >
                        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginRight: 16 }}>
                          {artists[0].avatar_url
                            ? <Image source={{ uri: artists[0].avatar_url }} style={{ width: '100%', height: '100%' }} transition={200} cachePolicy="memory-disk" />
                            : <Ionicons name="person" size={40} color={COLORS.textSecondary} />
                          }
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: COLORS.textPrimary, fontSize: 24, fontWeight: '900', letterSpacing: -0.5 }} numberOfLines={1}>
                            {artists[0].display_name}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                            <Text style={{ color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' }}>Artist</Text>
                            {artists[0].is_verified && <Ionicons name="checkmark-circle" size={16} color={COLORS.gold} />}
                          </View>
                        </View>
                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' }}>
                          <Ionicons name="chevron-forward" size={20} color={COLORS.textPrimary} />
                        </View>
                      </TouchableOpacity>
                    </View>

                    {artists.length > 1 && (
                      <>
                        <Text style={[styles.sectionLabel, { paddingHorizontal: 16, marginTop: 24 }]}>More artists</Text>
                        <FlatList 
                          data={artists.slice(1)}
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={{ paddingHorizontal: 16, gap: 16, marginTop: 12 }}
                          keyExtractor={(item) => item.id}
                          renderItem={({ item: artist }) => (
                            <TouchableOpacity
                              style={styles.artistCard}
                              onPress={() => router.push({ pathname: '/artist/[id]', params: { id: artist.id } })}
                            >
                              <View style={styles.artistAvatarLg}>
                                {artist.avatar_url
                                  ? <Image source={{ uri: artist.avatar_url }} style={styles.artistAvatarImgLg} transition={200} cachePolicy="memory-disk" />
                                  : <Ionicons name="person" size={40} color={COLORS.textSecondary} />
                                }
                              </View>
                              <Text style={styles.artistNameCenter} numberOfLines={1}>{artist.display_name}</Text>
                              {artist.is_verified && <View style={styles.badge}><Ionicons name="checkmark-circle" size={14} color={COLORS.gold} /></View>}
                            </TouchableOpacity>
                          )}
                        />
                      </>
                    )}
                  </View>
                )}

                {tracks.length > 0 && (
                  <>
                    <Text style={[styles.sectionLabel, { paddingHorizontal: 16, marginBottom: 8 }]}>Songs</Text>
                    {tracks.map(track => (
                      <Swipeable 
                        key={track.id} 
                        renderRightActions={() => renderRightActions(track)}
                        onSwipeableOpen={(direction) => {
                          if (direction === 'right') {
                            addTrackToQueue(track);
                          }
                        }}
                      >
                        <TrackItem
                          track={track}
                          isPlaying={currentTrack?.id === track.id}
                          onPress={() => playTrack(track, tracks)}
                          onArtistPress={() => router.push({ pathname: '/artist/[id]', params: { id: track.user_id } })}
                        />
                      </Swipeable>
                    ))}
                  </>
                )}

                {!loading && tracks.length === 0 && artists.length === 0 && (
                  <View style={{ marginTop: 40, paddingHorizontal: 16 }}>
                    <View style={{ alignItems: 'center', marginBottom: 32 }}>
                      <Ionicons name="search" size={48} color={COLORS.textSecondary} style={{ marginBottom: 12 }} />
                      <Text style={styles.emptyTitle}>No results found for "{query}"</Text>
                      <Text style={styles.emptyText}>We couldn't find exactly what you were looking for.</Text>
                    </View>

                    {suggestedAccounts.length > 0 && (
                      <>
                        <Text style={[styles.sectionLabel, { marginBottom: 16 }]}>Suggested Accounts</Text>
                        {suggestedAccounts.map((account) => {
                          // Mocking Monthly Listeners calculation based on follower count for UI purposes
                          const monthlyListeners = (account.follower_count * 3.4).toFixed(0); 
                          
                          return (
                            <TouchableOpacity 
                              key={account.id}
                              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
                              onPress={() => router.push({ pathname: '/artist/[id]', params: { id: account.id } })}
                            >
                              <View style={{ width: 60, height: 60, borderRadius: 30, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.1)', marginRight: 16 }}>
                                {account.avatar_url ? (
                                  <Image source={{ uri: account.avatar_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                                ) : (
                                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                    <Ionicons name="person" size={24} color={COLORS.textSecondary} />
                                  </View>
                                )}
                              </View>
                              <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                  <Text style={{ color: COLORS.textPrimary, fontSize: 16, fontWeight: '800' }}>{account.display_name}</Text>
                                  {account.is_verified && <Ionicons name="checkmark-circle" size={16} color={COLORS.gold} />}
                                </View>
                                <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 4 }}>
                                  {account.follower_count || 0} Followers • {account.track_count || 0} Songs
                                </Text>
                                <Text style={{ color: COLORS.textTertiary, fontSize: 12, marginTop: 2 }}>
                                  {monthlyListeners} Monthly Listeners
                                </Text>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </>
                    )}
                  </View>
                )}
              </>
            )}
          </>
        }
        contentContainerStyle={{ paddingBottom: 160 }}
      />
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black, paddingTop: 60 },
  title: { color: '#fff', fontSize: 28, fontWeight: '800', marginHorizontal: 16, marginBottom: 16, marginTop: 20 },
  searchBar: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderRadius: 12, 
    marginHorizontal: 16, 
    paddingHorizontal: 16, 
    paddingVertical: 14, 
    gap: 12, 
    marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden'
  },
  input: { flex: 1, color: COLORS.textPrimary, fontSize: 16, fontWeight: '600' },
  sectionLabel: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 12 },
  categoryCardWrapper: {
    width: CATEGORY_WIDTH,
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
  },
  categoryCard: {
    flex: 1,
    padding: 12,
    position: 'relative',
    justifyContent: 'flex-end', // Align text to bottom for a cleaner look
  },
  categoryTitle: { color: '#fff', fontSize: 18, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  recentPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20 },
  artistCard: { alignItems: 'center', width: 100, position: 'relative' },
  artistAvatarLg: { width: 90, height: 90, borderRadius: 45, backgroundColor: COLORS.card, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginBottom: 8 },
  artistAvatarImgLg: { width: 90, height: 90, borderRadius: 45 },
  artistNameCenter: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  badge: { position: 'absolute', bottom: 25, right: 5, backgroundColor: COLORS.black, borderRadius: 10, padding: 2 },
  topResultCard: { backgroundColor: 'rgba(255,255,255,0.05)', padding: 20, borderRadius: 16 },
  topResultAvatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginBottom: 16 },
  topResultImg: { width: 100, height: 100, borderRadius: 50 },
  topResultName: { color: COLORS.textPrimary, fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  empty: { alignItems: 'center', marginTop: 60, paddingHorizontal: 32 },
  emptyTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  emptyText: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
