const fs = require('fs');

let content = fs.readFileSync('app/(tabs)/ai-studio.tsx', 'utf8');

// 1. Replace imports
content = content.replace("import { Audio } from 'expo-av';", "import { useAudioRecorder, useAudioPlayer, requestRecordingPermissionsAsync, setAudioModeAsync, RecordingPresets } from 'expo-audio';");
content = content.replace("let AudioModule: any = Audio;", "let AudioModule: any = null;");

// 2. Add Hooks in AIStudioScreen
const hooks_code = `
  // expo-audio hooks
  const audioPlayer = useAudioPlayer(selectedAudioUri);
  const testPlayer = useAudioPlayer(testingPersonaId && testAudioUrls[testingPersonaId] ? testAudioUrls[testingPersonaId] : null);
  const wizardPlayer = useAudioPlayer(voiceWizardStep === 5 ? verifyAudioUri : personaAudioUri);
  
  const mainRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const wizardRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
`;

content = content.replace(/const \[isPlaying, setIsPlaying\] = useState\(false\);/, "const [isPlaying, setIsPlaying] = useState(false);\n" + hooks_code);

// 3. Replace handlePlayTestAudio
const new_handlePlayTestAudio = `  const handlePlayTestAudio = async (personaId: string) => {
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
  };`;
content = content.replace(/const handlePlayTestAudio = async \(personaId: string\) => \{[\s\S]*?console\.error\("Test audio play error", e\);\n\s+\}\n\s+\};/, new_handlePlayTestAudio);

// 4. Replace playWizardPreview & stopWizardPreview
const new_wizardPreview = `  const playWizardPreview = async () => {
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
  };`;
content = content.replace(/const playWizardPreview = async \(\) => \{[\s\S]*?setIsWizardPreviewPlaying\(false\);\n\s+\}\n\s+\};/, new_wizardPreview);

// 5. Replace startWizardRecording & stopWizardRecording
const new_startWizardRecording = `  const startWizardRecording = async () => {
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
  };`;

const new_stopWizardRecording = `  const stopWizardRecording = async (save: boolean) => {
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
  };`;

content = content.replace(/const startWizardRecording = async \(\) => \{[\s\S]*?setWizardVolume\(0\);\n\s+\} catch \(err\) \{\n\s+console\.error\("Failed to start wizard recording", err\);\n\s+Alert\.alert\("Error", "Could not start recording\. Please try again\."\);\n\s+\}\n\s+\};/, new_startWizardRecording);
content = content.replace(/const stopWizardRecording = async \(save: boolean\) => \{[\s\S]*?console\.error\("Failed to stop wizard recording", err\);\n\s+\}\n\s+\};/, new_stopWizardRecording);

// 6. Replace startRecording & stopRecording
const new_startRecording = `  const startRecording = async () => {
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (permission.status !== "granted") return;
      mainRecorder.record();
      setIsRecording(true);
      setVolume(0);
    } catch (error) {
      console.error("Failed to start recording", error);
    }
  };`;

const new_stopRecording = `  const stopRecording = async (submit: boolean) => {
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
  };`;

content = content.replace(/const startRecording = async \(\) => \{[\s\S]*?console\.error\("Failed to start recording", error\);\n\s+\}\n\s+\};/, new_startRecording);
content = content.replace(/const stopRecording = async \(submit: boolean\) => \{[\s\S]*?console\.error\("Failed to stop recording", error\);\n\s+\}\n\s+\};/, new_stopRecording);

// 7. Replace handlePlayPause
const new_handlePlayPause = `  const handlePlayPause = async () => {
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
  };`;
content = content.replace(/const handlePlayPause = async \(\) => \{[\s\S]*?console\.error\("Audio playback error", e\);\n\s+\}\n\s+\};/, new_handlePlayPause);

// 8. Fix wizardPreviewSound usage in stopWizardPreview/handlePlayTestAudio 
// Actually they use sound directly, let's fix the useEffects
content = content.replace(/wizardPreviewSound\?\.unloadAsync\(\)\.catch\(\(\) => \{\}\);\n\s+setWizardPreviewSound\(null\);/g, "wizardPlayer.pause();");
content = content.replace(/testSound\?\.stopAsync\(\)\.catch\(\(\) => \{\}\);/g, "testPlayer.pause();");

fs.writeFileSync('app/(tabs)/ai-studio.tsx', content, 'utf8');
console.log('Done refactoring');
