import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  Animated,
  Image,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  UIManager,
  Modal,
  TouchableWithoutFeedback,
  Share,
  RefreshControl,
  ActivityIndicator,
  InteractionManager,
  Easing,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { GlassView as BlurView } from "@/components/GlassView";
import { decode } from "base64-arraybuffer";
import * as Sharing from "expo-sharing";
import { useThemeStore } from "../../store/themeStore";
import { useAIStore } from "../../store/aiStore";
import { useAuthStore } from "../../store/authStore";
import { supabase } from "../../lib/supabase";
import {
  generateSunoTrack,
  generateLyrics,
  fetchSyncedLyricsLrc,
} from "../../lib/sunoApi";
import {
  generateVoiceValidation,
  getVoiceValidationInfo,
  createCustomVoice,
  getCustomVoiceRecord,
  checkVoiceAvailability,
  generateVoiceTest,
  getTaskInfo,
} from "../../lib/sunoApi";
import type { SunoTrackResult } from "../../lib/sunoApi";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { useAudioRecorder, useAudioPlayer, useAudioPlayerStatus, requestRecordingPermissionsAsync, setAudioModeAsync, RecordingPresets } from 'expo-audio';
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import { usePlayerStore, usePlaybackState, State } from "../../store/playerStore";
import { CoverArtModal } from "../../components/CoverArtModal";
import { EditSongDetailsModal } from "../../components/EditSongDetailsModal";
import { PublishSongModal } from "../../components/PublishSongModal";
import { ExtendSongModal } from "../../components/ExtendSongModal";
import {
  DashedChip,
  PlusChip,
  AudioWaveIcon,
  LyricsIcon,
  StylesIcon,
  VoiceFaceIcon,
  VideoIcon,
} from "../../components/ai/CreateChips";
import { SourcePreviewChip } from "../../components/ai/SourcePreviewChip";
import * as Haptics from "expo-haptics";
let FFmpegKit: any = null;
let ReturnCode: any = null;
// Removed ffmpeg-kit-react-native require to prevent Metro Fast Refresh crashes.
// We will rely on backend conversion for video

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Legacy AudioModule removed
let audioError: string | null = null;

const PLACEHOLDERS = [
  "Wimbo mkali wa Bongo Flava...",
  "Mdundo wa Amapiano wa kusisimua...",
  "Wimbo mtamu wa mapenzi...",
  "Mdundo wa Singeli wa kuchangamsha...",
  "Wimbo wa Injili wa kutia moyo...",
];

const LISTENING_TEXTS = [
  "Tunasikiliza...",
  "Imba wimbo wako...",
  "Tunarekodi sauti...",
  "Sikiliza mdundo...",
  "Andaa maneno yako...",
];

// ErrorBoundary removed to prevent Expo Router crash

const TypewriterPlaceholder = ({
  placeholders,
  style,
  glowStyle,
  isMultiline,
}: {
  placeholders: string[];
  style: any;
  glowStyle?: any;
  isMultiline?: boolean;
}) => {
  const [text, setText] = useState("");
  const [cursorVisible, setCursorVisible] = useState(true);
  const glowOpacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    let isDeleting = false;
    let textIndex = 0;
    let charIndex = 0;
    let isMounted = true;

    const type = () => {
      if (!isMounted) return;
      const currentText = placeholders[textIndex];
      if (isDeleting) {
        charIndex--;
        setText(currentText.substring(0, charIndex));
      } else {
        charIndex++;
        setText(currentText.substring(0, charIndex));
      }

      let speed = isDeleting ? 20 : 70;

      if (!isDeleting && charIndex === currentText.length) {
        speed = 2500;
        isDeleting = true;
      } else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        textIndex = (textIndex + 1) % placeholders.length;
        speed = 500;
      }

      timeout = setTimeout(type, speed);
    };

    timeout = setTimeout(type, 100);
    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, [placeholders]);

  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setCursorVisible((v) => !v);
    }, 500);
    return () => clearInterval(cursorInterval);
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View
        style={{
          flex: 1,
          justifyContent: isMultiline ? "flex-start" : "center",
        }}
      >
        <Animated.Text style={style}>
          {text}
          <Text style={{ opacity: cursorVisible ? 1 : 0 }}>|</Text>
        </Animated.Text>

        {glowStyle && (
          <Animated.Text
            style={[
              style,
              glowStyle,
              {
                position: "absolute",
                opacity: glowOpacity,
                top: isMultiline ? 0 : undefined,
              },
            ]}
          >
            {text}
            <Text style={{ opacity: cursorVisible ? 1 : 0 }}>|</Text>
          </Animated.Text>
        )}
      </View>
    </View>
  );
};


export default function AIStudioScreen() {
  const { COLORS } = useThemeStore();
  const {
    tasks,
    addTask,
    updateTask,
    setTasks,
    removeTask,
    personas,
    addPersona,
    togglePersonaFavorite,
    removePersona,
  } = useAIStore();
  const [personaTab, setPersonaTab] = useState<"All" | "Favorites">("All");

  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);


  const { playTrack, currentTrack, togglePlayPause, closePlayer } = usePlayerStore();
  const { state: pbState } = usePlaybackState();
  const isPlayingGlobal = pbState === State.Playing || pbState === State.Buffering;
  
  const spinAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    // NOTE: a native-driven Animated.loop replays from the value it STARTED at.
    // If the disc was paused mid-turn (e.g. at 0.5) the loop would only spin
    // 0.5→1 (half a turn) and jump back. So: finish the current turn, then
    // loop a clean 0→1 (full 360°).
    let active = true;
    let current: Animated.CompositeAnimation | null = null;
    if (isPlayingGlobal) {
      spinAnim.stopAnimation((v) => {
        if (!active) return;
        const progress = ((v % 1) + 1) % 1;
        spinAnim.setValue(progress);
        current = Animated.timing(spinAnim, {
          toValue: 1,
          duration: Math.max(1, 4000 * (1 - progress)),
          easing: Easing.linear,
          useNativeDriver: true,
        });
        current.start(({ finished }) => {
          if (!finished || !active) return;
          spinAnim.setValue(0);
          current = Animated.loop(
            Animated.timing(spinAnim, {
              toValue: 1,
              duration: 4000,
              easing: Easing.linear,
              useNativeDriver: true,
            })
          );
          current.start();
        });
      });
    } else {
      spinAnim.stopAnimation();
    }
    return () => {
      active = false;
      if (current) current.stop();
    };
  }, [isPlayingGlobal]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  const { session, profile, fetchProfile } = useAuthStore() as any;
  const [prompt, setPrompt] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDurationMs, setRecordingDurationMs] = useState(0);
  const [recording, setRecording] = useState<any | null>(null);
  const [volume, setVolume] = useState<number>(0);
  const [recordingTextIndex, setRecordingTextIndex] = useState(0);
  const [isInputExpanded, setIsInputExpanded] = useState(false);
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [isAdvancedMenuOpen, setIsAdvancedMenuOpen] = useState(false);
  const [advancedVariety, setAdvancedVariety] = useState(0.5);
  const [advancedGender, setAdvancedGender] = useState("Male");
  const [advancedTitle, setAdvancedTitle] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);



  const scrollViewRef = useRef<ScrollView>(null);
  const params = useLocalSearchParams();
  const router = useRouter();

  const remixData = useAIStore((s) => s.remixData);
  const setRemixData = useAIStore((s) => s.setRemixData);

  useEffect(() => {
    if (remixData) {
      setSelectedAudioUri(remixData.audioUrl);
      setAudioTitle(remixData.title || "Remix Audio");
      setPrompt(remixData.prompt || "");
      setStylesText(remixData.tags || "");

      // Clear remix data so it doesn't loop
      setRemixData(null);

      setTimeout(() => setIsInputExpanded(true), 400);
    }
  }, [remixData]);



  const fetchUserSongs = async () => {
    if (session?.user?.id && setTasks) {
      const { data, error } = await supabase
        .from("tracks")
        .select("*")
        .eq("user_id", session.user.id)
        .eq("is_ai", true)
        .order("created_at", { ascending: false });

      if (!error && data) {
        const mappedTasks = data.map((track) => ({
          taskId: track.id,
          title: track.title || "Untitled",
          status: "SUCCESS",
          createdAt: new Date(track.created_at).getTime(),
          taskType: "GENERATE",
          tracks: [
            {
              id: track.id,
              title: track.title || "Untitled",
              imageUrl: track.cover_url,
              audioUrl: track.audio_url,
              duration: track.duration_sec,
              status: "SUCCESS",
              caption: track.description,
              genre: track.genre,
              lyrics: track.lyrics,
              prompt: track.lyrics,
              tags: track.genre,
              is_public: track.is_public,
              allow_comments: track.allow_comments,
              allow_remix: track.allow_remix,
            },
          ],
        }));
        // setTasks (aiStore) already keeps songs that are still generating
        setTasks(mappedTasks as any);
      }
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchUserSongs();
    setIsRefreshing(false);
  };

  useEffect(() => {
    fetchUserSongs();
  }, [session?.user?.id, setTasks]);

  // Audio state
  const [isAudioMenuOpen, setIsAudioMenuOpen] = useState(false);

  const [isAudioEditorOpen, setIsAudioEditorOpen] = useState(false);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isSongOptionsOpen, setIsSongOptionsOpen] = useState(false);
  const [isCoverArtModalOpen, setIsCoverArtModalOpen] = useState(false);
  const [isEditSongDetailsModalOpen, setIsEditSongDetailsModalOpen] =
    useState(false);
  const [isPublishSongModalOpen, setIsPublishSongModalOpen] = useState(false);
  const [isExtendModalOpen, setIsExtendModalOpen] = useState(false);
  const [selectedSongTask, setSelectedSongTask] = useState<any>(null);
  const [audioTitle, setAudioTitle] = useState("Untitled");
  const [selectedAudioUri, setSelectedAudioUri] = useState<string | null>(null);
  const hasAudio = !!selectedAudioUri;
  // Video picked from the + menu — Suno uses its soundtrack as the song reference
  const [selectedVideo, setSelectedVideo] = useState<{
    uri: string;
    name: string;
    mimeType?: string;
  } | null>(null);
  const hasSource = hasAudio || !!selectedVideo;
  useEffect(() => {
    if (selectedAudioUri) setSelectedVideo(null);
  }, [selectedAudioUri]);
  const [isPlaying, setIsPlaying] = useState(false);

  // expo-audio hooks
  const audioPlayer = useAudioPlayer(selectedAudioUri);
  // Sample-song player: source is loaded on demand with replace() when the user taps play
  const testPlayer = useAudioPlayer(null);
  
  const mainRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const wizardRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);


  // Voice persona selection for generation
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);

  // Voice test / verification state
  const [testingPersonaId, setTestingPersonaId] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState("");
  const [testAudioUrls, setTestAudioUrls] = useState<Record<string, string>>({}); // personaId -> audioUrl
  const [testSound, setTestSound] = useState<any>(null);
  const [testPlayingId, setTestPlayingId] = useState<string | null>(null);

  const handleTestVoice = async (personaId: string, personaName: string) => {
    if (testingPersonaId) return; // already testing one
    setTestingPersonaId(personaId);
    setTestMessage("Generating voice sample... (~1-2 min)");
    try {
      const taskId = await generateVoiceTest(personaId, personaName);
      // Poll until done
      let audioUrl = "";
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        const info = await getTaskInfo(taskId);
        const status = (info?.status || "").toUpperCase();
        if (status === "SUCCESS") {
          audioUrl = info?.data?.[0]?.audioUrl || (info?.data?.[0] as any)?.audio_url || "";
          break;
        } else if (status === "FAILED" || status === "SENSITIVE_WORD_ERROR") {
          throw new Error("Voice test generation failed. Please try again.");
        }
        const remaining = 60 - i;
        setTestMessage(`Still generating... (~${remaining * 5}s remaining)`);
      }
      if (!audioUrl) throw new Error("Voice test timed out.");
      setTestAudioUrls((prev) => ({ ...prev, [personaId]: audioUrl }));
      setTestMessage("");
    } catch (e: any) {
      setTestMessage("");
      Alert.alert("Voice Test Failed", e.message || "Could not generate test. Try again.");
    } finally {
      setTestingPersonaId(null);
    }
  };

    const handlePlayTestAudio = async (personaId: string) => {
    const url = testAudioUrls[personaId];
    if (!url) return;
    try {
      if (testPlayingId === personaId && testPlayer.playing) {
        testPlayer.pause();
        setTestPlayingId(null);
        return;
      }
      if (testPlayer.playing) {
        testPlayer.pause();
      }
      testPlayer.replace({ uri: url });
      testPlayer.play();
      setTestPlayingId(personaId);
    } catch (e) {
      console.error("Test audio play error", e);
    }
  };

  // Lyrics state
  const [isLyricsMenuOpen, setIsLyricsMenuOpen] = useState(false);
  const [lyricsText, setLyricsText] = useState("");

  // Debounced history save
  useEffect(() => {
    const timeout = setTimeout(() => {
      setLyricsHistory((prev) => {
        const newHistory = prev.slice(0, lyricsHistoryIndex + 1);
        if (newHistory[newHistory.length - 1] !== lyricsText) {
          newHistory.push(lyricsText);
          setLyricsHistoryIndex(newHistory.length - 1);
          return newHistory;
        }
        return prev;
      });
    }, 500);
    return () => clearTimeout(timeout);
  }, [lyricsText]);
  const [lyricsHistory, setLyricsHistory] = useState<string[]>([""]);
    const [lyricsHistoryIndex, setLyricsHistoryIndex] = useState(0);
    const [isGeneratingLyrics, setIsGeneratingLyrics] = useState(false);
    const [isScanningLyrics, setIsScanningLyrics] = useState(false);
    const [isExtractingAudioLyrics, setIsExtractingAudioLyrics] = useState(false);

  // Styles state
  const [isStylesMenuOpen, setIsStylesMenuOpen] = useState(false);
  const [stylesText, setStylesText] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => {
      setStylesHistory((prev) => {
        const newHistory = prev.slice(0, stylesHistoryIndex + 1);
        if (newHistory[newHistory.length - 1] !== stylesText) {
          newHistory.push(stylesText);
          setStylesHistoryIndex(newHistory.length - 1);
          return newHistory;
        }
        return prev;
      });
    }, 500);
    return () => clearTimeout(timeout);
  }, [stylesText]);
  const [stylesHistory, setStylesHistory] = useState<string[]>([""]);
  const [stylesHistoryIndex, setStylesHistoryIndex] = useState(0);

  // ─── Voice Persona / Wizard State ───────────────────────────────────────────
  const [isPersonaModalOpen, setIsPersonaModalOpen] = useState(false);
  const [isVoiceWizardOpen, setIsVoiceWizardOpen] = useState(false);
  // Step 1 = record, Step 2 = preview, Step 3 = name & create
  const [voiceWizardStep, setVoiceWizardStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [personaName, setPersonaName] = useState("");
  const [personaDescription, setPersonaDescription] = useState("");
  const [personaAudioUri, setPersonaAudioUri] = useState<string | null>(null);
  const [verifyAudioUri, setVerifyAudioUri] = useState<string | null>(null);
  const [validateTaskId, setValidateTaskId] = useState<string | null>(null);
  const [validateText, setValidateText] = useState<string | null>(null);
  const [isPersonaGenerating, setIsPersonaGenerating] = useState(false);
  const [personaStatusText, setPersonaStatusText] = useState("");
  // Wizard preview player — source is loaded explicitly in playWizardPreview
  const wizardPlayer = useAudioPlayer(null);
  const wizardPlayerStatus = useAudioPlayerStatus(wizardPlayer);
  const wizardLoadedUriRef = useRef<string | null>(null);

  // Glowing circle animations for voice wizard
  const wizardPulse1 = useRef(new Animated.Value(1)).current;
  const wizardPulse2 = useRef(new Animated.Value(1)).current;
  const wizardGlow = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (!isVoiceWizardOpen) return;
    // Outer ring pulse
    const loop1 = Animated.loop(
      Animated.sequence([
        Animated.timing(wizardPulse1, { toValue: 1.2, duration: 900, useNativeDriver: true }),
        Animated.timing(wizardPulse1, { toValue: 1.0, duration: 900, useNativeDriver: true }),
      ])
    );
    // Inner ring pulse (offset)
    const loop2 = Animated.loop(
      Animated.sequence([
        Animated.timing(wizardPulse2, { toValue: 1.15, duration: 700, useNativeDriver: true }),
        Animated.timing(wizardPulse2, { toValue: 0.95, duration: 700, useNativeDriver: true }),
      ])
    );
    // Glow opacity pulse
    const loop3 = Animated.loop(
      Animated.sequence([
        Animated.timing(wizardGlow, { toValue: 0.9, duration: 800, useNativeDriver: true }),
        Animated.timing(wizardGlow, { toValue: 0.2, duration: 800, useNativeDriver: true }),
      ])
    );
    loop1.start(); loop2.start(); loop3.start();
    return () => { loop1.stop(); loop2.stop(); loop3.stop(); };
  }, [isVoiceWizardOpen]);

  // Wizard recording state (separate from main prompt recording)
  const [wizardRecording, setWizardRecording] = useState<any | null>(null);
  const [isWizardRecording, setIsWizardRecording] = useState(false);
  const [wizardDurationMs, setWizardDurationMs] = useState(0);
  const [wizardVolume, setWizardVolume] = useState(0);
  // Ticker forces the bar visualizer to re-render at ~60fps while recording
  const [vizTick, setVizTick] = useState(0);
  useEffect(() => {
    if (!isWizardRecording) return;
    const startTime = Date.now();
    const id = setInterval(() => {
      setVizTick(t => t + 1);
      setWizardDurationMs(Date.now() - startTime);
    }, 80);
    return () => clearInterval(id);
  }, [isWizardRecording]);

    const startWizardRecording = async () => {
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Permission Denied", "Microphone access is needed to record your voice.");
        return;
      }
      // IMPORTANT: expo-audio's player.pause() deactivates the iOS audio session
      // ~100ms later (it ignores active recorders), which silently kills a recording
      // that just started. So only pause if a preview is actually playing, and wait
      // for that deferred deactivation to pass BEFORE starting the recorder.
      if (isWizardPreviewPlaying || wizardPlayer.playing) {
        try { wizardPlayer.pause(); } catch {}
        setIsWizardPreviewPlaying(false);
        await new Promise((r) => setTimeout(r, 350));
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' });
      // REQUIRED by expo-audio: without this, iOS never creates the recording file.
      // Pass the preset explicitly so a fresh AAC/m4a recorder is always created.
      await wizardRecorder.prepareToRecordAsync(RecordingPresets.HIGH_QUALITY);
      wizardRecorder.record();
      setIsWizardRecording(true);
      setWizardDurationMs(0);
      setWizardVolume(0);
    } catch (err: any) {
      console.error("Failed to start wizard recording", err);
      Alert.alert("Recording Error", err?.message || "Could not start recording.");
    }
  };

  // Wizard preview playback
  const [wizardPreviewSound, setWizardPreviewSound] = useState<any>(null); // Keep state if needed elsewhere, but don't use
  const [isWizardPreviewPlaying, setIsWizardPreviewPlaying] = useState(false);

  const playWizardPreview = async () => {
    if (!wizardPlayer) return;
    try {
      if (isWizardPreviewPlaying) {
        wizardPlayer.pause();
        setIsWizardPreviewPlaying(false);
        return;
      }
      const uriToPlay = voiceWizardStep === 5 ? verifyAudioUri : personaAudioUri;
      if (!uriToPlay) {
        Alert.alert('No Recording', 'Please record your voice first.');
        return;
      }
      // Make sure the file is really there before trying to play it
      if (!uriToPlay.startsWith('http')) {
        const info = await FileSystem.getInfoAsync(uriToPlay);
        if (!info.exists) {
          Alert.alert('Recording Missing', 'The recording could not be found. Please record again.');
          return;
        }
      }
      // Switch the iOS audio session to playback so sound goes to the loudspeaker
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' });
      if (wizardLoadedUriRef.current !== uriToPlay) {
        wizardPlayer.replace({ uri: uriToPlay });
        wizardLoadedUriRef.current = uriToPlay;
      } else {
        await wizardPlayer.seekTo(0);
      }
      wizardPlayer.volume = 1.0;
      wizardPlayer.play();
      setIsWizardPreviewPlaying(true);
    } catch (e) {
      console.error('Wizard preview play error', e);
      setIsWizardPreviewPlaying(false);
      Alert.alert('Playback Error', 'Could not play the recording. Please try recording again.');
    }
  };

  // Reset the play button when the preview finishes
  useEffect(() => {
    if (wizardPlayerStatus?.didJustFinish) {
      setIsWizardPreviewPlaying(false);
      wizardPlayer.seekTo(0).catch(() => {});
    }
  }, [wizardPlayerStatus?.didJustFinish]);

  const stopWizardPreview = async () => {
    try {
      // Only pause when actually playing — pause() deactivates the iOS audio session
      if (wizardPlayer && wizardPlayer.playing) wizardPlayer.pause();
      setIsWizardPreviewPlaying(false);
    } catch (e) {}
  };

  // Clean up preview sound when wizard closes
  useEffect(() => {
    if (!isVoiceWizardOpen) {
      try { if (wizardPlayer.playing) wizardPlayer.pause(); } catch {}
      setIsWizardPreviewPlaying(false);
    }
  }, [isVoiceWizardOpen]);

  const stopWizardRecording = async (save: boolean) => {
    const recordedMs = wizardDurationMs;
    // What the native recorder ACTUALLY captured, in seconds (AVAudioRecorder.currentTime;
    // drops to 0 if iOS interrupted the recording). The on-screen timer is just a JS clock.
    let nativeMs = -1;
    try { nativeMs = (wizardRecorder.currentTime ?? -1) * 1000; } catch {}
    setIsWizardRecording(false);
    setWizardVolume(0);
    try {
      try {
        await wizardRecorder.stop();
      } catch (e) {
        console.warn("wizardRecorder.stop() failed", e);
      }
      const rawUri = wizardRecorder.uri;
      // Back to playback mode so the preview plays through the speaker
      try { await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' }); } catch {}

      if (!save) return;
      // The voice-clone API rejects samples shorter than ~10 seconds
      if (voiceWizardStep === 2 && recordedMs < 10000) {
        Alert.alert("Too Short", "Please record at least 10 seconds of clear singing or speaking.");
        return;
      }
      // Timer ran but the microphone captured (almost) nothing → recording was interrupted
      if (nativeMs >= 0 && nativeMs < 1000 && recordedMs >= 2000) {
        Alert.alert("Recording Interrupted", "The microphone stopped recording. Please tap record and try again.");
        return;
      }
      if (!rawUri) {
        Alert.alert("Recording Failed", "No audio was captured. Please try again.");
        return;
      }

      const srcUri = rawUri.startsWith("file://") ? rawUri : `file://${rawUri}`;

      // Wait (briefly) until iOS has finished writing the file to disk
      let info: any = await FileSystem.getInfoAsync(srcUri);
      for (let i = 0; i < 15 && (!info.exists || !info.size); i++) {
        await new Promise((r) => setTimeout(r, 150));
        info = await FileSystem.getInfoAsync(srcUri);
      }
      if (!info.exists || !info.size) {
        Alert.alert("Recording Failed", "The recording was not saved. Please record again.");
        return;
      }
      // A file this small contains no real audio (just a header) — don't send it
      if (info.size < 8000) {
        Alert.alert("Recording Failed", "No sound was captured. Check that the microphone isn't blocked and record again.");
        return;
      }

      // Copy out of the recorder's cache into a stable location so it can't be
      // overwritten/cleared before we preview or upload it
      const kind = voiceWizardStep === 4 ? "verify" : "sample";
      const ext = (rawUri.match(/\.(\w+)$/)?.[1] || "m4a").toLowerCase();
      const destUri = `${FileSystem.documentDirectory}voice_${kind}_${Date.now()}.${ext}`;
      await FileSystem.copyAsync({ from: srcUri, to: destUri });
      wizardLoadedUriRef.current = null;

      if (voiceWizardStep === 2) {
        setPersonaAudioUri(destUri);
        setVoiceWizardStep(3);
      } else if (voiceWizardStep === 4) {
        setVerifyAudioUri(destUri);
        setVoiceWizardStep(5);
      }
    } catch (err: any) {
      console.error("Failed to stop wizard recording", err);
      Alert.alert("Recording Error", err?.message || "Could not save the recording.");
    }
  };

  useEffect(() => {
    if (params.tool === "Personas") {
      setIsPersonaModalOpen(true);
    }
  }, [params.tool]);

  /**
   * Proper 3-step Suno Custom Voice creation:
   * 1. Upload voice recording to Supabase Storage to get a public URL
   * 2. POST /voice/validate with the URL + timing
   * 3. Poll /voice/validate-info until SUCCESS
   * 4. POST /voice/generate to create the custom voice (persona)
   * 5. Poll /voice/record-info until SUCCESS → get personaId
   */
  // Ref used to cancel the persona creation mid-poll without freezing
  const personaCancelRef = useRef(false);
  // True when the voice list was opened from the Create composer → reopen it after
  const reopenComposerAfterVoiceRef = useRef(false);

  // Map a local audio file to its extension + MIME type for upload
  const getAudioFileType = (uri: string) => {
    const ext = (uri.split("?")[0].match(/\.(\w+)$/)?.[1] || "m4a").toLowerCase();
    const types: Record<string, string> = {
      wav: "audio/wav",
      mp3: "audio/mpeg",
      m4a: "audio/mp4",
      aac: "audio/aac",
      caf: "audio/x-caf",
    };
    return { ext, contentType: types[ext] || "audio/mp4" };
  };

  const handleAnalyzeVoice = async () => {
    if (!personaName.trim()) {
      Alert.alert("Required", "Please provide a name for your voice persona.");
      return;
    }
    if (!personaAudioUri) {
      Alert.alert("Required", "Please record or upload a voice sample first.");
      return;
    }

    personaCancelRef.current = false;
    setIsPersonaGenerating(true);

    InteractionManager.runAfterInteractions(async () => {
      try {
        setPersonaStatusText("Uploading voice sample...");
        let publicVoiceUrl = personaAudioUri;

        if (!personaAudioUri.startsWith("http")) {
          const { ext, contentType } = getAudioFileType(personaAudioUri);
          const fileName = `voice_samples/persona_source_${session?.user?.id}_${Date.now()}.${ext}`;
          const fileBase64 = await FileSystem.readAsStringAsync(personaAudioUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const { error: uploadError } = await supabase.storage
            .from("audio")
            .upload(fileName, decode(fileBase64), { contentType, upsert: true });
          if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
          const { data: urlData } = supabase.storage
            .from("audio")
            .getPublicUrl(fileName);
          publicVoiceUrl = urlData.publicUrl;
        }

        if (personaCancelRef.current) return;

        setPersonaStatusText("Submitting voice for analysis...");
        // API wants whole seconds, end > start. Send a 10–30s segment of the sample.
        const durationSec = Math.floor((wizardDurationMs || 30000) / 1000);
        const vocalEnd = Math.max(10, Math.min(durationSec, 30));
        const taskId = await generateVoiceValidation(
          publicVoiceUrl,
          0,
          vocalEnd,
          "en",
          undefined,
        );

        if (personaCancelRef.current) return;

        setPersonaStatusText("Analyzing your voice... (this takes ~30s)");
        let vText = "";
        for (let i = 0; i < 40; i++) {
          if (personaCancelRef.current) return;
          await new Promise((r) => setTimeout(r, 3500));
          if (personaCancelRef.current) return;

          const info = await getVoiceValidationInfo(taskId);
          if (!info) continue; // transient — retry

          // Documented statuses: wait_processing | processing_validate |
          // processing_validate_fail | wait_validating | success | fail
          if (info.status === "wait_validating" && info.validateInfo) {
            vText = info.validateInfo;
            break;
          }
          if (info.status === "processing_validate_fail" || info.status === "fail") {
            throw new Error(info.errorMessage || "Voice validation failed. Please try a cleaner recording.");
          }
          setPersonaStatusText(`Analyzing your voice... (${i + 1}/40)`);
        }
        if (!vText) throw new Error("Voice analysis timed out. Please try again.");
        if (personaCancelRef.current) return;

        setValidateTaskId(taskId);
        setValidateText(vText);
        setVoiceWizardStep(4);
      } catch (e: any) {
        if (!personaCancelRef.current) {
          Alert.alert("Analysis Failed", e.message || "Something went wrong.");
        }
      } finally {
        personaCancelRef.current = false;
        setIsPersonaGenerating(false);
        setPersonaStatusText("");
      }
    });
  };

  const handleFinalizeVoice = async () => {
    if (!verifyAudioUri || !validateTaskId) {
      Alert.alert("Required", "Please record the verification phrase.");
      return;
    }

    personaCancelRef.current = false;
    setIsPersonaGenerating(true);

    InteractionManager.runAfterInteractions(async () => {
      try {
        setPersonaStatusText("Uploading verification audio...");
        let publicVerifyUrl = verifyAudioUri;

        if (!verifyAudioUri.startsWith("http")) {
          const { ext, contentType } = getAudioFileType(verifyAudioUri);
          const fileName = `voice_samples/persona_verify_${session?.user?.id}_${Date.now()}.${ext}`;
          const fileBase64 = await FileSystem.readAsStringAsync(verifyAudioUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const { error: uploadError } = await supabase.storage
            .from("audio")
            .upload(fileName, decode(fileBase64), { contentType, upsert: true });
          if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
          const { data: urlData } = supabase.storage
            .from("audio")
            .getPublicUrl(fileName);
          publicVerifyUrl = urlData.publicUrl;
        }

        if (personaCancelRef.current) return;

        setPersonaStatusText("Creating your AI voice persona...");
        const createTaskId = await createCustomVoice(
          validateTaskId,
          publicVerifyUrl,
          personaName.trim(),
          personaDescription.trim() || `Custom voice for ${personaName.trim()}`,
          undefined,
          "beginner",
          undefined,
        );

        if (personaCancelRef.current) return;

        setPersonaStatusText("Finalizing your AI voice... (this takes ~1 min)");
        let voiceId = "";
        for (let i = 0; i < 60; i++) {
          if (personaCancelRef.current) return;
          await new Promise((r) => setTimeout(r, 4000));
          if (personaCancelRef.current) return;

          const record = await getCustomVoiceRecord(createTaskId);
          if (!record) continue; // transient — retry

          if (record.status === "success" && record.voiceId) {
            voiceId = record.voiceId;
            break;
          }
          if (record.status === "fail" || record.status === "processing_validate_fail") {
            throw new Error(
              record.errorMessage ||
                "Voice verification failed. Make sure you sing/say the exact phrase shown, in a quiet place.",
            );
          }
          setPersonaStatusText(`Finalizing your AI voice... (${i + 1}/60)`);
        }
        if (!voiceId) throw new Error("Voice creation timed out. Please try again.");

        // Per API docs: confirm the voice is usable before songs depend on it.
        setPersonaStatusText("Getting your voice ready to sing...");
        for (let i = 0; i < 15; i++) {
          if (personaCancelRef.current) return;
          try {
            if (await checkVoiceAvailability(createTaskId)) break;
          } catch {
            break; // availability endpoint failing is non-fatal
          }
          await new Promise((r) => setTimeout(r, 4000));
        }

        addPersona({
          id: voiceId,
          name: personaName.trim(),
          description: personaDescription.trim() || "My cloned voice",
          createdAt: Date.now(),
          type: "voice",
        });
        // Auto-select it so the very next song is sung in this voice
        setSelectedPersonaId(voiceId);

        Alert.alert(
          "🎤 Voice Created!",
          `"${personaName.trim()}" is ready and selected. Your next song will be sung in your voice.`,
        );
        setIsVoiceWizardOpen(false);
        reopenComposerIfNeeded();
        setVoiceWizardStep(1);
        setPersonaName("");
        setPersonaDescription("");
        setPersonaAudioUri(null);
        setVerifyAudioUri(null);
        setValidateTaskId(null);
        setValidateText(null);
        setWizardDurationMs(0);
      } catch (e: any) {
        if (!personaCancelRef.current) {
          Alert.alert("Voice Creation Failed", e.message || "Something went wrong. Please try again.");
        }
      } finally {
        personaCancelRef.current = false;
        setIsPersonaGenerating(false);
        setPersonaStatusText("");
      }
    });
  };

  const handleCancelPersonaCreation = () => {
    personaCancelRef.current = true;
    setIsPersonaGenerating(false);
    setPersonaStatusText("");
    Alert.alert("Cancelled", "Voice persona creation was cancelled.");
  };


  const insets = useSafeAreaInsets();

  const [animationTick, setAnimationTick] = useState(0);
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecordModalOpen) {
      interval = setInterval(() => {
        setAnimationTick((prev) => prev + 1);
        if (isRecording) {
          setVolume(Math.random() * 0.8 + 0.2); // Mocked volume meter
        }
      }, 50);
    }
    return () => clearInterval(interval);
  }, [isRecordModalOpen, isRecording]);

  const handleLyricsChange = (text: string) => {
    setLyricsText(text);
  };

  // Call this onBlur or occasionally to save history
  const saveLyricsToHistory = () => {
    const newHistory = lyricsHistory.slice(0, lyricsHistoryIndex + 1);
    if (newHistory[newHistory.length - 1] !== lyricsText) {
      newHistory.push(lyricsText);
      setLyricsHistory(newHistory);
      setLyricsHistoryIndex(newHistory.length - 1);
    }
  };

  const undoLyrics = () => {
    if (lyricsHistoryIndex > 0) {
      const newIndex = lyricsHistoryIndex - 1;
      setLyricsHistoryIndex(newIndex);
      setLyricsText(lyricsHistory[newIndex]);
    }
  };

  const redoLyrics = () => {
    if (lyricsHistoryIndex < lyricsHistory.length - 1) {
      const newIndex = lyricsHistoryIndex + 1;
      setLyricsHistoryIndex(newIndex);
      setLyricsText(lyricsHistory[newIndex]);
    }
  };

  const handleScanLyrics = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Needed", "Please grant camera permission to scan your lyrics on paper.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        base64: true,
        quality: 0.2, // Reduced quality to keep size under 1MB for OCR API
        allowsEditing: true, // Let user crop to just the lyrics
      });

      if (!result.canceled && result.assets && result.assets.length > 0 && result.assets[0].base64) {
        setIsScanningLyrics(true);
        const base64Image = "data:image/jpeg;base64," + result.assets[0].base64;
        
        const formData = new FormData();
        formData.append("base64Image", base64Image);
        formData.append("language", "eng");
        formData.append("isOverlayRequired", "false");

        // Using free OCR.space API endpoint
        const response = await fetch("https://api.ocr.space/parse/image", {
          method: "POST",
          headers: {
            apikey: "helloworld",
          },
          body: formData,
        });

        const data = await response.json();
        if (data && data.ParsedResults && data.ParsedResults.length > 0) {
          const parsedText = data.ParsedResults[0].ParsedText;
          if (parsedText && parsedText.trim().length > 0) {
            let formattedText = parsedText.trim();
            // Normalize line endings
            formattedText = formattedText.replace(/\r\n/g, '\n');
            // Add an extra blank line before numbers like "1.", "2." or words like "Verse", "Chorus"
            formattedText = formattedText.replace(/\n(\d+[\.\)]\s*|(?:Verse|Chorus|Bridge)\s*\d*:?\s*)/gi, '\n\n$1');
            // Remove any excessive blank lines
            formattedText = formattedText.replace(/\n{3,}/g, '\n\n');

            setLyricsText((prev) => prev ? prev + "\n\n" + formattedText : formattedText);
            Alert.alert("Scan Success", "Lyrics extracted and formatted successfully!");
          } else {
            Alert.alert("No Text Found", "Could not read any text from the image.");
          }
        } else {
          Alert.alert("Scan Error", data?.ErrorMessage?.[0] || "Failed to parse the image. It might be too large or blurry.");
        }
      }
    } catch (err) {
      console.error("Scan lyrics error", err);
      Alert.alert("Error", "An error occurred while scanning. Please try again.");
    } finally {
      setIsScanningLyrics(false);
    }
  };

  const handleExtractLyricsFromMedia = async () => {
    if (!selectedAudioUri && !selectedVideo) {
      Alert.alert("No Media", "Please upload an audio or video file first to extract lyrics.");
      return;
    }
    setIsExtractingAudioLyrics(true);
    try {
      let mediaUrl;
      let kind: "audio" | "video";
      let mimeType;

      if (selectedVideo) {
        mediaUrl = await uploadCreateSource(selectedVideo.uri, "video", selectedVideo.mimeType);
        kind = "video";
        mimeType = selectedVideo.mimeType;
      } else if (selectedAudioUri) {
        mediaUrl = await uploadCreateSource(selectedAudioUri, "audio");
        kind = "audio";
      }

      if (!mediaUrl) throw new Error("Could not upload media for transcription.");

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token || anonKey;

      const res = await fetch(`${supabaseUrl}/functions/v1/transcribe-lyrics`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: mediaUrl, kind, mimeType }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to transcribe lyrics");
      }

      const { lyrics, instrumental } = await res.json();
      if (instrumental) {
        Alert.alert("Instrumental", "No vocals detected in the audio.");
      } else if (lyrics) {
        setLyricsText((prev) => (prev ? prev + "\n\n" + lyrics : lyrics));
        saveLyricsToHistory();
        Alert.alert("Success", "Lyrics extracted successfully!");
      } else {
        Alert.alert("No Lyrics", "Could not extract any lyrics.");
      }
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to extract lyrics.");
    } finally {
      setIsExtractingAudioLyrics(false);
    }
  };

    const handleGenerateLyrics = async () => {
    if (!session?.user?.id) {
      Alert.alert("Sign In Required", "Please sign in to generate lyrics.");
      return;
    }

    const currentCredits = profile?.credits ?? 0;
    const lyricsUsed = profile?.lyrics_used ?? 0;
    const lyricsRemaining = currentCredits - lyricsUsed;

    // No credits at all
    if (currentCredits < 1) {
      Alert.alert(
        "No Credits",
        "You need at least 1 credit to generate lyrics. Each credit gives you 1 free lyrics generation.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Top Up", onPress: () => router.push("/buy-credits") },
        ],
      );
      return;
    }

    // Has credits but used them all up
    if (lyricsRemaining <= 0) {
      Alert.alert(
        "Lyrics Quota Reached",
        `You've used all ${currentCredits} lyrics generation${currentCredits !== 1 ? "s" : ""} for your current credit balance.\n\nTop up to get more!`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Top Up", onPress: () => router.push("/buy-credits") },
        ],
      );
      return;
    }

    if (!lyricsText.trim()) {
      Alert.alert(
        "Need a Prompt",
        "Describe the song you want in the lyrics box before clicking the AI Pen.",
      );
      return;
    }

    setIsGeneratingLyrics(true);
    try {
      const response = await generateLyrics(lyricsText);
      if (response && response.text) {
        setLyricsText(response.text);

        // Push to undo history
        const newHistory = lyricsHistory.slice(0, lyricsHistoryIndex + 1);
        newHistory.push(response.text);
        setLyricsHistory(newHistory);
        setLyricsHistoryIndex(newHistory.length - 1);

        // Pre-fill title and style if kie.ai returned suggestions
        if (response.title && !advancedTitle?.trim()) setAdvancedTitle(response.title);
        if (response.tags && !stylesText?.trim()) {
          const suggested = response.tags.split(',').map((t: string) => t.trim()).filter(Boolean).slice(0, 2);
          if (suggested.length) setStylesText(suggested.join(', '));
        }

        // Deduct 1 from lyrics_used in Supabase
        const newLyricsUsed = lyricsUsed + 1;
        await supabase
          .from('profiles')
          .update({ lyrics_used: newLyricsUsed })
          .eq('id', session.user.id);

        // Update local profile state immediately
        if (profile) {
          useAuthStore.setState({
            profile: { ...profile, lyrics_used: newLyricsUsed },
          });
        }

        // Tell the user how many they have left
        const remaining = lyricsRemaining - 1;
        if (remaining > 0) {
          // Subtle toast-style info — don't be annoying, only show if they have few left
          if (remaining <= 2) {
            Alert.alert(
              "Lyrics Generated ✓",
              `${remaining} lyrics generation${remaining !== 1 ? "s" : ""} remaining with your current credits.`,
              [{ text: "OK" }],
            );
          }
        }
      } else {
        Alert.alert("Error", "Failed to generate lyrics. Please try again.");
      }
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to generate lyrics.");
    } finally {
      setIsGeneratingLyrics(false);
    }
  };


  const saveLyrics = () => {
    // Just close the modal for now, lyrics are preserved in state
    setIsLyricsMenuOpen(false);
    setIsInputExpanded(true);
  };

  const handleStylesChange = (text: string) => {
    setStylesText(text);
    if (text.endsWith(" ") || text.endsWith("\\n")) {
      const newHistory = stylesHistory.slice(0, stylesHistoryIndex + 1);
      if (newHistory[newHistory.length - 1] !== text) {
        newHistory.push(text);
        setStylesHistory(newHistory);
        setStylesHistoryIndex(newHistory.length - 1);
      }
    }
  };

  const undoStyles = () => {
    if (stylesHistoryIndex > 0) {
      const newIndex = stylesHistoryIndex - 1;
      setStylesHistoryIndex(newIndex);
      setStylesText(stylesHistory[newIndex]);
    }
  };

  const redoStyles = () => {
    if (stylesHistoryIndex < stylesHistory.length - 1) {
      const newIndex = stylesHistoryIndex + 1;
      setStylesHistoryIndex(newIndex);
      setStylesText(stylesHistory[newIndex]);
    }
  };

  const saveStyles = () => {
    setIsStylesMenuOpen(false);
    setIsInputExpanded(true);
  };

  // Animated placeholder logic
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const placeholderOpacity = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const waveformAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      // Fade out
      Animated.timing(placeholderOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDERS.length);

        // Fade in and pulse glow
        Animated.parallel([
          Animated.timing(placeholderOpacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(glowOpacity, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.timing(glowOpacity, {
              toValue: 0,
              duration: 1200,
              useNativeDriver: true,
            }),
          ]),
        ]).start();
      });
    }, 4000);

    let recordingInterval: NodeJS.Timeout;
    if (isRecording) {
      recordingInterval = setInterval(() => {
        setRecordingTextIndex((prev) => (prev + 1) % LISTENING_TEXTS.length);
      }, 2500);
      // We no longer loop the fake waveform animation here because it is powered by real audio metering.
    }

    return () => {
      clearInterval(interval);
      if (recordingInterval) clearInterval(recordingInterval);
    };
  }, [isRecording]);

  /** Reset the whole Create studio to a blank state. */
  const clearStudio = () => {
    setPrompt("");
    setLyricsText("");
    setStylesText("");
    setAdvancedTitle("");
    setSelectedAudioUri(null);
    setSelectedVideo(null);
    setAudioTitle("");
    setLyricsHistory([""]);
    setLyricsHistoryIndex(0);
    setStylesHistory([""]);
    setStylesHistoryIndex(0);
    setSelectedPersonaId(null);
    setIsInputExpanded(false);
  };

  const handleGenerate = async () => {
    if (!prompt.trim() && !lyricsText.trim() && !hasSource) return;

    if (!session?.user?.id) {
      Alert.alert(
        "Authentication Required",
        "Please sign in to generate music.",
      );
      return;
    }

    // A cloned voice needs words to sing — without lyrics/prompt the song is instrumental
    const selectedIsVoice =
      !!selectedPersonaId &&
      personas.find((p: any) => p.id === selectedPersonaId)?.type === "voice";
    // (with a video, Suno writes the lyrics itself, so it's allowed)
    if (selectedIsVoice && !prompt.trim() && !lyricsText.trim() && !selectedVideo) {
      Alert.alert(
        "Add lyrics for your voice",
        "Your voice needs words to sing. Add lyrics or describe the song first.",
      );
      return;
    }

    const currentCredits = profile?.credits ?? 0;
    if (currentCredits < 1) {
      Alert.alert(
        "Not Enough Balance",
        "Generating a song costs 1 Credit (500 TSH). Please top up your balance.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Top Up", onPress: () => router.push("/buy-credits") },
        ],
      );
      return;
    }

    // Deduct 1 Credit from Supabase before submitting
    const newCredits = currentCredits - 1;
    const { error: creditError } = await supabase
      .from("profiles")
      .update({ credits: newCredits })
      .eq("id", session.user.id);

    if (creditError) {
      Alert.alert("Error", `Failed to deduct credits. ${creditError.message}`);
      return;
    }

    // Refresh local profile store
    if (typeof fetchProfile === "function") {
      fetchProfile(session.user.id);
    } else {
      useAuthStore.setState({
        profile: { ...profile, credits: newCredits },
      } as any);
    }

    const newTaskId = `generate-${Date.now()}`;
    // Title priority: typed title → first line of lyrics → first words of prompt
    const deriveTitleFromText = (text: string): string => {
      const firstLine = (text || "")
        .split("\n")
        .map((l) =>
          l
            .replace(/\[[^\]]*\]/g, "") // [Verse], [Chorus]
            .replace(/^\s*\(?\d+[.)]\s*/, "") // "1." / "2)"
            .replace(/^\s*(verse|chorus|hook|intro|outro|bridge|pre-chorus|kiitikio|ubeti)\s*\d*\s*[:\-]?\s*/i, "")
            .replace(/["“”*_#]/g, "")
            .trim(),
        )
        .find((l) => l.length > 0);
      if (!firstLine) return "";
      const words = firstLine.split(/\s+/).slice(0, 5).join(" ");
      const clean = words.replace(/[,.;:!?\-]+$/, "").slice(0, 40).trim();
      return clean.charAt(0).toUpperCase() + clean.slice(1);
    };
    const taskTitle =
      advancedTitle.trim() ||
      deriveTitleFromText(lyricsText) ||
      deriveTitleFromText(prompt) ||
      "Untitled Song";

    // Add task in PROCESSING state — it will update to SUCCESS when polling completes
    addTask(newTaskId, taskTitle, "GENERATE");
    updateTask(newTaskId, "PROCESSING");

    // Clear input immediately so the user can compose another track
    const capturedPrompt = prompt;
    const capturedLyrics = lyricsText;
    const capturedStyles = stylesText;
    const capturedAudioUri = selectedAudioUri;
    const capturedVideo = selectedVideo;
    const capturedPersonaId = selectedPersonaId;
    const capturedIsVoice =
      !!capturedPersonaId &&
      personas.find((p: any) => p.id === capturedPersonaId)?.type === "voice";
    // Song submitted → clear the studio so the user starts fresh.
    // (Inputs are captured above and restored if generation fails.)
    const capturedTitle = advancedTitle;
    clearStudio();

    // Run generation in the background so the UI stays responsive
    (async () => {
      try {
        // Suno needs PUBLIC urls — push local picks to our storage first
        let videoUrl: string | undefined;
        let audioUrl: string | undefined;
        if (capturedVideo) {
          videoUrl = await uploadCreateSource(capturedVideo.uri, "video", capturedVideo.mimeType);
        } else if (capturedAudioUri) {
          audioUrl = await uploadCreateSource(capturedAudioUri, "audio");
        }

        const result: SunoTrackResult = await generateSunoTrack(
          videoUrl
            ? {
                // Video: prompt = song idea, lyrics = attachment, Suno writes words if none
                prompt: capturedPrompt,
                lyrics: capturedLyrics || undefined,
                tags: capturedStyles,
                title: taskTitle,
                make_instrumental: false,
                videoUrl,
                personaId: capturedPersonaId || undefined,
                isVoicePersona: capturedIsVoice,
              }
            : {
                prompt: capturedLyrics || capturedPrompt,
                tags: capturedStyles || (!capturedLyrics ? capturedPrompt : ""),
                title: taskTitle,
                make_instrumental: !capturedLyrics && !capturedPrompt,
                audioUrl,
                personaId: capturedPersonaId || undefined,
                isVoicePersona: capturedIsVoice,
              },
        );

        const versions: SunoTrackResult[] =
          result.versions && result.versions.length > 0 ? result.versions : [result];

        // Show ALL versions (Suno makes 2) — each version gets its own row
        const buildTrack = (v: SunoTrackResult, idx: number) => ({
          id: v.id || `${newTaskId}-${idx}`,
          audioUrl: v.audioUrl || "",
          videoUrl: v.videoUrl || "",
          imageUrl: v.imageUrl || "",
          title: `${taskTitle}${versions.length > 1 ? ` (v${idx + 1})` : ""}`,
          duration: v.duration,
          prompt: capturedPrompt || capturedLyrics,
          lyrics: capturedLyrics || v.lyrics || capturedPrompt,
          genre: capturedStyles || "AI Generated",
          tags: capturedStyles || "AI Generated",
          status: "SUCCESS",
          taskId: result.taskId,
        });
        updateTask(newTaskId, "SUCCESS", [buildTrack(versions[0], 0)] as any);
        for (let idx = 1; idx < versions.length; idx++) {
          const extraId = `${newTaskId}-v${idx + 1}`;
          addTask(extraId, `${taskTitle} (v${idx + 1})`, "GENERATE");
          updateTask(extraId, "SUCCESS", [buildTrack(versions[idx], idx)] as any);
        }

        // Persist every version to Supabase so it survives refresh / new phone
        if (session?.user?.id) {
          for (let idx = 0; idx < versions.length; idx++) {
            const v = versions[idx];
            if (!v.audioUrl) continue;
            const versionTitle = `${taskTitle}${versions.length > 1 ? ` (v${idx + 1})` : ""}`;
            (async () => {
              try {
                // 1. Insert the row IMMEDIATELY (with Suno URLs) so a refresh never loses it
                const { data: inserted, error: insertError } = await supabase
                  .from("tracks")
                  .insert({
                    user_id: session.user.id,
                    title: versionTitle,
                    artist_name: profile?.username || "BongoBox Creator",
                    genre: capturedStyles || "AI Generated",
                    lyrics: capturedLyrics || v.lyrics || capturedPrompt || null,
                    cover_url: v.imageUrl || null,
                    audio_url: v.audioUrl,
                    duration_sec: Math.floor(v.duration || 0),
                    is_public: false,
                    is_ai: true,
                  })
                  .select("id")
                  .single();

                if (insertError || !inserted) {
                  console.error("Supabase track insert error:", insertError);
                  Alert.alert(
                    "Song not saved",
                    `"${versionTitle}" was created but could not be saved to your account: ${insertError?.message || "unknown error"}`,
                  );
                  return;
                }
                const rowId = inserted.id;

                // 1b. Fetch Suno's word-level timings → LRC synced lyrics
                if (result.taskId && v.id && capturedLyrics) {
                  fetchSyncedLyricsLrc(result.taskId, v.id).then(async (lrc) => {
                    if (!lrc) return;
                    await supabase.from("tracks").update({ lyrics: lrc }).eq("id", rowId);
                    const localTaskId = idx === 0 ? newTaskId : `${newTaskId}-v${idx + 1}`;
                    updateTask(localTaskId, "SUCCESS", [
                      { ...buildTrack(v, idx), lyrics: lrc },
                    ] as any);
                    // If this song is playing right now, refresh its lyrics live
                    const playing = usePlayerStore.getState().currentTrack;
                    if (playing && (playing.id === v.id || playing.id === rowId)) {
                      usePlayerStore.setState({ currentTrack: { ...playing, lyrics: lrc } as any });
                    }
                  }).catch(() => {});
                }

                // 2. Copy MP3 + cover into our own storage (Suno links expire)
                const updates: Record<string, any> = {};
                const audioFileUri = FileSystem.cacheDirectory + `${rowId}.mp3`;
                await FileSystem.downloadAsync(v.audioUrl, audioFileUri);
                const audioBase64 = await FileSystem.readAsStringAsync(audioFileUri, { encoding: FileSystem.EncodingType.Base64 });
                const { error: audioUploadError } = await supabase.storage
                  .from("audio")
                  .upload(`ai_tracks/${rowId}.mp3`, decode(audioBase64), { contentType: "audio/mpeg", upsert: true });
                if (!audioUploadError) {
                  updates.audio_url = supabase.storage.from("audio").getPublicUrl(`ai_tracks/${rowId}.mp3`).data.publicUrl;
                } else {
                  console.error("Audio upload error:", audioUploadError);
                }

                if (v.imageUrl) {
                  const imageFileUri = FileSystem.cacheDirectory + `${rowId}.jpg`;
                  await FileSystem.downloadAsync(v.imageUrl, imageFileUri);
                  const imageBase64 = await FileSystem.readAsStringAsync(imageFileUri, { encoding: FileSystem.EncodingType.Base64 });
                  const { error: imageUploadError } = await supabase.storage
                    .from("images")
                    .upload(`ai_covers/${rowId}.jpg`, decode(imageBase64), { contentType: "image/jpeg", upsert: true });
                  if (!imageUploadError) {
                    updates.cover_url = supabase.storage.from("images").getPublicUrl(`ai_covers/${rowId}.jpg`).data.publicUrl;
                  }
                }

                if (Object.keys(updates).length > 0) {
                  await supabase.from("tracks").update(updates).eq("id", rowId);
                }
              } catch (err) {
                console.error("Error saving AI track to Supabase:", err);
              }
            })();
          }
        }
      } catch (e: any) {
        updateTask(newTaskId, "FAILED");
        // Give the user their inputs back so they can fix & retry without retyping
        setPrompt(capturedPrompt);
        setLyricsText(capturedLyrics);
        setStylesText(capturedStyles);
        setAdvancedTitle(capturedTitle);
        setSelectedPersonaId(capturedPersonaId);
        setSelectedAudioUri(capturedAudioUri);
        setSelectedVideo(capturedVideo);
        Alert.alert(
          "Generation Failed",
          e.message || "There was an error generating the track. Your credit has been refunded.",
        );
        // Refund the credit on failure
        supabase
          .from("profiles")
          .update({ credits: currentCredits })
          .eq("id", session?.user?.id || "")
          .then(() => {
            if (typeof fetchProfile === "function") fetchProfile(session?.user?.id || "");
          });
      }
    })();

  };

  /**
   * Upload a locally picked audio/video file to Supabase storage and return a
   * PUBLIC url Suno can fetch. Streams the file (no base64) so large videos
   * don't blow up memory.
   */
  const uploadCreateSource = async (
    uri: string,
    kind: "audio" | "video",
    mimeType?: string,
  ): Promise<string> => {
    if (/^https?:\/\//i.test(uri)) return uri; // already public (e.g. remix)

    const extMatch = uri.split("?")[0].match(/\.([a-z0-9]{2,5})$/i);
    const ext = (extMatch?.[1] || (kind === "video" ? "mp4" : "m4a")).toLowerCase();
    const contentType =
      mimeType ||
      (kind === "video"
        ? ext === "mov" ? "video/quicktime" : ext === "webm" ? "video/webm" : "video/mp4"
        : ext === "mp3" ? "audio/mpeg" : ext === "wav" ? "audio/wav" : ext === "ogg" ? "audio/ogg" : "audio/mp4");

    const userId = session?.user?.id || "anon";
    const path = `create_sources/${userId}/${Date.now()}.${ext}`;
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
    const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";
    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token || anonKey;

    const res = await FileSystem.uploadAsync(
      `${supabaseUrl}/storage/v1/object/audio/${path}`,
      uri,
      {
        httpMethod: "POST",
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
          "Content-Type": contentType,
          "x-upsert": "true",
        },
      },
    );
    if (res.status < 200 || res.status >= 300) {
      let msg = res.body;
      try { msg = JSON.parse(res.body)?.message || res.body; } catch {}
      throw new Error(`Could not upload your ${kind}: ${msg}`);
    }
    return supabase.storage.from("audio").getPublicUrl(path).data.publicUrl;
  };

  const handleAudioUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["audio/*", "application/ogg"],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const audioUri = result.assets[0].uri;
        console.log("Selected audio:", audioUri);
        setSelectedAudioUri(audioUri);
        setAudioTitle(
          result.assets[0].name
            ? result.assets[0].name.replace(/\.[^/.]+$/, "")
            : "Uploaded Audio",
        );
        setIsInputExpanded(false);
        setIsAudioMenuOpen(false);
        setTimeout(() => {
          setIsAudioEditorOpen(true);
        }, 400);
      }
    } catch (error) {
      console.error("Error picking audio:", error);
      Alert.alert("Error", "Failed to pick audio file");
    }
  };

  /**
   * Pick a video → Suno takes its soundtrack as the song reference
   * (Generate API `videoUrls`: mp4/mov/webm, ≤ 241s, ≤ 100MB).
   */
  const handleVideoPicker = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission needed", "Allow access to your videos to upload one.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
        allowsEditing: true, // lets the user trim long videos (iOS)
        videoMaxDuration: 241,
        quality: 1,
      });
      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const durationSec = (asset.duration ?? 0) / 1000; // ms → s
      if (durationSec > 241) {
        Alert.alert(
          "Video too long",
          `Videos can be up to 4 minutes (241s). Yours is ${Math.round(durationSec)}s — trim it and try again.`,
        );
        return;
      }
      let size = asset.fileSize ?? 0;
      if (!size) {
        const info = await FileSystem.getInfoAsync(asset.uri);
        size = info.exists ? (info as any).size ?? 0 : 0;
      }
      if (size > 100 * 1024 * 1024) {
        Alert.alert("Video too large", "Videos must be under 100 MB.");
        return;
      }
      const ext = (asset.uri.split("?")[0].match(/\.([a-z0-9]+)$/i)?.[1] || "mp4").toLowerCase();
      if (!["mp4", "mov", "webm", "m4v", "qt"].includes(ext)) {
        Alert.alert("Unsupported format", "Please choose an MP4, MOV or WEBM video.");
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Video replaces any audio source — one reference at a time
      if (audioPlayer?.playing) audioPlayer.pause();
      setSelectedAudioUri(null);
      setAudioTitle("");
      setSelectedVideo({
        uri: asset.uri,
        name: (asset.fileName || "My video").replace(/\.[^/.]+$/, ""),
        mimeType: asset.mimeType || undefined,
      });
    } catch (error) {
      console.error("Error picking video:", error);
      Alert.alert("Error", "Failed to pick video");
    }
  };

  const startRecording = async () => {
    try {
      const permissionResponse = await requestRecordingPermissionsAsync();
      if (permissionResponse.status !== 'granted') {
         return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' });

      mainRecorder.record();
      setIsRecording(true);
      setVolume(0);
      setRecordingDurationMs(0);
      
      // We manually update duration for expo-audio if needed, but we rely on interval above for volume
      let startTime = Date.now();
      let durationInterval = setInterval(() => {
         if (mainRecorder.isRecording) {
            let dur = Date.now() - startTime;
            setRecordingDurationMs(dur);
            if (dur >= 60000) {
               stopRecording(true);
               clearInterval(durationInterval);
            }
         } else {
            clearInterval(durationInterval);
         }
      }, 100);
      
    } catch (err) {
      console.error("Failed to start recording", err);
    }
  };

  const stopRecording = async (submit: boolean) => {
    try {
      if (mainRecorder.isRecording) {
        await mainRecorder.stop();
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' });
      }
      const uri = mainRecorder.uri;
      setIsRecording(false);
      setVolume(0);

      if (submit && uri) {
        console.log("Finished recording real audio:", uri);
        setSelectedAudioUri(uri);
        setIsAudioMenuOpen(false);
        setTimeout(() => {
          setIsAudioEditorOpen(true);
        }, 400);
      }
    } catch (err) {
      console.error("Failed to stop recording", err);
    }
  };

  const handlePlayPause = async () => {
    try {
      if (!selectedAudioUri || !audioPlayer) {
        return;
      }

      if (isPlaying) {
        audioPlayer.pause();
        setIsPlaying(false);
      } else {
        audioPlayer.play();
        setIsPlaying(true);
      }
    } catch (err) {
      console.error("Error playing audio", err);
    }
  };

  useEffect(() => {
    // Rely on audioPlayer hook for cleanup
  }, [audioPlayer]);

  // ── Voice picker opened from the Create composer ──
  // Two sibling <Modal>s can't be shown at once (iOS refuses, Android stacks
  // badly), so hide the composer, show the voice list, then bring it back.
  const openVoicePicker = () => {
    Haptics.selectionAsync().catch(() => {});
    Keyboard.dismiss();
    setIsPlusMenuOpen(false);
    setIsAudioMenuOpen(false);
    reopenComposerAfterVoiceRef.current = isInputExpanded;
    if (isInputExpanded) {
      setIsInputExpanded(false);
      setTimeout(() => setIsPersonaModalOpen(true), 350);
    } else {
      setIsPersonaModalOpen(true);
    }
  };
  const reopenComposerIfNeeded = () => {
    if (reopenComposerAfterVoiceRef.current) {
      reopenComposerAfterVoiceRef.current = false;
      setTimeout(() => setIsInputExpanded(true), 350);
    }
  };
  const closeVoicePicker = () => {
    setIsPersonaModalOpen(false);
    reopenComposerIfNeeded();
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: COLORS.black }]}
        edges={["top"]}
      >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Modal for Expanded Input */}
      <Modal
        visible={isInputExpanded}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          Keyboard.dismiss();
          setIsInputExpanded(false);
        }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View
            style={{
              flex: 1,
              backgroundColor: COLORS.black,
              paddingTop: Math.max(insets.top, Platform.OS === "ios" ? 40 : 20),
            }}
          >
            {/* Create Header */}
            <View style={styles.header}>
              <Text style={[styles.headerTitle, { color: COLORS.textPrimary }]}>
                {hasAudio && audioTitle?.toLowerCase().includes("remix") ? "Remix" : "Create"}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <TouchableOpacity
                  style={[
                    styles.creditsBadge,
                    {
                      paddingHorizontal: 10,
                      borderRadius: 20,
                      backgroundColor: "rgba(255,59,106,0.15)",
                      borderWidth: 0,
                      marginRight: 10,
                    },
                  ]}
                  onPress={() => {
                    Alert.alert(
                      "Clear Everything",
                      "Are you sure you want to clear your lyrics, styles, and audio?",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Clear",
                          style: "destructive",
                          onPress: () => clearStudio(),
                        },
                      ],
                    );
                  }}
                >
                  <Ionicons name="trash-outline" size={20} color="#ff3b6a" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.creditsBadge,
                    {
                      paddingHorizontal: 10,
                      borderRadius: 20,
                      backgroundColor: "rgba(255,255,255,0.1)",
                      borderWidth: 0,
                    },
                  ]}
                  onPress={() => {
                    Keyboard.dismiss();
                    setIsInputExpanded(false);
                  }}
                >
                  <Ionicons name="chevron-down" size={24} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              style={{ flex: 1, paddingHorizontal: 15 }}
            >
              <View style={styles.expandedCard}>
                {/* Top Chips Row */}
                <View style={{ zIndex: 10 }}>
                  <View style={styles.chipsRow}>
                    <PlusChip
                      active={isPlusMenuOpen}
                      onPress={() => {
                        setIsPlusMenuOpen(!isPlusMenuOpen);
                        setIsAudioMenuOpen(false);
                      }}
                    />

                    {selectedVideo ? (
                      <SourcePreviewChip
                        key={selectedVideo.uri}
                        testID="create-chip-video"
                        uri={selectedVideo.uri}
                        label={selectedVideo.name}
                        kind="video"
                        accentColor="#F09819"
                        onClear={() => setSelectedVideo(null)}
                      />
                    ) : !hasAudio ? (
                      <DashedChip
                        testID="create-chip-audio"
                        label="Audio"
                        icon={<AudioWaveIcon />}
                        active={isAudioMenuOpen}
                        onPress={() => {
                          setIsAudioMenuOpen(!isAudioMenuOpen);
                          setIsPlusMenuOpen(false);
                        }}
                      />
                    ) : (
                      <SourcePreviewChip
                        key={selectedAudioUri!}
                        testID="create-chip-audio-preview"
                        uri={selectedAudioUri!}
                        label={audioTitle || "My audio"}
                        kind="audio"
                        accentColor="#34D399"
                        onWillPlay={() => {
                          if (audioPlayer?.playing) audioPlayer.pause();
                          setIsPlaying(false);
                        }}
                        onClear={() => {
                          if (audioPlayer?.playing) audioPlayer.pause();
                          setIsPlaying(false);
                          setSelectedAudioUri(null);
                          setAudioTitle("");
                        }}
                      />
                    )}
                    
                    <DashedChip
                      testID="create-chip-lyrics"
                      label="Lyrics"
                      icon={
                        <LyricsIcon
                          color={lyricsText.trim().length > 0 ? "#34D399" : "rgba(255,255,255,0.85)"}
                        />
                      }
                      active={lyricsText.trim().length > 0}
                      onPress={() => setIsLyricsMenuOpen(true)}
                      onClear={() => setLyricsText("")}
                    />

                    <DashedChip
                      testID="create-chip-styles"
                      label="Styles"
                      icon={
                        <StylesIcon
                          color={stylesText.trim().length > 0 ? "#60A5FA" : "rgba(255,255,255,0.85)"}
                        />
                      }
                      active={stylesText.trim().length > 0}
                      onPress={() => setIsStylesMenuOpen(true)}
                      onClear={() => setStylesText("")}
                    />

                    {/* ── Voice: sing the song in the user's own cloned voice ── */}
                    <DashedChip
                      testID="create-chip-voice"
                      label={
                        selectedPersonaId
                          ? (personas.find((p: any) => p.id === selectedPersonaId)?.name ?? "Voice")
                          : "Voice"
                      }
                      icon={
                        <VoiceFaceIcon
                          color={selectedPersonaId ? "#C8A8FF" : "rgba(255,255,255,0.85)"}
                        />
                      }
                      accentColor="#8250FF"
                      active={!!selectedPersonaId}
                      onPress={openVoicePicker}
                      onClear={() => setSelectedPersonaId(null)}
                    />
                  </View>
                  {isPlusMenuOpen && (
                    <View style={styles.plusMenuPopover}>
                      <TouchableOpacity
                        testID="plus-menu-upload-video"
                        style={styles.plusMenuItem}
                        onPress={() => {
                          setIsPlusMenuOpen(false);
                          handleVideoPicker();
                        }}
                      >
                        <VideoIcon size={20} color="rgba(255,255,255,0.9)" />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.plusMenuItemText}>Upload Video</Text>
                          <Text
                            style={[
                              styles.plusMenuItemText,
                              { fontSize: 11, opacity: 0.5, marginTop: 2 },
                            ]}
                          >
                            We use its sound to create your song
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  )}

                  {isAudioMenuOpen && (
                    <View style={[styles.plusMenuPopover, { left: 50 }]}>
                      <TouchableOpacity
                        style={styles.plusMenuItem}
                        onPress={handleAudioUpload}
                      >
                        <Ionicons
                          name="cloud-upload-outline"
                          size={20}
                          color="rgba(255,255,255,0.9)"
                        />
                        <Text style={styles.plusMenuItemText}>
                          Upload Audio
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.plusMenuItem}
                        onPress={() => {
                          setIsAudioMenuOpen(false);
                          setIsPlusMenuOpen(false);
                          setIsInputExpanded(false);
                          setIsRecordModalOpen(true);
                        }}
                      >
                        <Ionicons
                          name="mic-outline"
                          size={20}
                          color="rgba(255,255,255,0.9)"
                        />
                        <Text style={styles.plusMenuItemText}>
                          Record Audio
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
                {/* Main Text Input */}
                <View style={{ flex: 1, marginTop: 20 }}>
                  {!prompt && (
                    <TypewriterPlaceholder
                      placeholders={PLACEHOLDERS}
                      style={[
                        styles.expandedInput,
                        { color: "rgba(255,255,255,0.4)", marginTop: 0 },
                      ]}
                      glowStyle={{
                        color: "rgba(255, 255, 255, 0.9)",
                        textShadowColor: "rgba(255, 255, 255, 0.8)",
                        textShadowOffset: { width: 0, height: 0 },
                        textShadowRadius: 10,
                      }}
                      isMultiline={true}
                    />
                  )}
                  <TextInput
                    style={[
                      styles.expandedInput,
                      { marginTop: 0, color: prompt ? "#FFF" : "transparent" },
                    ]}
                    placeholder=""
                    placeholderTextColor="transparent"
                    value={prompt}
                    onChangeText={setPrompt}
                    multiline
                    autoFocus
                  />
                </View>
                {/* Bottom Row */}
                <View style={styles.expandedBottomRow}>
                  <View style={styles.modelSelector}>
                    <Text style={styles.modelSelectorText}>v6-dapaz</Text>
                  </View>
                  <View style={styles.expandedActions}>
                    <TouchableOpacity
                      style={styles.expandedMicButton}
                      onPress={() => {
                        setIsInputExpanded(false);
                        setIsRecordModalOpen(true);
                      }}
                    >
                      <Ionicons
                        name="mic-outline"
                        size={24}
                        color="rgba(255,255,255,0.6)"
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.expandedSendButton,
                        !prompt.trim() && !lyricsText.trim() && !hasSource && { opacity: 0.5 },
                      ]}
                      onPress={handleGenerate}
                      disabled={!prompt.trim() && !lyricsText.trim() && !hasSource}
                    >
                      <LinearGradient
                        colors={["#FF512F", "#F09819"]}
                        style={StyleSheet.absoluteFill}
                      />
                      <Ionicons name="arrow-up" size={20} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </KeyboardAvoidingView>
            {/* Record Modal */}
            {/* Advanced Bottom Sheet */}
            {isAdvancedMenuOpen && (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { zIndex: 100, justifyContent: "flex-end" },
                ]}
              >
                <TouchableWithoutFeedback
                  onPress={() => setIsAdvancedMenuOpen(false)}
                >
                  <View
                    style={[
                      StyleSheet.absoluteFill,
                      { backgroundColor: "rgba(0,0,0,0.5)" },
                    ]}
                  />
                </TouchableWithoutFeedback>

                <View style={styles.advancedSheet}>
                  <View style={styles.advancedSheetHandle} />
                  <Text style={styles.advancedSheetTitle}>Advanced</Text>

                  <View style={styles.advancedRow}>
                    <Text style={styles.advancedLabel}>
                      Variety{" "}
                      <Ionicons
                        name="information-circle-outline"
                        size={14}
                        color="rgba(255,255,255,0.4)"
                      />
                    </Text>
                    <View style={styles.sliderTrack}>
                      <View style={styles.sliderTick} />
                      <View style={styles.sliderTick} />
                      <View style={styles.sliderThumb} />
                      <View style={styles.sliderTick} />
                      <View style={styles.sliderTick} />
                    </View>
                    <Text style={styles.advancedValue}>Normal</Text>
                  </View>
                  <View style={styles.advancedRow}>
                    <Text style={styles.advancedLabel}>
                      Vocal Gender{" "}
                      <Ionicons
                        name="information-circle-outline"
                        size={14}
                        color="rgba(255,255,255,0.4)"
                      />
                    </Text>
                    <View style={styles.genderToggle}>
                      <TouchableOpacity
                        onPress={() => setAdvancedGender("Male")}
                        style={{ paddingHorizontal: 12 }}
                      >
                        <Text
                          style={[
                            styles.genderText,
                            advancedGender === "Male" &&
                              styles.genderTextActive,
                          ]}
                        >
                          Male
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setAdvancedGender("Female")}
                        style={{ paddingHorizontal: 12 }}
                      >
                        <Text
                          style={[
                            styles.genderText,
                            advancedGender === "Female" &&
                              styles.genderTextActive,
                          ]}
                        >
                          Female
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={[styles.advancedRow, { paddingVertical: 12 }]}>
                    <Ionicons
                      name="musical-note"
                      size={16}
                      color="rgba(255,255,255,0.5)"
                      style={{ marginRight: 10 }}
                    />
                    <TextInput
                      style={styles.advancedTitleInput}
                      placeholder="Song Title"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      value={advancedTitle}
                      onChangeText={setAdvancedTitle}
                    />
                  </View>
                </View>
              </View>
            )}

            {/* Lyrics Full Sheet */}
            <Modal
              visible={isLyricsMenuOpen}
              animationType="slide"
              transparent={true}
              onRequestClose={() => setIsLyricsMenuOpen(false)}
            >
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={[
                  styles.lyricsSheetContainer,
                  { paddingTop: insets.top + 20 },
                ]}
              >
                {/* Header */}
                <View style={styles.lyricsHeader}>
                  <View style={styles.lyricsToolbar}>
                    <TouchableOpacity
                      style={styles.lyricsToolIcon}
                      onPress={undoLyrics}
                      disabled={lyricsHistoryIndex <= 0}
                    >
                      <Ionicons
                        name="arrow-undo"
                        size={20}
                        color={
                          lyricsHistoryIndex > 0
                            ? "rgba(255,255,255,0.8)"
                            : "rgba(255,255,255,0.3)"
                        }
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.lyricsToolIcon}
                      onPress={redoLyrics}
                      disabled={lyricsHistoryIndex >= lyricsHistory.length - 1}
                    >
                      <Ionicons
                        name="arrow-redo"
                        size={20}
                        color={
                          lyricsHistoryIndex < lyricsHistory.length - 1
                            ? "rgba(255,255,255,0.8)"
                            : "rgba(255,255,255,0.3)"
                        }
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.lyricsToolIcon}
                        onPress={handleScanLyrics}
                        disabled={isScanningLyrics}
                      >
                        {isScanningLyrics ? (
                          <ActivityIndicator size="small" color="#10b981" />
                        ) : (
                          <Ionicons
                            name="camera-outline"
                            size={20}
                            color="#10b981"
                          />
                        )}
                      </TouchableOpacity>
                      {hasSource && (
                        <TouchableOpacity
                          style={styles.lyricsToolIcon}
                          onPress={handleExtractLyricsFromMedia}
                          disabled={isExtractingAudioLyrics}
                        >
                          {isExtractingAudioLyrics ? (
                            <ActivityIndicator size="small" color="#8250FF" />
                          ) : (
                            <Ionicons
                              name="musical-notes-outline"
                              size={20}
                              color="#8250FF"
                            />
                          )}
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles.lyricsToolIcon}
                        onPress={handleGenerateLyrics}
                        disabled={isGeneratingLyrics}
                      >
                      <Ionicons
                        name="sparkles"
                        size={20}
                        color={
                          isGeneratingLyrics
                            ? "rgba(255,255,255,0.3)"
                            : COLORS.gold || "#FF2A75"
                        }
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.lyricsSaveButton}
                      onPress={saveLyrics}
                    >
                      <Ionicons name="checkmark" size={24} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                </View>
                {/* Content */}
                <View style={styles.lyricsContent}>
                  <Text style={styles.lyricsTitle}>Lyrics</Text>

                  <TextInput
                    style={styles.lyricsInput}
                    placeholder="Write lyrics or a prompt, or leave empty for instrumental"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={lyricsText}
                    onChangeText={handleLyricsChange}
                    onBlur={saveLyricsToHistory}
                    multiline
                    maxLength={3000}
                    autoFocus
                    selectionColor="#FF2A75"
                  />

                  <Text style={styles.lyricsCharCount}>
                    {lyricsText.length} / 3000
                  </Text>
                </View>
              </KeyboardAvoidingView>
            </Modal>

            {/* Styles Full Sheet */}
            <Modal
              visible={isStylesMenuOpen}
              animationType="slide"
              transparent={true}
              onRequestClose={() => setIsStylesMenuOpen(false)}
            >
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={[
                  styles.lyricsSheetContainer,
                  { paddingTop: insets.top + 20 },
                ]}
              >
                {/* Header */}
                <View style={styles.lyricsHeader}>
                  <View style={styles.lyricsToolbar}>
                    <TouchableOpacity
                      style={styles.lyricsToolIcon}
                      onPress={undoStyles}
                      disabled={stylesHistoryIndex <= 0}
                    >
                      <Ionicons
                        name="arrow-undo"
                        size={20}
                        color={
                          stylesHistoryIndex > 0
                            ? "rgba(255,255,255,0.8)"
                            : "rgba(255,255,255,0.3)"
                        }
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.lyricsToolIcon}
                      onPress={redoStyles}
                      disabled={stylesHistoryIndex >= stylesHistory.length - 1}
                    >
                      <Ionicons
                        name="arrow-redo"
                        size={20}
                        color={
                          stylesHistoryIndex < stylesHistory.length - 1
                            ? "rgba(255,255,255,0.8)"
                            : "rgba(255,255,255,0.3)"
                        }
                      />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.lyricsToolIcon}>
                      <Ionicons
                        name="bookmark-outline"
                        size={20}
                        color="rgba(255,255,255,0.8)"
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.lyricsSaveButton}
                      onPress={saveStyles}
                    >
                      <Ionicons name="checkmark" size={24} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                </View>
                {/* Content */}
                <View style={styles.lyricsContent}>
                  <Text style={styles.lyricsTitle}>Styles</Text>

                  <TextInput
                    style={styles.lyricsInput}
                    placeholder="Describe what you want your song to sound like"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={stylesText}
                    onChangeText={handleStylesChange}
                    multiline
                    maxLength={3000}
                    autoFocus
                    selectionColor="#FF2A75"
                  />

                  {/* Suggestion Chips Row */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ maxHeight: 60, flexGrow: 0, marginBottom: 10 }}
                    contentContainerStyle={{
                      alignItems: "center",
                      paddingBottom: 10,
                    }}
                  >
                    <TouchableOpacity
                      style={[
                        styles.lyricsIconButton,
                        {
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          marginRight: 10,
                          backgroundColor: "rgba(255,255,255,0.1)",
                        },
                      ]}
                    >
                      <Ionicons
                        name="sync"
                        size={18}
                        color="rgba(255,255,255,0.8)"
                      />
                    </TouchableOpacity>
                    {[
                      "female voice",
                      "cinematic",
                      "electronic",
                      "bongo flava",
                      "acoustic",
                    ].map((suggestion, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={styles.suggestionChip}
                        onPress={() => {
                          const newText =
                            stylesText +
                            (stylesText.length > 0 ? ", " : "") +
                            suggestion;
                          handleStylesChange(newText);
                        }}
                      >
                        <Text style={styles.suggestionChipText}>
                          {suggestion}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </KeyboardAvoidingView>
            </Modal>

            {/* Audio Editor Modal - Minimalist Redesign */}
            <Modal
              visible={isAudioEditorOpen}
              animationType="slide"
              presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
            >
              <View
                style={{
                  flex: 1,
                  backgroundColor: "#09090B",
                  paddingTop: 24,
                  paddingHorizontal: 24,
                }}
              >
                {/* Minimal Header */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "flex-start",
                    marginBottom: 40,
                  }}
                >
                  <TouchableOpacity
                    style={{ padding: 12, marginLeft: -12 }}
                    onPress={() => {
                      setIsAudioEditorOpen(false);
                      setIsInputExpanded(true);
                    }}
                  >
                    <Ionicons name="close" size={24} color="#A1A1AA" />
                  </TouchableOpacity>
                </View>

                {/* Title Input */}
                <View
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                    marginTop: -40,
                  }}
                >
                  <TextInput
                    style={{
                      color: "#FAFAFA",
                      fontSize: 32,
                      fontWeight: "600",
                      textAlign: "center",
                      letterSpacing: 0.5,
                      marginBottom: 8,
                    }}
                    value={audioTitle}
                    onChangeText={setAudioTitle}
                    placeholder="Name your track"
                    placeholderTextColor="#52525B"
                    maxLength={40}
                    selectionColor="#FAFAFA"
                  />
                  <View
                    style={{
                      width: 40,
                      height: 2,
                      backgroundColor: "#3F3F46",
                      marginTop: 12,
                      borderRadius: 1,
                    }}
                  />

                  {/* Minimal Player */}
                  <View style={{ marginTop: 80, alignItems: "center" }}>
                    <TouchableOpacity
                      style={{
                        width: 80,
                        height: 80,
                        borderRadius: 40,
                        borderWidth: 1,
                        borderColor: "#3F3F46",
                        justifyContent: "center",
                        alignItems: "center",
                        backgroundColor: isPlaying ? "#18181B" : "#FAFAFA",
                      }}
                      onPress={handlePlayPause}
                    >
                      <Ionicons
                        name={isPlaying ? "pause" : "play"}
                        size={32}
                        color={isPlaying ? "#FAFAFA" : "#09090B"}
                        style={{ marginLeft: isPlaying ? 0 : 4 }}
                      />
                    </TouchableOpacity>
                    <Text
                      style={{
                        color: "#A1A1AA",
                        marginTop: 24,
                        fontSize: 12,
                        letterSpacing: 2,
                        fontWeight: "500",
                      }}
                    >
                      {isPlaying ? "PLAYING" : "READY"}
                    </Text>
                  </View>
                </View>

                {/* Bottom Actions */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    paddingBottom: 50,
                    alignItems: "center",
                  }}
                >
                  <TouchableOpacity
                    style={{ padding: 16 }}
                    onPress={() => {
                      Alert.alert(
                        "Discard",
                        "Are you sure you want to discard this audio?",
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Discard",
                            style: "destructive",
                            onPress: () => {
                              setAudioTitle("");
                              setSelectedAudioUri(null);
                              setIsAudioEditorOpen(false);
                              setIsInputExpanded(true);
                            },
                          },
                        ],
                      );
                    }}
                  >
                    <Text
                      style={{
                        color: "#71717A",
                        fontSize: 16,
                        fontWeight: "500",
                      }}
                    >
                      Discard
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{
                      backgroundColor: "#FAFAFA",
                      paddingHorizontal: 32,
                      paddingVertical: 16,
                      borderRadius: 30,
                    }}
                    onPress={() => {
                      setIsAudioEditorOpen(false);
                      setIsInputExpanded(true);
                      const newTaskId = `upload-${Date.now()}`;
                      addTask(
                        newTaskId,
                        audioTitle || "Uploaded Audio",
                        "GENERATE",
                      );
                      updateTask(newTaskId, "SUCCESS", [
                        {
                          id: newTaskId,
                          audioUrl: selectedAudioUri || "",
                          videoUrl: "",
                          imageUrl: "",
                          title: audioTitle || "Uploaded Audio",
                          prompt: "uploaded",
                          tags: "uploaded",
                          status: "SUCCESS",
                          createdAt: Date.now(),
                        },
                      ]);
                    }}
                  >
                    <Text
                      style={{
                        color: "#09090B",
                        fontSize: 16,
                        fontWeight: "600",
                      }}
                    >
                      Save Audio
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
      </Modal>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Base Studio View */}
      <View style={{ flex: 1 }}>
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => router.push('/')} style={{ marginRight: 16, padding: 4 }}>
              <Ionicons name="chevron-back" size={26} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: COLORS.textPrimary }]}>
              Studio
            </Text>
          </View>
          <TouchableOpacity
            style={styles.creditsBadge}
            onPress={() => router.push("/buy-credits")}
          >
            <Ionicons name="flash" size={16} color={COLORS.gold} />
            <Text style={styles.creditsText}>{profile?.credits ?? 0}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.subHeader}>
          <Text style={[styles.subHeaderTitle, { color: COLORS.textPrimary }]}>
            My Songs
          </Text>
          <TouchableOpacity>
            <Ionicons name="filter" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.gold}
            />
          }
        >
          {tasks.flatMap((task) => {
            // If the task is successful and has tracks, render a card for each track.
            if (task.status === "SUCCESS" && task.tracks && task.tracks.length > 0) {
              return task.tracks.map((track, trackIndex) => {
                const singleTrackTask = { ...task, tracks: [track] };
                return (
                  <TouchableOpacity
                    key={`${task.taskId}-${track.id || trackIndex}`}
                    style={styles.taskItem}
                    onPress={() => {
                      if (track && track.audioUrl) {
                        playTrack({
                          id: track.id || task.taskId,
                          title: track.title || task.title || "Untitled",
                          audio_url: track.audioUrl,
                          cover_url: track.imageUrl || "https://picsum.photos/100",
                          duration_sec: track.duration || 0,
                          is_ai: true,
                          user_id: session?.user?.id,
                          artist_name: profile?.username || "BongoBox Creator",
                          lyrics: (track as any).lyrics || (track as any).prompt,
                          genre: (track as any).genre,
                        } as any);
                      }
                    }}
                  >
                    <View style={styles.taskImageContainer}>
                      <Image
                        source={{ uri: track?.imageUrl || "https://picsum.photos/100" }}
                        style={styles.taskImage}
                      />
                      {track?.duration ? (
                        <View style={styles.taskDuration}>
                          <Text style={styles.taskDurationText}>
                            {`${Math.floor(track.duration / 60)}:${Math.floor(track.duration % 60).toString().padStart(2, "0")}`}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.taskInfo}>
                      <View style={styles.taskTitleRow}>
                        <Text style={[styles.taskTitle, { color: COLORS.textPrimary }]} numberOfLines={1}>
                          {track.title || task.title || "Untitled Song"}
                        </Text>
                        <Text style={styles.taskVersionTag}>V6-DAPAZ</Text>
                      </View>
                      <Text style={styles.taskSubtitle} numberOfLines={2}>
                        {track.prompt || track.genre || "AI Generated"}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.moreButton}
                      onPress={() => {
                        setSelectedSongTask(singleTrackTask);
                        setIsSongOptionsOpen(true);
                      }}
                    >
                      <Ionicons name="ellipsis-horizontal" size={20} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              });
            }

            // Otherwise, render a single card for the generating/processing state.
            const track = task.tracks?.[0];
            return (
              <TouchableOpacity
                key={task.taskId}
                style={styles.taskItem}
                onPress={() => {
                  if (track && track.audioUrl) {
                    playTrack({
                      id: track.id || task.taskId,
                      title: track.title || task.title || "Untitled",
                      audio_url: track.audioUrl,
                      cover_url: track.imageUrl || "https://picsum.photos/100",
                      duration_sec: track.duration || 0,
                      is_ai: true,
                      user_id: session?.user?.id,
                      artist_name: profile?.username || "BongoBox Creator",
                      lyrics: (track as any).lyrics || (track as any).prompt,
                      genre: (track as any).genre,
                    } as any);
                  }
                }}
              >

                <View style={styles.taskImageContainer}>
                  {task.status === "PENDING" || task.status === "GENERATE" || task.status === "PROCESSING" ? (
                    <View style={[styles.taskImage, { justifyContent: "center", alignItems: "center", backgroundColor: "#222" }]}>
                      <ActivityIndicator color={COLORS.gold} />
                    </View>
                  ) : (
                    <Image source={{ uri: track?.imageUrl || "https://picsum.photos/100" }} style={styles.taskImage} />
                  )}
                  {task.status !== "PENDING" && task.status !== "GENERATE" && task.status !== "PROCESSING" && track?.duration ? (
                    <View style={styles.taskDuration}>
                      <Text style={styles.taskDurationText}>
                        {`${Math.floor(track.duration / 60)}:${Math.floor(track.duration % 60).toString().padStart(2, "0")}`}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.taskInfo}>
                  <View style={styles.taskTitleRow}>
                    <Text style={[styles.taskTitle, { color: COLORS.textPrimary }]} numberOfLines={1}>
                      {task.status === "PENDING" || task.status === "GENERATE" || task.status === "PROCESSING" ? "Generating song..." : task.title || "Untitled Song"}
                    </Text>
                    <Text style={styles.taskVersionTag}>V6-DAPAZ</Text>
                  </View>
                  <Text style={styles.taskSubtitle} numberOfLines={2}>
                    {task.status === "PENDING" || task.status === "GENERATE" || task.status === "PROCESSING" ? "Hang tight, the AI is composing your track..." : track?.prompt || track?.genre || "AI Generated"}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.moreButton}
                  onPress={() => {
                    setSelectedSongTask(task);
                    setIsSongOptionsOpen(true);
                  }}
                >
                  <Ionicons name="ellipsis-horizontal" size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
          {tasks.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons
                name="musical-notes-outline"
                size={48}
                color={COLORS.textSecondary}
              />
              <Text style={[styles.emptyText, { color: COLORS.textSecondary }]}>
                No songs yet. Start creating!
              </Text>
            </View>
          )}
        </ScrollView>
        {/* Floating Input Area */}
        {audioError && (
          <View
            style={{
              padding: 10,
              backgroundColor: "red",
              borderRadius: 8,
              margin: 10,
            }}
          >
            <Text style={{ color: "white" }}>Audio Error: {audioError}</Text>
          </View>
        )}
        {currentTrack ? (
          <View style={styles.inputWrapper}>
            <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
            {Platform.OS === "android" && (
              <LinearGradient colors={["rgba(30, 30, 30, 0.95)", "rgba(20, 20, 20, 0.98)"]} style={StyleSheet.absoluteFill} />
            )}
            <View style={[styles.inputContainer, { alignItems: 'center', paddingVertical: 8 }]}>
              <TouchableOpacity 
                style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }} 
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push("/player");
                }}
              >
                <Animated.Image 
                  source={{ uri: currentTrack.cover_url || "https://picsum.photos/100" }} 
                  style={{ 
                    width: 40, 
                    height: 40, 
                    borderRadius: 20, 
                    marginRight: 12,
                    transform: [{ rotate: spin }] 
                  }} 
                />
                <View style={{ flex: 1, justifyContent: 'center' }}>
                  <Text style={{ color: COLORS.textPrimary, fontWeight: '600', fontSize: 16 }} numberOfLines={1}>
                    {currentTrack.title}
                  </Text>
                  <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                    {currentTrack.artist_name || 'V6-DAPAZ'}
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                togglePlayPause();
              }} style={[styles.micButton, { marginRight: 8, padding: 8 }]}>
                <Ionicons name={isPlayingGlobal ? "pause" : "play"} size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                closePlayer();
              }} style={[styles.micButton, { padding: 8 }]}>
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.inputWrapper}>
            <BlurView
              intensity={80}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          {Platform.OS === "android" && (
            <LinearGradient
              colors={["rgba(30, 30, 30, 0.95)", "rgba(20, 20, 20, 0.98)"]}
              style={StyleSheet.absoluteFill}
            />
          )}
          <View style={styles.inputContainer}>
            <TouchableOpacity
              style={styles.textInputWrapper}
              onPress={() => {
                setIsInputExpanded(true);
              }}
              activeOpacity={1}
            >
              {/* Animated Placeholder overlay */}
              {!prompt && (
                <TypewriterPlaceholder
                  placeholders={PLACEHOLDERS}
                  style={[
                    styles.placeholderText,
                    { color: COLORS.textSecondary },
                  ]}
                  glowStyle={{
                    color: "rgba(255, 255, 255, 0.9)",
                    textShadowColor: "rgba(255, 255, 255, 0.8)",
                    textShadowOffset: { width: 0, height: 0 },
                    textShadowRadius: 10,
                  }}
                />
              )}
              <TextInput
                style={[styles.input, { color: COLORS.textPrimary }]}
                placeholder=""
                placeholderTextColor="transparent"
                value={prompt}
                onChangeText={setPrompt}
                multiline={true}
                editable={false}
                pointerEvents="none"
              />
            </TouchableOpacity>
            {prompt || stylesText || hasSource ? (
              <TouchableOpacity
                style={[styles.micButton, { marginRight: 4 }]}
                onPress={() => {
                  Alert.alert(
                    "Clear Everything",
                    "Are you sure you want to clear your lyrics, styles, and audio?",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Clear",
                        style: "destructive",
                        onPress: () => {
                          setPrompt("");
                          setStylesText("");
                          setSelectedAudioUri(null);
                          setSelectedVideo(null);
                          setAudioTitle("");
                        },
                      },
                    ],
                  );
                }}
              >
                <Ionicons name="trash-outline" size={24} color="#ff3b6a" />
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={styles.micButton}
              onPress={() => {
                setIsInputExpanded(false);
                setIsRecordModalOpen(true);
              }}
            >
              <Ionicons
                name="mic-outline"
                size={24}
                color={COLORS.textSecondary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sendButton, !prompt.trim() && !lyricsText.trim() && !hasSource && { opacity: 0.8 }]}
              onPress={handleGenerate}
              disabled={!prompt.trim() && !lyricsText.trim() && !hasSource}
            >
              <LinearGradient
                colors={["#FF512F", "#F09819"]}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons name="arrow-up" size={20} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        </View>
        )}
      </View>

      <Modal
        visible={isRecordModalOpen}
        animationType="slide"
        transparent={true}
      >
        <View
          style={{
            flex: 1,
            paddingTop: insets.top + 20,
            backgroundColor: "#18181A",
          }}
        >
          {/* Header */}
          <View style={{ flexDirection: "row", paddingHorizontal: 20 }}>
            <TouchableOpacity
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: "rgba(255,255,255,0.1)",
                justifyContent: "center",
                alignItems: "center",
              }}
              onPress={() => {
                setIsRecordModalOpen(false);
                setIsInputExpanded(true);
              }}
            >
              <Ionicons name="close" size={24} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          </View>
          {/* Glowing Waveform Center */}
          <View
            style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
          >
            <Animated.View
              style={{
                width: 200,
                height: 200,
                borderRadius: 100,
                backgroundColor: "rgba(255, 81, 47, 0.15)",
                justifyContent: "center",
                alignItems: "center",
                transform: [
                  {
                    scale: pulseAnim.interpolate({
                      inputRange: [1, 1.1],
                      outputRange: [1, 1 + (isRecording ? Math.min(volume * 1.5, 0.5) : 0.05)],
                    }),
                  },
                ],
              }}
            >
              <Animated.View
                style={{
                  width: 140,
                  height: 140,
                  borderRadius: 70,
                  backgroundColor: "rgba(255, 81, 47, 0.3)",
                  justifyContent: "center",
                  alignItems: "center",
                  transform: [
                    {
                      scale: pulseAnim.interpolate({
                        inputRange: [1, 1.1],
                        outputRange: [1, 1 + (isRecording ? Math.min(volume * 1.0, 0.3) : 0.02)],
                      }),
                    },
                  ],
                }}
              >
                <View
                  style={{
                    width: 90,
                    height: 90,
                    borderRadius: 45,
                    backgroundColor: "#FF512F",
                    justifyContent: "center",
                    alignItems: "center",
                    shadowColor: "#FF512F",
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.8,
                    shadowRadius: 15,
                  }}
                >
                  <Ionicons name="mic" size={40} color="#FFF" />
                </View>
              </Animated.View>
            </Animated.View>
            
            <View style={{ marginTop: 40, alignItems: "center" }}>
              <Text style={{ color: "#FFF", fontSize: 24, fontWeight: "600", letterSpacing: 1 }}>
                {`${Math.floor(recordingDurationMs / 60000)}:${Math.floor((recordingDurationMs % 60000) / 1000).toString().padStart(2, '0')}`}
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, marginTop: 8 }}>
                {isRecording ? "Recording..." : "Ready to record"}
              </Text>
            </View>
          </View>
          {/* Bottom Actions */}
          <View style={{ alignItems: "center", paddingBottom: 40 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-evenly",
                alignItems: "center",
                width: "100%",
                paddingHorizontal: 20,
                marginBottom: 30,
              }}
            >
              {/* Upload Button */}
              <TouchableOpacity
                style={{ alignItems: "center", width: 80 }}
                onPress={async () => {
                  setIsRecordModalOpen(false);
                  setIsInputExpanded(true);
                  try {
                    const res = await DocumentPicker.getDocumentAsync({
                      type: "audio/*",
                    });
                    if (res.assets && res.assets.length > 0) {
                      setSelectedAudioUri(res.assets[0].uri);
                      setIsAudioEditorOpen(true);
                    }
                  } catch (e) {}
                }}
              >
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: "rgba(255,255,255,0.08)",
                    justifyContent: "center",
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <Ionicons name="push-outline" size={24} color="#FFF" />
                </View>
                <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
                  Upload
                </Text>
              </TouchableOpacity>

              {/* Record Button */}
              <TouchableOpacity
                style={{
                  width: 90,
                  height: 90,
                  borderRadius: 45,
                  backgroundColor: isRecording
                    ? "rgba(255,81,47,0.3)"
                    : "rgba(255,255,255,0.05)",
                  justifyContent: "center",
                  alignItems: "center",
                }}
                onPress={() => {
                  if (isRecording) {
                    stopRecording(true);
                    setIsRecordModalOpen(false);
                    setIsInputExpanded(true);
                  } else {
                    startRecording();
                  }
                }}
              >
                <View
                  style={{
                    width: 70,
                    height: 70,
                    borderRadius: 35,
                    backgroundColor: "#FF3B30",
                    shadowColor: "#FF3B30",
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.5,
                    shadowRadius: 10,
                  }}
                >
                  {isRecording && (
                    <View
                      style={{
                        position: "absolute",
                        top: 19,
                        left: 19,
                        width: 32,
                        height: 32,
                        borderRadius: 6,
                        backgroundColor: "#FFF",
                      }}
                    />
                  )}
                </View>
              </TouchableOpacity>

              {/* Browse Button */}
              <TouchableOpacity
                style={{ alignItems: "center", width: 80 }}
                onPress={() => {
                  setIsRecordModalOpen(false);
                  setIsInputExpanded(true);
                  setIsAudioMenuOpen(true);
                }}
              >
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: "rgba(255,255,255,0.08)",
                    justifyContent: "center",
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <Ionicons name="library-outline" size={24} color="#FFF" />
                </View>
                <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
                  Browse
                </Text>
              </TouchableOpacity>
            </View>
            {/* Bottom Limit Text */}
            <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
              8 min limit,{" "}
              <Text
                style={{
                  textDecorationLine: "underline",
                  color: "rgba(255,255,255,0.8)",
                }}
              >
                upgrade
              </Text>{" "}
              to use longer audio
            </Text>
          </View>
        </View>
      </Modal>

      {/* Detailed Song Options Modal */}
      <Modal
        visible={isSongOptionsOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsSongOptionsOpen(false)}
      >
        {(() => {
          const selectedTrack = selectedSongTask?.tracks?.[0];
          const modalCoverImage = selectedTrack?.imageUrl || "";
          const modalSongTitle = selectedTrack?.title || "Untitled";
          const modalSongAudioUrl = selectedTrack?.audioUrl || "";
          const modalSongPrompt =
            selectedTrack?.lyrics || selectedTrack?.prompt || "";
          const modalSongTags =
            selectedTrack?.genre || selectedTrack?.tags || "";
          const modalSongDuration =
            selectedTrack?.duration || selectedSongTask?.duration || 0;
          return (
            <View
              style={{
                flex: 1,
                backgroundColor: "rgba(0,0,0,0.6)",
                justifyContent: "flex-end",
              }}
            >
              <TouchableWithoutFeedback
                onPress={() => setIsSongOptionsOpen(false)}
              >
                <View style={StyleSheet.absoluteFill} />
              </TouchableWithoutFeedback>
              <View style={styles.songOptionsSheet}>
                <View style={styles.sheetHandle} />

                <ScrollView
                  contentContainerStyle={styles.songOptionsScroll}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Header Info */}
                  <View style={styles.songOptionsHeader}>
                    <View style={{ position: "relative" }}>
                      <Image
                        source={{
                          uri:
                            modalCoverImage ||
                            "https://via.placeholder.com/150",
                        }}
                        style={styles.songOptionsImage}
                      />
                      <View
                        style={{
                          position: "absolute",
                          top: -4,
                          right: 10,
                          backgroundColor: "#1A1A1A",
                          borderRadius: 10,
                          padding: 4,
                          borderWidth: 1,
                          borderColor: "#333",
                        }}
                      >
                        <Ionicons name="pencil" size={10} color="#FFF" />
                      </View>
                    </View>
                    <View style={styles.songOptionsTitleContainer}>
                      <Text style={styles.songOptionsTitle}>
                        {modalSongTitle}
                      </Text>
                      <Text style={styles.songOptionsArtist}>
                        by {selectedSongTask?.username || "user"}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.moreInfoBadge}
                      onPress={() =>
                        Alert.alert(
                          "Song Info",
                          `Duration: ${modalSongDuration ? `${Math.floor(modalSongDuration / 60)}:${Math.floor(modalSongDuration % 60).toString().padStart(2, "0")}` : "Unknown"}
Status: ${selectedSongTask?.status || "Unknown"}`,
                        )
                      }
                    >
                      <Text style={styles.moreInfoText}>More Info</Text>
                    </TouchableOpacity>
                  </View>

                  {/* 3 Buttons Row */}
                  <View style={styles.songOptionsGrid}>
                    <TouchableOpacity
                      style={styles.gridBtn}
                      onPress={() => {
                        setIsSongOptionsOpen(false);
                        Alert.alert(
                          "Add to Playlist",
                          "Choose a playlist to add this song to.",
                        );
                      }}
                    >
                      <Ionicons name="add" size={24} color="#FFF" />
                      <Text style={styles.gridBtnText}>Add to Playlist</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.gridBtn}
                      onPress={() => {
                        setIsSongOptionsOpen(false);
                        Alert.alert("Added", "Added to your Liked Songs.");
                      }}
                    >
                      <Ionicons
                        name="thumbs-up-outline"
                        size={24}
                        color="#FFF"
                      />
                      <Text style={styles.gridBtnText}>Like Song</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.gridBtn}
                      onPress={async () => {
                        setIsSongOptionsOpen(false);
                        if (modalSongAudioUrl && !modalSongAudioUrl.startsWith("mock")) {
                          try {
                            const fileName = `${modalSongTitle.replace(/[^a-zA-Z0-9 _-]/g, "")}.mp3`;
                            const fileUri = FileSystem.documentDirectory + fileName;
                            Alert.alert("Preparing...", "Downloading your file for share/download...");
                            
                            const downloadResult = await FileSystem.downloadAsync(modalSongAudioUrl, fileUri);
                            if (downloadResult.status === 200) {
                              await Sharing.shareAsync(downloadResult.uri, {
                                mimeType: 'audio/mpeg',
                                dialogTitle: 'Save or Share your AI Song',
                                UTI: 'public.audio'
                              });
                            } else {
                              Alert.alert("Error", "Could not download the audio file.");
                            }
                          } catch (error: any) {
                            Alert.alert("Error", error.message || "Failed to share file");
                          }
                        } else {
                          Alert.alert(
                            "Not Ready",
                            "Audio URL is not available yet.",
                          );
                        }
                      }}
                    >
                      <Ionicons
                        name="arrow-redo-outline"
                        size={24}
                        color="#FFF"
                      />
                      <Text style={styles.gridBtnText}>Share Song</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.optionsList}>
                    {/* Download */}
                    <TouchableOpacity
                      style={styles.optionItem}
                      onPress={async () => {
                        setIsSongOptionsOpen(false);
                        const audioUrl = selectedTrack?.audioUrl;
                        if (!audioUrl || audioUrl.startsWith("mock")) {
                          Alert.alert(
                            "Download Failed",
                            "No audio file available for this song.",
                          );
                          return;
                        }
                        // Build filename: username - song title.mp3
                        const username = profile?.username || "BongoBox";
                        const songTitle = (selectedTrack?.title || "Untitled")
                          .replace(/[^a-zA-Z0-9 _-]/g, "")
                          .trim();
                        const fileName = `${username} - ${modalSongTitle}.mp3`;
                        const fileUri = FileSystem.documentDirectory + fileName;
                        try {
                          Alert.alert(
                            "Downloading...",
                            `Saving "${fileName}" to your phone.`,
                          );
                          const { status } =
                            await MediaLibrary.requestPermissionsAsync();
                          if (status !== "granted") {
                            Alert.alert(
                              "Permission Denied",
                              "Please allow media access to download songs.",
                            );
                            return;
                          }
                          const downloadResult = await FileSystem.downloadAsync(
                            audioUrl,
                            fileUri,
                          );
                          if (downloadResult.status !== 200) {
                            Alert.alert(
                              "Download Failed",
                              "Could not download the audio file.",
                            );
                            return;
                          }
                          await MediaLibrary.saveToLibraryAsync(
                            downloadResult.uri,
                          );
                          Alert.alert(
                            "✅ Downloaded!",
                            `"${fileName}" has been saved to your music library.`,
                          );
                        } catch (e: any) {
                          console.error("Download error:", e);
                          Alert.alert(
                            "Download Failed",
                            e.message || "Something went wrong.",
                          );
                        }
                      }}
                    >
                      <Ionicons
                        name="download-outline"
                        size={22}
                        color="#FFF"
                      />
                      <Text style={styles.optionText}>Download Song</Text>
                    </TouchableOpacity>

                    <View style={{ height: 16 }} />

                    {/* Group 1 */}
                    <View
                      style={{
                        backgroundColor: "#2A2A2A",
                        borderRadius: 12,
                        overflow: "hidden",
                      }}
                    >
                      <TouchableOpacity
                        style={[
                          styles.optionItem,
                          {
                            borderRadius: 0,
                            borderBottomWidth: 1,
                            borderBottomColor: "rgba(255,255,255,0.05)",
                          },
                        ]}
                        onPress={() => {
                          setIsSongOptionsOpen(false);
                          setIsEditSongDetailsModalOpen(true);
                        }}
                      >
                        <Ionicons
                          name="information-circle-outline"
                          size={22}
                          color="#FFF"
                        />
                        <Text style={styles.optionText}>Edit Song Details</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.optionItem,
                          {
                            borderRadius: 0,
                            borderBottomWidth: 1,
                            borderBottomColor: "rgba(255,255,255,0.05)",
                          },
                        ]}
                        onPress={() => {
                          setIsSongOptionsOpen(false);
                          setIsCoverArtModalOpen(true);
                        }}
                      >
                        <Ionicons
                          name="sparkles-outline"
                          size={22}
                          color="#FFF"
                        />
                        <Text style={styles.optionText}>Create Cover Art</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.optionItem, { borderRadius: 0 }]}
                        onPress={() => {
                          setIsSongOptionsOpen(false);
                          Alert.alert(
                            "Create Hook",
                            "Generating a hook for this track...",
                          );
                        }}
                      >
                        <Ionicons
                          name="play-circle-outline"
                          size={22}
                          color="#FFF"
                        />
                        <Text style={styles.optionText}>Create Hook</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={{ height: 16 }} />

                    {/* Group 2 */}
                    <View
                      style={{
                        backgroundColor: "#2A2A2A",
                        borderRadius: 12,
                        overflow: "hidden",
                      }}
                    >
                      <TouchableOpacity
                        style={[
                          styles.optionItem,
                          {
                            borderRadius: 0,
                            borderBottomWidth: 1,
                            borderBottomColor: "rgba(255,255,255,0.05)",
                          },
                        ]}
                        onPress={async () => {
                          setIsSongOptionsOpen(false);
                          const stripLrc = (txt: string) =>
                            (txt || "")
                              .split("\n")
                              .map((l: string) => l.replace(/^\s*(\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]\s*)+/, ""))
                              .join("\n")
                              .trim();

                          // 1. Lyrics we already have locally
                          let rawLyrics: string = selectedTrack?.lyrics || "";
                          let styles_: string = modalSongTags || "";

                          // 2. Missing? Look the song up in Supabase (by id, then by audio URL)
                          if (!rawLyrics.trim()) {
                            try {
                              let row: any = null;
                              if (selectedTrack?.id) {
                                const { data } = await supabase
                                  .from("tracks")
                                  .select("lyrics, genre")
                                  .eq("id", selectedTrack.id)
                                  .maybeSingle();
                                row = data;
                              }
                              if (!row?.lyrics && selectedTrack?.audioUrl) {
                                const { data } = await supabase
                                  .from("tracks")
                                  .select("lyrics, genre")
                                  .eq("audio_url", selectedTrack.audioUrl)
                                  .maybeSingle();
                                row = data || row;
                              }
                              if (row?.lyrics) rawLyrics = row.lyrics;
                              if (!styles_ && row?.genre) styles_ = row.genre;
                            } catch (e) {
                              console.log("Reuse lyrics lookup failed:", e);
                            }
                          }

                          const cleanLyrics = stripLrc(rawLyrics);
                          const originalPrompt = selectedTrack?.prompt || "";
                          setLyricsText(cleanLyrics);
                          // Place the lyrics in the prompt so the user can easily see and edit them.
                          setPrompt(cleanLyrics || originalPrompt || "");
                          setStylesText(styles_ === "AI Generated" ? "" : styles_);

                          if (!cleanLyrics && !originalPrompt) {
                            Alert.alert(
                              "No lyrics saved",
                              "This song was saved without lyrics (older songs or instrumentals). Only the style was reused.",
                            );
                          }
                          setIsInputExpanded(true);
                          scrollViewRef.current?.scrollTo({
                            y: 0,
                            animated: true,
                          });
                        }}
                      >
                        <Ionicons name="time-outline" size={22} color="#FFF" />
                        <Text style={styles.optionText}>
                          Reuse Styles & Lyrics
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.optionItem,
                          {
                            borderRadius: 0,
                            borderBottomWidth: 1,
                            borderBottomColor: "rgba(255,255,255,0.05)",
                          },
                        ]}
                        onPress={() => {
                          setIsSongOptionsOpen(false);
                          setSelectedAudioUri(modalSongAudioUrl);
                          setAudioTitle(modalSongTitle);
                          setPrompt("");
                          setStylesText("");
                          // Open the input expanded after a short delay to allow the modal to close first
                          setTimeout(() => setIsInputExpanded(true), 400);
                        }}
                      >
                        <Ionicons name="sync-outline" size={22} color="#FFF" />
                        <Text style={styles.optionText}>Remix</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.optionItem,
                          {
                            borderRadius: 0,
                            borderBottomWidth: 1,
                            borderBottomColor: "rgba(255,255,255,0.05)",
                          },
                        ]}
                        onPress={() => {
                          setIsSongOptionsOpen(false);
                          setIsExtendModalOpen(true);
                        }}
                      >
                        <Ionicons
                          name="arrow-forward-outline"
                          size={22}
                          color="#FFF"
                        />
                        <Text style={styles.optionText}>Extend</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.optionItem,
                          {
                            borderRadius: 0,
                            borderBottomWidth: 1,
                            borderBottomColor: "rgba(255,255,255,0.05)",
                          },
                        ]}
                        onPress={() => {
                          setIsSongOptionsOpen(false);
                          Alert.alert(
                            "Remaster Audio",
                            "Enhance audio quality? This will cost 500 TSH.",
                            [{ text: "Cancel" }, { text: "Pay 500 TSH" }],
                          );
                        }}
                      >
                        <Ionicons name="sparkles" size={22} color="#FFF" />
                        <Text style={styles.optionText}>Remaster</Text>
                        <View style={styles.upgradeBadge}>
                          <Text style={styles.upgradeBadgeText}>500 TSH</Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.optionItem,
                          { borderRadius: 0, opacity: 0.5 },
                        ]}
                        disabled={true}
                      >
                        <Ionicons
                          name="person-circle-outline"
                          size={22}
                          color="#FFF"
                        />
                        <Text style={styles.optionText}>Create Voice</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={{ height: 16 }} />

                    {/* Radio */}
                    <TouchableOpacity
                      style={styles.optionItem}
                      onPress={() => {
                        setIsSongOptionsOpen(false);
                        Alert.alert(
                          "Song Radio",
                          "Starting infinite radio based on this track...",
                        );
                      }}
                    >
                      <Ionicons name="radio-outline" size={22} color="#FFF" />
                      <Text style={styles.optionText}>Start Song Radio</Text>
                    </TouchableOpacity>

                    <View style={{ height: 16 }} />

                    {/* Dislike / Report */}
                    <View
                      style={{
                        backgroundColor: "#2A2A2A",
                        borderRadius: 12,
                        overflow: "hidden",
                      }}
                    >
                      <TouchableOpacity
                        style={[
                          styles.optionItem,
                          {
                            borderRadius: 0,
                            borderBottomWidth: 1,
                            borderBottomColor: "rgba(255,255,255,0.05)",
                          },
                        ]}
                        onPress={() => {
                          setIsSongOptionsOpen(false);
                          Alert.alert(
                            "Noted",
                            "We will show fewer songs like this.",
                          );
                        }}
                      >
                        <Ionicons
                          name="thumbs-down-outline"
                          size={22}
                          color="#FFF"
                        />
                        <Text style={styles.optionText}>Dislike Song</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.optionItem, { borderRadius: 0 }]}
                        onPress={() => {
                          setIsSongOptionsOpen(false);
                          Alert.alert(
                            "Reported",
                            "Thanks for keeping the community safe.",
                          );
                        }}
                      >
                        <Ionicons name="flag-outline" size={22} color="#FFF" />
                        <Text style={styles.optionText}>
                          Report Inappropriate
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <View style={{ height: 16 }} />

                    {/* Delete */}
                    <TouchableOpacity
                      style={styles.optionItem}
                      onPress={() => {
                        Alert.alert(
                          "Delete Song",
                          "Are you sure you want to delete this song?",
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Delete",
                              style: "destructive",
                              onPress: () => {
                                if (selectedSongTask) {
                                  removeTask(selectedSongTask.id);
                                  setIsSongOptionsOpen(false);
                                }
                              },
                            },
                          ],
                        );
                      }}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={22}
                        color="#FF3B30"
                      />
                      <Text style={[styles.optionText, { color: "#FF3B30" }]}>
                        Delete Song
                      </Text>
                    </TouchableOpacity>

                    <View style={{ height: 100 }} />
                  </View>
                </ScrollView>

                {/* Sticky Publish Button */}
                <View
                  style={[
                    styles.publishContainer,
                    {
                      paddingBottom: 30,
                      paddingTop: 10,
                      backgroundColor: "#1E1E1E",
                    },
                  ]}
                >
                  <TouchableOpacity
                    style={styles.publishBtn}
                    onPress={() => {
                      setIsSongOptionsOpen(false);
                      setIsPublishSongModalOpen(true);
                    }}
                  >
                    <Ionicons name="globe-outline" size={20} color="#000" />
                    <Text style={styles.publishBtnText}>Publish Song</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })()}
      </Modal>

      {/* Render Cover Art Modal */}
      <CoverArtModal
        visible={isCoverArtModalOpen}
        onClose={() => setIsCoverArtModalOpen(false)}
        songTask={selectedSongTask}
      />

      <EditSongDetailsModal
        visible={isEditSongDetailsModalOpen}
        onClose={() => setIsEditSongDetailsModalOpen(false)}
        songTask={selectedSongTask}
        onRequestCoverArtEdit={() => {
          setIsEditSongDetailsModalOpen(false);
          setIsCoverArtModalOpen(true);
        }}
      />

      <PublishSongModal
        visible={isPublishSongModalOpen}
        onClose={() => setIsPublishSongModalOpen(false)}
        songTask={selectedSongTask}
      />

      <ExtendSongModal
        visible={isExtendModalOpen}
        onClose={() => setIsExtendModalOpen(false)}
        songTask={selectedSongTask}
      />

      {/* ─── VOICES LIST MODAL ─────────────────────────────────────── */}
      <Modal
        visible={isPersonaModalOpen}
        animationType="slide"
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
        onRequestClose={closeVoicePicker}
      >
        <View style={{ flex: 1, backgroundColor: "#111", paddingTop: 20 }}>
          {/* Handle */}
          <View style={{ alignItems: "center", marginBottom: 20 }}>
            <View style={{ width: 40, height: 4, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 2 }} />
          </View>

          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, marginBottom: 24 }}>
            <TouchableOpacity onPress={closeVoicePicker} style={{ padding: 4, marginRight: 12 }}>
              <Ionicons name="close" size={24} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
            <Text style={{ color: "#FFF", fontSize: 20, fontWeight: "700", flex: 1 }}>My Voices</Text>
            <TouchableOpacity
              style={{
                flexDirection: "row", alignItems: "center",
                backgroundColor: "#FF2A75", paddingHorizontal: 14, paddingVertical: 8,
                borderRadius: 20,
              }}
              onPress={() => {
                // On Android, we must close the current modal first before opening a new one
                setIsPersonaModalOpen(false);
                setTimeout(() => {
                  setVoiceWizardStep(1);
                  setPersonaName("");
                  setPersonaDescription("");
                  setPersonaAudioUri(null);
                  setWizardDurationMs(0);
                  setIsVoiceWizardOpen(true);
                }, 350);
              }}
            >
              <Ionicons name="add" size={18} color="#FFF" />
              <Text style={{ color: "#FFF", fontSize: 14, fontWeight: "600", marginLeft: 4 }}>New Voice</Text>
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)", marginHorizontal: 20, marginBottom: 20 }}>
            {(["All", "Favorites"] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={{ flex: 1, paddingVertical: 12, borderBottomWidth: personaTab === tab ? 2 : 0, borderBottomColor: "#FF2A75" }}
                onPress={() => setPersonaTab(tab)}
              >
                <Text style={{ color: personaTab === tab ? "#FFF" : "rgba(255,255,255,0.5)", textAlign: "center", fontWeight: "600" }}>{tab}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* List */}
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
            {personas.filter((p) => personaTab === "All" || p.isFavorite).length === 0 ? (
              <View style={{ alignItems: "center", paddingTop: 60 }}>
                <Ionicons name="mic-off-outline" size={48} color="rgba(255,255,255,0.2)" />
                <Text style={{ color: "rgba(255,255,255,0.4)", marginTop: 16, fontSize: 15 }}>No voices yet. Tap + New Voice to get started!</Text>
              </View>
            ) : (
              personas.filter((p) => personaTab === "All" || p.isFavorite).map((p) => {
                const isSelected = selectedPersonaId === p.id;
                const isTesting = testingPersonaId === p.id;
                const hasTestAudio = !!testAudioUrls[p.id];
                const isPlayingTest = testPlayingId === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    activeOpacity={0.75}
                    onPress={() => {
                      setSelectedPersonaId(isSelected ? null : p.id);
                      closeVoicePicker();
                    }}
                    style={{
                      marginBottom: 16,
                      backgroundColor: isSelected ? "rgba(130,80,255,0.18)" : "rgba(255,255,255,0.04)",
                      borderRadius: 16,
                      padding: 14,
                      borderWidth: isSelected ? 1.5 : 0,
                      borderColor: isSelected ? "#8250FF" : "transparent",
                    }}
                  >
                    {/* Top row: avatar + info + heart + trash */}
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <LinearGradient
                        colors={isSelected ? ["#8250FF", "#BF5FFF"] : ["#FF2A75", "#FF512F"]}
                        style={{ width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center", marginRight: 14 }}
                      >
                        <Ionicons name={isSelected ? "checkmark" : "person"} size={22} color="#FFF" />
                      </LinearGradient>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: isSelected ? "#C8A8FF" : "#FFF", fontSize: 16, fontWeight: "600" }}>{p.name}</Text>
                        <Text style={{ color: p.type === "voice" ? "#FF7AA8" : "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: "700", marginTop: 2, letterSpacing: 0.4 }}>
                          {p.type === "voice" ? "YOUR VOICE • sings your songs" : "STYLE PERSONA"}
                        </Text>
                        {p.description
                          ? <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 2 }} numberOfLines={1}>{p.description}</Text>
                          : null}
                        {isSelected && (
                          <Text style={{ color: "#8250FF", fontSize: 12, marginTop: 3, fontWeight: "600" }}>✓ Active for next song</Text>
                        )}
                      </View>
                      <TouchableOpacity style={{ padding: 8 }} onPress={(e) => { e.stopPropagation?.(); togglePersonaFavorite(p.id); }}>
                        <Ionicons name={p.isFavorite ? "heart" : "heart-outline"} size={20} color={p.isFavorite ? "#FF2A75" : "rgba(255,255,255,0.4)"} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ padding: 8 }}
                        onPress={(e) => {
                          e.stopPropagation?.();
                          Alert.alert("Delete Voice", `Delete "${p.name}"?`, [
                            { text: "Cancel", style: "cancel" },
                            { text: "Delete", style: "destructive", onPress: () => {
                              removePersona(p.id);
                              if (isSelected) setSelectedPersonaId(null);
                              const newUrls = { ...testAudioUrls };
                              delete newUrls[p.id];
                              setTestAudioUrls(newUrls);
                            }},
                          ]);
                        }}
                      >
                        <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                      </TouchableOpacity>
                    </View>

                    {/* Bottom row: Test / Play verification (cloned voices only) */}
                    {p.type === "voice" && (
                    <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
                      {isTesting ? (
                        /* Generating test audio */
                        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, gap: 10 }}>
                          <ActivityIndicator size="small" color="#FF2A75" />
                          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, flex: 1 }} numberOfLines={1}>
                            {testMessage || "Generating..."}
                          </Text>
                        </View>
                      ) : hasTestAudio ? (
                        /* Test audio ready — play/stop inline */
                        <TouchableOpacity
                          onPress={(e) => { e.stopPropagation?.(); handlePlayTestAudio(p.id); }}
                          style={{
                            flex: 1,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                            backgroundColor: isPlayingTest ? "rgba(29,185,84,0.15)" : "rgba(255,255,255,0.06)",
                            borderRadius: 10,
                            paddingHorizontal: 14,
                            paddingVertical: 10,
                            borderWidth: isPlayingTest ? 1 : 0,
                            borderColor: isPlayingTest ? "#1DB954" : "transparent",
                          }}
                        >
                          <Ionicons
                            name={isPlayingTest ? "stop-circle" : "play-circle"}
                            size={22}
                            color={isPlayingTest ? "#1DB954" : "rgba(255,255,255,0.6)"}
                          />
                          <Text style={{ color: isPlayingTest ? "#1DB954" : "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: "600" }}>
                            {isPlayingTest ? "Stop" : "▶ Play Sample"}
                          </Text>
                          <TouchableOpacity
                            onPress={(e) => { e.stopPropagation?.(); handleTestVoice(p.id, p.name); }}
                            style={{ marginLeft: "auto" }}
                          >
                            <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>Regenerate</Text>
                          </TouchableOpacity>
                        </TouchableOpacity>
                      ) : (
                        /* Test not yet generated */
                        <TouchableOpacity
                          onPress={(e) => { e.stopPropagation?.(); handleTestVoice(p.id, p.name); }}
                          disabled={!!testingPersonaId}
                          style={{
                            flex: 1,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            backgroundColor: "rgba(255,255,255,0.06)",
                            borderRadius: 10,
                            paddingVertical: 10,
                            opacity: testingPersonaId && !isTesting ? 0.4 : 1,
                          }}
                        >
                          <Ionicons name="ear-outline" size={18} color="rgba(255,255,255,0.6)" />
                          <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: "600" }}>Hear a Sample Song</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    )}
                  </TouchableOpacity>
                );
              })

            )}
          </ScrollView>
        </View>
      </Modal>

      {/* ─── VOICE WIZARD MODAL ────────────────────────────────────── */}
      <Modal
        visible={isVoiceWizardOpen}
        animationType="slide"
        transparent={false}
        onRequestClose={() => {
          if (isWizardRecording) stopWizardRecording(false);
          setIsVoiceWizardOpen(false);
          reopenComposerIfNeeded();
        }}
      >
        <View style={{ flex: 1, backgroundColor: "#0A0A0E", overflow: "hidden" }}>
          <LinearGradient
            colors={["#2A0E24", "#140A1A", "#0A0A0E"]}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View pointerEvents="none" style={wz.glowBlob} />

          {/* Header */}
          <View style={[wz.header, { paddingTop: (insets.top || 0) + 12 }]}>
            <TouchableOpacity
              style={wz.iconBtn}
              onPress={() => {
                if (isWizardRecording) stopWizardRecording(false);
                stopWizardPreview();
                if (voiceWizardStep > 1) { setVoiceWizardStep((voiceWizardStep - 1) as any); }
                else { setIsVoiceWizardOpen(false); reopenComposerIfNeeded(); }
              }}
            >
              <Ionicons name={voiceWizardStep > 1 ? "arrow-back" : "close"} size={22} color="#FFF" />
            </TouchableOpacity>

            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={wz.stepLabel}>STEP {voiceWizardStep} OF 5</Text>
              <Text style={wz.headerTitle}>
                {voiceWizardStep === 1 ? "Name Your Voice"
                  : voiceWizardStep === 2 ? "Record Voice Sample"
                  : voiceWizardStep === 3 ? "Preview Sample"
                  : voiceWizardStep === 4 ? "Verify Identity"
                  : "Preview Verification"}
              </Text>
            </View>

            <View style={{ width: 40 }} />
          </View>

          {/* Segmented progress */}
          <View style={wz.progressRow}>
            {[1, 2, 3, 4, 5].map((s) => (
              <View key={s} style={wz.progressTrack}>
                {s <= voiceWizardStep && (
                  <LinearGradient
                    colors={WZ_ACCENT}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[StyleSheet.absoluteFill, s < voiceWizardStep && { opacity: 0.55 }]}
                  />
                )}
              </View>
            ))}
          </View>

          {voiceWizardStep === 1 ? (
            /* ── STEP 1: NAME & DESCRIPTION ── */
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 28, paddingBottom: 24 }}
              >
                <View style={{ alignItems: "center", marginBottom: 32 }}>
                  <LinearGradient colors={WZ_ACCENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={wz.heroIcon}>
                    <Ionicons name="person" size={32} color="#FFF" />
                  </LinearGradient>
                  <Text style={wz.heroTitle}>Create your AI voice</Text>
                  <Text style={wz.heroSub}>Give your voice persona a name. You'll record a short sample next.</Text>
                </View>

                <Text style={wz.fieldLabel}>VOICE NAME</Text>
                <View style={wz.field}>
                  <Ionicons name="mic-outline" size={18} color="#FF2A75" style={{ marginRight: 10 }} />
                  <TextInput
                    id="voice-name-input"
                    style={wz.fieldInput}
                    placeholder="e.g. My Rap Voice"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={personaName}
                    onChangeText={setPersonaName}
                    selectionColor="#FF2A75"
                    maxLength={40}
                    autoFocus
                  />
                  <Text style={wz.fieldCount}>{personaName.length}/40</Text>
                </View>

                <Text style={wz.fieldLabel}>
                  DESCRIPTION <Text style={{ color: "rgba(255,255,255,0.3)", letterSpacing: 0 }}>· optional</Text>
                </Text>
                <View style={[wz.field, { alignItems: "flex-start", paddingTop: 14 }]}>
                  <Ionicons name="document-text-outline" size={18} color="#FF2A75" style={{ marginRight: 10, marginTop: 1 }} />
                  <TextInput
                    id="voice-description-input"
                    style={[wz.fieldInput, { minHeight: 72, paddingTop: 0 }]}
                    placeholder="e.g. Deep bass voice, smooth R&B style"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={personaDescription}
                    onChangeText={setPersonaDescription}
                    selectionColor="#FF2A75"
                    maxLength={120}
                    multiline
                    textAlignVertical="top"
                  />
                </View>
                <Text style={[wz.fieldCount, { alignSelf: "flex-end", marginTop: -12 }]}>{personaDescription.length}/120</Text>
              </ScrollView>

              <View style={[wz.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                <TouchableOpacity
                  id="voice-wizard-next"
                  activeOpacity={0.85}
                  style={[wz.primaryBtn, !personaName.trim() && { opacity: 0.5 }]}
                  onPress={() => {
                    if (!personaName.trim()) {
                      Alert.alert("Required", "Please provide a name for your voice persona.");
                      return;
                    }
                    setVoiceWizardStep(2);
                  }}
                >
                  <LinearGradient colors={WZ_ACCENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={wz.primaryBtnInner}>
                    <Text style={wz.primaryBtnText}>Continue</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFF" />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          ) : voiceWizardStep === 2 ? (
            /* ── STEP 2: RECORD SOURCE ── */
            <View style={{ flex: 1 }}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16, alignItems: "center" }}
              >
                <Text style={wz.heroSub}>Record 10-30 seconds of clear singing or speaking.</Text>

                <View style={wz.tipsRow}>
                  {([
                    ["volume-mute-outline", "Quiet room"],
                    ["phone-portrait-outline", "Close to mic"],
                    ["musical-notes-outline", "Sing naturally"],
                  ] as const).map(([icon, label]) => (
                    <View key={label} style={wz.tipChip}>
                      <Ionicons name={icon} size={13} color="#FF7AA8" />
                      <Text style={wz.tipText}>{label}</Text>
                    </View>
                  ))}
                </View>

                <View style={[wz.card, isWizardRecording && wz.cardActive]}>
                  <WizardVisualizer recording={isWizardRecording} volume={wizardVolume} tick={vizTick} />
                  <Text style={wz.timer}>{formatWizardTime(wizardDurationMs)}</Text>
                  <Text style={wz.timerHint}>
                    {isWizardRecording ? (wizardDurationMs < 10000 ? "Keep going... (min 10s)" : wizardDurationMs >= 30000 ? "Great — tap to stop" : "Recording — tap to stop") : "Tap the button below to start"}
                  </Text>
                  <WizardDurationBar ms={wizardDurationMs} minMs={10000} maxMs={30000} />
                </View>

                <View style={{ flex: 1, minHeight: 24 }} />

                <WizardRecordButton
                  recording={isWizardRecording}
                  onPress={() => {
                    if (isWizardRecording) { stopWizardRecording(true); } else { startWizardRecording(); }
                  }}
                />
                <Text style={wz.recordLabel}>{isWizardRecording ? "Tap to stop" : "Tap to record"}</Text>
              </ScrollView>

              <View style={[wz.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                <TouchableOpacity
                  id="voice-wizard-upload"
                  activeOpacity={0.8}
                  disabled={isWizardRecording}
                  style={[wz.secondaryBtn, isWizardRecording && { opacity: 0.35 }]}
                  onPress={async () => {
                    try {
                      const res = await DocumentPicker.getDocumentAsync({ type: "audio/*" });
                      if (res.assets && res.assets.length > 0) {
                        setPersonaAudioUri(res.assets[0].uri);
                        setWizardPreviewSound(null);
                        setWizardDurationMs(30000);
                        setVoiceWizardStep(3); // → Preview Source
                      }
                    } catch (e) {}
                  }}
                >
                  <Ionicons name="cloud-upload-outline" size={18} color="rgba(255,255,255,0.85)" />
                  <Text style={wz.secondaryBtnText}>Upload audio instead</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : voiceWizardStep === 3 ? (
            /* ── STEP 3: PREVIEW SOURCE ── */
            <View style={{ flex: 1 }}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 16 }}
              >
                <View style={{ alignItems: "center", marginBottom: 28 }}>
                  <LinearGradient colors={WZ_ACCENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={wz.heroIcon}>
                    <Ionicons name="headset" size={30} color="#FFF" />
                  </LinearGradient>
                  <Text style={wz.heroTitle}>Listen back</Text>
                  <Text style={wz.heroSub}>Make sure your voice sounds clear before we analyze it.</Text>
                </View>

                <WizardPreviewCard
                  label="Voice sample"
                  playing={isWizardPreviewPlaying}
                  durationMs={wizardDurationMs}
                  onPress={isWizardPreviewPlaying ? stopWizardPreview : playWizardPreview}
                />

                {isPersonaGenerating ? (
                  <WizardStatusCard text={personaStatusText || "Processing..."} onCancel={handleCancelPersonaCreation} />
                ) : null}
              </ScrollView>

              {!isPersonaGenerating && (
                <View style={[wz.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                  <TouchableOpacity
                    id="voice-wizard-analyze"
                    activeOpacity={0.85}
                    style={wz.primaryBtn}
                    onPress={() => {
                      stopWizardPreview();
                      handleAnalyzeVoice();
                    }}
                  >
                    <LinearGradient colors={WZ_ACCENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={wz.primaryBtnInner}>
                      <Ionicons name="sparkles" size={18} color="#FFF" />
                      <Text style={wz.primaryBtnText}>Analyze Voice</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity
                    id="voice-wizard-rerecord-sample"
                    activeOpacity={0.8}
                    style={[wz.secondaryBtn, { marginTop: 12 }]}
                    onPress={() => {
                      stopWizardPreview();
                      setPersonaAudioUri(null);
                      setWizardDurationMs(0);
                      setWizardPreviewSound(null);
                      setVoiceWizardStep(2);
                    }}
                  >
                    <Ionicons name="refresh" size={18} color="rgba(255,255,255,0.85)" />
                    <Text style={wz.secondaryBtnText}>Record Again</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : voiceWizardStep === 4 ? (
            /* ── STEP 4: RECORD VERIFICATION ── */
            <View style={{ flex: 1 }}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: Math.max(insets.bottom, 16) + 8, alignItems: "center" }}
              >
                <Text style={wz.heroSub}>
                  Sing the phrase below exactly as written (singing works best — speaking is okay). Record in a quiet place.
                </Text>

                {/* Consent Script Box */}
                <View style={wz.phraseCard}>
                  <View style={wz.phraseBadge}>
                    <Ionicons name="shield-checkmark" size={12} color="#FF2A75" />
                    <Text style={wz.phraseBadgeText}>VERIFICATION PHRASE</Text>
                  </View>
                  <Text style={wz.phraseText}>"{validateText || ""}"</Text>
                </View>

                <View style={[wz.card, isWizardRecording && wz.cardActive]}>
                  <WizardVisualizer recording={isWizardRecording} volume={wizardVolume} tick={vizTick} />
                  <Text style={wz.timer}>{formatWizardTime(wizardDurationMs)}</Text>
                  <Text style={wz.timerHint}>
                    {isWizardRecording ? (wizardDurationMs < 5000 ? "Keep going... (min 5s)" : "Recording — tap to stop") : "Tap the button below to start"}
                  </Text>
                </View>

                <View style={{ flex: 1, minHeight: 24 }} />

                <WizardRecordButton
                  recording={isWizardRecording}
                  onPress={() => {
                    if (isWizardRecording) { stopWizardRecording(true); } else { startWizardRecording(); }
                  }}
                />
                <Text style={wz.recordLabel}>{isWizardRecording ? "Tap to stop" : "Tap to record"}</Text>
              </ScrollView>
            </View>
          ) : (
            /* ── STEP 5: PREVIEW VERIFICATION & FINALIZE ── */
            <View style={{ flex: 1 }}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 16 }}
              >
                <View style={{ alignItems: "center", marginBottom: 28 }}>
                  <LinearGradient colors={WZ_ACCENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={wz.heroIcon}>
                    <Ionicons name="shield-checkmark" size={30} color="#FFF" />
                  </LinearGradient>
                  <Text style={wz.heroTitle}>Almost done</Text>
                  <Text style={wz.heroSub}>Check your verification recording, then create your custom voice.</Text>
                </View>

                <WizardPreviewCard
                  label="Verification recording"
                  playing={isWizardPreviewPlaying}
                  durationMs={wizardDurationMs}
                  onPress={isWizardPreviewPlaying ? stopWizardPreview : playWizardPreview}
                />

                {isPersonaGenerating ? (
                  <WizardStatusCard text={personaStatusText || "Processing..."} onCancel={handleCancelPersonaCreation} />
                ) : null}
              </ScrollView>

              {!isPersonaGenerating && (
                <View style={[wz.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                  <TouchableOpacity
                    id="voice-wizard-create"
                    activeOpacity={0.85}
                    style={wz.primaryBtn}
                    onPress={() => {
                      stopWizardPreview();
                      handleFinalizeVoice();
                    }}
                  >
                    <LinearGradient colors={WZ_ACCENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={wz.primaryBtnInner}>
                      <Ionicons name="checkmark-circle" size={18} color="#FFF" />
                      <Text style={wz.primaryBtnText}>Create Custom Voice</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity
                    id="voice-wizard-rerecord-verify"
                    activeOpacity={0.8}
                    style={[wz.secondaryBtn, { marginTop: 12 }]}
                    onPress={() => {
                      stopWizardPreview();
                      setVerifyAudioUri(null);
                      setWizardDurationMs(0);
                      setWizardPreviewSound(null);
                      setVoiceWizardStep(4);
                    }}
                  >
                    <Ionicons name="refresh" size={18} color="rgba(255,255,255,0.85)" />
                    <Text style={wz.secondaryBtnText}>Record Again</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>
      </Modal>


    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  songOptionsSheet: {
    backgroundColor: "#1E1E1E",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: "85%",
    marginTop: "auto",
    overflow: "hidden",
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#666",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 20,
  },
  songOptionsScroll: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  songOptionsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  songOptionsImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 16,
  },
  songOptionsTitleContainer: {
    flex: 1,
  },
  songOptionsTitle: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  songOptionsArtist: {
    color: "#888",
    fontSize: 14,
  },
  moreInfoBadge: {
    borderWidth: 1,
    borderColor: "#444",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  moreInfoText: {
    color: "#888",
    fontSize: 12,
    fontWeight: "500",
  },
  songOptionsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  gridBtn: {
    flex: 1,
    backgroundColor: "#2A2A2A",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginHorizontal: 4,
  },
  gridBtnText: {
    color: "#FFF",
    fontSize: 12,
    marginTop: 8,
    textAlign: "center",
  },
  optionsList: {
    gap: 8,
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: "#2A2A2A",
    borderRadius: 12,
  },
  optionText: {
    color: "#FFF",
    fontSize: 16,
    marginLeft: 16,
    fontWeight: "500",
  },
  upgradeBadge: {
    backgroundColor: "rgba(255, 42, 117, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: "auto",
  },
  upgradeBadgeText: {
    color: "#FF2A75",
    fontSize: 12,
    fontWeight: "bold",
  },
  publishContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingTop: 40,
    paddingBottom: 40,
  },
  publishBtn: {
    backgroundColor: "#FFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 24,
  },
  publishBtnText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 8,
  },

  container: {
    flex: 1,
  },
  expandedCard: {
    flex: 1,
    backgroundColor: "#1C1C1E",
    borderRadius: 24,
    marginTop: 10,
    marginBottom: 20,
    padding: 20,
  },
  chipsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  iconChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  chipText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    fontWeight: "500",
  },
  expandedInput: {
    flex: 1,
    color: "#FFF",
    fontSize: 20,
    marginTop: 20,
    textAlignVertical: "top",
  },
  expandedBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  modelSelector: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  modelSelectorText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
  },
  expandedActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  expandedMicButton: {
    padding: 10,
    marginRight: 10,
  },
  expandedSendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "bold",
  },
  creditsBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  creditsText: {
    color: "#F09819",
    fontSize: 15,
    fontWeight: "bold",
    marginLeft: 6,
  },
  subHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  subHeaderTitle: {
    fontSize: 20,
    fontWeight: "600",
  },
  scrollContent: {
    paddingHorizontal: 15,
    paddingBottom: 160, // Space for the floating input
  },
  taskItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    marginBottom: 4,
  },
  taskDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FF2A75", // Pink dot
    marginRight: 8,
  },
  taskImageContainer: {
    width: 54,
    height: 54,
    borderRadius: 8,
    overflow: "hidden",
    marginRight: 12,
    position: "relative",
  },
  taskImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  taskDuration: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  taskDurationText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "600",
  },
  taskInfo: {
    flex: 1,
    justifyContent: "center",
  },
  taskTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginRight: 8,
    flexShrink: 1,
  },
  taskVersionTag: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  taskSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
  },
  moreButton: {
    padding: 10,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 50,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 16,
  },
  inputWrapper: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 105 : 95,
    left: 12,
    right: 12,
    minHeight: 56,
    maxHeight: 120,
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    minHeight: 56,
  },
  textInputWrapper: {
    flex: 1,
    justifyContent: "center",
    marginLeft: 12,
    paddingVertical: 12,
  },
  input: {
    fontSize: 16,
    padding: 0,
    margin: 0,
  },
  placeholderText: {
    fontSize: 16,
  },
  micButton: {
    padding: 10,
    marginRight: 4,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  recordingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: Platform.OS === "ios" ? 100 : 80,
  },
  recordingTextWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  recordingText: {
    fontSize: 28,
    fontWeight: "500",
    letterSpacing: 0.5,
  },
  recordingBottomPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(30, 30, 40, 0.95)",
    borderRadius: 40,
    paddingHorizontal: 12,
    paddingVertical: 12,
    width: "85%",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  recordingIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  waveformContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 10,
    height: 40,
  },
  waveformBar: {
    width: 3,
    backgroundColor: "#FFF",
    borderRadius: 2,
  },
  plusMenuPopover: {
    position: "absolute",
    top: 40,
    left: 0,
    backgroundColor: "rgba(40, 40, 40, 0.95)",
    borderRadius: 16,
    paddingVertical: 8,
    width: 180,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    zIndex: 100,
  },
  plusMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  plusMenuItemText: {
    color: "#FFF",
    fontSize: 16,
    marginLeft: 12,
  },
  advancedSheet: {
    backgroundColor: "rgba(30, 30, 30, 0.98)",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  advancedSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  advancedSheetTitle: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 24,
  },
  advancedRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  advancedLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    flex: 1,
  },
  sliderTrack: {
    flex: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    position: "relative",
    height: 20,
  },
  sliderTick: {
    width: 2,
    height: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 1,
  },
  sliderThumb: {
    position: "absolute",
    left: "50%",
    width: 12,
    height: 24,
    backgroundColor: "#FF2A75", // Pink
    borderRadius: 6,
    transform: [{ translateX: -6 }],
  },
  advancedValue: {
    color: "#FFF",
    fontSize: 14,
    marginLeft: 10,
  },
  genderToggle: {
    flexDirection: "row",
    alignItems: "center",
  },
  genderText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
  },
  genderTextActive: {
    color: "#FFF",
    fontWeight: "600",
  },
  advancedTitleInput: {
    flex: 1,
    color: "#FFF",
    fontSize: 14,
  },
  lyricsSheetContainer: {
    flex: 1,
    backgroundColor: "#1C1C1E", // Dark background matching design
    paddingHorizontal: 20,
  },
  lyricsHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginBottom: 20,
  },
  lyricsIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  lyricsToolbar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 24,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  lyricsToolIcon: {
    padding: 10,
  },
  lyricsSaveButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FF2A75", // Pink checkmark
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 6,
  },
  lyricsContent: {
    flex: 1,
  },
  lyricsTitle: {
    color: "#FFF",
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 16,
  },
  lyricsInput: {
    flex: 1,
    color: "#FFF",
    fontSize: 18,
    textAlignVertical: "top",
  },
  lyricsCharCount: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
    textAlign: "right",
    paddingVertical: 20,
  },
  suggestionChip: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  suggestionChipText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
  },
});
// forced refresh 123


// ─── VOICE WIZARD — presentational helpers (UI only, no business logic) ─────
const WZ_ACCENT = ["#FF2A75", "#FF512F"] as const;

const formatWizardTime = (ms: number) =>
  `${Math.floor(ms / 60000)}:${Math.floor((ms % 60000) / 1000).toString().padStart(2, "0")}`;

function WizardVisualizer({ recording, volume, tick }: { recording: boolean; volume: number; tick: number }) {
  return (
    <View style={{ width: "100%", height: 110, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 }}>
      {Array.from({ length: 24 }).map((_, i) => {
        const phase = tick * 0.3 + i * 0.6;
        const baseH = 6 + Math.abs(Math.sin(phase)) * 16;
        const volBoost = recording ? volume * 85 * (0.4 + Math.abs(Math.sin(phase + i))) : 0;
        const h = Math.min(baseH + volBoost, 100);
        const isCenter = Math.abs(i - 11.5) < 4;
        const opacity = recording ? 0.35 + volume * 0.65 : 1;
        return (
          <View
            key={i}
            style={{
              width: 6,
              height: Math.max(h, 4),
              borderRadius: 3,
              backgroundColor: recording
                ? (isCenter ? "#FF2A75" : `rgba(255,${42 + Math.floor(volume * 80)},117,${opacity})`)
                : "rgba(255,255,255,0.14)",
            }}
          />
        );
      })}
    </View>
  );
}

function WizardDurationBar({ ms, minMs, maxMs }: { ms: number; minMs: number; maxMs: number }) {
  const pct = Math.min(ms / maxMs, 1) * 100;
  const minPct = (minMs / maxMs) * 100;
  const reachedMin = ms >= minMs;
  return (
    <View style={{ width: "100%", marginTop: 18 }}>
      <View style={wz.durTrack}>
        <View style={{ width: `${pct}%`, height: "100%", borderRadius: 3, overflow: "hidden" }}>
          <LinearGradient
            colors={reachedMin ? WZ_ACCENT : ["rgba(255,42,117,0.55)", "rgba(255,81,47,0.55)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
        <View style={[wz.durMarker, { left: `${minPct}%` }]} />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
        <Text style={wz.durLabel}>0:00</Text>
        <Text style={[wz.durLabel, reachedMin && { color: "#FF7AA8" }]}>
          {reachedMin ? "✓ Minimum reached" : `Min ${formatWizardTime(minMs)}`}
        </Text>
        <Text style={wz.durLabel}>{formatWizardTime(maxMs)}</Text>
      </View>
    </View>
  );
}

function WizardRecordButton({ recording, onPress }: { recording: boolean; onPress: () => void }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!recording) { pulse.stopAnimation(); pulse.setValue(0); return; }
    pulse.setValue(0);
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [recording, pulse]);

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });

  return (
    <View style={{ width: 130, height: 130, alignItems: "center", justifyContent: "center" }}>
      {recording && (
        <Animated.View style={[wz.pulseRing, { transform: [{ scale: ringScale }], opacity: ringOpacity }]} />
      )}
      <TouchableOpacity
        id="voice-wizard-record-btn"
        activeOpacity={0.85}
        onPress={onPress}
        style={[wz.recordOuter, recording && { borderColor: "rgba(255,59,48,0.7)" }]}
      >
        {recording ? (
          <View style={wz.stopSquare} />
        ) : (
          <LinearGradient colors={WZ_ACCENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={wz.recordInner}>
            <Ionicons name="mic" size={30} color="#FFF" />
          </LinearGradient>
        )}
      </TouchableOpacity>
    </View>
  );
}

function WizardPreviewCard({ label, playing, durationMs, onPress }: {
  label: string; playing: boolean; durationMs: number; onPress: () => void;
}) {
  return (
    <View style={[wz.card, { flexDirection: "row", alignItems: "center", paddingVertical: 18 }, playing && wz.cardActive]}>
      <TouchableOpacity id="voice-wizard-preview-btn" activeOpacity={0.85} onPress={onPress}>
        {playing ? (
          <View style={[wz.playBtn, { backgroundColor: "rgba(255,59,48,0.18)", borderWidth: 1.5, borderColor: "#FF3B30" }]}>
            <Ionicons name="stop" size={24} color="#FF3B30" />
          </View>
        ) : (
          <LinearGradient colors={WZ_ACCENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={wz.playBtn}>
            <Ionicons name="play" size={26} color="#FFF" style={{ marginLeft: 3 }} />
          </LinearGradient>
        )}
      </TouchableOpacity>

      <View style={{ flex: 1, marginLeft: 16 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
          <Text style={wz.previewLabel}>{label}</Text>
          <Text style={wz.previewTime}>{formatWizardTime(durationMs)}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", height: 40, gap: 2.5 }}>
          {Array.from({ length: 32 }).map((_, i) => {
            const h = 6 + Math.abs(Math.sin((i + 1) * 0.7)) * 32;
            return (
              <View
                key={i}
                style={{
                  flex: 1,
                  height: h,
                  borderRadius: 2,
                  backgroundColor: playing
                    ? `rgba(255,42,117,${0.45 + Math.abs(Math.sin(i * 0.5)) * 0.55})`
                    : "rgba(255,255,255,0.22)",
                }}
              />
            );
          })}
        </View>
        <Text style={wz.previewHint}>{playing ? "Playing... tap to stop" : "Tap to listen back"}</Text>
      </View>
    </View>
  );
}

function WizardStatusCard({ text, onCancel }: { text: string; onCancel: () => void }) {
  return (
    <View style={[wz.card, wz.cardActive, { marginTop: 16, alignItems: "center", paddingVertical: 22 }]}>
      <ActivityIndicator color="#FF2A75" size="large" />
      <Text style={wz.statusText}>{text}</Text>
      <TouchableOpacity id="voice-wizard-cancel" onPress={onCancel} style={wz.cancelBtn} activeOpacity={0.8}>
        <Ionicons name="close" size={16} color="rgba(255,255,255,0.75)" />
        <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 14, fontWeight: "500" }}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const wz = StyleSheet.create({
  glowBlob: {
    position: "absolute",
    top: -160,
    alignSelf: "center",
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: "rgba(255,42,117,0.12)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  stepLabel: {
    color: "#FF7AA8",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.6,
    marginBottom: 3,
  },
  headerTitle: {
    color: "#FFF",
    fontSize: 17,
    fontWeight: "700",
  },
  progressRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 24,
    marginBottom: 4,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    shadowColor: "#FF2A75",
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
  },
  heroTitle: {
    color: "#FFF",
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  heroSub: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    paddingHorizontal: 12,
  },
  fieldLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 16,
    marginBottom: 22,
  },
  fieldInput: {
    flex: 1,
    color: "#FFF",
    fontSize: 16,
    paddingVertical: 15,
  },
  fieldCount: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 12,
    marginLeft: 8,
    fontVariant: ["tabular-nums"],
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  primaryBtn: {
    borderRadius: 28,
    overflow: "hidden",
    shadowColor: "#FF2A75",
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  primaryBtnInner: {
    height: 56,
    borderRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryBtnText: {
    color: "#FFF",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  secondaryBtn: {
    height: 52,
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  secondaryBtnText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 15,
    fontWeight: "600",
  },
  tipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
    marginBottom: 22,
  },
  tipChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,42,117,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,42,117,0.22)",
  },
  tipText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    fontWeight: "500",
  },
  card: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    paddingHorizontal: 18,
    paddingVertical: 20,
    alignItems: "center",
  },
  cardActive: {
    borderColor: "rgba(255,42,117,0.45)",
    backgroundColor: "rgba(255,42,117,0.06)",
  },
  timer: {
    color: "#FFF",
    fontSize: 40,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    letterSpacing: 1,
    marginTop: 8,
  },
  timerHint: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    marginTop: 4,
  },
  durTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.1)",
    position: "relative",
  },
  durMarker: {
    position: "absolute",
    top: -3,
    width: 2,
    height: 12,
    marginLeft: -1,
    borderRadius: 1,
    backgroundColor: "rgba(255,255,255,0.6)",
  },
  durLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
  pulseRing: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#FF3B30",
  },
  recordOuter: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(10,10,14,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  recordInner: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  stopSquare: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#FF3B30",
  },
  recordLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    fontWeight: "500",
    marginTop: 4,
  },
  phraseCard: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,42,117,0.25)",
    paddingHorizontal: 18,
    paddingVertical: 18,
    alignItems: "center",
    marginTop: 18,
    marginBottom: 18,
  },
  phraseBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255,42,117,0.12)",
    marginBottom: 12,
  },
  phraseBadgeText: {
    color: "#FF2A75",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  phraseText: {
    color: "#FFF",
    fontSize: 18,
    fontStyle: "italic",
    fontWeight: "600",
    lineHeight: 27,
    textAlign: "center",
  },
  playBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  previewLabel: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "600",
  },
  previewTime: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
  previewHint: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    marginTop: 8,
  },
  statusText: {
    color: "rgba(255,255,255,0.8)",
    marginTop: 14,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 22,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
});
