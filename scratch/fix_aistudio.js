const fs = require('fs');

let content = fs.readFileSync('app/(tabs)/ai-studio.tsx', 'utf-8');

// Replace startRecording
content = content.replace(
    /  const startRecording = async \(\) => \{[\s\S]*?  \};\r?\n/,
    `  const startRecording = async () => {
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
  };\n`
);

// Replace handlePlayPause
content = content.replace(
    /  const handlePlayPause = async \(\) => \{[\s\S]*?  \};\r?\n/,
    `  const handlePlayPause = async () => {
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
  };\n`
);

fs.writeFileSync('app/(tabs)/ai-studio.tsx', content, 'utf-8');
console.log("Updated ai-studio.tsx");
