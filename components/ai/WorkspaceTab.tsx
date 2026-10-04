// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Platform, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { decode } from 'base64-arraybuffer';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { supabase } from '../../lib/supabase';
import { getTaskInfo, getVocalRemovalInfo, separateVocals, SunoAudioData, createMusicVideo, getVideoRecordInfo } from '../../lib/sunoApi';
import { useAIStore, AISongTask } from '../../store/aiStore';
import { useAuthStore } from '../../store/authStore';
import { usePlayerStore } from '../../store/playerStore';
import { useThemeStore } from '../../store/themeStore';
import ExtendModal from './ExtendModal';


interface WorkspaceTabProps {
  openPersonaModal: (audioId: string, taskId: string) => void;
  navigateToTab?: (tab: string) => void;
}

export default function WorkspaceTab({ openPersonaModal, navigateToTab }: WorkspaceTabProps) {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const { tasks } = useAIStore();
  const { profile } = useAuthStore();
  const [isPublishing, setIsPublishing] = useState<Record<string, boolean>>({});
  const [isDownloading, setIsDownloading] = useState<Record<string, boolean>>({});
  const [isGeneratingVideo, setIsGeneratingVideo] = useState<Record<string, boolean>>({});
  const [isSeparating, setIsSeparating] = useState<Record<string, boolean>>({});

  const [extendModalVisible, setExtendModalVisible] = useState(false);
  const [extendAudioId, setExtendAudioId] = useState<string | null>(null);
  const [extendOriginalTitle, setExtendOriginalTitle] = useState('');

  const [publishModalVisible, setPublishModalVisible] = useState(false);
  const [publishTrack, setPublishTrack] = useState<SunoAudioData | null>(null);
  const [publishTask, setPublishTask] = useState<AISongTask | null>(null);
  const [publishTitle, setPublishTitle] = useState('');
  const [publishGenre, setPublishGenre] = useState('');

  const confirmPublish = async () => {
    if (!publishTrack || !publishTask) return;
    const track = publishTrack;
    const task = publishTask;
    const customTitle = publishTitle.trim() || track.title || task.title;
    const customGenre = publishGenre.trim();

    setPublishModalVisible(false);
    setIsPublishing((prev: any) => ({ ...prev, [track.id]: true }));
    try {
      const { session, profile } = useAuthStore.getState();
      if (!session) throw new Error("Not logged in");
      
      let targetAudioUrl = track.audioUrl || (track as any).streamAudioUrl || (track as any).sourceAudioUrl;
      let targetCoverUrl = track.imageUrl;
      
      if (targetAudioUrl?.includes('cdn1.suno.ai') || targetAudioUrl?.includes('tempfile.aiquickdraw.com')) {
        try {
          const fetchPromise = task.taskType === 'VOCAL_REMOVAL' ? getVocalRemovalInfo(task.taskId) : getTaskInfo(task.taskId);
          const timeoutPromise = new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000));
          const info = await Promise.race([fetchPromise, timeoutPromise]);
          if (info && info.data && info.data.length > 0) {
            const freshTrack = info.data.find((t: any) => t.id === track.id);
            if (freshTrack) {
              targetAudioUrl = freshTrack.audioUrl || freshTrack.streamAudioUrl || freshTrack.sourceAudioUrl;
              targetCoverUrl = freshTrack.imageUrl;
            }
          }
        } catch (fallbackErr) {
          console.log("Failed to refresh publish URL, proceeding with original URL:", fallbackErr);
        }
      }

      let localAudioUri: string;
      if (targetAudioUrl?.startsWith('file://')) {
        localAudioUri = targetAudioUrl;
      } else {
        localAudioUri = FileSystem.cacheDirectory + `${track.id}.mp3`;
        await FileSystem.downloadAsync(targetAudioUrl, localAudioUri);
      }

      let localCoverUri: string;
      if (targetCoverUrl?.startsWith('file://')) {
        localCoverUri = targetCoverUrl;
      } else {
        localCoverUri = FileSystem.cacheDirectory + `${track.id}.jpg`;
        if (targetCoverUrl) {
          await FileSystem.downloadAsync(targetCoverUrl, localCoverUri);
        } else {
          localCoverUri = '';
        }
      }

      const audioBase64 = await FileSystem.readAsStringAsync(localAudioUri, { encoding: FileSystem.EncodingType.Base64 });
      const { error: audioErr } = await supabase.storage.from('audio').upload(`ai_tracks/${track.id}.mp3`, decode(audioBase64), { contentType: 'audio/mpeg', upsert: true });
      if (audioErr) throw audioErr;

      let coverPublicUrl = '';
      if (localCoverUri) {
        const coverBase64 = await FileSystem.readAsStringAsync(localCoverUri, { encoding: FileSystem.EncodingType.Base64 });
        const { error: coverErr } = await supabase.storage.from('images').upload(`ai_covers/${track.id}.jpg`, decode(coverBase64), { contentType: 'image/jpeg', upsert: true });
        if (!coverErr) {
          coverPublicUrl = supabase.storage.from('images').getPublicUrl(`ai_covers/${track.id}.jpg`).data.publicUrl;
        }
      }

      const audioPublicUrl = supabase.storage.from('audio').getPublicUrl(`ai_tracks/${track.id}.mp3`).data.publicUrl;

      const { data: existing } = await supabase.from('tracks').select('id, cover_url').eq('audio_url', audioPublicUrl).maybeSingle();

      if (existing) {
        const { error: dbErr } = await supabase.from('tracks').update({
          title: customTitle,
          genre: customGenre || 'AI',
          cover_url: coverPublicUrl || existing.cover_url
        }).eq('id', existing.id);
        if (dbErr) throw dbErr;
      } else {
        const { error: dbErr } = await supabase.from('tracks').insert({
          user_id: session.user.id,
          artist_name: profile?.display_name || session.user.user_metadata?.display_name || 'AI Artist',
          title: customTitle,
          genre: customGenre || 'AI',
          audio_url: audioPublicUrl,
          cover_url: coverPublicUrl,
          lyrics: track.prompt || null,
          duration_sec: Math.floor(track.duration || 0),
          play_count: 0,
          is_public: true,
          is_ai: true,
        });
        if (dbErr) throw dbErr;
      }

      useAIStore.getState().updateTrack(task.taskId, track.id, { title: customTitle, isPublished: true } as any);

      Alert.alert("Success", "Song published to your profile!");
    } catch (e: any) {
      Alert.alert("Publish Error", e.message);
    } finally {
      setIsPublishing((prev: any) => ({ ...prev, [track.id]: false }));
    }
  };

  const openExtendModal = (audioId: string, title: string) => {
    setExtendAudioId(audioId);
    setExtendOriginalTitle(title);
    setExtendModalVisible(true);
  };

  const handleExtendSuccess = (taskId: string, originalTitle: string) => {
    useAIStore.getState().addTask(
      taskId,
      `Ext: ${originalTitle || 'AI Track'}`,
      'GENERATE'
    );
    Alert.alert("Success", "Extension started! A new task has been added to your workspace.");
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Workspace</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity style={styles.headerIconBtn}>
              <Ionicons name="search" size={20} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.creditBadge, (profile?.credits || 0) <= 2 && { backgroundColor: 'rgba(255, 59, 48, 0.1)', borderColor: COLORS.error, borderWidth: 1 }]} 
              onPress={() => router.push('/buy-credits')}
            >
              <Ionicons name="diamond" size={14} color={(profile?.credits || 0) <= 2 ? COLORS.error : COLORS.gold} />
              <Text style={[styles.creditText, (profile?.credits || 0) <= 2 && { color: COLORS.error }]}>
                {profile?.credits || 0}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cardsScroll} contentContainerStyle={{ paddingRight: 16 }}>
          <TouchableOpacity onPress={() => navigateToTab && navigateToTab('Create')} activeOpacity={0.8}>
            <LinearGradient colors={['#108c5c', '#1358BD']} style={styles.topCard}>
              <Ionicons name="sparkles" size={28} color="#FFF" style={{ marginBottom: 12 }} />
              <Text style={styles.topCardText}>Create Music</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigateToTab && navigateToTab('Personas')} activeOpacity={0.8}>
            <LinearGradient colors={['#A81A8A', '#571096']} style={styles.topCard}>
              <Ionicons name="mic" size={28} color="#FFF" style={{ marginBottom: 12 }} />
              <Text style={styles.topCardText}>Voice Personas</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigateToTab && navigateToTab('Cover')} activeOpacity={0.8}>
            <LinearGradient colors={['#C41427', '#800B17']} style={styles.topCard}>
              <Ionicons name="disc" size={28} color="#FFF" style={{ marginBottom: 12 }} />
              <Text style={styles.topCardText}>Cover Songs</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigateToTab && navigateToTab('Sounds')} activeOpacity={0.8}>
            <LinearGradient colors={['#E59400', '#D34D00']} style={styles.topCard}>
              <Ionicons name="volume-medium" size={28} color="#FFF" style={{ marginBottom: 12 }} />
              <Text style={styles.topCardText}>Sound Effects</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.localLibrarySection}>
          <TouchableOpacity style={styles.localLibraryRow}>
            <Ionicons name="albums-outline" size={24} color={COLORS.textPrimary} style={{ marginRight: 16 }} />
            <Text style={styles.localLibraryText}>Playlists</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textTertiary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.localLibraryRow}>
            <Ionicons name="cloud-offline-outline" size={24} color={COLORS.textPrimary} style={{ marginRight: 16 }} />
            <Text style={styles.localLibraryText}>Offline Songs</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textTertiary} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.localLibraryRow, { borderBottomWidth: 0 }]}>
            <Ionicons name="phone-portrait-outline" size={24} color={COLORS.textPrimary} style={{ marginRight: 16 }} />
            <Text style={styles.localLibraryText}>Device Music</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textTertiary} />
          </TouchableOpacity>
        </View>

        <View style={styles.subHeader}>
          <Text style={styles.subHeaderTitle}>My Songs</Text>
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={styles.filterText}>Filter</Text>
            <Ionicons name="funnel" size={14} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        {tasks.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="folder-open-outline" size={64} color="rgba(255,255,255,0.2)" />
            <Text style={styles.emptyText}>Your workspace is empty.</Text>
            <Text style={styles.emptySub}>Generate or cover audio to see it here.</Text>
          </View>
        ) : (
          tasks.map(task => (
            <TaskItem 
              key={task.taskId} 
              task={task} 
              isPublishing={isPublishing} 
              setIsPublishing={setIsPublishing} 
              isDownloading={isDownloading} 
              setIsDownloading={setIsDownloading} 
              isGeneratingVideo={isGeneratingVideo}
              setIsGeneratingVideo={setIsGeneratingVideo}
              isSeparating={isSeparating}
              setIsSeparating={setIsSeparating}
              openPersonaModal={openPersonaModal}
              openExtendModal={openExtendModal}
              onPublishClick={(track, task) => {
                setPublishTrack(track);
                setPublishTask(task);
                setPublishTitle(track.title || task.title);
                setPublishGenre('');
                setPublishModalVisible(true);
              }}
            />
          ))
        )}
      </ScrollView>

      <ExtendModal 
         visible={extendModalVisible}
         onClose={() => setExtendModalVisible(false)}
         audioId={extendAudioId}
         originalTitle={extendOriginalTitle}
         onSuccess={handleExtendSuccess}
      />

      <Modal visible={publishModalVisible} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#1E1E1E', padding: 24, borderRadius: 16 }}>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 16 }}>Publish Song</Text>
            
            <Text style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 8, fontWeight: '600' }}>Track Name</Text>
            <TextInput
              style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', padding: 12, borderRadius: 8, marginBottom: 16 }}
              value={publishTitle}
              onChangeText={setPublishTitle}
              placeholder="Enter track name..."
              placeholderTextColor="rgba(255,255,255,0.4)"
            />

            <Text style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 8, fontWeight: '600' }}>Genre</Text>
            <TextInput
              style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', padding: 12, borderRadius: 8, marginBottom: 24 }}
              value={publishGenre}
              onChangeText={setPublishGenre}
              placeholder="e.g. Afrobeats, Bongo Flava..."
              placeholderTextColor="rgba(255,255,255,0.4)"
            />

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <TouchableOpacity onPress={() => setPublishModalVisible(false)} style={{ padding: 12 }}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={confirmPublish}
                style={{ backgroundColor: COLORS.gold, padding: 12, borderRadius: 8, paddingHorizontal: 20 }}
              >
                <Text style={{ color: '#000', fontWeight: '700' }}>Publish</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export function TaskItem({ task, isPublishing, setIsPublishing, isDownloading, setIsDownloading, isGeneratingVideo, setIsGeneratingVideo, isSeparating, setIsSeparating, openPersonaModal, openExtendModal, onPublishClick }: { task: AISongTask, isPublishing: any, setIsPublishing: any, isDownloading: any, setIsDownloading: any, isGeneratingVideo: any, setIsGeneratingVideo: any, isSeparating: any, setIsSeparating: any, openPersonaModal: (id: string, taskId: string) => void, openExtendModal: (audioId: string, title: string) => void, onPublishClick: (track: SunoAudioData, task: AISongTask) => void }) {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const router = useRouter();
  const { updateTask, removeTask, updateTrack } = useAIStore();
  const [pollError, setPollError] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuTrack, setMenuTrack] = useState<SunoAudioData | null>(null);

  const openMenu = (track: SunoAudioData) => {
    setMenuTrack(track);
    setMenuVisible(true);
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleGenerateVideo = async (track: SunoAudioData) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const { profile, fetchProfile } = useAuthStore.getState();
    if (!profile || profile.credits < 1) {
      Alert.alert("Out of Credits", "You need at least 1 credit to generate a video. Buy more credits to continue!");
      return;
    }

    setIsGeneratingVideo((prev: any) => ({ ...prev, [track.id]: true }));
    try {
      const { error: creditError } = await supabase
        .from('profiles')
        .update({ credits: profile.credits - 1 })
        .eq('id', profile.id);
      if (creditError) throw creditError;
      
      await fetchProfile();
      
      const mp4TaskId = await createMusicVideo(task.taskId, track.id);
      
      const interval = setInterval(async () => {
        try {
          const info = await getVideoRecordInfo(mp4TaskId);
          if (info.status === 'success') {
            clearInterval(interval);
            updateTrack(task.taskId, track.id, { videoUrl: info.videoUrl });
            setIsGeneratingVideo((prev: any) => ({ ...prev, [track.id]: false }));
            Alert.alert("Success", "Music Video generated!");
          } else if (info.status === 'failed') {
            clearInterval(interval);
            setIsGeneratingVideo((prev: any) => ({ ...prev, [track.id]: false }));
            Alert.alert("Error", "Video generation failed.");
          }
        } catch (e) {
          console.error(e);
        }
      }, 5000);
      
    } catch (e: any) {
      setIsGeneratingVideo((prev: any) => ({ ...prev, [track.id]: false }));
      Alert.alert("Video Error", e.message);
    }
  };

  const handleAutoDownload = async (taskId: string, tracks: SunoAudioData[]) => {
    for (const track of tracks) {
      try {
        let targetAudioUrl = track.audioUrl || (track as any).streamAudioUrl || (track as any).sourceAudioUrl;
        if (!targetAudioUrl || targetAudioUrl.startsWith('file://')) continue;

        const localAudioUri = FileSystem.documentDirectory + `AI_${track.id}.mp3`;
        
        const fileInfo = await FileSystem.getInfoAsync(localAudioUri);
        if (!fileInfo.exists) {
          const { status } = await FileSystem.downloadAsync(targetAudioUrl, localAudioUri);
          if (status !== 200) {
            await FileSystem.deleteAsync(localAudioUri, { idempotent: true });
            throw new Error(`Failed to download audio, status: ${status}`);
          }
        }
        
        updateTrack(taskId, track.id, { audioUrl: localAudioUri });
      } catch (e) {
        console.log("Auto-download failed for track", track.id, e);
      }
    }
  };

  const handleAutoPublish = async (taskId: string, tracks: SunoAudioData[], title: string) => {
    for (const track of tracks) {
      if ((track as any).isPublished) continue;

      try {
        const { session, profile } = useAuthStore.getState();
        if (!session) continue;

        let targetAudioUrl = track.audioUrl || (track as any).streamAudioUrl || (track as any).sourceAudioUrl;
        let targetCoverUrl = track.imageUrl;

        if (!targetAudioUrl || targetAudioUrl.startsWith('file://')) continue;

        const localAudioUri = FileSystem.cacheDirectory + `auto_publish_${track.id}.mp3`;
        await FileSystem.downloadAsync(targetAudioUrl, localAudioUri);

        let localCoverUri = '';
        if (targetCoverUrl) {
          localCoverUri = FileSystem.cacheDirectory + `auto_publish_${track.id}.jpg`;
          await FileSystem.downloadAsync(targetCoverUrl, localCoverUri);
        }

        const audioBase64 = await FileSystem.readAsStringAsync(localAudioUri, { encoding: FileSystem.EncodingType.Base64 });
        const { error: audioErr } = await supabase.storage.from('audio').upload(`ai_tracks/${track.id}.mp3`, decode(audioBase64), { contentType: 'audio/mpeg', upsert: true });
        if (audioErr) continue;

        let coverPublicUrl = '';
        if (localCoverUri) {
          const coverBase64 = await FileSystem.readAsStringAsync(localCoverUri, { encoding: FileSystem.EncodingType.Base64 });
          const { error: coverErr } = await supabase.storage.from('images').upload(`ai_covers/${track.id}.jpg`, decode(coverBase64), { contentType: 'image/jpeg', upsert: true });
          if (!coverErr) {
            coverPublicUrl = supabase.storage.from('images').getPublicUrl(`ai_covers/${track.id}.jpg`).data.publicUrl;
          }
        }

        const audioPublicUrl = supabase.storage.from('audio').getPublicUrl(`ai_tracks/${track.id}.mp3`).data.publicUrl;

        const { data: existing } = await supabase.from('tracks').select('id').eq('audio_url', audioPublicUrl).maybeSingle();

        if (!existing) {
          await supabase.from('tracks').insert({
            user_id: session.user.id,
            artist_name: profile?.display_name || session.user.user_metadata?.display_name || 'AI Artist',
            title: track.title || title,
            audio_url: audioPublicUrl,
            cover_url: coverPublicUrl,
            lyrics: track.prompt || null,
            duration_sec: Math.floor(track.duration || 0),
            play_count: 0,
            is_public: true,
            is_ai: true,
          });
        }

        updateTrack(taskId, track.id, { isPublished: true } as any);
      } catch (e) {
        console.log("Auto-publish failed for track", track.id, e);
      }
    }
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    
    const refundCredit = async () => {
      try {
        const { profile, fetchProfile } = useAuthStore.getState();
        if (profile?.id) {
          const { error } = await supabase.rpc('deduct_credits', { user_id: profile.id, amount: -1 });
          if (error) {
             await supabase.from('profiles').update({ credits: profile.credits + 1 }).eq('id', profile.id);
          }
          await fetchProfile(profile.id);
        }
      } catch (e) {
        console.error("Failed to refund credit", e);
      }
    };

    if (task.status === 'PENDING' || task.status === 'PROCESSING') {
      const poll = async () => {
        try {
          const info = task.taskType === 'VOCAL_REMOVAL' 
            ? await getVocalRemovalInfo(task.taskId) 
            : await getTaskInfo(task.taskId);
          setPollError(null);
          
          const hasTracks = info.data && info.data.length > 0 && (info.data[0].audioUrl || info.data[0].streamAudioUrl);
          
          if (hasTracks && info.data) {
             const mappedData = info.data.map((t: any) => ({ ...t, audioUrl: t.audioUrl || t.streamAudioUrl || t.sourceAudioUrl }));
             updateTask(task.taskId, 'SUCCESS', mappedData);
             handleAutoDownload(task.taskId, mappedData);
             handleAutoPublish(task.taskId, mappedData, task.title);
          } else if (info.status === 'SENSITIVE_WORD_ERROR') {
             updateTask(task.taskId, 'SENSITIVE_WORD_ERROR');
             refundCredit();
          } else if (info.status?.includes('FAILED') || info.status?.includes('ERROR')) {
             updateTask(task.taskId, 'FAILED', undefined, info.status);
             refundCredit();
          } else if (info.status === 'SUCCESS' && !hasTracks) {
             updateTask(task.taskId, 'FAILED', undefined, 'SUCCESS but no audio returned');
             refundCredit();
          }
        } catch (e: any) {
          setPollError(e.message || "Network error");
        }
      };
      poll(); // check immediately on mount
      interval = setInterval(poll, 10000);
    }
    return () => clearInterval(interval);
  }, [task.status]);

  const manualCheck = async () => {
    try {
      const info = task.taskType === 'VOCAL_REMOVAL' 
        ? await getVocalRemovalInfo(task.taskId) 
        : await getTaskInfo(task.taskId);
      const hasTracks = info.data && info.data.length > 0 && (info.data[0].sourceAudioUrl || info.data[0].audioUrl || info.data[0].streamAudioUrl);
      if (hasTracks && info.data) {
        const mappedData = info.data.map((t: any) => ({ ...t, audioUrl: t.audioUrl || t.streamAudioUrl || t.sourceAudioUrl }));
        updateTask(task.taskId, 'SUCCESS', mappedData);
        handleAutoDownload(task.taskId, mappedData);
        handleAutoPublish(task.taskId, mappedData, task.title);
      } else if (info.status === 'SENSITIVE_WORD_ERROR') {
        updateTask(task.taskId, 'SENSITIVE_WORD_ERROR');
      } else if (info.status === 'FAILED' || (info.status === 'SUCCESS' && !hasTracks)) {
        updateTask(task.taskId, 'FAILED');
      }
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const handlePlay = async (track: SunoAudioData) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      let playTrackData = track;
      let targetUrl = track.audioUrl || (track as any).audio_url || (track as any).streamAudioUrl || (track as any).sourceAudioUrl;
      
      if (targetUrl?.includes('cdn1.suno.ai') || targetUrl?.includes('tempfile.aiquickdraw.com')) {
        try {
          const fetchPromise = getTaskInfo(task.taskId);
          const timeoutPromise = new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000));
          const info = await Promise.race([fetchPromise, timeoutPromise]);
          if (info && info.data && info.data.length > 0) {
            const freshTrack = info.data.find((t: any) => t.id === track.id);
            if (freshTrack) {
              playTrackData = { ...freshTrack, audioUrl: freshTrack.audioUrl || freshTrack.audio_url || freshTrack.streamAudioUrl || freshTrack.sourceAudioUrl } as any;
              targetUrl = playTrackData.audioUrl;
              const mappedData = info.data.map((t: any) => ({ ...t, audioUrl: t.audioUrl || t.audio_url || t.streamAudioUrl || t.sourceAudioUrl }));
              updateTask(task.taskId, 'SUCCESS', mappedData);
            }
          }
        } catch (fallbackErr) {
          console.log("Failed to refresh track URL, proceeding with original URL:", fallbackErr);
        }
      }

      if (!targetUrl) {
        Alert.alert("Error", "No audio URL found for this track.");
        return;
      }
      
      if (targetUrl?.includes('kie.ai/suno-api')) {
        Alert.alert("Corrupted Track", "This track was generated before the API fix and cannot be played. Please generate a new song.");
        return;
      }

      const { profile } = useAuthStore.getState();
      const aiTrack = {
        id: playTrackData.id,
        audio_url: targetUrl,
        title: playTrackData.title || task.title,
        artist_name: profile?.display_name || 'AI Generated',
        cover_url: playTrackData.imageUrl || (playTrackData as any).image_url || 'https://via.placeholder.com/150',
        video_url: playTrackData.videoUrl || track.videoUrl,
        duration: Math.floor(playTrackData.duration || 0),
        play_count: 0,
        is_unpublished: true,
        is_ai: true,
        lyrics: playTrackData.prompt || null
      };

      usePlayerStore.getState().setMode('local');
      usePlayerStore.getState().playTrack(aiTrack as any);
      router.push('/player');
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const handleDownload = async (track: SunoAudioData) => {
    setIsDownloading((prev: any) => ({ ...prev, [track.id]: true }));
    try {
      let localAudioUri = track.audioUrl;
      
      if (!localAudioUri?.startsWith('file://')) {
        let targetAudioUrl = track.audioUrl || (track as any).streamAudioUrl || (track as any).sourceAudioUrl;
        if (targetAudioUrl?.includes('cdn1.suno.ai') || targetAudioUrl?.includes('tempfile.aiquickdraw.com')) {
          try {
            const fetchPromise = task.taskType === 'VOCAL_REMOVAL' ? getVocalRemovalInfo(task.taskId) : getTaskInfo(task.taskId);
            const timeoutPromise = new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000));
            const info = await Promise.race([fetchPromise, timeoutPromise]);
            if (info && info.data && info.data.length > 0) {
              const freshTrack = info.data.find((t: any) => t.id === track.id);
              if (freshTrack) {
                targetAudioUrl = freshTrack.audioUrl || freshTrack.streamAudioUrl || freshTrack.sourceAudioUrl;
              }
            }
          } catch (fallbackErr) {
            console.log("Failed to refresh download URL, proceeding with original URL:", fallbackErr);
          }
        }
        if (targetAudioUrl && !targetAudioUrl.startsWith('file://')) {
          localAudioUri = FileSystem.documentDirectory + `AI_${track.id}.mp3`;
          const { status } = await FileSystem.downloadAsync(targetAudioUrl, localAudioUri);
          if (status === 200) {
            updateTrack(task.taskId, track.id, { audioUrl: localAudioUri });
          } else {
            await FileSystem.deleteAsync(localAudioUri, { idempotent: true });
          }
        }
      }
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(localAudioUri, {
          mimeType: 'audio/mpeg',
          dialogTitle: `Share ${track.title || 'AI Song'}`,
          UTI: 'public.mp3'
        });
      } else {
        Alert.alert("Error", "Sharing is not available on this device.");
      }
    } catch (e: any) {
      Alert.alert("Download Error", e.message);
    } finally {
      setIsDownloading((prev: any) => ({ ...prev, [track.id]: false }));
    }
  };

  const handleSeparateVocals = async (track: SunoAudioData) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const { profile, fetchProfile } = useAuthStore.getState();
    if (!profile || profile.credits < 1) {
      Alert.alert("Out of Credits", "You need at least 1 credit to separate vocals. Buy more credits to continue!");
      return;
    }

    setIsSeparating((prev: any) => ({ ...prev, [track.id]: true }));
    try {
      const { error: creditError } = await supabase
        .from('profiles')
        .update({ credits: profile.credits - 1 })
        .eq('id', profile.id);
      if (creditError) throw creditError;
      
      await fetchProfile();

      const newTaskId = await separateVocals(task.taskId, track.id);
      useAIStore.getState().addTask(
        newTaskId,
        `Separated: ${track.title || task.title}`,
        'VOCAL_REMOVAL'
      );
      Alert.alert("Success", "Vocal separation started! A new task has been added to your workspace.");
    } catch (e: any) {
      Alert.alert("Separation Error", e.message);
    } finally {
      setIsSeparating((prev: any) => ({ ...prev, [track.id]: false }));
    }
  };

  return (
    <View style={styles.taskCard}>
      {task.status === 'PENDING' || task.status === 'PROCESSING' ? (
        <View style={styles.trackRow}>
          <View style={[styles.trackImg, { backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' }]}>
            <ActivityIndicator color={COLORS.gold} />
          </View>
          <View style={{ flex: 1, marginLeft: 12, justifyContent: 'center' }}>
            <Text style={styles.trackTitle}>{task.title}</Text>
            <Text style={styles.trackSubtitle}>{pollError ? `Retrying... (${pollError})` : 'AI is composing...'}</Text>
          </View>
        </View>
      ) : task.status === 'SENSITIVE_WORD_ERROR' ? (
        <View style={styles.trackRow}>
          <View style={[styles.trackImg, { backgroundColor: 'rgba(255,59,48,0.1)', alignItems: 'center', justifyContent: 'center' }]}>
            <Ionicons name="warning" size={24} color={COLORS.error} />
          </View>
          <View style={{ flex: 1, marginLeft: 12, justifyContent: 'center' }}>
            <Text style={styles.trackTitle}>{task.title}</Text>
            <Text style={[styles.trackSubtitle, { color: COLORS.error }]}>Generation Failed: Sensitive words</Text>
          </View>
          <TouchableOpacity onPress={() => removeTask(task.taskId)} style={{ padding: 8 }}>
            <Ionicons name="trash-outline" size={20} color={COLORS.textTertiary} />
          </TouchableOpacity>
        </View>
      ) : task.status === 'FAILED' ? (
        <View style={styles.trackRow}>
          <View style={[styles.trackImg, { backgroundColor: 'rgba(255,59,48,0.1)', alignItems: 'center', justifyContent: 'center' }]}>
            <Ionicons name="warning" size={24} color={COLORS.error} />
          </View>
          <View style={{ flex: 1, marginLeft: 12, justifyContent: 'center' }}>
            <Text style={styles.trackTitle}>{task.title}</Text>
            <Text style={[styles.trackSubtitle, { color: COLORS.error }]} numberOfLines={1}>{(task as any).failReason || 'Generation Failed'}</Text>
          </View>
          <TouchableOpacity onPress={() => removeTask(task.taskId)} style={{ padding: 8 }}>
            <Ionicons name="trash-outline" size={20} color={COLORS.textTertiary} />
          </TouchableOpacity>
        </View>
      ) : Array.isArray(task.tracks) && task.tracks.length > 0 ? (
        task.tracks.map((track, idx) => (
          <View key={track.id} style={styles.trackRow}>
            <TouchableOpacity onPress={() => handlePlay(track)}>
              <View>
                <Image source={{ uri: track.imageUrl }} style={styles.trackImg} cachePolicy="memory-disk" />
                <View style={styles.durationPill}>
                  <Text style={styles.durationText}>{formatDuration(track.duration || 0)}</Text>
                </View>

              </View>
            </TouchableOpacity>
            
            <View style={{ flex: 1, marginLeft: 12, justifyContent: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 2 }}>
                <Text style={styles.trackTitle} numberOfLines={1}>{track.title || "AI Generated"}</Text>
                {task.taskType === 'VOCAL_REMOVAL' ? (
                  <View style={styles.badge}><Text style={styles.badgeText}>Vocals</Text></View>
                ) : (
                  <View style={styles.badge}><Text style={styles.badgeText}>v5.5</Text></View>
                )}
              </View>
              <Text style={styles.trackSubtitle} numberOfLines={1}>{track.prompt || track.tags || 'AI Generated Music'}</Text>
            </View>

            <TouchableOpacity style={{ padding: 12 }} onPress={() => openMenu(track)}>
              <Ionicons name="ellipsis-horizontal" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
        ))
      ) : null}

      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
            <View style={styles.modalHandle} />
            {menuTrack && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                <View style={styles.modalHeader}>
                  <Image source={{ uri: menuTrack.imageUrl }} style={styles.modalImg} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle} numberOfLines={1}>{menuTrack.title || 'AI Generated'}</Text>
                    <Text style={styles.modalSubtitle} numberOfLines={1}>{menuTrack.prompt || menuTrack.tags || 'AI Generated Music'}</Text>
                  </View>
                </View>

                <MenuAction icon="play" label="Play Track" onPress={() => { setMenuVisible(false); handlePlay(menuTrack); }} COLORS={COLORS} />
                <MenuAction icon="cloud-upload" label="Publish to Profile" onPress={() => { setMenuVisible(false); onPublishClick(menuTrack, task); }} loading={isPublishing[menuTrack.id]} COLORS={COLORS} />
                <MenuAction icon="download" label="Download Audio" onPress={() => { handleDownload(menuTrack); }} loading={isDownloading[menuTrack.id]} COLORS={COLORS} />
                
                <MenuAction icon="cut" label="Separate Vocals" onPress={() => { setMenuVisible(false); handleSeparateVocals(menuTrack); }} loading={isSeparating[menuTrack.id]} COLORS={COLORS} />
                <MenuAction icon="add-circle" label="Extend Track" onPress={() => { setMenuVisible(false); openExtendModal(menuTrack.id, menuTrack.title || task.title); }} COLORS={COLORS} />
                <MenuAction icon="person-add" label="Voice Persona (Coming Soon)" onPress={() => { setMenuVisible(false); Alert.alert("Coming Soon", "Voice Personas are currently in development!"); }} COLORS={COLORS} />
                
                <View style={styles.menuDivider} />
                <MenuAction icon="trash" label="Delete Task" color={COLORS.error} onPress={() => { setMenuVisible(false); removeTask(task.taskId); }} COLORS={COLORS} />
              </ScrollView>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function MenuAction({ icon, label, onPress, loading, disabled, color, COLORS }: any) {
  return (
    <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20 }} onPress={onPress} disabled={disabled || loading}>
      <View style={{ width: 32, alignItems: 'center' }}>
        {loading ? <ActivityIndicator size="small" color={color || COLORS.textPrimary} /> : <Ionicons name={icon} size={22} color={color || COLORS.textPrimary} />}
      </View>
      <Text style={{ fontSize: 16, fontWeight: '600', marginLeft: 12, color: color || COLORS.textPrimary }}>{label}</Text>
    </TouchableOpacity>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, marginTop: 8 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 28, fontWeight: '900' },
  headerIconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  
  cardsScroll: { marginBottom: 24 },
  topCard: { width: 140, height: 100, borderRadius: 12, padding: 12, justifyContent: 'space-between', marginRight: 12 },
  topCardText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  
  localLibrarySection: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, paddingHorizontal: 16, marginBottom: 32 },
  localLibraryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  localLibraryText: { flex: 1, color: COLORS.textPrimary, fontSize: 17, fontWeight: '600' },

  subHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  subHeaderTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '800' },
  filterText: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },

  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 40, padding: 20 },
  emptyText: { color: COLORS.textSecondary, fontSize: 18, fontWeight: '700', marginTop: 16 },
  emptySub: { color: COLORS.textTertiary, fontSize: 14, marginTop: 8 },

  creditBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, gap: 6 },
  creditText: { color: COLORS.gold, fontSize: 14, fontWeight: '700' },
  
  taskCard: { marginBottom: 0 },
  trackRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  trackImg: { width: 56, height: 56, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)' },
  durationPill: { position: 'absolute', bottom: 4, left: 4, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 },
  durationText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  newDot: { position: 'absolute', top: 25, left: -8, width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF2D55' },
  
  trackTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700', marginRight: 8 },
  badge: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 12, marginRight: 4 },
  badgeText: { color: COLORS.textSecondary, fontSize: 10, fontWeight: '600' },
  trackSubtitle: { color: COLORS.textTertiary, fontSize: 14, marginTop: 4 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1E1E1E', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' },
  modalHandle: { width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginTop: 12, marginBottom: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', marginBottom: 8 },
  modalImg: { width: 48, height: 48, borderRadius: 8, marginRight: 12 },
  modalTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '800' },
  modalSubtitle: { color: COLORS.textTertiary, fontSize: 14, marginTop: 2 },
  menuDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginVertical: 8 },
});
