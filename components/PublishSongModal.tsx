import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../lib/supabase";
import { useAIStore } from "../store/aiStore";

interface PublishSongModalProps {
  visible: boolean;
  onClose: () => void;
  songTask: any; // The task from aiStore
}

export const PublishSongModal: React.FC<PublishSongModalProps> = ({
  visible,
  onClose,
  songTask,
}) => {
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    if (visible && songTask?.tracks?.[0]) {
      setTitle(songTask.tracks[0].title || "");
      setGenre(songTask.tracks[0].genre || songTask.tracks[0].tags || "");
    }
  }, [visible, songTask]);

  const handlePublish = async () => {
    if (!songTask?.tracks?.[0]) return;
    const track = songTask.tracks[0];
    
    // Fallback if no ID is stored (which shouldn't happen, but we can look it up by audio_url)
    if (!track.id || track.id.includes('-v')) {
      // Find the track in DB
      try {
        setIsPublishing(true);
        const { data: existing } = await supabase
          .from("tracks")
          .select("id")
          .eq("audio_url", track.audioUrl)
          .single();
          
        if (existing) {
          const { error } = await supabase
            .from("tracks")
            .update({
              title,
              genre,
              is_public: true,
            })
            .eq("id", existing.id);

          if (error) throw error;
        } else {
          // If for some reason it isn't in DB at all, insert it.
          const { data: s } = await supabase.auth.getSession();
          if (s?.session?.user) {
             await supabase.from("tracks").insert({
               user_id: s.session.user.id,
               title,
               genre,
               audio_url: track.audioUrl,
               cover_url: track.imageUrl,
               duration_sec: track.duration,
               is_public: true,
               is_ai: true,
             });
          }
        }

        // Update local state
        const updatedTrack = { ...track, title, genre, tags: genre };
        useAIStore.getState().updateTrack(songTask.id, track.id, updatedTrack);
        
        Alert.alert("Success", "Song published successfully!");
        onClose();
      } catch (err) {
        console.error("Publish error:", err);
        Alert.alert("Error", "Failed to publish the song.");
      } finally {
        setIsPublishing(false);
      }
      return;
    }

    try {
      setIsPublishing(true);
      const { error } = await supabase
        .from("tracks")
        .update({
          title,
          genre,
          is_public: true,
        })
        .eq("id", track.id);

      if (error) {
        throw error;
      }

      // Update local state
      const updatedTrack = { ...track, title, genre, tags: genre };
      useAIStore.getState().updateTrack(songTask.id, track.id, updatedTrack);

      Alert.alert("Success", "Song published successfully!");
      onClose();
    } catch (error) {
      console.error("Failed to publish song:", error);
      Alert.alert("Error", "Failed to publish the song.");
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Publish Song</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <Text style={styles.label}>Song Name</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Enter song name..."
              placeholderTextColor="#666"
            />

            <Text style={styles.label}>Genre</Text>
            <TextInput
              style={styles.input}
              value={genre}
              onChangeText={setGenre}
              placeholder="Enter genre..."
              placeholderTextColor="#666"
            />

            <TouchableOpacity
              style={styles.publishBtn}
              onPress={handlePublish}
              disabled={isPublishing}
            >
              {isPublishing ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.publishBtnText}>Publish Now</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#1E1E1E",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    minHeight: 400,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  headerTitle: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "bold",
  },
  closeBtn: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  label: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#2A2A2A",
    color: "#FFF",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  publishBtn: {
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 30,
    alignItems: "center",
    marginTop: 10,
  },
  publishBtnText: {
    color: "#000",
    fontSize: 18,
    fontWeight: "bold",
  },
});
