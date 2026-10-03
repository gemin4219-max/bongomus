import re

with open("app/(tabs)/ai-studio.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Replace imports
content = content.replace("import { Audio } from 'expo-av';", "import { useAudioRecorder, useAudioPlayer, requestRecordingPermissionsAsync, setAudioModeAsync, RecordingPresets } from 'expo-audio';")
content = content.replace("let AudioModule: any = Audio;", "let AudioModule: any = null;")

# 2. Add Hooks in AIStudioScreen
hooks_code = """
  // expo-audio hooks
  const audioPlayer = useAudioPlayer(selectedAudioUri);
  const testPlayer = useAudioPlayer(testAudioUrls[testingPersonaId || ""] || null);
  const wizardPlayer = useAudioPlayer(voiceWizardStep === 5 ? verifyAudioUri : personaAudioUri);
  
  const mainRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const wizardRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
"""

content = re.sub(
    r"(const \[isPlaying, setIsPlaying\] = useState\(false\);)",
    r"\1\n" + hooks_code,
    content
)

# 3. Replace handlePlayTestAudio
new_handlePlayTestAudio = """  const handlePlayTestAudio = async (personaId: string) => {
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
      testPlayer.play();
      setTestPlayingId(personaId);
    } catch (e) {
      console.error("Test audio play error", e);
    }
  };"""
content = re.sub(
    r"const handlePlayTestAudio = async \(personaId: string\) => \{.*?\n\s+try \{.*?setTestPlayingId\(personaId\);\n\s+\} catch \(e\) \{\n\s+console.error\(\"Test audio play error\", e\);\n\s+\}\n\s+\};",
    new_handlePlayTestAudio,
    content,
    flags=re.DOTALL
)

# 4. Replace playWizardPreview & stopWizardPreview
new_wizardPreview = """  const playWizardPreview = async () => {
    if (!wizardPlayer) return;
    try {
      if (wizardPlayer.playing) {
         wizardPlayer.seekTo(0);
         wizardPlayer.play();
      } else {
         wizardPlayer.play();
      }
      setIsWizardPreviewPlaying(true);
    } catch (e) {
      console.error('Wizard preview play error', e);
    }
  };

  const stopWizardPreview = async () => {
    try {
      wizardPlayer.pause();
      setIsWizardPreviewPlaying(false);
    } catch (e) {}
  };"""

content = re.sub(
    r"const playWizardPreview = async \(\) => \{.*?setIsWizardPreviewPlaying\(false\);\n\s+\}\n\s+\};",
    new_wizardPreview,
    content,
    flags=re.DOTALL
)

# 5. Replace startWizardRecording & stopWizardRecording
new_startWizardRecording = """  const startWizardRecording = async () => {
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Permission Denied", "Microphone access is needed to record your voice.");
        return;
      }
      wizardRecorder.record();
      setIsWizardRecording(true);
      setWizardDurationMs(0);
      setWizardVolume(0);
    } catch (err) {
      console.error("Failed to start wizard recording", err);
    }
  };"""

new_stopWizardRecording = """  const stopWizardRecording = async (save: boolean) => {
    if (!wizardRecorder.isRecording) {
      setIsWizardRecording(false);
      if (save) {
        if (voiceWizardStep === 2) {
          setPersonaAudioUri("mock-persona-voice.m4a");
          setVoiceWizardStep(3);
        } else if (voiceWizardStep === 4) {
          setVerifyAudioUri("mock-persona-voice.m4a");
          setVoiceWizardStep(5);
        }
      }
      return;
    }
    try {
      wizardRecorder.stop();
      const uri = wizardRecorder.uri;
      setIsWizardRecording(false);
      setWizardVolume(0);

      if (save && uri) {
        if (voiceWizardStep === 2) {
          setPersonaAudioUri(uri);
          setVoiceWizardStep(3);
        } else if (voiceWizardStep === 4) {
          setVerifyAudioUri(uri);
          setVoiceWizardStep(5);
        }
      }
    } catch (err) {
      console.error("Failed to stop wizard recording", err);
    }
  };"""

content = re.sub(
    r"const startWizardRecording = async \(\) => \{.*?setWizardVolume\(0\);\n\s+\} catch \(err\) \{\n\s+console\.error\(\"Failed to start wizard recording\", err\);\n\s+Alert\.alert\(\"Error\", \"Could not start recording\. Please try again\.\"\);\n\s+\}\n\s+\};",
    new_startWizardRecording,
    content,
    flags=re.DOTALL
)

content = re.sub(
    r"const stopWizardRecording = async \(save: boolean\) => \{.*?\n\s+\} catch \(err\) \{\n\s+console\.error\(\"Failed to stop wizard recording\", err\);\n\s+\}\n\s+\};",
    new_stopWizardRecording,
    content,
    flags=re.DOTALL
)

# 6. Replace startRecording & stopRecording
new_startRecording = """  const startRecording = async () => {
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (permission.status !== "granted") return;
      mainRecorder.record();
      setIsRecording(true);
      setVolume(0);
    } catch (error) {
      console.error("Failed to start recording", error);
    }
  };"""

new_stopRecording = """  const stopRecording = async (submit: boolean) => {
    try {
      mainRecorder.stop();
      setIsRecording(false);
      if (submit && mainRecorder.uri) {
         setPrompt("Audio recording added. Click to process...");
      }
      setVolume(0);
    } catch (error) {
      console.error("Failed to stop recording", error);
    }
  };"""

content = re.sub(
    r"const startRecording = async \(\) => \{.*?\n\s+\} catch \(error\) \{\n\s+console\.error\(\"Failed to start recording\", error\);\n\s+\}\n\s+\};",
    new_startRecording,
    content,
    flags=re.DOTALL
)

content = re.sub(
    r"const stopRecording = async \(submit: boolean\) => \{.*?\n\s+\} catch \(error\) \{\n\s+console\.error\(\"Failed to stop recording\", error\);\n\s+\}\n\s+\};",
    new_stopRecording,
    content,
    flags=re.DOTALL
)

# 7. Replace handlePlayPause
new_handlePlayPause = """  const handlePlayPause = async () => {
    try {
      if (!audioPlayer) return;
      if (isPlaying) {
        audioPlayer.pause();
        setIsPlaying(false);
      } else {
        audioPlayer.play();
        setIsPlaying(true);
      }
    } catch (e) {
      console.error("Audio playback error", e);
    }
  };"""

content = re.sub(
    r"const handlePlayPause = async \(\) => \{.*?\n\s+\} catch \(e\) \{\n\s+console\.error\(\"Audio playback error\", e\);\n\s+\}\n\s+\};",
    new_handlePlayPause,
    content,
    flags=re.DOTALL
)

with open("app/(tabs)/ai-studio.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Done")
