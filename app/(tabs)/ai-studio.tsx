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
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { GlassView as BlurView } from "@/components/GlassView";
import { useThemeStore } from "../../store/themeStore";
import { useAIStore } from "../../store/aiStore";
import { useAuthStore } from "../../store/authStore";
import { supabase } from "../../lib/supabase";
import {
  generateSunoTrack,
  generateLyrics,
} from "../../lib/sunoApi";
import {
  generateVoiceValidation,
  getVoiceValidationInfo,
  createCustomVoice,
  getCustomVoiceRecord,
  generateVoiceTest,
  getTaskInfo,
} from "../../lib/sunoApi";
import type { SunoTrackResult } from "../../lib/sunoApi";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { Audio } from 'expo-av';
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import { usePlayerStore } from "../../store/playerStore";
import { CoverArtModal } from "../../components/CoverArtModal";
import { EditSongDetailsModal } from "../../components/EditSongDetailsModal";
import { ExtendSongModal } from "../../components/ExtendSongModal";
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

let AudioModule: any = Audio;
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


  const { playTrack } = usePlayerStore();
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
  const [isExtendModalOpen, setIsExtendModalOpen] = useState(false);
  const [selectedSongTask, setSelectedSongTask] = useState<any>(null);
  const [audioTitle, setAudioTitle] = useState("Untitled");
  const [selectedAudioUri, setSelectedAudioUri] = useState<string | null>(null);
  const hasAudio = !!selectedAudioUri;
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

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
          audioUrl = info?.data?.[0]?.audioUrl || info?.data?.[0]?.audio_url || "";
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
    if (!url || !AudioModule) return;
    try {
      if (testPlayingId === personaId && testSound) {
        await testSound.stopAsync();
        setTestPlayingId(null);
        return;
      }
      // Stop any currently playing test
      if (testSound) { await testSound.stopAsync().catch(() => {}); }
      const { sound: newSound } = await AudioModule.Sound.createAsync(
        { uri: url },
        { shouldPlay: true },
        (status: any) => { if (status.didJustFinish) setTestPlayingId(null); }
      );
      setTestSound(newSound);
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
    const id = setInterval(() => setVizTick(t => t + 1), 80);
    return () => clearInterval(id);
  }, [isWizardRecording]);

  const startWizardRecording = async () => {
    try {
      if (!AudioModule) {
        setIsWizardRecording(true);
        return;
      }
      const permission = await AudioModule.requestPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Permission Denied", "Microphone access is needed to record your voice.");
        return;
      }
      await AudioModule.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      const { recording } = await AudioModule.Recording.createAsync(
        { ...AudioModule.RecordingOptionsPresets.HIGH_QUALITY, isMeteringEnabled: true },
        (status: any) => {
          if (status.isRecording) {
            setWizardDurationMs(status.durationMillis);
            // Suno voice persona requires 5–60 seconds
            if (status.durationMillis >= 60000) {
              stopWizardRecording(true);
              return;
            }
            const db = status.metering !== undefined ? status.metering : -160;
            const val = Math.max(0, Math.min(1, (db + 50) / 50));
            setWizardVolume(val);
          }
        },
        30
      );
      setWizardRecording(recording);
      setIsWizardRecording(true);
      setWizardDurationMs(0);
      setWizardVolume(0);
    } catch (err) {
      console.error("Failed to start wizard recording", err);
      Alert.alert("Error", "Could not start recording. Please try again.");
    }
  };

  // Wizard preview playback
  const [wizardPreviewSound, setWizardPreviewSound] = useState<any>(null);
  const [isWizardPreviewPlaying, setIsWizardPreviewPlaying] = useState(false);

  const playWizardPreview = async () => {
    const currentUri = voiceWizardStep === 5 ? verifyAudioUri : personaAudioUri;
    if (!currentUri || !AudioModule) return;
    try {
      // Ensure audio is routed through the main speaker (not earpiece) on Android
      await AudioModule.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      if (wizardPreviewSound) {
        await wizardPreviewSound.playFromPositionAsync(0);
        setIsWizardPreviewPlaying(true);
        return;
      }
      const { sound } = await AudioModule.Sound.createAsync(
        { uri: currentUri },
        { shouldPlay: true, volume: 1.0 },
        (status: any) => {
          if (status.didJustFinish || !status.isPlaying) {
            setIsWizardPreviewPlaying(false);
          }
        }
      );
      setWizardPreviewSound(sound);
      setIsWizardPreviewPlaying(true);
    } catch (e) {
      console.error('Wizard preview play error', e);
      Alert.alert('Playback Error', 'Could not play the recording. Please try recording again.');
    }
  };

  const stopWizardPreview = async () => {
    try {
      await wizardPreviewSound?.stopAsync();
      setIsWizardPreviewPlaying(false);
    } catch (e) {}
  };

  // Clean up preview sound when wizard closes
  useEffect(() => {
    if (!isVoiceWizardOpen) {
      wizardPreviewSound?.unloadAsync().catch(() => {});
      setWizardPreviewSound(null);
      setIsWizardPreviewPlaying(false);
    }
  }, [isVoiceWizardOpen]);

  const stopWizardRecording = async (save: boolean) => {
    if (!wizardRecording) {
      setIsWizardRecording(false);
      if (save) {
        if (voiceWizardStep === 2) {
          setPersonaAudioUri("mock-persona-voice.m4a");
          setVoiceWizardStep(3); // → Preview Source
        } else if (voiceWizardStep === 4) {
          setVerifyAudioUri("mock-persona-voice.m4a");
          setVoiceWizardStep(5); // → Preview Verify
        }
      }
      return;
    }
    try {
      await wizardRecording.stopAndUnloadAsync();
      const uri = wizardRecording.getURI();
      setWizardRecording(null);
      setIsWizardRecording(false);
      setWizardVolume(0);

      // Immediately switch back to playback mode so preview works on both iOS and Android
      try {
        await AudioModule?.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false, // route through main speaker, NOT earpiece
        });
      } catch (_) {}

      if (save && uri) {
        const durationSec = wizardDurationMs / 1000;
        if (durationSec < 5) {
          Alert.alert("Too Short", "Please record at least 5 seconds of your voice.");
          return;
        }
        if (voiceWizardStep === 2) {
          setPersonaAudioUri(uri);
          setWizardPreviewSound(null); // reset so it reloads the new recording
          setVoiceWizardStep(3); // → Preview Source
        } else if (voiceWizardStep === 4) {
          setVerifyAudioUri(uri);
          setWizardPreviewSound(null);
          setVoiceWizardStep(5); // → Preview Verify
        }
      }
    } catch (err) {
      console.error("Failed to stop wizard recording", err);
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
          const fileName = `persona_source_${session?.user?.id}_${Date.now()}.m4a`;
          const fileBase64 = await FileSystem.readAsStringAsync(personaAudioUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const fileData = Uint8Array.from(atob(fileBase64), (c) => c.charCodeAt(0));
          const { error: uploadError } = await supabase.storage
            .from("voice-samples")
            .upload(fileName, fileData, { contentType: "audio/m4a", upsert: true });
          if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
          const { data: urlData } = supabase.storage
            .from("voice-samples")
            .getPublicUrl(fileName);
          publicVoiceUrl = urlData.publicUrl;
        }

        if (personaCancelRef.current) return;

        setPersonaStatusText("Submitting voice for analysis...");
        const durationSec = wizardDurationMs / 1000 || 30;
        const taskId = await generateVoiceValidation(
          publicVoiceUrl,
          0,
          Math.min(durationSec, 60),
          "en",
          undefined,
        );

        if (personaCancelRef.current) return;

        setPersonaStatusText("Analyzing your voice... (this takes ~30s)");
        let validated = false;
        let vText = "";
        for (let i = 0; i < 30; i++) {
          if (personaCancelRef.current) return;
          await new Promise((r) => setTimeout(r, 3500));
          if (personaCancelRef.current) return;

          const info = await getVoiceValidationInfo(taskId);
          if (!info) continue;

          const status = (info?.status || info?.successFlag || "").toUpperCase();
          if (status === "SUCCESS" || status === "COMPLETE") {
            vText = info?.response?.validateText || info?.validateText || "I authorize this voice cloning process.";
            validated = true;
            break;
          } else if (status === "FAILED" || status === "ERROR") {
            throw new Error(info?.failReason || "Voice validation failed. Please try a cleaner recording.");
          }
          setPersonaStatusText(`Analyzing your voice... (${i + 1}/30)`);
        }
        if (!validated) throw new Error("Voice analysis timed out.");
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
          const fileName = `persona_verify_${session?.user?.id}_${Date.now()}.m4a`;
          const fileBase64 = await FileSystem.readAsStringAsync(verifyAudioUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const fileData = Uint8Array.from(atob(fileBase64), (c) => c.charCodeAt(0));
          const { error: uploadError } = await supabase.storage
            .from("voice-samples")
            .upload(fileName, fileData, { contentType: "audio/m4a", upsert: true });
          if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
          const { data: urlData } = supabase.storage
            .from("voice-samples")
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
        let personaId = "";
        for (let i = 0; i < 40; i++) {
          if (personaCancelRef.current) return;
          await new Promise((r) => setTimeout(r, 4000));
          if (personaCancelRef.current) return;

          const record = await getCustomVoiceRecord(createTaskId);
          if (!record) continue;

          const status = (record?.status || record?.successFlag || "").toUpperCase();
          if (status === "SUCCESS" || status === "COMPLETE") {
            personaId = record?.response?.voiceId || record?.voiceId || createTaskId;
            break;
          } else if (status === "FAILED" || status === "ERROR") {
            throw new Error(record?.failReason || "Failed to create voice persona.");
          }
          setPersonaStatusText(`Finalizing your AI voice... (${i + 1}/40)`);
        }
        if (!personaId) throw new Error("Persona creation timed out.");

        addPersona({
          id: personaId,
          name: personaName.trim(),
          description: personaDescription.trim(),
          createdAt: Date.now(),
        });

        Alert.alert(
          "🎤 Voice Created!",
          `"${personaName.trim()}" is ready! You can now use it when generating songs.`,
        );
        setIsVoiceWizardOpen(false);
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
        if (isRecording && typeof AudioModule === "undefined") {
          setVolume(Math.random() * 0.8 + 0.2);
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
        if (response.title && !songTitle?.trim()) setSongTitle(response.title);
        if (response.tags && !selectedStyles?.length) {
          const suggested = response.tags.split(',').map((t: string) => t.trim()).filter(Boolean).slice(0, 2);
          if (suggested.length) setSelectedStyles(suggested);
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

  const handleGenerate = async () => {
    if (!prompt.trim() && !hasAudio) return;

    if (!session?.user?.id) {
      Alert.alert(
        "Authentication Required",
        "Please sign in to generate music.",
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
      Alert.alert("Error", "Failed to deduct credits. Please try again.");
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
    const taskTitle = prompt.trim() || "Generated Audio";

    // Add task in PROCESSING state — it will update to SUCCESS when polling completes
    addTask(newTaskId, taskTitle, "GENERATE");
    updateTask(newTaskId, "PROCESSING");

    // Clear input immediately so the user can compose another track
    const capturedPrompt = prompt;
    const capturedLyrics = lyricsText;
    const capturedStyles = stylesText;
    const capturedAudioUri = selectedAudioUri;
    const capturedPersonaId = selectedPersonaId;
    setPrompt("");
    setIsInputExpanded(false);

    // Run generation in the background so the UI stays responsive
    (async () => {
      try {
        const result: SunoTrackResult = await generateSunoTrack({
          prompt: capturedLyrics || capturedPrompt,
          tags: capturedStyles || (!capturedLyrics ? capturedPrompt : ""),
          title: taskTitle,
          make_instrumental: !capturedLyrics,
          audioUrl: capturedAudioUri || undefined,
          personaId: capturedPersonaId || undefined,
        });

        const trackId = result.id || newTaskId;
        const finalAudioUrl = result.audioUrl || "";
        const finalImageUrl = result.imageUrl || "";
        const finalTitle = result.title || taskTitle;

        updateTask(newTaskId, "SUCCESS", [
          {
            id: trackId,
            audioUrl: finalAudioUrl,
            videoUrl: result.videoUrl || "",
            imageUrl: finalImageUrl,
            title: finalTitle,
            prompt: capturedPrompt || capturedLyrics,
            lyrics: capturedLyrics || capturedPrompt,
            genre: capturedStyles || "AI Generated",
            tags: capturedStyles || "AI Generated",
            status: "SUCCESS",
          } as any,
        ]);

        // Persist to Supabase
        if (session?.user?.id && finalAudioUrl) {
          supabase
            .from("tracks")
            .insert({
              id: trackId,
              user_id: session.user.id,
              title: finalTitle,
              artist_name: profile?.username || "BongoBox Creator",
              genre: capturedStyles || "AI Generated",
              cover_url: finalImageUrl,
              audio_url: finalAudioUrl,
              duration_sec: 0,
              is_public: false,
            })
            .then(({ error: insertError }) => {
              if (insertError)
                console.error("Supabase track insert error:", insertError);
            });
        }
      } catch (e: any) {
        updateTask(newTaskId, "FAILED");
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

    setSelectedAudioUri(null);
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

  const handleVideoPicker = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const videoUri = result.assets[0].uri;
        console.log("Selected video:", videoUri);

        // Convert to audio using ffmpeg locally
        const outputUri = videoUri.replace(/\.[^/.]+$/, "") + "_audio.mp3";

        if (FFmpegKit && ReturnCode) {
          console.log("Converting video to audio...", outputUri);
          const session = await FFmpegKit.execute(
            `-y -i ${videoUri} -q:a 0 -map a ${outputUri}`,
          );
          const returnCode = await session.getReturnCode();

          if (ReturnCode.isSuccess(returnCode)) {
            console.log("Successfully converted video to audio:", outputUri);
            setSelectedAudioUri(outputUri);
            setIsInputExpanded(false);
            setIsAudioMenuOpen(false);
            setTimeout(() => {
              setIsAudioEditorOpen(true);
            }, 400);
          } else {
            console.error("FFmpeg conversion failed");
            Alert.alert("Error", "Could not extract audio from video.");
          }
        } else {
          console.log(
            "FFmpegKit not available, skipping conversion and proceeding with original video URI for now",
          );
          setSelectedAudioUri(videoUri);
          setIsInputExpanded(false);
          setIsAudioMenuOpen(false);
          setTimeout(() => {
            setIsAudioEditorOpen(true);
          }, 400);
        }
      }
    } catch (error) {
      console.error("Error picking video:", error);
      Alert.alert("Error", "Failed to pick video");
    }
  };

  const startRecording = async () => {
    try {
      if (!AudioModule) {
        setIsRecording(true);
        setVolume(0);
        return;
      }
      const permission = await AudioModule.requestPermissionsAsync();
      if (permission.status !== "granted") return;

      await AudioModule.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await AudioModule.Recording.createAsync(
        {
          ...AudioModule.RecordingOptionsPresets.HIGH_QUALITY,
          isMeteringEnabled: true,
        },
        (status) => {
          if (status.isRecording) {
            setRecordingDurationMs(status.durationMillis);
            
            // Enforce max 60 seconds (Suno persona limit)
            if (status.durationMillis >= 60000) {
              stopRecording(true);
              return;
            }

            const db = status.metering !== undefined ? status.metering : -160;
            // Map -50dB to 0dB into 0 to 1 scale for visual volume
            const val = (db + 50) / 50;
            const newVol = Math.max(0, Math.min(1, val));
            
            setVolume(newVol);
          }
        },
        30 // 30ms update interval for smoother 33fps animation
      );
      
      setRecording(recording);
      setIsRecording(true);
      setVolume(0);
      setRecordingDurationMs(0);
    } catch (err) {
      console.error("Failed to start recording", err);
    }
  };

  const stopRecording = async (submit: boolean) => {
    if (!recording) {
      setIsRecording(false);
      if (submit) {
        setSelectedAudioUri("mock-uri");
        setIsAudioMenuOpen(false);
        setTimeout(() => setIsAudioEditorOpen(true), 400);
      }
      return;
    }
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
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
      if (!AudioModule) {
        Alert.alert("Audio error", "Audio module is undefined.");
        return;
      }

      if (!selectedAudioUri) {
        return;
      }

      if (sound) {
        if (isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
        } else {
          await AudioModule.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
            staysActiveInBackground: true,
            playThroughEarpieceAndroid: false,
            shouldDuckAndroid: true,
          });
          await sound.playAsync();
          setIsPlaying(true);
        }
      } else {
        await AudioModule.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          playThroughEarpieceAndroid: false,
          shouldDuckAndroid: true,
        });
        const { sound: newSound } = await AudioModule.Sound.createAsync(
          { uri: selectedAudioUri },
          { shouldPlay: true },
        );
        newSound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            setIsPlaying(false);
            newSound.setPositionAsync(0);
          }
        });
        setSound(newSound);
        setIsPlaying(true);
      }
    } catch (err) {
      console.error("Error playing audio", err);
    }
  };

  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

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
                          onPress: () => {
                            setPrompt("");
                            setStylesText("");
                            setSelectedAudioUri(null);
                            setAudioTitle("");
                            setLyricsHistory([""]);
                            setLyricsHistoryIndex(0);
                            setStylesHistory([""]);
                            setStylesHistoryIndex(0);
                            setSelectedPersonaId(null);
                          },
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
                    <TouchableOpacity
                      style={[
                        styles.iconChip,
                        isPlusMenuOpen && {
                          backgroundColor: "rgba(255,255,255,0.15)",
                        },
                      ]}
                      onPress={() => setIsPlusMenuOpen(!isPlusMenuOpen)}
                    >
                      <Ionicons name="add" size={18} color="#FFF" />
                    </TouchableOpacity>
                    
                    {/* ── Voice Persona Selector Chip ── */}
                    {personas.length > 0 && (
                      <TouchableOpacity
                        style={[
                          styles.chip,
                          selectedPersonaId && {
                            backgroundColor: "rgba(130, 80, 255, 0.35)",
                            borderColor: "#8250FF",
                            borderWidth: 1.5,
                            shadowColor: "#8250FF",
                            shadowOffset: { width: 0, height: 0 },
                            shadowOpacity: 0.9,
                            shadowRadius: 12,
                            elevation: 10,
                          },
                        ]}
                        onPress={() => setIsPersonaModalOpen(true)}
                      >
                        <Ionicons
                          name="mic-outline"
                          size={15}
                          color={selectedPersonaId ? "#C8A8FF" : "rgba(255,255,255,0.7)"}
                          style={{ marginRight: 5 }}
                        />
                        <Text
                          style={[
                            styles.chipText,
                            selectedPersonaId && { color: "#C8A8FF" },
                          ]}
                          numberOfLines={1}
                        >
                          {selectedPersonaId
                            ? (personas.find((p: any) => p.id === selectedPersonaId)?.name ?? "Voice")
                            : "Voice"}
                        </Text>
                        {selectedPersonaId && (
                          <TouchableOpacity
                            onPress={() => setSelectedPersonaId(null)}
                            style={{ marginLeft: 5 }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons
                              name="close"
                              size={13}
                              color="rgba(200,168,255,0.7)"
                            />
                          </TouchableOpacity>
                        )}
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={[
                        styles.chip,
                        hasAudio && {
                          backgroundColor: "rgba(255,255,255,0.1)",
                          borderColor: "rgba(255,255,255,0.15)",
                          paddingLeft: 6,
                          paddingRight: 10,
                          paddingVertical: 6,
                        },
                        !hasAudio && isAudioMenuOpen && {
                          backgroundColor: "rgba(255,255,255,0.15)",
                        },
                      ]}
                      onPress={() => {
                        if (!hasAudio) {
                          setIsAudioMenuOpen(!isAudioMenuOpen);
                        } else {
                          // Tap on the pill text could open the editor or play, but we'll leave it as play
                          handlePlayPause();
                        }
                      }}
                    >
                      {hasAudio ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <TouchableOpacity 
                            style={{ 
                              width: 24, 
                              height: 24, 
                              borderRadius: 12, 
                              backgroundColor: 'rgba(255,255,255,0.2)',
                              justifyContent: 'center',
                              alignItems: 'center',
                              marginRight: 8,
                              overflow: 'hidden'
                            }}
                            onPress={handlePlayPause}
                          >
                            <Image 
                              source={{ uri: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=100&auto=format&fit=crop' }} 
                              style={{ width: '100%', height: '100%', position: 'absolute' }} 
                            />
                            <View style={{ width: '100%', height: '100%', position: 'absolute', backgroundColor: 'rgba(0,0,0,0.4)' }} />
                            <Ionicons name={isPlaying ? "pause" : "play"} size={14} color="#FFF" style={{ marginLeft: isPlaying ? 0 : 2 }} />
                          </TouchableOpacity>
                          <Text style={[styles.chipText, { color: "#FFF", fontSize: 13 }]} numberOfLines={1}>
                            {audioTitle || "Remix Audio"}
                          </Text>
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation();
                              setSelectedAudioUri(null);
                              setAudioTitle("");
                              if (sound) sound.unloadAsync();
                            }}
                            style={{ marginLeft: 8, padding: 2 }}
                          >
                            <Ionicons
                              name="close"
                              size={16}
                              color="rgba(255,255,255,0.5)"
                            />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <>
                          <Ionicons
                            name="musical-notes-outline"
                            size={16}
                            color="rgba(255,255,255,0.8)"
                            style={{ marginRight: 6 }}
                          />
                          <Text style={styles.chipText}>Audio</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[
                        styles.chip,
                        stylesText.trim().length > 0 && {
                          backgroundColor: "rgba(255,255,255,0.1)",
                          borderColor: "rgba(255,255,255,0.15)",
                        },
                      ]}
                      onPress={() => setIsStylesMenuOpen(true)}
                    >
                      {stylesText.trim().length > 0 ? (
                        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: "#3b82f6", justifyContent: "center", alignItems: "center", marginRight: 6 }}>
                          <Ionicons name="musical-note" size={12} color="#FFF" />
                        </View>
                      ) : (
                        <Ionicons
                          name="color-palette-outline"
                          size={16}
                          color="rgba(255,255,255,0.8)"
                          style={{ marginRight: 6 }}
                        />
                      )}
                      <Text
                        style={[
                          styles.chipText,
                          stylesText.trim().length > 0 && { color: "#FFF" },
                        ]}
                      >
                        Styles
                      </Text>
                      {stylesText.trim().length > 0 && (
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            setStylesText("");
                          }}
                          style={{ marginLeft: 6 }}
                        >
                          <Ionicons
                            name="close"
                            size={14}
                            color="rgba(255,255,255,0.5)"
                          />
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.chip,
                        lyricsText.trim().length > 0 && {
                          backgroundColor: "rgba(255,255,255,0.1)",
                          borderColor: "rgba(255,255,255,0.15)",
                        },
                      ]}
                      onPress={() => setIsLyricsMenuOpen(true)}
                    >
                      {lyricsText.trim().length > 0 && (
                        <Ionicons
                          name="list-outline"
                          size={16}
                          color="#10b981"
                          style={{ marginRight: 6 }}
                        />
                      )}
                      <Text
                        style={[
                          styles.chipText,
                          lyricsText.trim().length > 0 && { color: "#FFF" },
                        ]}
                      >
                        Lyrics
                      </Text>
                      {lyricsText.trim().length > 0 && (
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            setLyricsText("");
                          }}
                          style={{ marginLeft: 6 }}
                        >
                          <Ionicons
                            name="close"
                            size={14}
                            color="rgba(255,255,255,0.5)"
                          />
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>
                  </View>
                  {isPlusMenuOpen && (
                    <View style={styles.plusMenuPopover}>
                      <TouchableOpacity
                        style={styles.plusMenuItem}
                        onPress={() => {
                          setIsPlusMenuOpen(false);
                          setIsInputExpanded(false);
                          setIsPersonaModalOpen(true);
                        }}
                      >
                        <Ionicons
                          name="person-outline"
                          size={20}
                          color="rgba(255,255,255,0.9)"
                        />
                        <Text style={styles.plusMenuItemText}>
                          Voice (Sauti Zako)
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.plusMenuItem}
                        onPress={() => {
                          setIsPlusMenuOpen(false);
                          setIsAudioMenuOpen(true);
                        }}
                      >
                        <Ionicons
                          name="pulse-outline"
                          size={20}
                          color="rgba(255,255,255,0.9)"
                        />
                        <Text style={styles.plusMenuItemText}>Audio</Text>
                        <Ionicons
                          name="chevron-forward"
                          size={16}
                          color="rgba(255,255,255,0.4)"
                          style={{ marginLeft: "auto" }}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.plusMenuItem}>
                        <Ionicons
                          name="image-outline"
                          size={20}
                          color="rgba(255,255,255,0.9)"
                        />
                        <Text style={styles.plusMenuItemText}>Image</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.plusMenuItem}
                        onPress={() => {
                          setIsPlusMenuOpen(false);
                          handleVideoPicker();
                        }}
                      >
                        <Ionicons
                          name="film-outline"
                          size={20}
                          color="rgba(255,255,255,0.9)"
                        />
                        <Text style={styles.plusMenuItemText}>Video</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.plusMenuItem}
                        onPress={() => {
                          setIsPlusMenuOpen(false);
                          setIsAdvancedMenuOpen(true);
                        }}
                      >
                        <Ionicons
                          name="options-outline"
                          size={20}
                          color="rgba(255,255,255,0.9)"
                        />
                        <Text style={styles.plusMenuItemText}>Advanced</Text>
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
                        !prompt.trim() && { opacity: 0.5 },
                      ]}
                      onPress={handleGenerate}
                      disabled={!prompt.trim()}
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
          <Text style={[styles.headerTitle, { color: COLORS.textPrimary }]}>
            Studio
          </Text>
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
          {tasks.map((task) => {
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
                    });
                  }
                }}
              >
                {/* Optional pink dot indicator */}
                <View style={styles.taskDot} />

                <View style={styles.taskImageContainer}>
                  {task.status === "GENERATE" ? (
                    <View
                      style={[
                        styles.taskImage,
                        {
                          justifyContent: "center",
                          alignItems: "center",
                          backgroundColor: "#333",
                        },
                      ]}
                    >
                      <ActivityIndicator color={COLORS.gold} />
                    </View>
                  ) : (
                    <Image
                      source={{
                        uri: track?.imageUrl || "https://picsum.photos/100",
                      }}
                      style={styles.taskImage}
                    />
                  )}
                  <View style={styles.taskDuration}>
                    <Text style={styles.taskDurationText}>
                      {track?.duration
                        ? `${Math.floor(track.duration / 60)}:${(track.duration % 60).toString().padStart(2, "0")}`
                        : "0:48"}
                    </Text>
                  </View>
                </View>
                <View style={styles.taskInfo}>
                  <View style={styles.taskTitleRow}>
                    <Text
                      style={[styles.taskTitle, { color: COLORS.textPrimary }]}
                      numberOfLines={1}
                    >
                      {task.status === "GENERATE"
                        ? "Generating..."
                        : task.title || "Untitled Song"}
                    </Text>
                    <Text style={styles.taskVersionTag}>V6-DAPAZ</Text>
                  </View>
                  <Text style={styles.taskSubtitle} numberOfLines={2}>
                    1 {track?.prompt || "electronic"}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.moreButton}
                  onPress={() => {
                    setSelectedSongTask(task);
                    setIsSongOptionsOpen(true);
                  }}
                >
                  <Ionicons
                    name="ellipsis-horizontal"
                    size={20}
                    color={COLORS.textSecondary}
                  />
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
                multiline={false}
                editable={false}
                pointerEvents="none"
              />
            </TouchableOpacity>
            {prompt || stylesText || selectedAudioUri ? (
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
              style={[styles.sendButton, !prompt.trim() && { opacity: 0.8 }]}
              onPress={handleGenerate}
              disabled={!prompt.trim()}
            >
              <LinearGradient
                colors={["#FF512F", "#F09819"]}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons name="arrow-up" size={20} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        </View>
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
                          `Duration: ${modalSongDuration ? `${Math.floor(modalSongDuration / 60)}:${(modalSongDuration % 60).toString().padStart(2, "0")}` : "Unknown"}
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
                      onPress={() => {
                        setIsSongOptionsOpen(false);
                        if (modalSongAudioUrl) {
                          Share.share({
                            message: `Check out my AI song '${modalSongTitle}': ${modalSongAudioUrl}`,
                          });
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
                        onPress={() => {
                          setIsSongOptionsOpen(false);
                          setPrompt(modalSongPrompt || "");
                          setStylesText(modalSongTags || "");
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
                      Alert.alert("Publish", "Publishing to global feed...");
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
        onRequestClose={() => setIsPersonaModalOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: "#111", paddingTop: 20 }}>
          {/* Handle */}
          <View style={{ alignItems: "center", marginBottom: 20 }}>
            <View style={{ width: 40, height: 4, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 2 }} />
          </View>

          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, marginBottom: 24 }}>
            <TouchableOpacity onPress={() => setIsPersonaModalOpen(false)} style={{ padding: 4, marginRight: 12 }}>
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
                      setIsPersonaModalOpen(false);
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

                    {/* Bottom row: Test / Play verification */}
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
                          <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: "600" }}>Verify My Voice</Text>
                        </TouchableOpacity>
                      )}
                    </View>
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
        }}
      >
        <View style={{ flex: 1, backgroundColor: "#000", overflow: "hidden" }}>
          <LinearGradient
            colors={["#0F0C29", "#302B63", "#24243E"]}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />

          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: (insets.top || 0) + 16, paddingBottom: 16 }}>
            <TouchableOpacity
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", justifyContent: "center", alignItems: "center" }}
              onPress={() => {
                if (isWizardRecording) stopWizardRecording(false);
                stopWizardPreview();
                if (voiceWizardStep > 1) { setVoiceWizardStep((voiceWizardStep - 1) as any); }
                else { setIsVoiceWizardOpen(false); }
              }}
            >
              <Ionicons name={voiceWizardStep > 1 ? "arrow-back" : "close"} size={22} color="#FFF" />
            </TouchableOpacity>

            <View style={{ backgroundColor: "rgba(0,0,0,0.3)", paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
              <Text style={{ color: "#FFF", fontSize: 15, fontWeight: "600" }}>
                {voiceWizardStep === 1 ? "Name Your Voice" 
                  : voiceWizardStep === 2 ? "Record Voice Sample" 
                  : voiceWizardStep === 3 ? "Preview Sample" 
                  : voiceWizardStep === 4 ? "Verify Identity" 
                  : "Preview Verification"}
              </Text>
            </View>

            <View style={{ width: 40 }} />
          </View>

          {/* Step indicator */}
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 8 }}>
            {[1, 2, 3, 4, 5].map((s) => (
              <View key={s} style={{ width: s === voiceWizardStep ? 24 : 8, height: 8, borderRadius: 4, backgroundColor: s === voiceWizardStep ? "#FF2A75" : s < voiceWizardStep ? "rgba(255,42,117,0.4)" : "rgba(255,255,255,0.2)" }} />
            ))}
          </View>

          {voiceWizardStep === 1 ? (
            /* ── STEP 1: NAME & DESCRIPTION ── */
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, paddingHorizontal: 28 }}>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 20, paddingBottom: 60 }}>
                {/* Name input */}
                <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: "600", letterSpacing: 1, marginBottom: 10 }}>VOICE NAME *</Text>
                <View style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 4, marginBottom: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
                  <TextInput
                    style={{ color: "#FFF", fontSize: 17, paddingVertical: 12 }}
                    placeholder="e.g. My Rap Voice"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={personaName}
                    onChangeText={setPersonaName}
                    selectionColor="#FF2A75"
                    maxLength={40}
                    autoFocus
                  />
                </View>

                <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: "600", letterSpacing: 1, marginBottom: 10 }}>DESCRIPTION (optional)</Text>
                <View style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 4, marginBottom: 36, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
                  <TextInput
                    style={{ color: "#FFF", fontSize: 16, paddingVertical: 12 }}
                    placeholder="e.g. Deep bass voice, smooth R&B style"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={personaDescription}
                    onChangeText={setPersonaDescription}
                    selectionColor="#FF2A75"
                    maxLength={120}
                    multiline
                  />
                </View>

                <TouchableOpacity
                  style={{ borderRadius: 28, overflow: "hidden" }}
                  onPress={() => {
                    if (!personaName.trim()) {
                      Alert.alert("Required", "Please provide a name for your voice persona.");
                      return;
                    }
                    setVoiceWizardStep(2);
                  }}
                >
                  <LinearGradient colors={["#FF2A75", "#FF512F"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 18, alignItems: "center", borderRadius: 28 }}>
                    <Text style={{ color: "#FFF", fontSize: 17, fontWeight: "700", letterSpacing: 0.5 }}>Next</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          ) : voiceWizardStep === 2 ? (
            /* ── STEP 2: RECORD SOURCE ── */
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, textAlign: "center", marginBottom: 24, paddingHorizontal: 40, lineHeight: 22 }}>
                Record 5-30 seconds of clear singing or speaking.
              </Text>

              {/* Dynamic Bar Visualizer — reacts to microphone volume */}
              <View style={{ width: 280, height: 120, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 5, marginBottom: 8 }}>
                {Array.from({ length: 22 }).map((_, i) => {
                  const phase = vizTick * 0.3 + i * 0.6;
                  const baseH = 8 + Math.abs(Math.sin(phase)) * 20;
                  const volBoost = isWizardRecording ? wizardVolume * 85 * (0.4 + Math.abs(Math.sin(phase + i))) : 0;
                  const h = Math.min(baseH + volBoost, 100);
                  const isCenter = Math.abs(i - 10) < 4;
                  const opacity = isWizardRecording ? (0.3 + wizardVolume * 0.7) : 0.15;
                  return (
                    <View
                      key={i}
                      style={{
                        width: 8,
                        height: Math.max(h, 4),
                        borderRadius: 4,
                        backgroundColor: isWizardRecording
                          ? (isCenter ? "#FF2A75" : `rgba(255,${42 + Math.floor(wizardVolume * 80)},117,${opacity})`)
                          : "rgba(255,255,255,0.12)",
                        shadowColor: "#FF2A75",
                        shadowOpacity: isWizardRecording ? 0.6 : 0,
                        shadowRadius: 4,
                        elevation: isWizardRecording ? 3 : 0,
                      }}
                    />
                  );
                })}
              </View>

              {/* Timer */}
              <View style={{ marginTop: 36, alignItems: "center" }}>
                <Text style={{ color: "#FFF", fontSize: 32, fontWeight: "700", fontVariant: ["tabular-nums"], letterSpacing: 2 }}>
                  {`${Math.floor(wizardDurationMs / 60000)}:${Math.floor((wizardDurationMs % 60000) / 1000).toString().padStart(2, "0")}`}
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 6 }}>
                  {isWizardRecording ? (wizardDurationMs < 5000 ? "Keep going... (min 5s)" : "Recording — tap to stop") : "Tap the button below to start"}
                </Text>
              </View>

              {/* Record / Stop button */}
              <TouchableOpacity
                style={{
                  marginTop: 48,
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: isWizardRecording ? "rgba(255,59,48,0.25)" : "rgba(255,42,117,0.2)",
                  justifyContent: "center",
                  alignItems: "center",
                  borderWidth: 2,
                  borderColor: isWizardRecording ? "#FF3B30" : "#FF2A75",
                  shadowColor: isWizardRecording ? "#FF3B30" : "#FF2A75",
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.7,
                  shadowRadius: 16,
                  elevation: 12,
                }}
                onPress={() => {
                  if (isWizardRecording) { stopWizardRecording(true); } else { startWizardRecording(); }
                }}
              >
                {isWizardRecording ? (
                  <View style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: "#FF3B30" }} />
                ) : (
                  <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#FF2A75" }} />
                )}
              </TouchableOpacity>

              {/* Upload alternative */}
              <TouchableOpacity
                style={{ marginTop: 24, flexDirection: "row", alignItems: "center", padding: 12 }}
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
                <Ionicons name="cloud-upload-outline" size={18} color="rgba(255,255,255,0.5)" />
                <Text style={{ color: "rgba(255,255,255,0.5)", marginLeft: 8, fontSize: 14 }}>Upload audio instead</Text>
              </TouchableOpacity>
            </View>
          ) : voiceWizardStep === 3 ? (
            /* ── STEP 3: PREVIEW SOURCE ── */
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 }}>
              {/* Waveform visual */}
              <View style={{ flexDirection: "row", alignItems: "center", height: 80, gap: 3, marginBottom: 40 }}>
                {Array.from({ length: 40 }).map((_, i) => {
                  const h = 8 + Math.abs(Math.sin((i + 1) * 0.7)) * 52;
                  return (
                    <View
                      key={i}
                      style={{
                        width: 5,
                        height: h,
                        borderRadius: 3,
                        backgroundColor: isWizardPreviewPlaying
                          ? `rgba(255,42,117,${0.4 + Math.abs(Math.sin(i * 0.5)) * 0.6})`
                          : "rgba(255,255,255,0.25)",
                      }}
                    />
                  );
                })}
              </View>

              {/* Duration label */}
              <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, marginBottom: 32 }}>
                {`${Math.floor(wizardDurationMs / 60000)}:${Math.floor((wizardDurationMs % 60000) / 1000).toString().padStart(2, "0")} recorded`}
              </Text>

              {/* Play / Stop button */}
              <TouchableOpacity
                onPress={isWizardPreviewPlaying ? stopWizardPreview : playWizardPreview}
                style={{
                  width: 90,
                  height: 90,
                  borderRadius: 45,
                  backgroundColor: isWizardPreviewPlaying ? "rgba(255,59,48,0.2)" : "rgba(255,42,117,0.2)",
                  borderWidth: 2,
                  borderColor: isWizardPreviewPlaying ? "#FF3B30" : "#FF2A75",
                  justifyContent: "center",
                  alignItems: "center",
                  shadowColor: isWizardPreviewPlaying ? "#FF3B30" : "#FF2A75",
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.8,
                  shadowRadius: 20,
                  elevation: 15,
                  marginBottom: 16,
                }}
              >
                <Ionicons
                  name={isWizardPreviewPlaying ? "stop" : "play"}
                  size={36}
                  color={isWizardPreviewPlaying ? "#FF3B30" : "#FF2A75"}
                />
              </TouchableOpacity>
              <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 48 }}>
                {isWizardPreviewPlaying ? "Playing... tap to stop" : "Tap to listen back"}
              </Text>

              {/* Status + Cancel */}
              {isPersonaGenerating ? (
                <View style={{ alignItems: "center", marginBottom: 24, width: "100%" }}>
                  <ActivityIndicator color="#FF2A75" size="large" />
                  <Text style={{ color: "rgba(255,255,255,0.7)", marginTop: 12, fontSize: 14, textAlign: "center", lineHeight: 20 }}>
                    {personaStatusText || "Processing..."}
                  </Text>
                  <TouchableOpacity
                    onPress={handleCancelPersonaCreation}
                    style={{ marginTop: 16, paddingVertical: 10, paddingHorizontal: 28, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" }}
                  >
                    <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>✕ Cancel</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {/* Action buttons */}
              {!isPersonaGenerating && (
                <TouchableOpacity
                  onPress={() => {
                    stopWizardPreview();
                    handleAnalyzeVoice();
                  }}
                  style={{
                    width: "100%",
                    borderRadius: 28,
                    overflow: "hidden",
                    marginBottom: 16,
                  }}
                >
                  <LinearGradient
                    colors={["#FF2A75", "#FF512F"]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={{ paddingVertical: 18, alignItems: "center", borderRadius: 28 }}
                  >
                    <Text style={{ color: "#FFF", fontSize: 17, fontWeight: "700" }}>Analyze Voice</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}

              {!isPersonaGenerating && (
                <TouchableOpacity
                  onPress={() => {
                    stopWizardPreview();
                    setPersonaAudioUri(null);
                    setWizardDurationMs(0);
                    setWizardPreviewSound(null);
                    setVoiceWizardStep(2);
                  }}
                  style={{ paddingVertical: 14, paddingHorizontal: 24 }}
                >
                  <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 15 }}>Record Again</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : voiceWizardStep === 4 ? (
            /* ── STEP 4: RECORD VERIFICATION ── */
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, textAlign: "center", marginBottom: 24, paddingHorizontal: 40, lineHeight: 22 }}>
                Read the authorization script below clearly to verify your voice.
              </Text>

              {/* Consent Script Box */}
              <View style={{
                backgroundColor: "rgba(255,255,255,0.05)",
                padding: 16,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.15)",
                marginHorizontal: 32,
                marginBottom: 36,
                alignItems: "center"
              }}>
                <Text style={{ color: "#FF2A75", fontSize: 11, fontWeight: "800", letterSpacing: 1.5, marginBottom: 8, textTransform: "uppercase" }}>Verification Phrase</Text>
                <Text style={{ color: "#FFF", fontSize: 16, fontStyle: "italic", textAlign: "center", lineHeight: 24, fontWeight: "500" }}>
                  "{validateText || "I authorize this voice cloning process."}"
                </Text>
              </View>

              {/* Dynamic Bar Visualizer — reacts to microphone volume */}
              <View style={{ width: 280, height: 120, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 5, marginBottom: 8 }}>
                {Array.from({ length: 22 }).map((_, i) => {
                  const phase = vizTick * 0.3 + i * 0.6;
                  const baseH = 8 + Math.abs(Math.sin(phase)) * 20;
                  const volBoost = isWizardRecording ? wizardVolume * 85 * (0.4 + Math.abs(Math.sin(phase + i))) : 0;
                  const h = Math.min(baseH + volBoost, 100);
                  const isCenter = Math.abs(i - 10) < 4;
                  const opacity = isWizardRecording ? (0.3 + wizardVolume * 0.7) : 0.15;
                  return (
                    <View
                      key={i}
                      style={{
                        width: 8,
                        height: Math.max(h, 4),
                        borderRadius: 4,
                        backgroundColor: isWizardRecording
                          ? (isCenter ? "#FF2A75" : `rgba(255,${42 + Math.floor(wizardVolume * 80)},117,${opacity})`)
                          : "rgba(255,255,255,0.12)",
                        shadowColor: "#FF2A75",
                        shadowOpacity: isWizardRecording ? 0.6 : 0,
                        shadowRadius: 4,
                        elevation: isWizardRecording ? 3 : 0,
                      }}
                    />
                  );
                })}
              </View>

              {/* Timer */}
              <View style={{ marginTop: 36, alignItems: "center" }}>
                <Text style={{ color: "#FFF", fontSize: 32, fontWeight: "700", fontVariant: ["tabular-nums"], letterSpacing: 2 }}>
                  {`${Math.floor(wizardDurationMs / 60000)}:${Math.floor((wizardDurationMs % 60000) / 1000).toString().padStart(2, "0")}`}
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 6 }}>
                  {isWizardRecording ? (wizardDurationMs < 5000 ? "Keep going... (min 5s)" : "Recording — tap to stop") : "Tap the button below to start"}
                </Text>
              </View>

              {/* Record / Stop button */}
              <TouchableOpacity
                style={{
                  marginTop: 48,
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: isWizardRecording ? "rgba(255,59,48,0.25)" : "rgba(255,42,117,0.2)",
                  justifyContent: "center",
                  alignItems: "center",
                  borderWidth: 2,
                  borderColor: isWizardRecording ? "#FF3B30" : "#FF2A75",
                  shadowColor: isWizardRecording ? "#FF3B30" : "#FF2A75",
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.7,
                  shadowRadius: 16,
                  elevation: 12,
                }}
                onPress={() => {
                  if (isWizardRecording) { stopWizardRecording(true); } else { startWizardRecording(); }
                }}
              >
                {isWizardRecording ? (
                  <View style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: "#FF3B30" }} />
                ) : (
                  <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#FF2A75" }} />
                )}
              </TouchableOpacity>
            </View>
          ) : (
            /* ── STEP 5: PREVIEW VERIFICATION & FINALIZE ── */
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 }}>
              {/* Waveform visual */}
              <View style={{ flexDirection: "row", alignItems: "center", height: 80, gap: 3, marginBottom: 40 }}>
                {Array.from({ length: 40 }).map((_, i) => {
                  const h = 8 + Math.abs(Math.sin((i + 1) * 0.7)) * 52;
                  return (
                    <View
                      key={i}
                      style={{
                        width: 5,
                        height: h,
                        borderRadius: 3,
                        backgroundColor: isWizardPreviewPlaying
                          ? `rgba(255,42,117,${0.4 + Math.abs(Math.sin(i * 0.5)) * 0.6})`
                          : "rgba(255,255,255,0.25)",
                      }}
                    />
                  );
                })}
              </View>

              {/* Duration label */}
              <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, marginBottom: 32 }}>
                {`${Math.floor(wizardDurationMs / 60000)}:${Math.floor((wizardDurationMs % 60000) / 1000).toString().padStart(2, "0")} recorded`}
              </Text>

              {/* Play / Stop button */}
              <TouchableOpacity
                onPress={isWizardPreviewPlaying ? stopWizardPreview : playWizardPreview}
                style={{
                  width: 90,
                  height: 90,
                  borderRadius: 45,
                  backgroundColor: isWizardPreviewPlaying ? "rgba(255,59,48,0.2)" : "rgba(255,42,117,0.2)",
                  borderWidth: 2,
                  borderColor: isWizardPreviewPlaying ? "#FF3B30" : "#FF2A75",
                  justifyContent: "center",
                  alignItems: "center",
                  shadowColor: isWizardPreviewPlaying ? "#FF3B30" : "#FF2A75",
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.8,
                  shadowRadius: 20,
                  elevation: 15,
                  marginBottom: 16,
                }}
              >
                <Ionicons
                  name={isWizardPreviewPlaying ? "stop" : "play"}
                  size={36}
                  color={isWizardPreviewPlaying ? "#FF3B30" : "#FF2A75"}
                />
              </TouchableOpacity>
              <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 48 }}>
                {isWizardPreviewPlaying ? "Playing... tap to stop" : "Tap to listen back"}
              </Text>

              {/* Status + Cancel */}
              {isPersonaGenerating ? (
                <View style={{ alignItems: "center", marginBottom: 24, width: "100%" }}>
                  <ActivityIndicator color="#FF2A75" size="large" />
                  <Text style={{ color: "rgba(255,255,255,0.7)", marginTop: 12, fontSize: 14, textAlign: "center", lineHeight: 20 }}>
                    {personaStatusText || "Processing..."}
                  </Text>
                  <TouchableOpacity
                    onPress={handleCancelPersonaCreation}
                    style={{ marginTop: 16, paddingVertical: 10, paddingHorizontal: 28, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" }}
                  >
                    <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>✕ Cancel</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {/* Action buttons */}
              {!isPersonaGenerating && (
                <TouchableOpacity
                  onPress={() => {
                    stopWizardPreview();
                    handleFinalizeVoice();
                  }}
                  style={{
                    width: "100%",
                    borderRadius: 28,
                    overflow: "hidden",
                    marginBottom: 16,
                  }}
                >
                  <LinearGradient
                    colors={["#FF2A75", "#FF512F"]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={{ paddingVertical: 18, alignItems: "center", borderRadius: 28 }}
                  >
                    <Text style={{ color: "#FFF", fontSize: 17, fontWeight: "700" }}>Create Custom Voice</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}

              {!isPersonaGenerating && (
                <TouchableOpacity
                  onPress={() => {
                    stopWizardPreview();
                    setVerifyAudioUri(null);
                    setWizardDurationMs(0);
                    setWizardPreviewSound(null);
                    setVoiceWizardStep(4);
                  }}
                  style={{ paddingVertical: 14, paddingHorizontal: 24 }}
                >
                  <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 15 }}>Record Again</Text>
                </TouchableOpacity>
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
    paddingBottom: 100, // Space for the floating input
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
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  inputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  textInputWrapper: {
    flex: 1,
    height: "100%",
    justifyContent: "center",
    marginLeft: 12,
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
