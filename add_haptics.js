const fs = require('fs');
const filePath = 'app/(tabs)/ai-studio.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add Haptics import
if (!content.includes("import * as Haptics from 'expo-haptics';")) {
  content = content.replace(
    /import \{ Audio \} from "expo-av";/,
    "import { Audio } from \"expo-av\";\nimport * as Haptics from 'expo-haptics';"
  );
}

// 2. Add Haptics logic in setOnRecordingStatusUpdate
const oldCallback = `      recording.setOnRecordingStatusUpdate((status) => {
        if (status.isRecording) {
          const db = status.metering !== undefined ? status.metering : -160;
          // Map -50dB to 0dB into 0 to 1 scale for visual volume
          const val = (db + 50) / 50;
          setVolume(Math.max(0, Math.min(1, val)));
        }
      });`;

const newCallback = `      let lastVibrateTime = Date.now();
      let lastVol = 0;
      recording.setOnRecordingStatusUpdate((status) => {
        if (status.isRecording) {
          const db = status.metering !== undefined ? status.metering : -160;
          // Map -50dB to 0dB into 0 to 1 scale for visual volume
          const val = (db + 50) / 50;
          const newVol = Math.max(0, Math.min(1, val));
          setVolume(newVol);
          
          if (newVol > 0.5 && newVol - lastVol > 0.15 && Date.now() - lastVibrateTime > 100) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            lastVibrateTime = Date.now();
          }
          lastVol = newVol;
        }
      });`;

if (content.includes(oldCallback)) {
  content = content.replace(oldCallback, newCallback);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log("Successfully added haptics");
} else {
  console.log("Could not find the target string for setOnRecordingStatusUpdate.");
}
