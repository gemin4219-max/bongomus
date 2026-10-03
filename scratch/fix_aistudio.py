import re

with open('app/(tabs)/ai-studio.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace handlePlayTestAudio
content = re.sub(
    r"  const handlePlayTestAudio = async \(personaId: string\) => \{[\s\S]*?  \};\n",
    """  const handlePlayTestAudio = async (personaId: string) => {
    const url = testAudioUrls[personaId];
    if (!url) return;
    try {
      if (testPlayingId === personaId && testPlayer.playing) {
        testPlayer.pause();
        setTestPlayingId(null);
        return;
      }
      testPlayer.play();
      setTestPlayingId(personaId);
    } catch (e) {
      console.error("Test audio play error", e);
    }
  };\n""",
    content,
    count=1
)

# Replace startRecording
content = re.sub(
    r"  const startRecording = async \(\) => \{[\s\S]*?  \};\n",
    """  const startRecording = async () => {
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (permission.status !== "granted") return;
      mainRecorder.record();
      setIsRecording(true);
      setVolume(0);
      setRecordingDurationMs(0);
    } catch (err) {
      console.error("Failed to start recording", err);
    }
  };\n""",
    content,
    count=1
)

# Replace stopRecording
content = re.sub(
    r"  const stopRecording = async \(submit: boolean\) => \{[\s\S]*?  \};\n",
    """  const stopRecording = async (submit: boolean) => {
    if (!mainRecorder.isRecording) {
      setIsRecording(false);
      if (submit) {
        setSelectedAudioUri("mock-uri");
        setIsAudioMenuOpen(false);
        setTimeout(() => setIsAudioEditorOpen(true), 400);
      }
      return;
    }
    try {
      mainRecorder.stop();
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
  };\n""",
    content,
    count=1
)

# Replace handlePlayPause
content = re.sub(
    r"  const handlePlayPause = async \(\) => \{[\s\S]*?  \};\n",
    """  const handlePlayPause = async () => {
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
  };\n""",
    content,
    count=1
)

# Also fix stopWizardRecording
content = re.sub(
    r"  const stopWizardRecording = async \(save: boolean\) => \{[\s\S]*?  \};\n",
    """  const stopWizardRecording = async (save: boolean) => {
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
        const durationSec = wizardDurationMs / 1000;
        if (durationSec < 5) {
          import('react-native').then(rn => rn.Alert.alert("Too Short", "Please record at least 5 seconds of your voice."));
          return;
        }
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
  };\n""",
    content,
    count=1
)

with open('app/(tabs)/ai-studio.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated ai-studio.tsx")
