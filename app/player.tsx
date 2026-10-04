// @ts-nocheck
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator, Modal, Alert, Animated, Easing, PanResponder, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassView as BlurView } from '@/components/GlassView';
import { useRouter } from 'expo-router';
import Slider from '@react-native-community/slider';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as ScreenCapture from 'expo-screen-capture';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import * as Clipboard from 'expo-clipboard';
import { usePlayerStore } from '../store/playerStore';
import { useAIStore } from '../store/aiStore';
import { useOfflineStore } from '../store/offlineStore';
import { useThemeStore, VinylThemeType } from '../store/themeStore';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { useRewardedAd } from '../components/ads/useRewardedAd';
import AppBannerAd from '../components/ads/AppBannerAd';
import ShareCardModal from '../components/ShareCardModal';
import CommentsModal from '../components/CommentsModal';
import { ScrollView, FlatList } from 'react-native';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { useProgress, usePlaybackState, State } from '../store/playerStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GlassBackButton from '../components/GlassBackButton';

const LyricLine = ({ text, isActive, isNext, isPrev, COLORS, fontSize = 22 }: { text: string, isActive: boolean, isNext: boolean, isPrev: boolean, COLORS: any, fontSize?: number }) => {
  const anim = useRef(new Animated.Value(isActive ? 1 : 0)).current;

  useEffect(() => {
    let target = 0;
    if (isActive) target = 1;
    else if (isNext || isPrev) target = 0.4;

    Animated.timing(anim, {
      toValue: target,
      duration: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [isActive, isNext, isPrev]);

  const scale = anim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0.94, 0.97, 1.06]
  });

  // Every line stays readable — only the active one is fully lit.
  const opacity = anim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0.32, 0.55, 1]
  });

  return (
    <Animated.Text
      style={{
        color: isActive ? COLORS.gold : COLORS.textPrimary,
        fontSize,
        lineHeight: Math.round(fontSize * 1.3),
        fontWeight: isActive ? '900' : '700',
        textAlign: 'center',
        opacity,
        transform: [{ scale }]
      }}
    >
      {text || '♪'}
    </Animated.Text>
  );
};

const SyncedLyricsView = ({ lines, activeIndex, COLORS, visible, onSeek, fontSize = 22, style }: {
  lines: { time: number; text: string }[];
  activeIndex: number;
  COLORS: any;
  visible: boolean;
  onSeek?: (seconds: number) => void;
  fontSize?: number;
  style?: any;
}) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const [viewportH, setViewportH] = useState(0);
  const [lineLayouts, setLineLayouts] = useState<{ [key: number]: number }>({});
  const userScrolling = useRef(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [detached, setDetached] = useState(false);
  const activeRef = useRef(activeIndex);
  activeRef.current = activeIndex;

  const shownIndex = Math.max(0, Math.min(activeIndex, lines.length - 1));

  const centre = (index: number, animated: boolean) => {
    if (!scrollViewRef.current || !viewportH || lines.length === 0) return;
    const i = Math.max(0, Math.min(index, lines.length - 1));
    const lineY = lineLayouts[i];
    if (lineY !== undefined) {
      const targetY = Math.max(0, lineY - viewportH / 2 + 20); // 20 is approx half line height
      scrollViewRef.current.scrollTo({ y: targetY, animated });
    }
  };

  useEffect(() => {
    if (!visible || userScrolling.current) return;
    centre(activeIndex, true);
  }, [activeIndex, visible, viewportH, lineLayouts]);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => centre(activeRef.current, false), 80);
    return () => clearTimeout(t);
  }, [visible, viewportH]);

  useEffect(() => () => { if (resumeTimer.current) clearTimeout(resumeTimer.current); }, []);

  const resumeFollow = (delay: number) => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => {
      userScrolling.current = false;
      setDetached(false);
      centre(activeRef.current, true);
    }, delay);
  };

  const half = viewportH ? viewportH / 2 : 120;

  return (
    <View style={[{ flex: 1, overflow: 'hidden' }, style]} onLayout={e => setViewportH(e.nativeEvent.layout.height)}>
      {viewportH > 0 && (
        <ScrollView
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          scrollEventThrottle={16}
          onScrollBeginDrag={() => {
            if (resumeTimer.current) clearTimeout(resumeTimer.current);
            userScrolling.current = true;
            setDetached(true);
          }}
          onScrollEndDrag={() => resumeFollow(3000)}
          onMomentumScrollBegin={() => {
            if (userScrolling.current && resumeTimer.current) clearTimeout(resumeTimer.current);
          }}
          onMomentumScrollEnd={() => { if (userScrolling.current) resumeFollow(3000); }}
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: half, paddingBottom: half }}
        >
          {lines.map((item, index) => (
            <TouchableOpacity
              key={index}
              activeOpacity={0.6}
              disabled={!onSeek}
              onLayout={(e) => {
                const y = e.nativeEvent.layout.y;
                setLineLayouts(prev => ({ ...prev, [index]: y }));
              }}
              onPress={() => {
                if (resumeTimer.current) clearTimeout(resumeTimer.current);
                userScrolling.current = false;
                setDetached(false);
                onSeek?.(item.time / 1000);
                centre(index, true);
              }}
              style={{ paddingVertical: 12 }}
            >
              <LyricLine
                text={item.text}
                isActive={index === shownIndex}
                isNext={index === shownIndex + 1}
                isPrev={index === shownIndex - 1}
                COLORS={COLORS}
                fontSize={fontSize}
              />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {detached && (
        <TouchableOpacity
          onPress={() => resumeFollow(0)}
          activeOpacity={0.85}
          style={{ position: 'absolute', bottom: 10, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.7)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}
        >
          <Ionicons name="locate" size={14} color={COLORS.gold} />
          <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '600' }}>Follow song</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};


const { width } = Dimensions.get('window');

export default function PlayerScreen() {
  const { COLORS, vinylTheme, setVinylTheme } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  const scrollY = useRef(new Animated.Value(0)).current;
  const { showAd } = useRewardedAd();
  const insets = useSafeAreaInsets();
  const {
    currentTrack,
    queue,
    reorderQueue,
    removeTrackFromQueue,
    isShuffled,
    repeatMode,
    togglePlayPause,
    skipNext,
    skipPrev,
    seekTo,
    toggleShuffle,
    toggleRepeat,
    playbackRate,
    setPlaybackRate,
    sleepTimerMs,
    setSleepTimer,
    clearSleepTimer,
  } = usePlayerStore();

  const isPlayingRef = useRef(false);
  const viewShotRef = useRef<View>(null);

  const takeAdminScreenshot = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Need media library permissions to save screenshot.');
        return;
      }
      const uri = await captureRef(viewShotRef, { format: 'png', quality: 1 });
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('Success', 'Admin screenshot saved to your gallery!');
    } catch (e: any) {
      Alert.alert('Error', 'Could not save screenshot: ' + e.message);
    }
  };

  const { downloadTrack, isDownloaded, isDownloading, downloadProgress } = useOfflineStore();

  const { position, duration } = useProgress();
  const playbackState = usePlaybackState();
  const isPlaying = playbackState.state === State.Playing || playbackState.state === State.Buffering || playbackState.state === State.Loading;
  const isActuallyPlaying = playbackState.state === State.Playing;
  const positionMs = (position || 0) * 1000;
  const durationMs = (duration || 0) * 1000;
  const [showSleepTimer, setShowSleepTimer] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const currentSpin = useRef(0);
  const spinLoop = useRef<any>(null);
  const [isScratching, setIsScratching] = useState(false);
  const [scratchPosMs, setScratchPosMs] = useState(0);

  // Generate static dust particles so they don't re-render randomly
  const dustParticles = useMemo(() => {
    return [...Array(45)].map((_, i) => ({
      top: `${Math.random() * 90 + 5}%`,
      left: `${Math.random() * 90 + 5}%`,
      width: Math.random() * 5 + 1,
      height: Math.random() * 5 + 1,
      opacity: Math.random() * 0.6 + 0.2,
      rotate: `${Math.random() * 360}deg`,
      isGrime: Math.random() > 0.7
    }));
  }, []);

  const startSpin = () => {
    spinLoop.current = Animated.timing(spinAnim, {
      toValue: currentSpin.current + 1,
      duration: 3000,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    spinLoop.current.start(({ finished }) => {
      if (finished && isPlaying && !isScratching) {
        currentSpin.current += 1;
        startSpin();
      }
    });
  };

  useEffect(() => {
    if (isPlaying && !isScratching) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, { toValue: 1.02, duration: 2000, useNativeDriver: true }),
          Animated.timing(scaleAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        ])
      ).start();
      
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.1, duration: 1500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        ])
      ).start();
      
      waveAnim.setValue(0);
      Animated.loop(
        Animated.timing(waveAnim, { toValue: 1, duration: 2500, easing: Easing.out(Easing.cubic), useNativeDriver: true })
      ).start();
      
      startSpin();
    } else {
      scaleAnim.stopAnimation();
      pulseAnim.stopAnimation();
      waveAnim.stopAnimation();
      if (spinLoop.current) spinLoop.current.stop();
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
      Animated.spring(pulseAnim, { toValue: 1, useNativeDriver: true }).start();
      waveAnim.setValue(0);
    }
    
    return () => {
      if (spinLoop.current) spinLoop.current.stop();
    };
  }, [isPlaying, isScratching]);

  const spin = spinAnim.interpolate({
    inputRange: [-100, 100],
    outputRange: ['-36000deg', '36000deg']
  });

  // Emotional, deep atmospheric colors (Amber, Deep Crimson, Electric Indigo, Neon Cyan, Emerald, Magenta)
  const getEmotionalGradient = (trackId: string | undefined) => {
    const gradients = [
      ['#ff00ff', '#00e5ff', '#ff00ff'],
      ['#ff6f00', '#ff00aa', '#ff6f00'],
      ['#00e676', '#00e5ff', '#00e676'],
      ['#d32f2f', '#ff6f00', '#d32f2f'],
      ['#4b0082', '#ff00ff', '#4b0082'],
    ];
    let hash = 0;
    if (trackId) {
      for (let i = 0; i < trackId.length; i++) {
        hash = trackId.charCodeAt(i) + ((hash << 5) - hash);
      }
    }
    return gradients[Math.abs(hash) % gradients.length];
  };
  const glowGradient = getEmotionalGradient(currentTrack?.id);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setIsScratching(true);
        scaleAnim.setValue(0.95);
        if (spinLoop.current) spinLoop.current.stop();
        
        seekTo(position); // to trigger any position read if needed? Actually TrackPlayer isn't imported here for getPosition. Wait, let's use the local state `positionMs` instead of TrackPlayer.getPosition().
        setScratchPosMs(positionMs);
        spinAnim.stopAnimation((val) => { currentSpin.current = val; });
      },
      onPanResponderMove: (evt, gestureState) => {
        const deltaRot = gestureState.dx / 150;
        spinAnim.setValue(currentSpin.current + deltaRot);
        const deltaMs = (gestureState.dx / width) * 30000;
        const newPos = Math.max(0, Math.min(durationMs, scratchPosMs + deltaMs));
        seekTo(newPos / 1000);
      },
      onPanResponderRelease: (evt, gestureState) => {
        setIsScratching(false);
        const deltaRot = gestureState.dx / 150;
        currentSpin.current += deltaRot;
        
        const deltaMs = (gestureState.dx / width) * 30000;
        const finalPos = Math.max(0, Math.min(durationMs, scratchPosMs + deltaMs));
        seekTo(finalPos / 1000);
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
        if (isPlaying) startSpin();
      }
    })
  ).current;
  const [showFxModal, setShowFxModal] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const session = useAuthStore(s => s.session);
  const profile = useAuthStore(s => s.profile);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [myPlaylists, setMyPlaylists] = useState<any[]>([]);
  const [remixPrompt, setRemixPrompt] = useState('');
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isLyricsFullscreen, setIsLyricsFullscreen] = useState(false);
  const [lyricsLang, setLyricsLang] = useState<'swahili'|'english'>('swahili');
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [eqBands, setEqBands] = useState([0.5, 0.5, 0.5, 0.5, 0.5]); // 60Hz, 230Hz, 910Hz, 3.6kHz, 14kHz

  const parsedLyrics = useMemo(() => {
    let rawLyrics = currentTrack?.lyrics;
    if (lyricsLang === 'swahili' && currentTrack?.lyrics_swahili) rawLyrics = currentTrack.lyrics_swahili;
    if (lyricsLang === 'english' && currentTrack?.lyrics_english) rawLyrics = currentTrack.lyrics_english;
    
    if (!rawLyrics) return null;
    const lines = rawLyrics.split('\n');
    const result: { time: number; text: string }[] = [];
    
    // Accept [mm:ss], [m:ss.x], [mm:ss.xx] and [mm:ss.xxx]
    const lrcRegex = /^\s*\[(\d{1,2}):(\d{1,2}(?:\.\d{1,3})?)\](.*)/;
    let isLrc = false;
    
    lines.forEach(line => {
      const match = line.match(lrcRegex);
      if (match) {
        isLrc = true;
        const minutes = parseInt(match[1]);
        const seconds = parseFloat(match[2]);
        result.push({
          time: (minutes * 60 + seconds) * 1000,
          text: match[3].trim()
        });
      }
    });
    
    if (!isLrc) {
      // Estimate timings for non-LRC lyrics to create pseudo-sync
      const cleanLines = lines.map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('['));
      if (cleanLines.length === 0) return null;
      
      const safeDuration = durationMs || 180000; // default 3 mins if unknown
      
      // Use percentage-based buffering: 12% intro, 75% for vocals
      const introBuffer = safeDuration * 0.12; 
      const usableDuration = safeDuration * 0.75;
      const timePerLine = usableDuration / cleanLines.length;
      
      return cleanLines.map((text, idx) => ({
        time: introBuffer + (idx * timePerLine),
        text
      }));
    }
    
    return result;
  }, [currentTrack, durationMs, lyricsLang]);





  const activeLyricIndex = useMemo(() => {
    if (!parsedLyrics) return -1;
    for (let i = parsedLyrics.length - 1; i >= 0; i--) {
      if (positionMs >= parsedLyrics[i].time) {
        return i;
      }
    }
    return 0;
  }, [positionMs, parsedLyrics]);

  // Auto-scrolling is handled inside <SyncedLyricsView>.

  const openPlaylistModal = async () => {
    if (!session) {
      Alert.alert('Login Required', 'You must be logged in to add songs to a playlist.');
      useAuthStore.getState().disableOfflineMode();
      router.push('/auth');
      return;
    }
    setShowPlaylistModal(true);
    setLoadingPlaylists(true);
    const { data } = await supabase.from('playlists').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false });
    if (data) setMyPlaylists(data);
    setLoadingPlaylists(false);
  };



  const addToPlaylist = async (playlistId: string) => {
    const { error } = await supabase.from('playlist_tracks').insert({
      playlist_id: playlistId,
      track_id: currentTrack?.id
    });
    if (error) {
      if (error.code === '23505') Alert.alert('Notice', 'Song is already in this playlist!');
      else Alert.alert('Error', error.message);
    } else {
      Alert.alert('Success', 'Song added to playlist!');
      setShowPlaylistModal(false);
      
      const pl = myPlaylists.find(p => p.id === playlistId);
      if (pl) {
        await supabase.from('playlists').update({ track_count: (pl.track_count || 0) + 1 }).eq('id', playlistId);
      }
    }
  };

  const [isExportingMp3, setIsExportingMp3] = useState(false);

  // Downloads the song as a real .mp3 file and opens the native share sheet
  // (WhatsApp, Telegram, Save to Files, AirDrop, Bluetooth…)
  const shareAsMp3 = async () => {
    if (!currentTrack?.audio_url) {
      Alert.alert('Error', 'This song has no audio file yet.');
      return;
    }
    try {
      setIsExportingMp3(true);
      const safeName = (currentTrack.title || 'BongoBox Song')
        .replace(/[^a-zA-Z0-9 _-]/g, '')
        .trim()
        .replace(/\s+/g, '_') || 'BongoBox_Song';
      const fileUri = `${FileSystem.documentDirectory}${safeName}.mp3`;
      const info = await FileSystem.getInfoAsync(fileUri);
      if (!info.exists) {
        const url = currentTrack.audio_url.replace(/ /g, '%20');
        await FileSystem.downloadAsync(url, fileUri);
      }
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Saved', `MP3 saved to app documents as ${safeName}.mp3`);
        return;
      }
      await Sharing.shareAsync(fileUri, {
        mimeType: 'audio/mpeg',
        UTI: 'public.mp3',
        dialogTitle: `Share ${currentTrack.title}`,
      });
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to export MP3');
    } finally {
      setIsExportingMp3(false);
    }
  };

  const isOwnAiTrack = !!currentTrack?.is_ai && currentTrack?.user_id === session?.user?.id;

  const handleShare = async () => {
    if (!currentTrack) return;
    
    const options: any[] = [];
    if (isOwnAiTrack) {
      options.push({ text: 'Send MP3 File 🎵', onPress: shareAsMp3 });
    }
    options.push({ text: 'Share Card / Link', onPress: () => setShowShareModal(true) });
    options.push({ text: 'Cancel', style: 'cancel' });

    Alert.alert('Share Song', 'How do you want to share?', options);
  };

  const handleReport = () => {
    Alert.alert(
      "Ripoti Wimbo (Report Track)",
      "Tatizo ni nini na huu wimbo? (What is the issue?)",
      [
        { text: "Ghairi (Cancel)", style: "cancel" },
        { 
          text: "Aina Sio Sahihi (Incorrect Genre)", 
          onPress: () => {
            if (!session) {
              Alert.alert("Kosa", "Tafadhali ingia ili kuripoti.");
              return;
            }
            Alert.alert(
              "Imetumwa kwa AI (Flagged for AI Review)", 
              "Asante! Tutatumia AI yetu na kura za jamii kuchunguza kama huu wimbo ni wa aina sahihi (e.g. Gospel)."
            );
          }
        },
        { 
          text: "Hakimiliki (Copyright)", 
          style: "destructive",
          onPress: async () => {
            if (!session) {
              Alert.alert("Kosa", "Ingia kwenye akaunti yako ili kutoa ripoti.");
              return;
            }
            try {
              const { error } = await supabase.from('copyright_reports').insert({
                track_id: currentTrack?.id,
                reporter_id: session.user.id,
                reason: 'Unauthorized use of copyrighted material'
              });
              if (error) throw error;
              Alert.alert("Asante", "Ripoti yako imepokelewa na itachunguzwa na usimamizi.");
            } catch (e: any) {
              Alert.alert("Kosa", e.message);
            }
          }
        }
      ]
    );
  };

  // Lyrics Slide Animation
  const slideLyricsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slideLyricsAnim, {
      toValue: showLyrics ? 1 : 0,
      duration: 450,
      easing: Easing.bezier(0.25, 1, 0.5, 1),
      useNativeDriver: true,
    }).start();
  }, [showLyrics]);

  const vinylTranslateX = slideLyricsAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -(width * 1.2)],
  });

  const lyricsTranslateX = slideLyricsAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [width * 1.2, 0],
  });

  const vinylOpacity = slideLyricsAnim.interpolate({
    inputRange: [0, 0.5],
    outputRange: [1, 0],
  });

  const lyricsOpacity = slideLyricsAnim.interpolate({
    inputRange: [0.5, 1],
    outputRange: [0, 1],
  });




  useEffect(() => {
    if (!sleepTimerMs) {
      setTimeLeft(null);
      return;
    }
    const interval = setInterval(() => {
      const diff = Math.max(0, sleepTimerMs - Date.now());
      if (diff <= 0) {
        setTimeLeft(null);
        clearInterval(interval);
      } else {
        const m = Math.floor(diff / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${m}:${s.toString().padStart(2, '0')}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [sleepTimerMs]);


  if (!currentTrack) {
    return (
      <View style={styles.container}>
        <GlassBackButton onPress={() => router.back()} style={{ marginTop: 50, marginLeft: 20 }} />
      </View>
    );
  }

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  let currentQuote = "";
  if (parsedLyrics && parsedLyrics.length > 0) {
    if (activeLyricIndex >= 0 && activeLyricIndex < parsedLyrics.length) {
      currentQuote = parsedLyrics[activeLyricIndex].text;
      if (activeLyricIndex + 1 < parsedLyrics.length) {
        currentQuote += `\n${parsedLyrics[activeLyricIndex + 1].text}`;
      }
    } else {
      currentQuote = parsedLyrics[0].text;
      if (parsedLyrics.length > 1) {
        currentQuote += `\n${parsedLyrics[1].text}`;
      }
    }
  }

  return (
    <View style={styles.container} ref={viewShotRef} collapsable={false}>
      {/* Blurred cover art as full-screen background */}
      <View style={StyleSheet.absoluteFill}>
        {currentTrack.cover_url ? (
          <Image
            source={{ uri: currentTrack.cover_url }}
            style={StyleSheet.absoluteFill}
            blurRadius={40}
            cachePolicy="memory-disk"
          />
        ) : null}
        {/* Dark overlay so it's not too bright */}
        <LinearGradient
          colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.75)', 'rgba(0,0,0,0.92)']}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Glass overlay on entire screen */}
      <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
      <Animated.ScrollView 
        style={StyleSheet.absoluteFill} 
        showsVerticalScrollIndicator={false} 
        bounces={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
      >
        <View style={{ minHeight: Dimensions.get('window').height, paddingTop: insets.top + 28, paddingBottom: insets.bottom + 80, justifyContent: 'space-between' }}>

      {/* Header */}
      <View style={styles.header}>
        <GlassBackButton onPress={() => router.back()} />
        <Text style={styles.headerTitle}>Inacheza Sasa</Text>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setShowSleepTimer(true)}>
          <Ionicons name={sleepTimerMs ? "alarm" : "alarm-outline"} size={26} color={sleepTimerMs ? COLORS.gold : COLORS.textPrimary} />
          {timeLeft && <Text style={{ color: COLORS.gold, fontSize: 10, fontWeight: '700', marginTop: 2, width: 56, textAlign: 'center' }} numberOfLines={1} adjustsFontSizeToFit>{timeLeft}</Text>}
        </TouchableOpacity>
      </View>
      {/* Cinematic Album Art OR Lyrics */}
      <View style={{ width: width - 60, height: width - 60, alignSelf: 'center', justifyContent: 'center' }}>
        
        {/* Lyrics View */}
        <Animated.View pointerEvents={showLyrics ? 'auto' : 'none'} style={{ position: 'absolute', width: '100%', height: '100%', transform: [{ translateX: lyricsTranslateX }], opacity: lyricsOpacity, zIndex: showLyrics ? 10 : 1 }}>
          
          {/* Bilingual Toggle */}
          {(currentTrack?.lyrics_swahili || currentTrack?.lyrics_english) && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 }}>
              <View style={{ flexDirection: 'row', backgroundColor: COLORS.cardAlt, borderRadius: 20, padding: 4 }}>
                <TouchableOpacity onPress={() => setLyricsLang('swahili')} style={{ paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16, backgroundColor: lyricsLang === 'swahili' ? COLORS.gold : 'transparent' }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: lyricsLang === 'swahili' ? COLORS.black : COLORS.textSecondary }}>Swahili</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setLyricsLang('english')} style={{ paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16, backgroundColor: lyricsLang === 'english' ? COLORS.gold : 'transparent' }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: lyricsLang === 'english' ? COLORS.black : COLORS.textSecondary }}>English</Text>
                </TouchableOpacity>
              </View>
              
              <TouchableOpacity onPress={() => setIsLyricsFullscreen(true)} style={{ padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20 }}>
                <Ionicons name="expand" size={18} color={COLORS.gold} />
              </TouchableOpacity>
            </View>
          )}


          {parsedLyrics ? (
            parsedLyrics.length > 0 ? (
              <SyncedLyricsView
                lines={parsedLyrics}
                activeIndex={activeLyricIndex}
                COLORS={COLORS}
                visible={showLyrics && !isLyricsFullscreen}
                onSeek={seekTo}
              />
            ) : (
              <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 40 }}>
                <Ionicons name="mic-off-outline" size={64} color={COLORS.textTertiary} />
                <Text style={{ color: COLORS.textSecondary, marginTop: 16, fontSize: 16, fontWeight: '600' }}>No synced lyrics available.</Text>
              </View>
            )
          ) : null}
        </Animated.View>

        {/* Vinyl View */}
        <Animated.View pointerEvents={showLyrics ? 'none' : 'auto'} style={{ position: 'absolute', width: width - 60, height: width - 60, transform: [{ translateX: vinylTranslateX }], opacity: vinylOpacity, zIndex: showLyrics ? 1 : 10 }}>
          <View style={[styles.coverWrap, { marginBottom: 0 }]} {...panResponder.panHandlers}>
            {/* Outer Turntable Platter (Static) */}
            <View style={styles.platterBase}>
              <View style={styles.platterDots} />
            </View>

            {isPlaying && (
              <Animated.View style={[styles.pulseCircle, { transform: [{ scale: pulseAnim }], opacity: pulseAnim.interpolate({ inputRange: [1, 1.15], outputRange: [0.6, 0] }) }]} />
            )}

            {/* Glowing Colorful Light Emitting from the Gap */}
            <Animated.View style={{
              position: 'absolute',
              width: width - 66,
              height: width - 66,
              opacity: pulseAnim.interpolate({ inputRange: [1, 1.15], outputRange: [0.5, 0.95] }),
              transform: [{ rotate: spin }]
            }} pointerEvents="none">
              <View style={{
                flex: 1,
                borderRadius: 1000,
                shadowColor: glowGradient[0],
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.9,
                shadowRadius: 15,
              }}>
                <LinearGradient 
                  colors={glowGradient} 
                  start={{x: 0, y: 0}} 
                  end={{x: 1, y: 1}} 
                  style={{ flex: 1, borderRadius: 1000 }} 
                />
              </View>
            </Animated.View>

            {/* Spinning Vintage Vinyl Record */}
            <Animated.View style={[styles.vinylRecord, { transform: [{ scale: scaleAnim }, { rotate: spin }] }]}>
              {/* Heavy Grime Base Layer */}
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(50, 35, 15, 0.2)' }]} pointerEvents="none" />
              
              {/* Base Vinyl Grooves */}
              <LinearGradient colors={['rgba(255,255,255,0.03)', 'rgba(0,0,0,0.8)', 'rgba(255,255,255,0.03)']} style={StyleSheet.absoluteFill} pointerEvents="none" />
              <View style={[styles.vinylGroove, { width: width - 90, height: width - 90, opacity: 0.3 }]} />
              <View style={[styles.vinylGroove, { width: width - 110, height: width - 110, opacity: 0.5 }]} />
              <View style={[styles.vinylGroove, { width: width - 130, height: width - 130, opacity: 0.8 }]} />
              <View style={[styles.vinylGroove, { width: width - 160, height: width - 160, opacity: 0.4 }]} />
              <View style={[styles.vinylGroove, { width: width - 180, height: width - 180, opacity: 0.6 }]} />
              
              {/* Dirt and Dust Particles */}
              {dustParticles.map((dust, i) => (
                <View key={`dust-${i}`} style={{
                  position: 'absolute',
                  top: dust.top as any,
                  left: dust.left as any,
                  width: dust.width,
                  height: dust.height,
                  backgroundColor: dust.isGrime ? '#3a2b1c' : '#e6dfd3',
                  opacity: dust.opacity,
                  borderRadius: 2,
                  transform: [{ rotate: dust.rotate }]
                }} pointerEvents="none" />
              ))}

              {/* Heavy Vintage Scratches */}
              <View style={[styles.vintageScratch, { width: 140, top: '20%', left: '10%', transform: [{ rotate: '43deg' }], opacity: 0.6 }]} />
              <View style={[styles.vintageScratch, { width: 80, top: '70%', left: '15%', transform: [{ rotate: '-12deg' }], opacity: 0.4 }]} />
              <View style={[styles.vintageScratch, { width: 220, top: '50%', left: '2%', transform: [{ rotate: '88deg' }], opacity: 0.3 }]} />
              <View style={[styles.vintageScratch, { width: 60, top: '85%', left: '60%', transform: [{ rotate: '150deg' }], opacity: 0.7 }]} />
              <View style={[styles.vintageScratch, { width: 110, top: '10%', left: '50%', transform: [{ rotate: '25deg' }], opacity: 0.5 }]} />
              <View style={[styles.vintageScratch, { width: 170, top: '40%', left: '30%', transform: [{ rotate: '-65deg' }], opacity: 0.25 }]} />
              <View style={[styles.vintageScratch, { width: 90, top: '30%', left: '70%', transform: [{ rotate: '10deg' }], opacity: 0.5 }]} />

              {/* Micro Scratches & Scuffs */}
              <View style={[styles.microScratch, { width: 40, top: '45%', left: '20%', transform: [{ rotate: '70deg' }] }]} />
              <View style={[styles.microScratch, { width: 50, top: '65%', left: '40%', transform: [{ rotate: '-30deg' }] }]} />
              <View style={[styles.microScratch, { width: 30, top: '15%', left: '80%', transform: [{ rotate: '110deg' }] }]} />
              <View style={[styles.microScratch, { width: 60, top: '80%', left: '25%', transform: [{ rotate: '5deg' }] }]} />
              
              {/* Vinyl Ring Wear (Aged fading outer ring) */}
              <View style={styles.ringWear} pointerEvents="none" />
              
              {/* Center Label (Cover Art) with Vintage Sepia Fade & Paper Wear */}
              <View style={styles.vinylCenterLabel}>
                {currentTrack.cover_url ? (
                  <Image source={{ uri: currentTrack.cover_url }} style={{ width: '100%', height: '100%' }} transition={300} cachePolicy="memory-disk" />
                ) : (
                  <View style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: '#e6d5b8' }}>
                    <Ionicons name="musical-notes" size={40} color={'#5c4a3d'} />
                  </View>
                )}
                {/* Vintage Sepia Tint Overlay */}
                <View style={{ ...StyleSheet.absoluteFill, backgroundColor: 'rgba(139, 69, 19, 0.25)' }} pointerEvents="none" />
                {/* Paper Ring Wear Effect on Label */}
                <View style={{ ...StyleSheet.absoluteFill, borderRadius: 1000, borderWidth: 15, borderColor: 'rgba(0,0,0,0.4)' }} pointerEvents="none" />
                <View style={{ ...StyleSheet.absoluteFill, borderRadius: 1000, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)', margin: 4 }} pointerEvents="none" />
                
                {/* Ad Overlay on Vinyl Center */}
                <View style={{ position: 'absolute', width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', transform: [{ scale: 0.65 }] }}>
                  <AppBannerAd />
                </View>
              </View>
              
              {/* Center Spindle Hole */}
              <View style={styles.vinylSpindle} />
            </Animated.View>

            {/* Sharp Vinyl Glare / Scuffed Sheen (STATIC overlay) */}
            <View style={{ position: 'absolute', width: width - 70, height: width - 70, borderRadius: (width - 70) / 2, overflow: 'hidden' }} pointerEvents="none">
              <LinearGradient colors={['transparent', 'rgba(255,255,255,0.12)', 'transparent', 'rgba(255,255,255,0.06)', 'transparent']} start={{x: 0.2, y: 0}} end={{x: 0.8, y: 1}} style={StyleSheet.absoluteFill} />
            </View>


            {/* Professional Tonearm (The Staff/Needle) — fixed position, only disk spins */}
            <View style={[styles.tonearmContainer, { transform: [{ rotate: '18deg' }] }]} pointerEvents="none">
              {/* Base/Pivot */}
              <View style={styles.tonearmBase}>
                <LinearGradient colors={['#333', '#111']} style={StyleSheet.absoluteFill} />
                <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#888', borderWidth: 2, borderColor: '#333' }} />
              </View>
              {/* Main Arm */}
              <LinearGradient colors={['#e0e0e0', '#a0a0a0', '#e0e0e0']} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={styles.tonearmStick} />
              {/* Headshell Joint */}
              <View style={styles.tonearmJoint} />
              {/* Headshell/Needle block */}
              <View style={styles.tonearmHead}>
                <LinearGradient colors={['#2a2a2a', '#111']} style={StyleSheet.absoluteFill} />
                <View style={{ width: 2, height: 4, backgroundColor: 'red', position: 'absolute', bottom: -2, right: 4 }} />
              </View>
            </View>
          </View>
        </Animated.View>
      </View>

      {/* Info & Actions */}
      <View style={styles.infoRow}>
        <View style={styles.infoWrap}>
          {/* Bug 4 Fix: Use numberOfLines={2} so long titles wrap rather than shrink unreadably */}
          <Text style={styles.title} numberOfLines={2}>{currentTrack.title}</Text>
          <TouchableOpacity onPress={() => {
            router.back();
            setTimeout(() => router.push(`/artist/${currentTrack.user_id}`), 100);
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.artist} numberOfLines={1}>{currentTrack.artist_name}</Text>
              {currentTrack.profile?.is_verified && (
                <Ionicons name="checkmark-circle" size={14} color={COLORS.gold} style={{ marginLeft: 4 }} />
              )}
            </View>
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {profile?.is_admin && (
            <TouchableOpacity style={styles.downloadBtn} onPress={takeAdminScreenshot}>
              <Ionicons name="camera" size={26} color={COLORS.gold} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.downloadBtn} onPress={() => setShowCommentsModal(true)}>
            <Ionicons name="chatbubble-ellipses-outline" size={26} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.downloadBtn} onPress={openPlaylistModal}>
            <Ionicons name="list" size={26} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.downloadBtn} onPress={handleShare}>
            {(isSharing || isExportingMp3) ? <ActivityIndicator size="small" color={COLORS.textPrimary} /> : <Ionicons name="share-social-outline" size={26} color={COLORS.textSecondary} />}
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.downloadBtn} 
            onPress={() => {
              // Your own AI songs: export a real MP3 file (save to Files / send to friends)
              if (isOwnAiTrack) {
                shareAsMp3();
                return;
              }
              if (isDownloaded(currentTrack.id) || isDownloading[currentTrack.id]) return;
              Alert.alert(
                "Pakua Wimbo",
                "Tazama tangazo fupi ili kupakua wimbo huu na kusikiliza bila intaneti.",
                [
                  { text: "Ghairi", style: "cancel" },
                  { 
                    text: "Tazama", 
                    onPress: () => {
                      showAd(
                        () => downloadTrack(currentTrack),
                        () => {}
                      );
                    }
                  }
                ]
              );
            }}
          >
            {isDownloading[currentTrack.id] ? (
              <View style={{ alignItems: 'center' }}>
                <ActivityIndicator size="small" color={COLORS.gold} />
                <Text style={{ color: COLORS.gold, fontSize: 10, marginTop: 4, fontWeight: '700' }}>
                  {Math.round((downloadProgress[currentTrack.id] || 0) * 100)}%
                </Text>
              </View>
            ) : (
              <Ionicons 
                name={isDownloaded(currentTrack.id) ? "checkmark-circle" : "cloud-download-outline"} 
                size={28} 
                color={isDownloaded(currentTrack.id) ? COLORS.gold : COLORS.textSecondary} 
              />
            )}
          </TouchableOpacity>
        </View>
      </View>
      <View style={{ marginBottom: 16 }}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={{ paddingHorizontal: 24, gap: 12, alignItems: 'center' }}
        >
          <TouchableOpacity 
            style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              gap: 6, 
              paddingHorizontal: 16, 
              paddingVertical: 8, 
              borderRadius: 20, 
              backgroundColor: showLyrics ? COLORS.gold : COLORS.cardAlt 
            }}
            onPress={() => setShowLyrics(!showLyrics)}
          >
            <Ionicons name="mic-outline" size={16} color={showLyrics ? COLORS.black : COLORS.textSecondary} />
            <Text style={{ 
              color: showLyrics ? COLORS.black : COLORS.textSecondary, 
              fontWeight: '800', 
              fontSize: 12,
              letterSpacing: 1
            }}>
              LYRICS
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              gap: 6, 
              paddingHorizontal: 16, 
              paddingVertical: 8, 
              borderRadius: 20, 
              backgroundColor: playbackRate !== 1.0 ? COLORS.gold : COLORS.cardAlt 
            }}
            onPress={() => setShowFxModal(true)}
          >
            <Ionicons name="color-wand" size={16} color={playbackRate !== 1.0 ? COLORS.black : COLORS.textSecondary} />
            <Text style={{ 
              color: playbackRate !== 1.0 ? COLORS.black : COLORS.textSecondary, 
              fontWeight: '800', 
              fontSize: 12,
              letterSpacing: 1
            }}>
              AUDIO EFFECTS
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              gap: 6, 
              paddingHorizontal: 16, 
              paddingVertical: 8, 
              borderRadius: 20, 
              backgroundColor: showQueueModal ? COLORS.gold : COLORS.cardAlt 
            }}
            onPress={() => setShowQueueModal(true)}
          >
            <Ionicons name="list" size={16} color={showQueueModal ? COLORS.black : COLORS.textSecondary} />
            <Text style={{ 
              color: showQueueModal ? COLORS.black : COLORS.textSecondary, 
              fontWeight: '800', 
              fontSize: 12,
              letterSpacing: 1
            }}>
              UP NEXT
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              gap: 6, 
              paddingHorizontal: 16, 
              paddingVertical: 8, 
              borderRadius: 20, 
              backgroundColor: 'rgba(255, 60, 60, 0.1)' 
            }}
            onPress={handleReport}
          >
            <Ionicons name="warning" size={16} color="#ff5555" />
            <Text style={{ 
              color: '#ff5555', 
              fontWeight: '800', 
              fontSize: 12,
              letterSpacing: 1
            }}>
              REPORT
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Seek Bar */}
      <View style={styles.progressWrap}>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={Math.max(durationMs || 1, positionMs + 1)}
          value={positionMs}
          onSlidingComplete={seekTo}
          minimumTrackTintColor={COLORS.gold}
          maximumTrackTintColor={COLORS.divider}
          thumbTintColor={COLORS.gold}
        />
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatTime(positionMs)}</Text>
          <Text style={styles.timeText}>{formatTime(durationMs)}</Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controlsWrap}>
        <TouchableOpacity style={styles.ctrlBtn} onPress={toggleShuffle}>
          <Ionicons name="shuffle" size={26} color={isShuffled ? COLORS.gold : COLORS.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.ctrlBtn} onPress={skipPrev}>
          <Ionicons name="play-skip-back" size={36} color={COLORS.textPrimary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.playBtn} onPress={togglePlayPause}>
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={36} color={COLORS.black} style={{ marginLeft: isPlaying ? 0 : 4 }} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.ctrlBtn} onPress={skipNext}>
          <Ionicons name="play-skip-forward" size={36} color={COLORS.textPrimary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.ctrlBtn} onPress={toggleRepeat}>
          <Ionicons 
            name={repeatMode === 'one' ? "repeat-sharp" : "repeat"} 
            size={26} 
            color={repeatMode !== 'off' ? COLORS.gold : COLORS.textSecondary} 
          />
          {repeatMode === 'one' && (
            <View style={{ position: 'absolute', backgroundColor: COLORS.darkSurface, borderRadius: 10, width: 12, height: 12, justifyContent: 'center', alignItems: 'center', right: 8, bottom: 8 }}>
              <Text style={{ fontSize: 8, color: COLORS.gold, fontWeight: 'bold' }}>1</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      </View>

      {/* Glassmorphic controls panel at bottom */}
      <BlurView intensity={30} tint="dark" style={{ marginTop: 8, marginHorizontal: 0, overflow: 'hidden', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' }}>
        <View style={{ padding: 24, paddingBottom: 100, backgroundColor: 'rgba(0,0,0,0.25)' }}>
          {/* Lyrics Section & AI Song Section */}
          <View style={{ marginBottom: currentTrack?.is_ai ? 120 : 40 }}>
            {currentTrack?.is_ai ? (
              <>
                {/* About this song Card */}
                <View style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 24, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 8 }}>About this song</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
                    Created on {new Date(currentTrack.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </Text>
                </View>

                {/* Style Description Card */}
                <View style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 24, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Style Description</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 8 }}>
                        <Ionicons name="musical-notes-outline" size={16} color="rgba(255,255,255,0.6)" />
                      </TouchableOpacity>
                      <TouchableOpacity style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 8 }}>
                        <Ionicons name="copy-outline" size={16} color="rgba(255,255,255,0.6)" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  <Text style={{ color: '#fff', fontSize: 15, lineHeight: 24, marginBottom: 20, fontWeight: '500' }}>
                    {(currentTrack as any).ai_prompt || currentTrack.description || "No style description available."}
                  </Text>
                  
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                    <Text style={{ color: '#fff', fontSize: 15 }}>Weirdness</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15 }}>{(currentTrack as any).ai_weirdness || '50%'}</Text>
                  </View>
                  
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                    <Text style={{ color: '#fff', fontSize: 15 }}>Style Influence</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15 }}>{(currentTrack as any).ai_influence || '50%'}</Text>
                  </View>
                  
                  <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 16 }} />
                  
                  <TouchableOpacity>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', fontWeight: '500' }}>See Less</Text>
                  </TouchableOpacity>
                </View>

                {/* Lyrics Card */}
                <View style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 24, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Lyrics</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 8 }}>
                        <Ionicons name="musical-notes-outline" size={16} color="rgba(255,255,255,0.6)" />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 8 }}
                        onPress={async () => {
                          const text = currentTrack.lyrics || currentTrack.lyrics_swahili || currentTrack.lyrics_english;
                          if (text) {
                            await Clipboard.setStringAsync(text);
                            Alert.alert("Copied", "Lyrics copied to clipboard!");
                          }
                        }}
                      >
                        <Ionicons name="copy-outline" size={16} color="rgba(255,255,255,0.6)" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  {parsedLyrics && parsedLyrics.length > 0 ? (
                    <View style={{ height: 350, marginHorizontal: -20, marginBottom: -20 }}>
                      <SyncedLyricsView
                        lines={parsedLyrics}
                        activeIndex={activeLyricIndex}
                        COLORS={COLORS}
                        visible={true}
                        onSeek={seekTo}
                        fontSize={18}
                      />
                    </View>
                  ) : (
                    <Text style={{ color: '#fff', fontSize: 16, lineHeight: 28, fontWeight: '500' }}>
                      {currentTrack.lyrics || currentTrack.lyrics_swahili || currentTrack.lyrics_english || "Lyrics aren't available for this song yet. Check back later!"}
                    </Text>
                  )}
                </View>
              </>
            ) : (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>Lyrics</Text>
                  <TouchableOpacity 
                        style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 8 }}
                        onPress={async () => {
                          const text = currentTrack.lyrics || currentTrack.lyrics_swahili || currentTrack.lyrics_english;
                          if (text) {
                            await Clipboard.setStringAsync(text);
                            Alert.alert("Copied", "Lyrics copied to clipboard!");
                          }
                        }}
                      >
                        <Ionicons name="copy-outline" size={16} color="rgba(255,255,255,0.6)" />
                  </TouchableOpacity>
                </View>
                <BlurView intensity={20} tint="dark" style={{ padding: 20, borderRadius: 16, overflow: 'hidden' }}>
                  {parsedLyrics && parsedLyrics.length > 0 ? (
                    <View style={{ height: 350, marginHorizontal: -20, marginVertical: -20 }}>
                      <SyncedLyricsView
                        lines={parsedLyrics}
                        activeIndex={activeLyricIndex}
                        COLORS={COLORS}
                        visible={true}
                        onSeek={seekTo}
                        fontSize={18}
                      />
                    </View>
                  ) : (
                    <Text style={{ color: COLORS.textSecondary, fontSize: 16, lineHeight: 24, fontWeight: '500' }}>
                      {currentTrack.lyrics || currentTrack.lyrics_swahili || currentTrack.lyrics_english || "Lyrics aren't available for this song yet. Check back later!"}
                    </Text>
                  )}
                </BlurView>
              </>
            )}
          </View>
{/* Up Next Section */}
          <View>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 16 }}>Up Next</Text>
            {queue.slice(0, 10).map((item, idx) => (
              <TouchableOpacity
                key={item.id + '-' + idx}
                activeOpacity={0.7}
                onPress={() => {
                  const { playTrack, queue: q } = usePlayerStore.getState();
                  playTrack(item, q);
                }}
                style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  marginBottom: 12,
                  backgroundColor: currentTrack?.id === item.id ? 'rgba(212,175,55,0.1)' : 'transparent',
                  padding: 8,
                  borderRadius: 12,
                  marginHorizontal: -8
                }}
              >
                <Image source={{ uri: item.cover_url || '' }} style={{ width: 48, height: 48, borderRadius: 8, marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: currentTrack?.id === item.id ? COLORS.gold : COLORS.textPrimary, fontSize: 16, fontWeight: '700' }} numberOfLines={1}>{item.title}</Text>
                  <Text style={{ color: COLORS.textSecondary, fontSize: 14 }} numberOfLines={1}>{item.artist_name}</Text>
                </View>
                {currentTrack?.id === item.id && (
                  <Ionicons name="volume-medium" size={18} color={COLORS.gold} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </BlurView>
      </Animated.ScrollView>





      {/* Sticky Mini Header */}
      <Animated.View 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          opacity: scrollY.interpolate({
            inputRange: [width - 60, width],
            outputRange: [0, 1],
            extrapolate: 'clamp'
          }),
          transform: [{
            translateY: scrollY.interpolate({
              inputRange: [width - 61, width - 60],
              outputRange: [-150, 0],
              extrapolate: 'clamp'
            })
          }],
          zIndex: 100,
        }}
        pointerEvents="box-none"
      >
        <BlurView intensity={40} tint="dark" style={{ paddingTop: insets.top, paddingBottom: 12, paddingHorizontal: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              
              <Image source={{ uri: currentTrack?.cover_url || undefined }} style={{ width: 40, height: 40, borderRadius: 6, marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }} numberOfLines={1}>{currentTrack?.title}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }} numberOfLines={1}>{currentTrack?.artist_name || 'AI Track'}</Text>
              </View>
            </View>
            <TouchableOpacity 
              onPress={togglePlayPause} 
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', marginLeft: 12 }}
            >
              <Ionicons name={isPlaying ? "pause" : "play"} size={22} color="#fff" style={{ marginLeft: isPlaying ? 0 : 2 }} />
            </TouchableOpacity>
          </View>
        </BlurView>
      </Animated.View>


      {/* Sticky Mini Header */}
      <Animated.View 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          opacity: scrollY.interpolate({
            inputRange: [width - 60, width],
            outputRange: [0, 1],
            extrapolate: 'clamp'
          }),
          zIndex: 100,
        }}
        pointerEvents="box-none"
      >
        <BlurView intensity={40} tint="dark" style={{ paddingTop: insets.top, paddingBottom: 12, paddingHorizontal: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <GlassBackButton onPress={() => router.back()} style={{ position: 'relative', top: 0, left: 0, marginRight: 12, width: 40, height: 40 }} />
              <Image source={{ uri: currentTrack?.cover_url || undefined }} style={{ width: 40, height: 40, borderRadius: 6, marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }} numberOfLines={1}>{currentTrack?.title}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }} numberOfLines={1}>{currentTrack?.artist_name || 'AI Track'}</Text>
              </View>
            </View>
            <TouchableOpacity 
              onPress={togglePlayPause} 
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', marginLeft: 12 }}
            >
              <Ionicons name={isPlaying ? "pause" : "play"} size={22} color="#fff" style={{ marginLeft: isPlaying ? 0 : 2 }} />
            </TouchableOpacity>
          </View>
        </BlurView>
      </Animated.View>

      {/* Sleep Timer Modal */}
      <Modal visible={showSleepTimer} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Set Sleep Timer</Text>
            <Text style={styles.modalSub}>Music will pause automatically</Text>
            
            <View style={{ gap: 12, marginTop: 20 }}>
              {[15, 30, 45, 60].map(mins => (
                <TouchableOpacity 
                  key={mins} 
                  style={styles.sleepOptionBtn}
                  onPress={() => { setSleepTimer(mins); setShowSleepTimer(false); }}
                >
                  <Text style={styles.sleepOptionText}>{mins} Minutes</Text>
                  <Ionicons name="time-outline" size={20} color={COLORS.gold} />
                </TouchableOpacity>
              ))}
              
              {sleepTimerMs && (
                <TouchableOpacity 
                  style={[styles.sleepOptionBtn, { backgroundColor: 'rgba(255,50,50,0.1)', borderColor: 'rgba(255,50,50,0.3)' }]}
                  onPress={() => { clearSleepTimer(); setShowSleepTimer(false); }}
                >
                  <Text style={[styles.sleepOptionText, { color: '#ff5555' }]}>Turn Off Timer</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setShowSleepTimer(false)}>
              <Text style={styles.closeModalText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Audio Effects Modal */}
      <Modal visible={showFxModal} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <View>
                <Text style={styles.modalTitle}>Audio Effects</Text>
                <Text style={styles.modalSub}>Speed & Equalizer</Text>
                <Text style={styles.modalSub}>Pitch Adjustment</Text>
              </View>
              <TouchableOpacity onPress={() => setShowFxModal(false)} style={{ padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20 }}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Voice Changer */}
              <View style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: 16, borderRadius: 16, marginBottom: 20 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                  <Text style={{ color: COLORS.textPrimary, fontWeight: '700' }}>Voice Changer</Text>
                  <Text style={{ color: COLORS.textSecondary, fontSize: 12, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>Pitch FX</Text>
                </View>
                
                <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                  <TouchableOpacity onPress={() => setPlaybackRate(1.5)} style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: playbackRate > 1.2 ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: playbackRate > 1.2 ? 'rgba(212,175,55,0.5)' : 'rgba(255,255,255,0.1)' }}>
                    <Text style={{ color: playbackRate > 1.2 ? COLORS.gold : COLORS.textSecondary, fontSize: 14, fontWeight: '600' }}>Chipmunk</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity onPress={() => setPlaybackRate(0.7)} style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: playbackRate === 0.7 ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: playbackRate === 0.7 ? 'rgba(212,175,55,0.5)' : 'rgba(255,255,255,0.1)' }}>
                    <Text style={{ color: playbackRate === 0.7 ? COLORS.gold : COLORS.textSecondary, fontSize: 14, fontWeight: '600' }}>Deep Voice</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity onPress={() => setPlaybackRate(0.85)} style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: playbackRate === 0.85 ? 'rgba(0,191,255,0.2)' : 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: playbackRate === 0.85 ? 'rgba(0,191,255,0.5)' : 'rgba(255,255,255,0.1)' }}>
                    <Text style={{ color: playbackRate === 0.85 ? '#00bfff' : COLORS.textSecondary, fontSize: 14, fontWeight: '600' }}>Underwater</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setPlaybackRate(1.0)} style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: playbackRate === 1.0 ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: playbackRate === 1.0 ? 'rgba(212,175,55,0.5)' : 'rgba(255,255,255,0.1)' }}>
                    <Text style={{ color: playbackRate === 1.0 ? COLORS.gold : COLORS.textSecondary, fontSize: 14, fontWeight: '600' }}>Normal</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>


      {/* Playlist Selection Modal */}
      <Modal visible={showPlaylistModal} transparent={true} animationType="slide" onRequestClose={() => setShowPlaylistModal(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add to Playlist</Text>
            {loadingPlaylists ? (
              <ActivityIndicator color={COLORS.gold} style={{ marginVertical: 40 }} />
            ) : myPlaylists.length === 0 ? (
              <Text style={{ color: COLORS.textSecondary, marginVertical: 20, textAlign: 'center' }}>You don't have any playlists yet.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 300, width: '100%', marginTop: 20 }}>
                {myPlaylists.map(pl => (
                  <TouchableOpacity key={pl.id} style={styles.playlistOption} onPress={() => addToPlaylist(pl.id)}>
                    <Ionicons name="musical-notes" size={24} color={COLORS.gold} />
                    <Text style={styles.playlistOptionText}>{pl.title}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setShowPlaylistModal(false)}>
              <Text style={styles.closeModalText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Queue Modal */}
      <Modal visible={showQueueModal} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={[styles.modalContent, { paddingHorizontal: 0, paddingBottom: 20, maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>Up Next</Text>
            
            {queue.length === 0 ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <Ionicons name="musical-notes-outline" size={60} color={COLORS.textTertiary} />
                <Text style={{ color: COLORS.textSecondary, marginTop: 12, textAlign: 'center' }}>Your queue is empty.</Text>
                <Text style={{ color: COLORS.textTertiary, fontSize: 12, marginTop: 4, textAlign: 'center' }}>Swipe songs in the list to add them here.</Text>
              </View>
            ) : (
              <DraggableFlatList
                data={queue}
                keyExtractor={(item, idx) => item.id + '-' + idx}
                style={{ marginTop: 20, maxHeight: 450 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
                onDragEnd={({ data, from, to }) => {
                  reorderQueue(from, to);
                }}
                renderItem={({ item, getIndex, drag, isActive }: RenderItemParams<any>) => (
                  // Bug 5 Fix: Tap a song in Up Next to play it immediately
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                      const { playTrack, queue: q } = usePlayerStore.getState();
                      playTrack(item, q);
                      setShowQueueModal(false);
                    }}
                    style={{ 
                      flexDirection: 'row', 
                      alignItems: 'center', 
                      marginBottom: 16,
                      backgroundColor: isActive ? 'rgba(255,255,255,0.1)' : currentTrack?.id === item.id ? 'rgba(212,175,55,0.1)' : 'transparent',
                      padding: isActive ? 8 : 8,
                      borderRadius: 12,
                      marginHorizontal: -8
                    }}
                  >
                    <Text style={{ color: currentTrack?.id === item.id ? COLORS.gold : COLORS.textTertiary, fontSize: 12, width: 24, fontWeight: '700' }}>{(getIndex() || 0) + 1}</Text>
                    <Image source={{ uri: item.cover_url }} style={{ width: 44, height: 44, borderRadius: 8, marginRight: 12 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: currentTrack?.id === item.id ? COLORS.gold : COLORS.textPrimary, fontSize: 16, fontWeight: '700' }} numberOfLines={1}>{item.title}</Text>
                      <Text style={{ color: COLORS.textSecondary, fontSize: 14 }} numberOfLines={1}>{item.artist_name}</Text>
                    </View>
                    {currentTrack?.id === item.id && (
                      <Ionicons name="volume-medium" size={18} color={COLORS.gold} style={{ marginRight: 4 }} />
                    )}
                    <TouchableOpacity onLongPress={drag} delayLongPress={150} style={{ padding: 12 }}>
                      <Ionicons name="reorder-three" size={24} color={COLORS.textTertiary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removeTrackFromQueue(getIndex() || 0)} style={{ padding: 12, marginRight: -12 }}>
                      <Ionicons name="close-circle-outline" size={20} color={COLORS.textTertiary} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                )}
              />
            )}

            <TouchableOpacity style={[styles.closeModalBtn, { marginHorizontal: 20, marginBottom: 0 }]} onPress={() => setShowQueueModal(false)}>
              <Text style={styles.closeModalText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Fullscreen Lyrics Modal */}
      <Modal visible={isLyricsFullscreen} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(10,10,12,0.98)', paddingTop: 50 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 16 }}>
            <Text style={{ color: COLORS.textPrimary, fontSize: 18, fontWeight: '800' }}>Lyrics</Text>
            <TouchableOpacity onPress={() => setIsLyricsFullscreen(false)} style={{ padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 24 }}>
              <Ionicons name="contract" size={24} color={COLORS.gold} />
            </TouchableOpacity>
          </View>
          {/* ... existing fullscreen lyrics ... */}
          {parsedLyrics ? (
            <SyncedLyricsView
              lines={parsedLyrics}
              activeIndex={activeLyricIndex}
              COLORS={COLORS}
              visible={isLyricsFullscreen}
              onSeek={seekTo}
              fontSize={26}
            />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: COLORS.textSecondary }}>No synced lyrics available.</Text>
            </View>
          )}
        </View>
      </Modal>

      <ShareCardModal 
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
        track={currentTrack}
        quote={currentQuote}
      />

      <CommentsModal 
        visible={showCommentsModal} 
        onClose={() => setShowCommentsModal(false)} 
        trackId={currentTrack.id} 
      />
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 8 },
  iconBtn: { padding: 8, width: 56, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 14 },
  coverWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: 24, position: 'relative', width: width - 60, height: width - 60, alignSelf: 'center' },
  pulseCircle: { position: 'absolute', width: width - 70, height: width - 70, borderRadius: 1000, backgroundColor: COLORS.gold },
  vinylRecord: { width: width - 70, height: width - 70, borderRadius: (width - 70) / 2, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center', elevation: 20, shadowColor: COLORS.gold, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, borderWidth: 1, borderColor: '#111', overflow: 'hidden' },
  platterBase: { position: 'absolute', width: width - 60, height: width - 60, borderRadius: (width - 60) / 2, backgroundColor: '#1a1a1a', borderWidth: 2, borderColor: '#333', alignItems: 'center', justifyContent: 'center' },
  platterDots: { position: 'absolute', width: width - 64, height: width - 64, borderRadius: (width - 64) / 2, borderWidth: 8, borderColor: '#2a2a2a', borderStyle: 'dashed' },
  vinylGroove: { position: 'absolute', borderRadius: 1000, borderWidth: 1, borderColor: '#1f1f1f' },
  vintageScratch: { position: 'absolute', height: 1, backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: 1, shadowColor: '#fff', shadowOpacity: 0.3, shadowRadius: 1, shadowOffset: { width: 0, height: 0 } },
  microScratch: { position: 'absolute', height: 0.5, backgroundColor: 'rgba(255,255,255,0.15)' },
  ringWear: { position: 'absolute', width: '85%', height: '85%', top: '7.5%', left: '7.5%', borderRadius: 1000, borderWidth: 30, borderColor: 'rgba(255,255,255,0.02)', borderStyle: 'dotted' },
  vinylCenterLabel: { width: 130, height: 130, borderRadius: 65, overflow: 'hidden', backgroundColor: '#e6d5b8', borderWidth: 4, borderColor: '#3d2b1f' },
  vinylSpindle: { position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: '#8c8c8c', borderWidth: 3, borderColor: '#111' },
  
  tonearmContainer: { position: 'absolute', top: -15, right: 5, width: 60, height: 60, alignItems: 'center', justifyContent: 'center', zIndex: 100, elevation: 100 },
  tonearmBase: { position: 'absolute', width: 48, height: 48, borderRadius: 24, backgroundColor: '#2a2a2a', borderWidth: 2, borderColor: '#111', alignItems: 'center', justifyContent: 'center', zIndex: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 4, overflow: 'hidden' },
  tonearmStick: { position: 'absolute', top: 30, width: 10, height: 130, backgroundColor: '#ccc', zIndex: 1 },
  tonearmJoint: { position: 'absolute', top: 156, width: 16, height: 16, backgroundColor: '#555', zIndex: 2, borderRadius: 3 },
  tonearmHead: { position: 'absolute', top: 168, width: 22, height: 40, backgroundColor: '#111', borderRadius: 4, transform: [{ rotate: '22deg' }, { translateX: -8 }, { translateY: -4 }], borderWidth: 1, borderColor: '#333', overflow: 'hidden', zIndex: 3 },
  closeBtn: { marginTop: 50, marginLeft: 20 },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 32, marginBottom: 16 },
  infoWrap: { flex: 1, paddingRight: 16 },
  title: { color: COLORS.textPrimary, fontSize: 24, fontWeight: '800', marginBottom: 4 },
  artist: { color: COLORS.gold, fontSize: 18, fontWeight: '500' },
  downloadBtn: { padding: 8 },
  progressWrap: { paddingHorizontal: 24, marginBottom: 20 },
  slider: { width: '100%', height: 40 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, marginTop: -10 },
  timeText: { color: COLORS.textTertiary, fontSize: 12, fontVariant: ['tabular-nums'] },
  controlsWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 },
  ctrlBtn: { padding: 10 },
  playBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.gold, justifyContent: 'center', alignItems: 'center' },
  
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: 'rgba(20,20,20,0.85)', padding: 24, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingBottom: 50, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  modalTitle: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  modalSub: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 4 },
  sleepOptionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.cardAlt, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.divider },
  sleepOptionText: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '600' },
  closeModalBtn: { marginTop: 24, padding: 16, borderRadius: 16, alignItems: 'center' },
  closeModalText: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
  playlistOption: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardAlt, padding: 16, borderRadius: 12, marginBottom: 12, width: '100%', gap: 12 },
  playlistOptionText: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
});
