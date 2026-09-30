import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Modal, TextInput, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from '@/mock-expo-av';

import { supabase } from '../../lib/supabase';
import {
  generateVoiceValidation,
  getVoiceValidationInfo,
  createCustomVoice,
  getCustomVoiceRecord,
  regenerateVoiceValidation,
  checkVoiceAvailability,
} from '../../lib/sunoApi';
import { useThemeStore } from '../../store/themeStore';

import { useAuthStore } from '../../store/authStore';

interface CustomVoiceWizardProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CustomVoiceWizard({ visible, onClose, onSuccess }: CustomVoiceWizardProps) {
  const { COLORS } = useThemeStore();
  const styles = getStyles(COLORS);
  const { session } = useAuthStore();
  
  const [step, setStep] = useState(0); 
  // 0: Initial Info & Source Audio, 1: Generating Phrase, 2: Record Verification, 3: Generating Voice, 4: Success

  // Form State
  const [voiceName, setVoiceName] = useState('');
  const [sourceAudioUri, setSourceAudioUri] = useState<string | null>(null);
  const [sourceAudioName, setSourceAudioName] = useState<string | null>(null);
  const [vocalStart, setVocalStart] = useState('0');
  const [vocalEnd, setVocalEnd] = useState('10');
  
  const [taskId, setTaskId] = useState<string | null>(null);
  const [validationPhrase, setValidationPhrase] = useState<string | null>(null);
  
  const [verifyAudioUri, setVerifyAudioUri] = useState<string | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [sourceRecording, setSourceRecording] = useState<Audio.Recording | null>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recording) {
        recording.stopAndUnloadAsync().catch(() => {});
      }
      if (sourceRecording) {
        sourceRecording.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, [recording, sourceRecording]);

  // Polling validation phrase
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === 1 && taskId) {
      interval = setInterval(async () => {
        try {
          const info = await getVoiceValidationInfo(taskId);
          if (info.status === 'wait_validating' && info.validateInfo) {
            setValidationPhrase(info.validateInfo);
            setStep(2);
            clearInterval(interval);
          } else if (info.status === 'processing_validate_fail' || info.status === 'fail') {
            clearInterval(interval);
            Alert.alert("Error", info.errorMessage || "Failed to generate validation phrase");
            setStep(0);
          }
        } catch (e: any) {
          console.error(e);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [step, taskId]);

  // Polling final voice
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === 3 && taskId) {
      interval = setInterval(async () => {
        try {
          const info = await getCustomVoiceRecord(taskId);
          if (!info) return; // transient — keep polling
          if (info.status === 'success') {
            clearInterval(interval);

            // voiceId comes directly from typed VoiceRecordData
            const voiceId = info.voiceId || taskId;

            // Check availability before proceeding (best practice per API docs)
            try {
              const available = await checkVoiceAvailability(taskId);
              if (!available) {
                // Voice exists but isn't ready yet — keep polling a bit longer
                return;
              }
            } catch {
              // checkVoiceAvailability failing is non-fatal — continue
            }

            // Add to Zustand store
            import('../../store/aiStore').then(({ useAIStore }) => {
              useAIStore.getState().addPersona({
                id: voiceId,
                name: voiceName,
                description: 'Custom Voice Clone',
                createdAt: Date.now(),
              });
            });

            // Persist to Supabase
            supabase
              .from('custom_voices')
              .update({ status: 'success', voice_id: voiceId })
              .eq('task_id', taskId)
              .then();

            setStep(4);
            onSuccess();
          } else if (info.status === 'fail' || info.status === 'processing_validate_fail') {
            clearInterval(interval);
            Alert.alert('Error', info.errorMessage || 'Failed to generate custom voice');
            setStep(2);
          }
        } catch (e: any) {
          console.error(e);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [step, taskId]);


  const uploadToStorage = async (uri: string, folder: string) => {
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    const fileName = `${Date.now()}_audio.mp3`; // simplfied extension
    const { error: uploadErr } = await supabase.storage.from('audio').upload(`${folder}/${fileName}`, decode(base64), { contentType: 'audio/mpeg' });
    if (uploadErr) throw uploadErr;
    return supabase.storage.from('audio').getPublicUrl(`${folder}/${fileName}`).data.publicUrl;
  };

  const handleStartValidation = async () => {
    if (!sourceAudioUri || !voiceName) {
      Alert.alert("Missing Details", "Please provide a voice name and select a source audio file.");
      return;
    }
    setIsProcessing(true);
    try {
      const publicUrl = await uploadToStorage(sourceAudioUri, 'voices');
      const startS = parseInt(vocalStart) || 0;
      const endS = parseInt(vocalEnd) || 10;
      
      const newTaskId = await generateVoiceValidation(publicUrl, startS, endS, 'en');
      setTaskId(newTaskId);
      setStep(1);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const startRecording = async () => {
    if (recording) return;
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: newRecording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(newRecording);
    } catch (err: any) {
      console.error('Failed to start recording', err);
      Alert.alert('Error', 'Failed to start recording. Please check your microphone permissions.');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    const currentRecording = recording;
    setRecording(null);
    try {
      await currentRecording.stopAndUnloadAsync();
      const uri = currentRecording.getURI();
      if (uri) setVerifyAudioUri(uri);
    } catch (err: any) {
      console.error('Failed to stop recording', err);
      Alert.alert('Error', 'Failed to stop recording.');
    }
  };

  const startSourceRecording = async () => {
    if (sourceRecording) return;
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: newRecording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setSourceRecording(newRecording);
    } catch (err: any) {
      console.error('Failed to start source recording', err);
      Alert.alert('Error', 'Failed to start source recording. Please check your microphone permissions.');
    }
  };

  const stopSourceRecording = async () => {
    if (!sourceRecording) return;
    const currentRecording = sourceRecording;
    setSourceRecording(null);
    try {
      await currentRecording.stopAndUnloadAsync();
      const uri = currentRecording.getURI();
      if (uri) {
        setSourceAudioUri(uri);
        setSourceAudioName("Recorded Audio");
      }
    } catch (err: any) {
      console.error('Failed to stop source recording', err);
      Alert.alert('Error', 'Failed to stop source recording.');
    }
  };

  const pickAudio = async (setUri: (uri: string) => void, setName: (name: string) => void) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*' });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setUri(result.assets[0].uri);
        setName(result.assets[0].name);
      }
    } catch (e: any) {
      Alert.alert("Error picking audio", e.message);
    }
  };

  const handleGenerateVoice = async () => {
    if (!verifyAudioUri || !taskId) {
      Alert.alert('Missing Details', 'Please record or upload the verification phrase.');
      return;
    }
    setIsProcessing(true);
    try {
      const publicUrl = await uploadToStorage(verifyAudioUri, 'verification');
      // API order: taskId, verifyUrl, voiceName, description, style, singerSkillLevel, callBackUrl
      const newTaskId = await createCustomVoice(
        taskId,
        publicUrl,
        voiceName,
        'Custom Voice Clone',
        'Pop',        // style
        'beginner',   // singerSkillLevel
      );
      setTaskId(newTaskId);

      // Persist to Supabase
      await supabase.from('custom_voices').insert({
        user_id: session?.user.id,
        name: voiceName,
        task_id: newTaskId,
        status: 'pending',
      });

      setStep(3);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRegeneratePhrase = async () => {
    if (!taskId) return;
    setIsProcessing(true);
    try {
      const newTaskId = await regenerateVoiceValidation(taskId);
      setTaskId(newTaskId);
      setValidationPhrase(null);
      setVerifyAudioUri(null);
      setStep(1); // go back to polling screen while new phrase is generated
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = async () => {
    if (recording) {
      await stopRecording();
    }
    if (sourceRecording) {
      await stopSourceRecording();
    }
    setStep(0);
    setVoiceName('');
    setSourceAudioUri(null);
    setVerifyAudioUri(null);
    setValidationPhrase(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'} onRequestClose={handleClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Create Custom Voice</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
          
          {step === 0 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Step 1: Source Audio</Text>
              <Text style={styles.stepDesc}>Upload or record a clear audio clip of the voice you want to clone.</Text>
              
              <Text style={styles.label}>Voice Name</Text>
              <TextInput style={styles.input} placeholder="My Awesome Voice" placeholderTextColor={COLORS.textTertiary} value={voiceName} onChangeText={setVoiceName} />
              
              <Text style={styles.label}>Audio Source</Text>
              
              <View style={styles.audioSourceContainer}>
                <TouchableOpacity 
                  style={[styles.audioActionCard, sourceRecording && styles.audioActionCardActive]} 
                  onPress={sourceRecording ? stopSourceRecording : startSourceRecording}
                >
                  <View style={[styles.recordBtnSmall, sourceRecording && styles.recordingActive]}>
                    <Ionicons name={sourceRecording ? "stop" : "mic"} size={20} color={COLORS.white} />
                  </View>
                  <Text style={styles.audioActionText}>
                    {sourceRecording ? 'Stop Recording' : 'Record Voice'}
                  </Text>
                </TouchableOpacity>

                <View style={styles.divider} />

                <TouchableOpacity style={styles.audioActionCard} onPress={() => pickAudio(setSourceAudioUri, setSourceAudioName)}>
                  <View style={styles.uploadBtnSmall}>
                    <Ionicons name="document-attach" size={20} color={COLORS.gold} />
                  </View>
                  <Text style={styles.audioActionText}>Upload File</Text>
                </TouchableOpacity>
              </View>

              {sourceAudioName && (
                <View style={styles.selectedAudioBox}>
                  <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
                  <Text style={styles.selectedAudioText} numberOfLines={1}>Selected: {sourceAudioName}</Text>
                </View>
              )}
              
              <Text style={styles.label}>Extraction Range (Optional)</Text>
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <View style={{ flex: 1 }}>
                  <TextInput style={styles.input} placeholder="Start (s)" keyboardType="numeric" placeholderTextColor={COLORS.textTertiary} value={vocalStart} onChangeText={setVocalStart} />
                </View>
                <View style={{ flex: 1 }}>
                  <TextInput style={styles.input} placeholder="End (s)" keyboardType="numeric" placeholderTextColor={COLORS.textTertiary} value={vocalEnd} onChangeText={setVocalEnd} />
                </View>
              </View>

              <TouchableOpacity style={styles.primaryBtn} onPress={handleStartValidation} disabled={isProcessing}>
                <LinearGradient colors={[COLORS.gold, '#F9A826']} style={[StyleSheet.absoluteFill, { borderRadius: 30 }]} />
                {isProcessing ? <ActivityIndicator color={COLORS.black} /> : <Text style={styles.primaryBtnText}>Analyze Voice</Text>}
              </TouchableOpacity>
            </View>
          )}

          {step === 1 && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.gold} />
              <Text style={styles.loadingTitle}>Analyzing Audio</Text>
              <Text style={styles.loadingDesc}>Suno AI is processing your audio to generate a unique validation phrase...</Text>
            </View>
          )}

          {step === 2 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Step 2: Verification</Text>
              <Text style={styles.stepDesc}>Please record yourself singing or speaking the exact phrase below to verify ownership and tune the model.</Text>
              
              <View style={styles.phraseBox}>
                <Text style={styles.phraseText}>{validationPhrase}</Text>
              </View>
              
              <View style={{ alignItems: 'center', marginTop: 32 }}>
                <TouchableOpacity 
                  style={[styles.recordBtn, recording && styles.recordingActive]} 
                  onPress={recording ? stopRecording : startRecording}
                >
                  <Ionicons name={recording ? "stop" : "mic"} size={32} color={COLORS.white} />
                </TouchableOpacity>
                <Text style={{ color: COLORS.textSecondary, marginTop: 12 }}>
                  {recording ? 'Recording... Tap to stop' : 'Tap to record phrase'}
                </Text>
              </View>
              
              <Text style={{ color: COLORS.textTertiary, textAlign: 'center', marginVertical: 24 }}>OR</Text>
              
              <TouchableOpacity style={styles.uploadBtn} onPress={() => pickAudio(setVerifyAudioUri, () => {})}>
                <Ionicons name="document-attach-outline" size={20} color={COLORS.gold} />
                <Text style={styles.uploadBtnText}>{verifyAudioUri ? 'Change Recording' : 'Upload Verification Recording'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryBtn, !verifyAudioUri && { opacity: 0.5 }]}
                onPress={handleGenerateVoice}
                disabled={isProcessing || !verifyAudioUri}
              >
                <LinearGradient colors={[COLORS.gold, '#F9A826']} style={[StyleSheet.absoluteFill, { borderRadius: 30 }]} />
                {isProcessing ? <ActivityIndicator color={COLORS.black} /> : <Text style={styles.primaryBtnText}>Generate Custom Voice</Text>}
              </TouchableOpacity>

              {/* Regenerate phrase if it doesn't match / expired */}
              <TouchableOpacity
                style={styles.regenerateBtn}
                onPress={handleRegeneratePhrase}
                disabled={isProcessing}
              >
                <Ionicons name="refresh-outline" size={16} color={COLORS.textSecondary} />
                <Text style={styles.regenerateBtnText}>Get a Different Phrase</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 3 && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.gold} />
              <Text style={styles.loadingTitle}>Generating Voice</Text>
              <Text style={styles.loadingDesc}>Your custom voice model is being generated. This might take a few minutes...</Text>
            </View>
          )}

          {step === 4 && (
            <View style={styles.loadingContainer}>
              <Ionicons name="checkmark-circle" size={80} color={COLORS.success} />
              <Text style={styles.loadingTitle}>Voice Created!</Text>
              <Text style={styles.loadingDesc}>Your new custom voice "{voiceName}" is ready to use.</Text>
              <TouchableOpacity style={[styles.primaryBtn, { width: '100%', marginTop: 32 }]} onPress={() => { onSuccess(); handleClose(); }}>
                <LinearGradient colors={[COLORS.gold, '#F9A826']} style={[StyleSheet.absoluteFill, { borderRadius: 30 }]} />
                <Text style={styles.primaryBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>
      </View>
    </Modal>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  modalContainer: { flex: 1, backgroundColor: COLORS.black },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 40, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  modalTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '800' },
  closeBtn: { padding: 4 },
  
  stepContainer: { flex: 1, marginTop: 16 },
  stepTitle: { color: COLORS.textPrimary, fontSize: 24, fontWeight: '800', marginBottom: 8 },
  stepDesc: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 22, marginBottom: 24 },
  
  label: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700', marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: '#FFFFFF', color: '#000000', padding: 16, borderRadius: 16, fontSize: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  
  uploadBtn: { backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  uploadBtnText: { color: COLORS.gold, fontWeight: '700', fontSize: 14 },
  regenerateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16, paddingVertical: 12 },
  regenerateBtnText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  
  primaryBtn: { paddingVertical: 18, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginTop: 40, overflow: 'hidden' },
  primaryBtnText: { color: COLORS.black, fontSize: 16, fontWeight: '800' },

  audioSourceContainer: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 8, marginTop: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  audioActionCard: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 12 },
  audioActionCardActive: { backgroundColor: 'rgba(255,59,48,0.1)' },
  audioActionText: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600', marginTop: 8 },
  divider: { width: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 8 },
  
  recordBtnSmall: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.error, alignItems: 'center', justifyContent: 'center' },
  uploadBtnSmall: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(212,175,55,0.2)', alignItems: 'center', justifyContent: 'center' },
  
  selectedAudioBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(52, 199, 89, 0.1)', padding: 12, borderRadius: 12, marginTop: 16, borderWidth: 1, borderColor: 'rgba(52, 199, 89, 0.2)' },
  selectedAudioText: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '600', flex: 1, marginLeft: 8 },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  loadingTitle: { color: COLORS.textPrimary, fontSize: 24, fontWeight: '800', marginTop: 24, marginBottom: 8 },
  loadingDesc: { color: COLORS.textSecondary, fontSize: 15, textAlign: 'center', paddingHorizontal: 32, lineHeight: 24 },

  phraseBox: { backgroundColor: 'rgba(212, 175, 55, 0.1)', padding: 24, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.3)', marginTop: 16 },
  phraseText: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '600', textAlign: 'center', fontStyle: 'italic', lineHeight: 30 },
  
  recordBtn: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.error, alignItems: 'center', justifyContent: 'center', elevation: 5 },
  recordingActive: { backgroundColor: '#8b0000', transform: [{ scale: 1.1 }] }
});
