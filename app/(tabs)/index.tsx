import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Dimensions, ActivityIndicator, Animated, Platform, RefreshControl
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AppBannerAd from '../../components/ads/AppBannerAd';
import { useRouter } from 'expo-router';
import { GlassView as BlurView } from '@/components/GlassView';
import { supabase } from '../../lib/supabase';
import { useThemeStore } from '../../store/themeStore';
import { GENRES, Track, Profile, Playlist } from '../../constants';
import { usePlayerStore } from '../../store/playerStore';
import AcrylicShelfItem from '../../components/AcrylicShelfItem';
import CategoryCollageCard from '../../components/CategoryCollageCard';
import GlassArtistHalo from '../../components/GlassArtistHalo';
import GlassTrackCard from '../../components/GlassTrackCard';
import LiveRadioTuner from '../../components/LiveRadioTuner';
import AiStudioBanner from '../../components/AiStudioBanner';
import DailyShuffler from '../../components/DailyShuffler';
import { getDailySelection } from '../../utils/dailyRandom';
import { useAuthStore } from '../../store/authStore';
import { useLayoutStore } from '../../store/layoutStore';
import { useTranslation } from 'react-i18next';
import TrackItem from '../../components/TrackItem';

const REGIONS = ['All', 'Kinondoni', 'Ilala', 'Temeke', 'Mwanza', 'Arusha', 'Dodoma'];

const MOODS = [
  { id: 1, title: 'Late Night Drive', gradient: ['#141E30', '#243B55'] },
  { id: 2, title: 'Gym Motivation', gradient: ['#FF416C', '#FF4B2B'] },
  { id: 3, title: 'Chill Sunday', gradient: ['#4CB8C4', '#3CD3AD'] },
  { id: 4, title: 'Heartbreak', gradient: ['#0f0c29', '#302b63'] },
  { id: 5, title: 'Morning Coffee', gradient: ['#FFB75E', '#ED8F03'] },
  { id: 6, title: 'Party Mode', gradient: ['#8E2DE2', '#4A00E0'] },
];



const FALLBACK_PAINTINGS = [
  require('../../assets/images/african_art_1.jpg'),
  require('../../assets/images/african_art_2.jpg'),
  require('../../assets/images/african_art_3.png'),
  require('../../assets/images/african_art_4.jpg'),
  require('../../assets/images/african_art_5.png')
];

const getFallbackImage = (idStr?: string) => {
  if (!idStr) return FALLBACK_PAINTINGS[0];
  const sum = String(idStr).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return FALLBACK_PAINTINGS[sum % FALLBACK_PAINTINGS.length];
};

// STATIONS removed in favor of dynamic liveStations

const { width, height } = Dimensions.get('window');
const ITEM_SIZE = width * 0.72;
const SPACER_ITEM_SIZE = (width - ITEM_SIZE) / 2;

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return { text: 'Good Morning', icon: 'partly-sunny' as const };
  if (hour < 18) return { text: 'Good Afternoon', icon: 'partly-sunny-outline' as const };
  return { text: 'Good Evening', icon: 'moon' as const };
};

const MUSIC_CATEGORIES = [
  { id: 'Bongo Flava', title: 'Bongo Flava', subtitle: 'The Core Sound', icon: 'musical-note', imageSource: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=500&auto=format&fit=crop' },
  { id: 'Amapiano', title: 'Amapiano', subtitle: 'Dance Floor Fillers', icon: 'musical-notes', imageSource: 'https://images.unsplash.com/photo-1493225457124-a1a2a5f5f9af?q=80&w=500&auto=format&fit=crop' },
  { id: 'Afrobeats', title: 'Afrobeats', subtitle: 'Global Grooves', icon: 'earth', imageSource: require('../../assets/images/afrobeats.png') },
  { id: 'Singeli', title: 'Singeli', subtitle: 'High Energy', icon: 'flash', imageSource: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=500&auto=format&fit=crop' },
  { id: 'Gospel / Injili', title: 'Gospel', subtitle: 'Uplifting Praise', icon: 'heart', imageSource: 'https://images.unsplash.com/photo-1438029071396-1e831a7fa6d8?q=80&w=500&auto=format&fit=crop' },
  { id: 'Taarab', title: 'Taarab', subtitle: 'Coastal Vibes', icon: 'water', imageSource: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?q=80&w=500&auto=format&fit=crop' },
  { id: 'Hip-hop', title: 'Hip Hop', subtitle: 'Street Anthems', icon: 'mic', imageSource: 'https://images.unsplash.com/photo-1499364615650-ec38552f4f34?q=80&w=500&auto=format&fit=crop' },
  { id: 'R&B', title: 'R&B', subtitle: 'Smooth & Soulful', icon: 'musical-note', imageSource: 'https://images.unsplash.com/photo-1516280440503-6c84c164b73b?q=80&w=500&auto=format&fit=crop' },
  { id: 'Reggae', title: 'Reggae', subtitle: 'Island Roots', icon: 'leaf', imageSource: 'https://images.unsplash.com/photo-1601643157091-ce5c665179ab?q=80&w=500&auto=format&fit=crop' },
];

export default function HomeScreen() {
  const { COLORS, theme } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  const { t } = useTranslation();
  const playTrack = usePlayerStore(s => s.playTrack);
  const currentTrack = usePlayerStore(s => s.currentTrack);
  const isPlaying = usePlayerStore(s => s.isPlaying);
  const session = useAuthStore(s => s.session);

  const [featured, setFeatured] = useState<Track[]>([]);
  const [classics, setClassics] = useState<Track[]>([]);
  const [featuredPlaylists, setFeaturedPlaylists] = useState<any[]>([]);
  const [trending, setTrending] = useState<Track[]>([]);
  const [newReleases, setNewReleases] = useState<Track[]>([]);
  const [artists, setArtists] = useState<Profile[]>([]);
  const [albums, setAlbums] = useState<Playlist[]>([]);
  const [myPlaylists, setMyPlaylists] = useState<Playlist[]>([]);
  const [aiTracks, setAiTracks] = useState<Track[]>([]);
  const [liveStations, setLiveStations] = useState<any[]>([]);
  const [dbGenres, setDbGenres] = useState<any[]>([]);
  const [categoryImages, setCategoryImages] = useState<Record<string, string[]>>({});
  const [emergingArtists, setEmergingArtists] = useState<Profile[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState('All');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [recentlyPlayed, setRecentlyPlayed] = useState<Track[]>([]);
  const [autoPlaylists, setAutoPlaylists] = useState<{ id: string, title: string, subtitle: string, colors: string[], tracks: Track[] }[]>([]);
  
  const [recommendedTracks, setRecommendedTracks] = useState<Track[]>([]);
  const [recommendedArtist, setRecommendedArtist] = useState<string>('');

  // New Categories
  const [weekendParty, setWeekendParty] = useState<Track[]>([]);
  const [midnightSoul, setMidnightSoul] = useState<Track[]>([]);
  const [underRadar, setUnderRadar] = useState<Track[]>([]);

  // Animation for sticky header & ticker
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollX = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  const heroCarouselRef = useRef<any>(null);
  const currentHeroIndex = useRef(0);

  // Auto-hide navigation logic
  const isNavVisible = useLayoutStore(s => s.isNavVisible);
  const setIsNavVisible = useLayoutStore(s => s.setIsNavVisible);
  const lastScrollY = useRef(0);
  const headerTranslateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerTranslateY, {
      toValue: isNavVisible ? 0 : -120, // Hide header by moving up
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isNavVisible]);

  const handleScroll = (event: any) => {
    const currentY = event.nativeEvent.contentOffset.y;
    const navVisible = useLayoutStore.getState().isNavVisible;
    
    // Always show at top
    if (currentY <= 10) {
      if (!navVisible) useLayoutStore.getState().setIsNavVisible(true);
      lastScrollY.current = currentY;
      return;
    }

    // Scroll Down -> Hide
    if (currentY > lastScrollY.current + 15 && navVisible) {
      useLayoutStore.getState().setIsNavVisible(false);
    } 
    // Scroll Up -> Show
    else if (currentY < lastScrollY.current - 15 && !navVisible) {
      useLayoutStore.getState().setIsNavVisible(true);
    }

    lastScrollY.current = currentY;
  };

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true })
      ])
    ).start();
  }, []);

  useEffect(() => {
    loadData(true);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadTrending();
  }, [selectedRegion]);

  const loadTrending = async () => {
    // Fetch top 50, then select 20 daily
    let query = supabase.from('tracks').select('*, profile:profiles!tracks_user_id_fkey!inner(*)').eq('is_public', true).or('is_ai.eq.false,is_ai.is.null').order('play_count', { ascending: false }).limit(50);
    
    if (selectedRegion !== 'All') {
      query = query.ilike('profile.location', `%${selectedRegion}%`);
    }
    
    const { data, error } = await query;
    if (error) console.error("Trending Error:", error);
    if (data) setTrending(getDailySelection(data as Track[], 20));
  };

  const loadData = async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      // Fetch larger pools (limit 50) so we can daily-shuffle them and pick 10
      const [featuredRes, newRes, artistsRes, albumsRes, myPlaylistsRes, classicsRes, emergingRes, eventsRes, aiRes, liveRes, dynamicSectionsRes, genresRes] = await Promise.all([
        supabase.from('tracks').select('*, profile:profiles!tracks_user_id_fkey(*)').eq('is_public', true).or('is_ai.eq.false,is_ai.is.null').order('play_count', { ascending: false }).limit(50), 
        supabase.from('tracks').select('*, profile:profiles!tracks_user_id_fkey(*)').eq('is_public', true).or('is_ai.eq.false,is_ai.is.null').order('created_at', { ascending: false }).limit(50),
        supabase.from('profiles').select('*').eq('role', 'artist').order('follower_count', { ascending: false }).limit(50),
        supabase.from('playlists').select('id, title, cover_url, track_count').eq('is_public', true).gt('track_count', 0).order('track_count', { ascending: false }).limit(50),
        session?.user.id ? supabase.from('playlists').select('*').eq('user_id', session.user.id).gt('track_count', 0).order('created_at', { ascending: false }).limit(10) : Promise.resolve({ data: null }),
        supabase.from('tracks').select('*, profile:profiles!tracks_user_id_fkey(*)').eq('is_public', true).or('is_ai.eq.false,is_ai.is.null').order('created_at', { ascending: true }).limit(50),
        supabase.from('profiles').select('*').eq('role', 'artist').order('follower_count', { ascending: true }).limit(50),
        supabase.from('events').select('*').order('event_date', { ascending: true }),
        supabase.from('tracks').select('*, profile:profiles!tracks_user_id_fkey(*)').eq('is_public', true).eq('is_ai', true).order('play_count', { ascending: false }).limit(50),
        supabase.from('live_stations').select('*, profiles(display_name, username, avatar_url)').eq('status', 'live').order('listener_count', { ascending: false }).limit(10),
        // Fetch Admin-driven featured playlists with tracks
        supabase.from('playlists')
          .select('id, title, subtitle, cover_url, playlist_tracks(tracks(*, profile:profiles!tracks_user_id_fkey(*)))')
          .eq('is_featured', true)
          .order('created_at', { ascending: false }),
        supabase.from('genres').select('*').order('created_at', { ascending: true })
      ]);
      
      await loadTrending(); 
      
      // Shuffle the large pools and select a subset for the day
      if (featuredRes.data) setFeatured(getDailySelection(featuredRes.data as Track[], 7));
      if (newRes.data) setNewReleases(getDailySelection(newRes.data as Track[], 10));
      if (artistsRes.data) setArtists(getDailySelection(artistsRes.data as Profile[], 10));
      if (albumsRes.data) setAlbums(getDailySelection(albumsRes.data as Playlist[], 10));
      if (myPlaylistsRes.data) setMyPlaylists(myPlaylistsRes.data as Playlist[]); // Keep original
      if (classicsRes.data) setClassics(getDailySelection(classicsRes.data as Track[], 10));
      if (aiRes.data) setAiTracks(getDailySelection(aiRes.data as Track[], 10));
      if (emergingRes.data) setEmergingArtists(getDailySelection(emergingRes.data as Profile[], 10));
      if (eventsRes.data) setEvents(eventsRes.data); // Keep original
      if (liveRes.data) setLiveStations(liveRes.data); // Keep original
      if (dynamicSectionsRes && !dynamicSectionsRes.error && dynamicSectionsRes.data) {
        setFeaturedPlaylists(dynamicSectionsRes.data);
      }
      
      const displayGenres = (genresRes && !genresRes.error && genresRes.data && genresRes.data.length > 0) ? genresRes.data : MUSIC_CATEGORIES;
      setDbGenres(displayGenres);

      // Fetch images for categories to make collages
      const catPromises = displayGenres.map(cat => 
        supabase.from('tracks').select('cover_url').eq('genre', cat.name || cat.id).order('play_count', { ascending: false }).limit(4)
      );
      const catResults = await Promise.all(catPromises);
      const newCategoryImages: Record<string, string[]> = {};
      catResults.forEach((res, index) => {
        if (res.data && res.data.length > 0) {
           newCategoryImages[displayGenres[index].name || displayGenres[index].id] = res.data.map(t => t.cover_url).filter(Boolean);
        }
      });
      setCategoryImages(newCategoryImages);

      if (session?.user.id) {
        // Fetch recently played
        const { data: recentHistory } = await supabase.from('listening_history')
          .select('track_id')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(30);
          
        if (recentHistory && recentHistory.length > 0) {
          const trackIds = [...new Set(recentHistory.map(r => r.track_id))].slice(0, 10);
          const { data: tracksData } = await supabase.from('tracks')
            .select('*, profile:profiles!tracks_user_id_fkey(*)')
            .in('id', trackIds);
            
          if (tracksData && tracksData.length > 0) {
            const sortedTracks = trackIds.map(id => tracksData.find(t => t.id === id)).filter(Boolean) as Track[];
            setRecentlyPlayed(sortedTracks);
            
            // Generate Because You Listen To based on the most recent track's artist
            const mostRecentTrack = sortedTracks[0];
            if (mostRecentTrack && mostRecentTrack.user_id) {
              setRecommendedArtist(mostRecentTrack.artist_name || 'this artist');
              const { data: recData } = await supabase.from('tracks')
                .select('*, profile:profiles!tracks_user_id_fkey(*)')
                .eq('user_id', mostRecentTrack.user_id)
                .neq('id', mostRecentTrack.id)
                .eq('is_public', true)
                .order('play_count', { ascending: false })
                .limit(10);
                
              if (recData && recData.length > 0) {
                setRecommendedTracks(recData as Track[]);
              }
            }
          }
        } else {
          // Fallback: If no history, just show some tracks to keep the UI looking full
          const { data: randomTracks } = await supabase.from('tracks')
            .select('*, profile:profiles!tracks_user_id_fkey(*)')
            .eq('is_public', true)
            .limit(10);
          if (randomTracks) {
            setRecentlyPlayed(randomTracks.sort(() => 0.5 - Math.random()) as Track[]);
            
            // Provide a random recommendation fallback
            if (randomTracks.length > 0) {
              const randomTrack = randomTracks[0];
              setRecommendedArtist(randomTrack.artist_name || 'this artist');
              const { data: recData } = await supabase.from('tracks')
                .select('*, profile:profiles!tracks_user_id_fkey(*)')
                .eq('user_id', randomTrack.user_id)
                .neq('id', randomTrack.id)
                .eq('is_public', true)
                .limit(10);
              if (recData) setRecommendedTracks(recData as Track[]);
            }
          }
        }
      }

      // Generate Auto Playlists based on random genres
      const shuffledGenres = [...GENRES].sort(() => 0.5 - Math.random()).slice(0, 3);
      const generatedPlaylists = [];
      const gradients = [
        ['#ff4b1f', '#ff9068'],
        ['#2193b0', '#6dd5ed'],
        ['#8E2DE2', '#4A00E0'],
        ['#FF416C', '#FF4B2B'],
        ['#0f0c29', '#302b63']
      ];
      
      for (let i = 0; i < shuffledGenres.length; i++) {
        const genre = shuffledGenres[i];
        let { data: genreTracks } = await supabase.from('tracks')
          .select('*, profile:profiles!tracks_user_id_fkey(*)')
          .eq('genre', genre.name)
          .eq('is_public', true)
          .order('play_count', { ascending: false })
          .limit(20);
          
        // Fallback: If no tracks for this genre in DB, grab random tracks so the playlist still generates
        if (!genreTracks || genreTracks.length === 0) {
          const { data: randomTracks } = await supabase.from('tracks')
            .select('*, profile:profiles!tracks_user_id_fkey(*)')
            .eq('is_public', true)
            .limit(20);
          genreTracks = randomTracks?.sort(() => 0.5 - Math.random()) || null;
        }
          
        if (genreTracks && genreTracks.length > 0) {
          generatedPlaylists.push({
            id: `auto_${genre.name}`,
            title: `${genre.name} Mix`,
            subtitle: 'Made for you',
            colors: gradients[i % gradients.length],
            tracks: genreTracks as Track[]
          });
        }
      }
      setAutoPlaylists(generatedPlaylists);

      // Fetch New Categories (with distinct fallbacks to prevent duplicates)
      const { data: genericFallback } = await supabase.from('tracks').select('*, profile:profiles!tracks_user_id_fkey(*)').eq('is_public', true).limit(50);
      const fallbackTracks = genericFallback ? genericFallback.sort(() => 0.5 - Math.random()) : [];

      // 1. Weekend Party Starters (Amapiano, Singeli, Bongo Flava)
      const { data: weekendData } = await supabase.from('tracks')
        .select('*, profile:profiles!tracks_user_id_fkey(*)')
        .in('genre', ['Amapiano', 'Singeli', 'Bongo Flava'])
        .eq('is_public', true)
        .order('play_count', { ascending: false })
        .limit(10);
      setWeekendParty((weekendData?.length ? weekendData : fallbackTracks.slice(0, 10)) as Track[]);

      // 2. Midnight Soul (R&B, Emotion, Taarab)
      const { data: midnightData } = await supabase.from('tracks')
        .select('*, profile:profiles!tracks_user_id_fkey(*)')
        .in('genre', ['R&B', 'Emotion', 'Taarab'])
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(10);
      setMidnightSoul((midnightData?.length ? midnightData : fallbackTracks.slice(10, 20)) as Track[]);

      // 3. Under the Radar (Lowest play counts)
      const { data: radarData } = await supabase.from('tracks')
        .select('*, profile:profiles!tracks_user_id_fkey(*)')
        .eq('is_public', true)
        .order('play_count', { ascending: true })
        .limit(15);
      setUnderRadar((radarData?.length ? radarData : fallbackTracks.slice(20, 30)) as Track[]);

    } catch (e) {
      console.log("Offline or network error fetching home data", e);
    } finally {
      setLoading(false);
    }
  };

  const generateRoadTripPlaylist = async () => {
    try {
      const { data } = await supabase
        .from('tracks')
        .select('*, profile:profiles!tracks_user_id_fkey(*)')
        .eq('is_public', true)
        .order('play_count', { ascending: false })
        .limit(50);
        
      if (data && data.length > 0) {
        const shuffled = data.sort(() => 0.5 - Math.random()).slice(0, 20);
        playTrack(shuffled[0], shuffled);
        router.push('/player');
      }
    } catch (e) {
      console.error("Failed to generate road trip playlist", e);
    }
  };

  useEffect(() => {
    if (trending.length === 0) return;
    const interval = setInterval(() => {
      currentHeroIndex.current = (currentHeroIndex.current + 1) % Math.min(trending.length, 10);
      heroCarouselRef.current?.scrollTo({ x: currentHeroIndex.current * width, animated: true });
    }, 4000);
    return () => clearInterval(interval);
  }, [trending]);

  const createPlaylist = async () => {
    if (!session) {
      import('react-native').then(({ Alert }) => {
        Alert.alert("Login Required", "You must be logged in to create a playlist");
      });
      return;
    }
    import('react-native').then(({ Alert }) => {
      Alert.prompt("New Playlist", "Enter a name for your playlist", [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Create", 
          onPress: async (text) => {
            if (text) {
              const { error } = await supabase.from('playlists').insert({
                title: text,
                user_id: session.user.id,
                is_public: true
              });
              if (error) Alert.alert("Error", error.message);
              else {
                Alert.alert("Success", "Playlist created!");
                loadData();
              }
            }
          } 
        }
      ]);
    });
  };

  // Skeleton pulse animation for loading state
  const skeletonPulse = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(skeletonPulse, { toValue: 0.7, duration: 800, useNativeDriver: true }),
          Animated.timing(skeletonPulse, { toValue: 0.3, duration: 800, useNativeDriver: true })
        ])
      ).start();
    }
  }, [loading]);

  if (loading) {
    // Professional sweeping shimmer: a bright gradient moves left → right across every placeholder
    const shimmerTranslate = skeletonPulse.interpolate({
      inputRange: [0.3, 0.7],
      outputRange: [-width, width],
    });

    const ShimmerBox = ({ w, h, br = 12, mt = 0 }: { w: number | string; h: number; br?: number; mt?: number }) => (
      <View style={{ width: w as any, height: h, borderRadius: br, marginTop: mt, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
        <Animated.View style={{
          position: 'absolute', top: 0, bottom: 0, width: '100%',
          transform: [{ translateX: shimmerTranslate }],
        }}>
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.12)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      </View>
    );

    return (
      <View style={styles.container}>
        {/* Header — always visible */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 16, gap: 16, backgroundColor: 'rgba(15,15,15,0.95)' }}>
          <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800', flex: 1 }}>Good Music</Text>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="notifications" size={20} color="#fff" />
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: Platform.OS === 'ios' ? 120 : 100, paddingBottom: 160 }}>

          {/* Hero card shimmer */}
          <View style={{ marginHorizontal: 16, marginBottom: 32 }}>
            <ShimmerBox w="100%" h={ITEM_SIZE} br={20} />
          </View>

          {/* Staff Picks row shimmer */}
          <View style={{ paddingHorizontal: 16, marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between' }}>
            <ShimmerBox w={150} h={20} br={6} />
            <ShimmerBox w={50} h={14} br={4} />
          </View>
          {[1, 2, 3].map(i => (
            <View key={`sp-${i}`} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16, gap: 12 }}>
              <ShimmerBox w={56} h={56} br={8} />
              <View style={{ flex: 1, gap: 8 }}>
                <ShimmerBox w="70%" h={14} br={4} />
                <ShimmerBox w="45%" h={11} br={4} />
              </View>
            </View>
          ))}

          {/* Horizontal card sections */}
          {[1, 2].map(sec => (
            <View key={`sec-${sec}`} style={{ marginTop: 24, marginBottom: 8 }}>
              <View style={{ paddingHorizontal: 16, marginBottom: 14, flexDirection: 'row', justifyContent: 'space-between' }}>
                <ShimmerBox w={130} h={20} br={6} />
                <ShimmerBox w={45} h={14} br={4} />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 16, gap: 14 }}>
                {[1, 2, 3, 4].map(i => (
                  <View key={i} style={{ width: 140, gap: 10 }}>
                    <ShimmerBox w={140} h={140} br={14} />
                    <ShimmerBox w={110} h={13} br={4} />
                    <ShimmerBox w={70} h={11} br={4} />
                  </View>
                ))}
              </ScrollView>
            </View>
          ))}

          {/* Artist circles shimmer */}
          <View style={{ marginTop: 24, marginBottom: 8 }}>
            <View style={{ paddingHorizontal: 16, marginBottom: 14 }}>
              <ShimmerBox w={160} h={20} br={6} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 16, gap: 16 }}>
              {[1, 2, 3, 4, 5].map(i => (
                <View key={i} style={{ alignItems: 'center', gap: 10, width: 80 }}>
                  <ShimmerBox w={80} h={80} br={40} />
                  <ShimmerBox w={60} h={11} br={4} />
                </View>
              ))}
            </ScrollView>
          </View>

        </ScrollView>
      </View>
    );
  }

  const heroTrack = featured[0];
  // Bug 2 Fix: Use actual listening history; fall back to featured for new users
  const jumpBackTracks = recentlyPlayed.length > 0 ? recentlyPlayed.slice(0, 6) : featured.slice(1, 7);
  const top10Tracks = trending.slice(0, 10);


  const playVibe = (vibeTitle: string) => {
    // Collect tracks to simulate AI playlist generation
    const allTracks = [...trending, ...featured, ...classics, ...newReleases];
    if (allTracks.length === 0) return;
    
    // Remove duplicates
    const uniqueTracks = Array.from(new Map(allTracks.map(item => [item.id, item])).values());
    
    // Shuffle them to simulate a dynamic, fresh playlist
    const shuffled = uniqueTracks.sort(() => 0.5 - Math.random());
    
    // Take the top 20
    const playlist = shuffled.slice(0, 20);
    
    // Immediately play the vibe playlist
    if (playlist.length > 0) {
      playTrack(playlist[0], playlist);
      router.push('/player');
    }
  };

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 200],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatCount = (count: number) => {
    if (!count) return '0';
    if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
    if (count >= 1000) return (count / 1000).toFixed(0) + 'K';
    return count.toString();
  };

  const filterByGenre = (tracks: Track[]) => {
    if (selectedGenre === 'All') return tracks;
    return tracks.filter(t => t.genre?.toLowerCase() === selectedGenre.toLowerCase());
  };

  const displayTrending = filterByGenre(trending);
  const displayRecentlyPlayed = filterByGenre(recentlyPlayed);
  const displayFeatured = filterByGenre(featured);
  const displayNewReleases = filterByGenre(newReleases);
  const displayAiTracks = filterByGenre(aiTracks);

  const staffPicksChunks = [];
  for (let i = 0; i < displayTrending.length; i += 3) {
    staffPicksChunks.push(displayTrending.slice(i, i + 3));
  }

  const jumpBackChunks = [];
  const jumpSource = displayRecentlyPlayed.length > 0 ? displayRecentlyPlayed : displayFeatured.slice(1);
  for (let i = 0; i < jumpSource.length; i += 3) {
    jumpBackChunks.push(jumpSource.slice(i, i + 3));
  }

  return (
    <View style={styles.container}>
      {/* Sticky Glassmorphic Header - Animated */}
      <Animated.View style={[styles.headerRow, { transform: [{ translateY: headerTranslateY }] }]}>
        <BlurView intensity={80} tint="dark" style={[{ width: '100%', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 16 }]}>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800', marginLeft: 4 }}>Good Music</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity style={styles.bellBtn} onPress={() => router.push('/discover')}>
              <Ionicons name="compass-outline" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.bellBtn} onPress={() => router.push('/notifications')}>
              <Ionicons name="notifications" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </BlurView>
      </Animated.View>

      <View style={{ flex: 1 }}>
        <Animated.ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={{ paddingTop: Platform.OS === 'ios' ? 120 : 100, paddingBottom: 160 }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#FF0055"
              colors={['#FF0055', '#00F0FF']}
              progressBackgroundColor="#1C1C28"
            />
          }
        >
          <DailyShuffler>



            {/* AI Studio CTA Banner */}
            <AiStudioBanner onPress={() => router.push('/ai-studio')} />

            {/* Staff Picks Section */}
            {staffPicksChunks.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Staff Picks</Text>
                <TouchableOpacity onPress={() => router.push('/view-all?type=staff-picks')}><Text style={styles.seeAll}>See All</Text></TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} pagingEnabled snapToInterval={width * 0.9} decelerationRate="fast" contentContainerStyle={{ paddingLeft: 16 }}>
                {staffPicksChunks.map((chunk, index) => (
                  <View key={index} style={{ width: width * 0.9, paddingRight: 16 }}>
                    {chunk.map(track => (
                      <TouchableOpacity key={track.id} style={styles.staffPickRow} onPress={() => { playTrack(track, displayTrending); router.push('/player'); }}>
                        <View style={styles.staffPickCoverWrap}>
                          <Image source={{ uri: track.cover_url || undefined }} style={styles.staffPickCover} />
                          <View style={styles.durationBadge}>
                            <Text style={styles.durationText}>{formatTime(track.duration_sec)}</Text>
                          </View>
                        </View>
                        <View style={styles.staffPickInfo}>
                          <Text style={styles.staffPickTitle} numberOfLines={1}>{track.title}</Text>
                          <View style={styles.staffPickStats}>
                            <Ionicons name="play" size={12} color="rgba(255,255,255,0.5)" style={{ marginRight: 4 }} />
                            <Text style={styles.staffPickStatText}>
                              {formatCount(track.play_count)} · {track.genre || 'Music'}
                            </Text>
                          </View>
                        </View>
                        <TouchableOpacity style={styles.ellipsisBtn}>
                          <Ionicons name="ellipsis-horizontal" size={20} color="rgba(255,255,255,0.5)" />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Made in AI Studio (AI Tracks) */}
          {displayAiTracks.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Made in AI Studio</Text>
                <TouchableOpacity onPress={() => router.push('/view-all?type=ai-studio')}><Text style={styles.seeAll}>See All</Text></TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 16 }}>
                {displayAiTracks.map(track => (
                  <TouchableOpacity key={track.id} style={styles.sunoCard} onPress={() => { playTrack(track, displayAiTracks); router.push('/player'); }}>
                    <View style={styles.sunoCoverWrap}>
                      <Image source={{ uri: track.cover_url || undefined }} style={styles.sunoCover} />
                      <View style={styles.sunoDurationBadge}>
                        <Text style={styles.sunoDurationText}>{formatTime(track.duration_sec)}</Text>
                      </View>
                      <TouchableOpacity style={styles.sunoEllipsisBtn}>
                        <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.sunoTitle} numberOfLines={1}>{track.title}</Text>
                    <Text style={styles.sunoGenre} numberOfLines={1}>{track.genre || 'Electronic'}</Text>
                    <View style={styles.sunoStats}>
                      <Ionicons name="play" size={12} color="rgba(255,255,255,0.5)" style={{ marginRight: 4 }} />
                      <Text style={styles.sunoStatText}>{formatCount(track.play_count)}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Jump Back In Section */}
          {jumpBackChunks.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Jump Back In</Text>
                <TouchableOpacity onPress={() => router.push('/view-all?type=jump-back')}><Text style={styles.seeAll}>See All</Text></TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} pagingEnabled snapToInterval={width * 0.9} decelerationRate="fast" contentContainerStyle={{ paddingLeft: 16 }}>
                {jumpBackChunks.map((chunk, index) => (
                  <View key={index} style={{ width: width * 0.9, paddingRight: 16 }}>
                    {chunk.map(track => (
                      <TouchableOpacity key={track.id} style={styles.staffPickRow} onPress={() => { playTrack(track, jumpSource); router.push('/player'); }}>
                        <View style={styles.staffPickCoverWrap}>
                          <Image source={{ uri: track.cover_url || undefined }} style={styles.staffPickCover} />
                          <View style={styles.durationBadge}>
                            <Text style={styles.durationText}>{formatTime(track.duration_sec)}</Text>
                          </View>
                        </View>
                        <View style={styles.staffPickInfo}>
                          <Text style={styles.staffPickTitle} numberOfLines={1}>{track.title}</Text>
                          <View style={styles.staffPickStats}>
                            <Ionicons name="play" size={12} color="rgba(255,255,255,0.5)" style={{ marginRight: 4 }} />
                            <Text style={styles.staffPickStatText}>
                              {formatCount(track.play_count)} · {track.genre || 'Music'}
                            </Text>
                          </View>
                        </View>
                        <TouchableOpacity style={styles.ellipsisBtn}>
                          <Ionicons name="ellipsis-horizontal" size={20} color="rgba(255,255,255,0.5)" />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* New Releases */}
          {displayNewReleases.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>New Releases</Text>
                <TouchableOpacity onPress={() => router.push('/view-all?type=new-releases')}><Text style={styles.seeAll}>See All</Text></TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 16 }}>
                {displayNewReleases.map(track => (
                  <TouchableOpacity key={track.id} style={styles.sunoCard} onPress={() => { playTrack(track, displayNewReleases); router.push('/player'); }}>
                    <View style={styles.sunoCoverWrap}>
                      <Image source={{ uri: track.cover_url || undefined }} style={styles.sunoCover} />
                      <View style={styles.sunoDurationBadge}>
                        <Text style={styles.sunoDurationText}>{formatTime(track.duration_sec)}</Text>
                      </View>
                      <TouchableOpacity style={styles.sunoEllipsisBtn}>
                        <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.sunoTitle} numberOfLines={1}>{track.title}</Text>
                    <Text style={styles.sunoGenre} numberOfLines={1}>{track.genre || 'Latest'}</Text>
                    <View style={styles.sunoStats}>
                      <Ionicons name="play" size={12} color="rgba(255,255,255,0.5)" style={{ marginRight: 4 }} />
                      <Text style={styles.sunoStatText}>{formatCount(track.play_count)}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
          {/* Trending Now */}
          {displayTrending.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Trending Now</Text>
                <TouchableOpacity onPress={() => router.push('/view-all?type=trending-now')}><Text style={styles.seeAll}>See All</Text></TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 16 }}>
                {displayTrending.slice(0, 10).map(track => (
                  <TouchableOpacity key={track.id} style={styles.sunoCard} onPress={() => { playTrack(track, displayTrending); router.push('/player'); }}>
                    <View style={styles.sunoCoverWrap}>
                      <Image source={{ uri: track.cover_url || undefined }} style={styles.sunoCover} />
                      <View style={styles.sunoDurationBadge}>
                        <Text style={styles.sunoDurationText}>{formatTime(track.duration_sec)}</Text>
                      </View>
                      <TouchableOpacity style={styles.sunoEllipsisBtn}>
                        <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.sunoTitle} numberOfLines={1}>{track.title}</Text>
                    <Text style={styles.sunoGenre} numberOfLines={1}>{track.genre || 'Trending'}</Text>
                    <View style={styles.sunoStats}>
                      <Ionicons name="play" size={12} color="rgba(255,255,255,0.5)" style={{ marginRight: 4 }} />
                      <Text style={styles.sunoStatText}>{formatCount(track.play_count)}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Top Charts - list style */}
          {displayFeatured.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Top Charts</Text>
                <TouchableOpacity onPress={() => router.push('/view-all?type=trending')}><Text style={styles.seeAll}>See All</Text></TouchableOpacity>
              </View>
              <View style={{ paddingHorizontal: 16 }}>
                {displayFeatured.slice(0, 5).map((track, i) => (
                  <TouchableOpacity key={track.id} style={styles.staffPickRow} onPress={() => { playTrack(track, displayFeatured); router.push('/player'); }}>
                    <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 18, fontWeight: '700', width: 28, marginRight: 8 }}>{i + 1}</Text>
                    <View style={styles.staffPickCoverWrap}>
                      <Image source={{ uri: track.cover_url || undefined }} style={styles.staffPickCover} />
                    </View>
                    <View style={styles.staffPickInfo}>
                      <Text style={styles.staffPickTitle} numberOfLines={1}>{track.title}</Text>
                      <View style={styles.staffPickStats}>
                        <Ionicons name="play" size={12} color="rgba(255,255,255,0.5)" style={{ marginRight: 4 }} />
                        <Text style={styles.staffPickStatText}>{formatCount(track.play_count)} · {track.genre || 'Music'}</Text>
                      </View>
                    </View>
                    <TouchableOpacity style={styles.ellipsisBtn}>
                      <Ionicons name="ellipsis-horizontal" size={20} color="rgba(255,255,255,0.5)" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
          
          {/* Dynamic Featured Sections (Backend-driven) */}
          {featuredPlaylists.map(playlist => {
            // Extract tracks from the playlist_tracks join
            const playlistTracks = (playlist.playlist_tracks || [])
              .map((pt: any) => pt.tracks)
              .filter(Boolean) as Track[];
              
            if (playlistTracks.length === 0) return null;

            return (
              <View key={`featured-section-${playlist.id}`} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{playlist.title}</Text>
                  <TouchableOpacity onPress={() => router.push(`/playlist/${playlist.id}`)}>
                    <Text style={styles.seeAll}>See All</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 16 }}>
                  {playlistTracks.map(track => (
                    <TouchableOpacity key={track.id} style={styles.sunoCard} onPress={() => { playTrack(track, playlistTracks); router.push('/player'); }}>
                      <View style={styles.sunoCoverWrap}>
                        <Image source={{ uri: track.cover_url || undefined }} style={styles.sunoCover} />
                        <View style={styles.sunoDurationBadge}>
                          <Text style={styles.sunoDurationText}>{formatTime(track.duration_sec)}</Text>
                        </View>
                        <TouchableOpacity style={styles.sunoEllipsisBtn}>
                          <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.sunoTitle} numberOfLines={1}>{track.title}</Text>
                      <Text style={styles.sunoGenre} numberOfLines={1}>{track.genre || playlist.subtitle || 'Featured'}</Text>
                      <View style={styles.sunoStats}>
                        <Ionicons name="play" size={12} color="rgba(255,255,255,0.5)" style={{ marginRight: 4 }} />
                        <Text style={styles.sunoStatText}>{formatCount(track.play_count)}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            );
          })}

          {/* Most Searched Artist */}
          {artists.length > 1 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Most Searched Artist</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 16, gap: 16, paddingTop: 10, paddingBottom: 10 }}>
                {artists.slice(1).map(artist => (
                  <GlassArtistHalo
                    key={`searched-${artist.id}`}
                    name={artist.display_name || artist.username}
                    imageUrl={artist.avatar_url || undefined}
                    onPress={() => router.push(`/artist/${artist.id}`)}
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {/* Song Categories (Genres) */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Explore Categories</Text>
              <TouchableOpacity onPress={() => router.push('/view-all?type=categories')}><Text style={styles.seeAll}>See All</Text></TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 16, gap: 16, paddingTop: 10 }}>
              {dbGenres.map((cat, idx) => {
                const catId = cat.name || cat.id; // DB uses 'name', constants use 'id'
                const catTitle = cat.name || cat.title;
                const catSubtitle = cat.subtitle || 'Explore';
                const catIcon = cat.icon;
                const catImage = cat.image_url || cat.imageSource;
                
                const fetchedImages = categoryImages[catId] || [];
                // If there are tracks in this category, use their covers. Otherwise fallback to the static image.
                const imagesToDisplay = fetchedImages.length > 0 ? fetchedImages : [catImage];
                return (
                  <CategoryCollageCard
                    key={`genre-${catId}-${idx}`}
                    title={catTitle}
                    subtitle={catSubtitle}
                    iconName={catIcon as any}
                    images={imagesToDisplay}
                    onPress={() => router.push(`/view-all?type=category&id=${catId}`)}
                  />
                );
              })}
            </ScrollView>
          </View>

          {/* Albums to Listen */}
          {albums.length > 0 && (
            <View style={[styles.section, { marginTop: 24, marginBottom: 40 }]}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Albums to Listen</Text>
                <TouchableOpacity onPress={() => router.push('/view-all?type=albums')}><Text style={styles.seeAll}>See All</Text></TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 16, gap: 16, paddingTop: 10 }}>
                {albums.map(album => (
                  <AcrylicShelfItem
                    key={`album-${album.id}`}
                    title={album.title}
                    subtitle={`${album.track_count} tracks`}
                    imageSource={album.cover_url || undefined}
                    onPress={() => router.push(`/playlist/${album.id}`)}
                  />
                ))}
              </ScrollView>
            </View>
          )}
          </DailyShuffler>

          {/* Grand Finale: Live Radio Tuner */}
          {liveStations.length > 0 && (
            <LiveRadioTuner 
              station={liveStations[0]} 
              onPress={() => router.push('/view-all?type=live')}
            />
          )}
          
          <View style={{ marginTop: 24, marginBottom: 40, alignItems: 'center' }}>
            <AppBannerAd />
          </View>
          
        </Animated.ScrollView>
      </View>
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F', // Dark minimal background
    backgroundColor: '#0F0F0F',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F0F0F',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  seeAll: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    fontWeight: '500',
  },
  
  // Staff Picks Rows
  staffPickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  staffPickCoverWrap: {
    position: 'relative',
  },
  staffPickCover: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: COLORS.cardAlt,
  },
  durationBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  staffPickInfo: {
    flex: 1,
    marginLeft: 12,
  },
  staffPickTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 4,
  },
  staffPickStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  staffPickStatText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
  },
  ellipsisBtn: {
    padding: 8,
  },

  // Suno Studio Cards
  sunoCard: {
    width: width * 0.42,
    marginRight: 16,
  },
  sunoCoverWrap: {
    position: 'relative',
    marginBottom: 12,
  },
  sunoCover: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    backgroundColor: COLORS.cardAlt,
  },
  sunoDurationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sunoDurationText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  sunoEllipsisBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
  },
  sunoTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  sunoGenre: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginBottom: 4,
  },
  sunoStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sunoStatText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
  },
});
