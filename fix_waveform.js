const fs = require('fs');
const filePath = 'app/(tabs)/ai-studio.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// The first array map (Record Modal)
content = content.replace(
  /\{Array\.from\(\{ length: 40 \}\)\.map\(\(_, i\) => \{\s*const h = isRecording\s*\?\s*\(Math\.sin\(animationTick \* 0\.2 \+ i\) \* 0\.5 \+ 0\.5\) \*\s*\(volume \* 80\) \+\s*10\s*:\s*10;/g,
  `{Array.from({ length: 40 }).map((_, i) => {
                    const idleHeight = (Math.sin(animationTick * 0.15 + i * 0.5) * 0.5 + 0.5) * 20 + 4;
                    const recordHeight = (Math.sin(animationTick * 0.3 + i) * 0.5 + 0.5) * (volume * 80) + 10;
                    const h = isRecording ? recordHeight : idleHeight;`
);

// The second array map (Voice Wizard Step 2)
content = content.replace(
  /\{Array\.from\(\{ length: 30 \}\)\.map\(\(_, i\) => \{\s*const h = isRecording\s*\?\s*\(Math\.sin\(animationTick \* 0\.3 \+ i\) \* 0\.5 \+ 0\.5\) \*\s*\(volume \* 60\) \+\s*10\s*:\s*10;/g,
  `{Array.from({ length: 30 }).map((_, i) => {
                      const idleHeight = (Math.sin(animationTick * 0.2 + i * 0.4) * 0.5 + 0.5) * 15 + 4;
                      const recordHeight = (Math.sin(animationTick * 0.4 + i) * 0.5 + 0.5) * (volume * 60) + 10;
                      const h = isRecording ? recordHeight : idleHeight;`
);

// Wait, I should also check if the Voice Wizard Step 1 red circle can be animated? The red circle pulses (scale: pulseAnim) but is not a line.
// The user says "glowing red line i want animated thing to be ther not that stupid line".

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated waveform animations.');
