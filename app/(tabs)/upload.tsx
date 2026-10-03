import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter, useFocusEffect } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";
import { useLayoutStore } from "../../store/layoutStore";
import { useThemeStore } from "../../store/themeStore";
import { GENRES } from "../../constants";
import * as FileSystem from "expo-file-system/legacy";
import { decode } from "base64-arraybuffer";

import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";

type EPTrack = {
  title: string;
  collaborator: string;
  audioFile: { uri: string; name: string; mimeType: string } | null;
  lyricsSwahili: string;
  lyricsEnglish: string;
};

export default function UploadScreen() {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  
  useFocusEffect(
    React.useCallback(() => {
      useLayoutStore.getState().setIsNavVisible(true);
    }, [])
  );

  const [uploadMode, setUploadMode] = useState<"single" | "ep">("single");

  // Single Track State
  const [title, setTitle] = useState("");
  const [collaborator, setCollaborator] = useState("");
  const [description, setDescription] = useState("");
  const [lyricsSwahili, setLyricsSwahili] = useState("");
  const [lyricsEnglish, setLyricsEnglish] = useState("");
  const [audioFile, setAudioFile] = useState<{
    uri: string;
    name: string;
    mimeType: string;
  } | null>(null);

  // EP / Album State
  const [epTitle, setEpTitle] = useState("");
  const [epDescription, setEpDescription] = useState("");
  const [epTracks, setEpTracks] = useState<EPTrack[]>([
    {
      title: "",
      collaborator: "",
      audioFile: null,
      lyricsSwahili: "",
      lyricsEnglish: "",
    },
  ]);

  // Shared State
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState("Bongo Flava");
  const [showGenrePicker, setShowGenrePicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [dbGenres, setDbGenres] = useState<any[]>([]);

  // Animations
  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const fetchGenres = async () => {
      const { data } = await supabase
        .from("genres")
        .select("*")
        .order("created_at", { ascending: true });
      if (data && data.length > 0) setDbGenres(data);
      else setDbGenres(GENRES);
    };
    fetchGenres();
  }, []);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const triggerModeSwitch = (mode: "single" | "ep") => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setUploadMode(mode);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    });
  };

  if (!session) {
    return (
      <View style={styles.noAuth}>
        <LinearGradient
          colors={["#1a1a1a", "#000"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.noAuthIconContainer}>
          <Ionicons name="mic-outline" size={80} color={COLORS.gold} />
        </View>
        <Text style={styles.noAuthTitle}>Artist Studio</Text>
        <Text style={styles.noAuthText}>
          Log in as an artist to upload your latest tracks, EPs, and albums.
        </Text>
        <TouchableOpacity
          style={styles.loginBtn}
          onPress={() => router.push("/auth")}
        >
          <LinearGradient
            colors={[COLORS.gold, "#f5c64c"]}
            style={styles.loginBtnGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.loginBtnText}>Log In / Sign Up</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  const pickCover = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled) setCoverUri(result.assets[0].uri);
  };

  const pickSingleAudio = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "audio/*",
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) {
      setAudioFile({
        uri: result.assets[0].uri,
        name: result.assets[0].name,
        mimeType: result.assets[0].mimeType ?? "audio/mpeg",
      });
    }
  };

  const pickEPTrackAudio = async (index: number) => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "audio/*",
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) {
      const newTracks = [...epTracks];
      newTracks[index].audioFile = {
        uri: result.assets[0].uri,
        name: result.assets[0].name,
        mimeType: result.assets[0].mimeType ?? "audio/mpeg",
      };
      setEpTracks(newTracks);
    }
  };

  const addEPTrack = () =>
    setEpTracks([
      ...epTracks,
      {
        title: "",
        collaborator: "",
        audioFile: null,
        lyricsSwahili: "",
        lyricsEnglish: "",
      },
    ]);
  const removeEPTrack = (index: number) => {
    const newTracks = [...epTracks];
    newTracks.splice(index, 1);
    setEpTracks(newTracks);
  };

  const uploadCoverToStorage = async (userId: string) => {
    if (!coverUri) return null;
    const coverBase64 = await FileSystem.readAsStringAsync(coverUri, {
      encoding: "base64",
    });
    const coverFileName = `${userId}/cover_${Date.now()}.jpg`;
    const { error: coverError } = await supabase.storage
      .from("covers")
      .upload(coverFileName, decode(coverBase64), {
        contentType: "image/jpeg",
        upsert: false,
      });
    if (!coverError) {
      const { data } = supabase.storage
        .from("covers")
        .getPublicUrl(coverFileName);
      return data.publicUrl;
    }
    return null;
  };

  const uploadSingle = async () => {
    const mainArtist = profile?.display_name ?? "Unknown Artist";
    if (!title.trim() || !audioFile || !coverUri) {
      Alert.alert(
        "Missing Details",
        "Please provide a track title, cover art, and audio file.",
      );
      return;
    }
    setUploading(true);
    setProgress(0.1);
    setProgressLabel("Preparing cover art...");
      
    try {
      const userId = session.user.id;
      const coverUrl = await uploadCoverToStorage(userId);
      setProgress(0.4);
      setProgressLabel("Processing audio...");

      let durationSec = 0;
      // Duration fetching disabled to remove expo-av dependency
      // The backend can calculate this later if needed.

      const audioBase64 = await FileSystem.readAsStringAsync(audioFile.uri, {
        encoding: "base64",
      });
      const ext = audioFile.name.split(".").pop() ?? "mp3";
      const audioFileName = `${userId}/audio_${Date.now()}.${ext}`;
      setProgress(0.6);
      setProgressLabel("Uploading high-quality audio...");

      const { error: audioError } = await supabase.storage
        .from("audio")
        .upload(audioFileName, decode(audioBase64), {
          contentType: audioFile.mimeType,
          upsert: false,
        });
      if (audioError) throw audioError;

      const { data: audioData } = supabase.storage
        .from("audio")
        .getPublicUrl(audioFileName);
      setProgress(0.9);
      setProgressLabel("Finalizing release...");

      const finalArtistName = collaborator.trim()
        ? `${mainArtist}, ${collaborator.trim()}`
        : mainArtist;
      const { error: dbError } = await supabase.from("tracks").insert({
        user_id: userId,
        title: title.trim(),
        artist_name: finalArtistName,
        genre: selectedGenre,
        audio_url: audioData.publicUrl,
        cover_url: coverUrl,
        description: description.trim() || null,
        lyrics_swahili: lyricsSwahili.trim() || null,
        lyrics_english: lyricsEnglish.trim() || null,
        is_public: true,
        duration_sec: durationSec,
        copyright_cleared: true,
      });
      if (dbError) throw dbError;

      setProgress(1);
      setProgressLabel("Upload Complete!");
      setTimeout(() => {
        Alert.alert(
          "Release Successful!",
          "Your track is now live in the BongoBox catalog.",
          [
            {
              text: "Awesome",
              onPress: () => {
                resetForm();
                router.replace("/");
              },
            },
          ],
        );
      }, 500);
    } catch (e: any) {
      Alert.alert("Upload Failed", e.message ?? "Please try again later.");
    } finally {
      if (progress < 1) setUploading(false);
    }
  };

  const uploadEP = async () => {
    const mainArtist = profile?.display_name ?? "Unknown Artist";
    if (!epTitle.trim() || !coverUri)
      return Alert.alert(
        "Error",
        "Please provide an EP title and cover image.",
      );
    if (epTracks.some((t) => !t.title.trim() || !t.audioFile))
      return Alert.alert("Error", "All tracks require a title and audio file.");

    setUploading(true);
    setProgress(0.1);
    setProgressLabel("Uploading artwork...");

    try {
      const userId = session.user.id;
      const coverUrl = await uploadCoverToStorage(userId);
      setProgress(0.2);
      setProgressLabel("Creating EP collection...");

      const { data: playlistData, error: playlistError } = await supabase
        .from("playlists")
        .insert({
          user_id: userId,
          title: epTitle.trim(),
          description: epDescription.trim() || null,
          cover_url: coverUrl,
          is_public: true,
        })
        .select("id")
        .single();
      if (playlistError) throw playlistError;

      for (let i = 0; i < epTracks.length; i++) {
        const track = epTracks[i];
        setProgress(0.2 + ((i + 1) / epTracks.length) * 0.7);
        setProgressLabel(`Mastering Track ${i + 1} of ${epTracks.length}...`);

        let durationSec = 0;
        // Duration fetching disabled to remove expo-av dependency
        // The backend can calculate this later if needed.

        const audioBase64 = await FileSystem.readAsStringAsync(
          track.audioFile!.uri,
          { encoding: "base64" },
        );
        const ext = track.audioFile!.name.split(".").pop() ?? "mp3";
        const audioFileName = `${userId}/audio_${Date.now()}_${i}.${ext}`;

        const { error: audioError } = await supabase.storage
          .from("audio")
          .upload(audioFileName, decode(audioBase64), {
            contentType: track.audioFile!.mimeType,
            upsert: false,
          });
        if (audioError) throw audioError;

        const { data: audioData } = supabase.storage
          .from("audio")
          .getPublicUrl(audioFileName);
        const finalArtistName = track.collaborator.trim()
          ? `${mainArtist}, ${track.collaborator.trim()}`
          : mainArtist;

        const { data: insertedTrack, error: dbError } = await supabase
          .from("tracks")
          .insert({
            user_id: userId,
            title: track.title.trim(),
            artist_name: finalArtistName,
            genre: selectedGenre,
            audio_url: audioData.publicUrl,
            cover_url: coverUrl,
            description: epDescription.trim() || null,
            lyrics_swahili: track.lyricsSwahili.trim() || null,
            lyrics_english: track.lyricsEnglish.trim() || null,
            is_public: true,
            duration_sec: durationSec,
            copyright_cleared: true,
          })
          .select("id")
          .single();
        if (dbError) throw dbError;

        await supabase
          .from("playlist_tracks")
          .insert({ playlist_id: playlistData.id, track_id: insertedTrack.id });
      }
      setProgress(1);
      setProgressLabel("EP Release Complete!");
      setTimeout(() => {
        Alert.alert(
          "Release Successful!",
          "Your EP is now live in the BongoBox catalog.",
          [
            {
              text: "Awesome",
              onPress: () => {
                resetForm();
                router.replace("/");
              },
            },
          ],
        );
      }, 500);
    } catch (e: any) {
      Alert.alert("Upload Failed", e.message ?? "Please try again later.");
    } finally {
      if (progress < 1) setUploading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setCollaborator("");
    setDescription("");
    setLyricsSwahili("");
    setLyricsEnglish("");
    setAudioFile(null);
    setCoverUri(null);
    setEpTitle("");
    setEpDescription("");
    setEpTracks([
      {
        title: "",
        collaborator: "",
        audioFile: null,
        lyricsSwahili: "",
        lyricsEnglish: "",
      },
    ]);
    setUploading(false);
    setProgress(0);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <LinearGradient
        colors={["#101010", "#000000"]}
        style={StyleSheet.absoluteFill}
      />

      {/* Premium Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Studio</Text>
        <Text style={styles.headerSubtitle}>
          Release your next hit to the world
        </Text>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 160 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Mode Switcher */}
        <View style={styles.switcherContainer}>
          <View style={styles.switcherBg}>
            <TouchableOpacity
              style={[
                styles.switcherBtn,
                uploadMode === "single" && styles.switcherBtnActive,
              ]}
              onPress={() => triggerModeSwitch("single")}
            >
              <Text
                style={[
                  styles.switcherText,
                  uploadMode === "single" && styles.switcherTextActive,
                ]}
              >
                Single Track
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.switcherBtn,
                uploadMode === "ep" && styles.switcherBtnActive,
              ]}
              onPress={() => triggerModeSwitch("ep")}
            >
              <Text
                style={[
                  styles.switcherText,
                  uploadMode === "ep" && styles.switcherTextActive,
                ]}
              >
                EP / Album
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Cover Art Section */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Artwork</Text>
            <TouchableOpacity style={styles.coverDropzone} onPress={pickCover}>
              {coverUri ? (
                <Image
                  source={{ uri: coverUri }}
                  style={styles.coverImage}
                  transition={300}
                />
              ) : (
                <LinearGradient
                  colors={["rgba(255,255,255,0.05)", "rgba(255,255,255,0.02)"]}
                  style={styles.coverPlaceholder}
                >
                  <Ionicons
                    name="images-outline"
                    size={42}
                    color="rgba(255,255,255,0.4)"
                    style={{ marginBottom: 12 }}
                  />
                  <Text style={styles.coverHintText}>
                    Tap to browse or drop artwork
                  </Text>
                  <Text style={styles.coverSubhintText}>
                    High-quality JPEG or PNG (1:1 ratio)
                  </Text>
                </LinearGradient>
              )}
              {coverUri && (
                <View style={styles.coverEditBadge}>
                  <Ionicons name="camera-reverse" size={18} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Genre Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Genre Classification</Text>
            <TouchableOpacity
              style={styles.genrePill}
              onPress={() => setShowGenrePicker(true)}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={styles.genreIconBg}>
                  <Ionicons
                    name={
                      (dbGenres.find((g) => (g.name || g.id) === selectedGenre)
                        ?.icon as any) || "musical-notes"
                    }
                    size={18}
                    color={COLORS.gold}
                  />
                </View>
                <Text style={styles.genreValue}>{selectedGenre}</Text>
              </View>
              <Ionicons
                name="chevron-down"
                size={20}
                color="rgba(255,255,255,0.5)"
              />
            </TouchableOpacity>

            {showGenrePicker && (
              <BlurView intensity={20} tint="dark" style={styles.genreDropdown}>
                {dbGenres.map((g) => (
                  <TouchableOpacity
                    key={g.name || g.id}
                    style={[
                      styles.genreOption,
                      selectedGenre === (g.name || g.id) &&
                        styles.genreOptionSelected,
                    ]}
                    onPress={() => {
                      setSelectedGenre(g.name || g.id);
                      setShowGenrePicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.genreOptionText,
                        selectedGenre === (g.name || g.id) && {
                          color: COLORS.gold,
                          fontWeight: "700",
                        },
                      ]}
                    >
                      {g.name || g.id}
                    </Text>
                    {selectedGenre === (g.name || g.id) && (
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color={COLORS.gold}
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </BlurView>
            )}
          </View>

          {/* Single Mode Specific */}
          {uploadMode === "single" && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Track Details</Text>

              <View style={styles.inputGroup}>
                <BongoInput
                  icon="musical-note"
                  placeholder="Track Title"
                  value={title}
                  onChangeText={setTitle}
                  required
                />
                <BongoInput
                  icon="people"
                  placeholder="Collaborator(s) (Optional)"
                  value={collaborator}
                  onChangeText={setCollaborator}
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.audioDropzone,
                  audioFile && styles.audioDropzoneSuccess,
                ]}
                onPress={pickSingleAudio}
              >
                <Ionicons
                  name={audioFile ? "checkmark-circle" : "cloud-upload"}
                  size={32}
                  color={audioFile ? COLORS.gold : "rgba(255,255,255,0.4)"}
                  style={{ marginBottom: 8 }}
                />
                <Text
                  style={[
                    styles.audioDropText,
                    audioFile && { color: "#fff", fontWeight: "bold" },
                  ]}
                >
                  {audioFile ? audioFile.name : "Select Master Audio File"}
                </Text>
                <Text style={styles.audioSubText}>
                  {audioFile
                    ? "Ready for release"
                    : "WAV, FLAC, or MP3 up to 100MB"}
                </Text>
              </TouchableOpacity>

              <Text style={[styles.sectionLabel, { marginTop: 20 }]}>
                Additional Meta
              </Text>
              <BongoInput
                icon="document-text"
                placeholder="Short description..."
                value={description}
                onChangeText={setDescription}
                multiline
              />
              <BongoInput
                icon="language"
                placeholder="Lyrics (Swahili)..."
                value={lyricsSwahili}
                onChangeText={setLyricsSwahili}
                multiline
              />
              <BongoInput
                icon="language"
                placeholder="Lyrics (English)..."
                value={lyricsEnglish}
                onChangeText={setLyricsEnglish}
                multiline
              />
            </View>
          )}

          {/* EP Mode Specific */}
          {uploadMode === "ep" && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Release Details</Text>
              <View style={styles.inputGroup}>
                <BongoInput
                  icon="albums"
                  placeholder="EP / Album Title"
                  value={epTitle}
                  onChangeText={setEpTitle}
                  required
                />
                <BongoInput
                  icon="document-text"
                  placeholder="Description (Optional)"
                  value={epDescription}
                  onChangeText={setEpDescription}
                  multiline
                />
              </View>

              <Text style={[styles.sectionLabel, { marginTop: 24 }]}>
                Tracklist
              </Text>
              {epTracks.map((track, index) => (
                <BlurView
                  intensity={15}
                  tint="dark"
                  key={index}
                  style={styles.trackCard}
                >
                  <View style={styles.trackCardHeader}>
                    <View style={styles.trackBadge}>
                      <Text style={styles.trackBadgeText}>{index + 1}</Text>
                    </View>
                    {epTracks.length > 1 && (
                      <TouchableOpacity
                        onPress={() => removeEPTrack(index)}
                        style={styles.removeTrackBtn}
                      >
                        <Ionicons
                          name="close"
                          size={16}
                          color="rgba(255,255,255,0.6)"
                        />
                      </TouchableOpacity>
                    )}
                  </View>

                  <BongoInput
                    icon="musical-note"
                    placeholder={`Track ${index + 1} Title`}
                    value={track.title}
                    onChangeText={(t) => {
                      const newT = [...epTracks];
                      newT[index].title = t;
                      setEpTracks(newT);
                    }}
                    required
                  />

                  <TouchableOpacity
                    style={[
                      styles.miniAudioDrop,
                      track.audioFile && styles.miniAudioDropSuccess,
                    ]}
                    onPress={() => pickEPTrackAudio(index)}
                  >
                    <Ionicons
                      name={
                        track.audioFile ? "checkmark-circle" : "musical-notes"
                      }
                      size={20}
                      color={
                        track.audioFile ? COLORS.gold : "rgba(255,255,255,0.4)"
                      }
                    />
                    <Text
                      style={[
                        styles.miniAudioText,
                        track.audioFile && { color: "#fff" },
                      ]}
                      numberOfLines={1}
                    >
                      {track.audioFile
                        ? track.audioFile.name
                        : "Attach Audio File"}
                    </Text>
                  </TouchableOpacity>
                </BlurView>
              ))}

              <TouchableOpacity style={styles.addTrackBtn} onPress={addEPTrack}>
                <Ionicons name="add" size={20} color={COLORS.gold} />
                <Text style={styles.addTrackBtnText}>Add Another Track</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Upload Button */}
          <View style={{ marginTop: 20, marginBottom: 40 }}>
            {uploading ? (
              <View style={styles.uploadingContainer}>
                <ActivityIndicator
                  size="small"
                  color={COLORS.gold}
                  style={{ marginBottom: 12 }}
                />
                <Text style={styles.uploadingLabel}>{progressLabel}</Text>
                <View style={styles.progressTrack}>
                  <Animated.View
                    style={[
                      styles.progressFill,
                      {
                        width: progressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ["0%", "100%"],
                        }),
                      },
                    ]}
                  />
                </View>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() =>
                  uploadMode === "single" ? uploadSingle() : uploadEP()
                }
              >
                <LinearGradient
                  colors={[COLORS.gold, "#f5c64c"]}
                  style={styles.publishBtn}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="rocket" size={22} color="#000" />
                  <Text style={styles.publishBtnText}>Publish to BongoBox</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function BongoInput({
  icon,
  placeholder,
  value,
  onChangeText,
  multiline,
  required,
}: any) {
  const [isFocused, setIsFocused] = useState(false);
  return (
    <View
      style={[
        stylesInput.container,
        isFocused && stylesInput.focused,
        multiline && { height: 100, alignItems: "flex-start", paddingTop: 16 },
      ]}
    >
      <Ionicons
        name={icon}
        size={20}
        color={isFocused ? "#f5c64c" : "rgba(255,255,255,0.3)"}
        style={{ marginRight: 12, marginTop: multiline ? 2 : 0 }}
      />
      <TextInput
        style={[
          stylesInput.input,
          multiline && { height: 70, textAlignVertical: "top" },
        ]}
        placeholder={placeholder + (required ? " *" : "")}
        placeholderTextColor="rgba(255,255,255,0.3)"
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
    </View>
  );
}

const stylesInput = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 12,
  },
  focused: {
    borderColor: "rgba(245, 198, 76, 0.4)",
    backgroundColor: "rgba(245, 198, 76, 0.05)",
  },
  input: { flex: 1, color: "#fff", fontSize: 16 },
});

const getStyles = (COLORS: any) =>
  StyleSheet.create({
    container: { flex: 1, paddingHorizontal: 20 },
    header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
    headerTitle: {
      fontSize: 34,
      fontWeight: "900",
      color: "#fff",
      letterSpacing: -0.5,
    },
    headerSubtitle: {
      fontSize: 16,
      color: "rgba(255,255,255,0.5)",
      marginTop: 4,
    },

    switcherContainer: { alignItems: "center", marginBottom: 30 },
    switcherBg: {
      flexDirection: "row",
      backgroundColor: "rgba(255,255,255,0.05)",
      borderRadius: 30,
      padding: 4,
      width: "90%",
    },
    switcherBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 26,
      alignItems: "center",
    },
    switcherBtnActive: { backgroundColor: "#fff" },
    switcherText: {
      color: "rgba(255,255,255,0.6)",
      fontWeight: "600",
      fontSize: 15,
    },
    switcherTextActive: { color: "#000", fontWeight: "800" },

    section: { marginBottom: 32 },
    sectionLabel: {
      fontSize: 14,
      fontWeight: "700",
      color: "rgba(255,255,255,0.6)",
      textTransform: "uppercase",
      letterSpacing: 1.2,
      marginBottom: 12,
    },

    coverDropzone: {
      width: "100%",
      aspectRatio: 1,
      borderRadius: 24,
      overflow: "hidden",
      backgroundColor: "rgba(255,255,255,0.02)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.05)",
      borderStyle: "dashed",
    },
    coverPlaceholder: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    coverHintText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "600",
      marginBottom: 4,
    },
    coverSubhintText: { color: "rgba(255,255,255,0.4)", fontSize: 13 },
    coverImage: { width: "100%", height: "100%" },
    coverEditBadge: {
      position: "absolute",
      bottom: 16,
      right: 16,
      backgroundColor: "rgba(0,0,0,0.6)",
      padding: 10,
      borderRadius: 20,
      backdropFilter: "blur(10px)",
    },

    genrePill: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: "rgba(255,255,255,0.03)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.05)",
      borderRadius: 20,
      padding: 16,
    },
    genreIconBg: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: "rgba(245, 198, 76, 0.1)",
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    genreValue: { fontSize: 16, color: "#fff", fontWeight: "600" },
    genreDropdown: {
      marginTop: 8,
      borderRadius: 20,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.05)",
    },
    genreOption: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: "rgba(255,255,255,0.05)",
    },
    genreOptionSelected: { backgroundColor: "rgba(245, 198, 76, 0.1)" },
    genreOptionText: { fontSize: 15, color: "rgba(255,255,255,0.7)" },

    inputGroup: { gap: 12 },

    audioDropzone: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 32,
      paddingHorizontal: 20,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.1)",
      borderStyle: "dashed",
      backgroundColor: "rgba(255,255,255,0.02)",
      marginTop: 12,
    },
    audioDropzoneSuccess: {
      borderColor: COLORS.gold,
      backgroundColor: "rgba(245, 198, 76, 0.05)",
      borderStyle: "solid",
    },
    audioDropText: {
      fontSize: 16,
      color: "rgba(255,255,255,0.7)",
      marginBottom: 4,
    },
    audioSubText: { fontSize: 13, color: "rgba(255,255,255,0.4)" },

    trackCard: {
      borderRadius: 24,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.05)",
      overflow: "hidden",
    },
    trackCardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    trackBadge: {
      backgroundColor: "rgba(255,255,255,0.1)",
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
    },
    trackBadgeText: { color: "#fff", fontSize: 12, fontWeight: "800" },
    removeTrackBtn: { padding: 4 },
    miniAudioDrop: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      borderRadius: 16,
      backgroundColor: "rgba(255,255,255,0.05)",
      gap: 12,
    },
    miniAudioDropSuccess: {
      backgroundColor: "rgba(245, 198, 76, 0.1)",
      borderWidth: 1,
      borderColor: "rgba(245, 198, 76, 0.3)",
    },
    miniAudioText: {
      color: "rgba(255,255,255,0.5)",
      fontSize: 14,
      fontWeight: "500",
      flex: 1,
    },

    addTrackBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 16,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: "rgba(245, 198, 76, 0.4)",
      borderStyle: "dashed",
    },
    addTrackBtnText: {
      color: COLORS.gold,
      fontSize: 15,
      fontWeight: "700",
      marginLeft: 8,
    },

    publishBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      height: 60,
      borderRadius: 30,
      gap: 12,
      shadowColor: COLORS.gold,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 8,
    },
    publishBtnText: { color: "#000", fontSize: 17, fontWeight: "800" },

    uploadingContainer: {
      alignItems: "center",
      padding: 24,
      backgroundColor: "rgba(255,255,255,0.03)",
      borderRadius: 24,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.05)",
    },
    uploadingLabel: {
      color: "#fff",
      fontSize: 15,
      fontWeight: "600",
      marginBottom: 16,
    },
    progressTrack: {
      height: 6,
      width: "100%",
      backgroundColor: "rgba(255,255,255,0.1)",
      borderRadius: 3,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      backgroundColor: COLORS.gold,
      borderRadius: 3,
    },

    noAuth: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    noAuthIconContainer: {
      width: 140,
      height: 140,
      borderRadius: 70,
      backgroundColor: "rgba(245, 198, 76, 0.1)",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 24,
      borderWidth: 2,
      borderColor: "rgba(245, 198, 76, 0.2)",
    },
    noAuthTitle: {
      color: "#fff",
      fontSize: 28,
      fontWeight: "900",
      marginBottom: 12,
    },
    noAuthText: {
      color: "rgba(255,255,255,0.6)",
      fontSize: 16,
      textAlign: "center",
      marginBottom: 32,
      lineHeight: 24,
    },
    loginBtn: {
      width: "100%",
      maxWidth: 300,
      overflow: "hidden",
      borderRadius: 30,
    },
    loginBtnGradient: {
      paddingVertical: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    loginBtnText: { color: "#000", fontSize: 16, fontWeight: "800" },
  });
