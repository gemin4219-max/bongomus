const fs = require('fs');
const filePath = 'app/(tabs)/ai-studio.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const oldWaveformStart = `<LinearGradient
                  colors={[
                    "rgba(255,81,47,0)",
                    "rgba(255,81,47,0.5)",
                    "rgba(255,81,47,0)",
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    height: 100,
                    width: "100%",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {Array.from({ length: 40 }).map((_, i) => {
                    const idleHeight = (Math.sin(animationTick * 0.15 + i * 0.5) * 0.5 + 0.5) * 20 + 4;
                    const recordHeight = (Math.sin(animationTick * 0.3 + i) * 0.5 + 0.5) * (volume * 80) + 10;
                    const h = isRecording ? recordHeight : idleHeight;
                    return (
                      <View
                        key={i}
                        style={{
                          width: 3,
                          height: h,
                          backgroundColor: "#F09819",
                          marginHorizontal: 2,
                          borderRadius: 2,
                        }}
                      />
                    );
                  })}
                </LinearGradient>`;

const newWaveform = `<View style={{ height: 160, width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
                  {Array.from({ length: 35 }).map((_, i) => {
                    // Create a bell curve effect so the center bars are always taller than the edges
                    const centerDist = Math.abs(i - 17) / 17; 
                    const multiplier = Math.max(0.1, 1 - Math.pow(centerDist, 1.5));
                    
                    const idleHeight = (Math.sin(animationTick * 0.2 + i * 0.4) * 0.5 + 0.5) * 25 * multiplier + 6;
                    const recordHeight = (Math.sin(animationTick * 0.5 + i * 0.8) * 0.5 + 0.5) * (volume * 120 * multiplier) + 20;
                    const h = isRecording ? recordHeight : idleHeight;
                    
                    // Alternating beautiful neon colors
                    const barColor = i % 3 === 0 ? "#FF2A75" : i % 3 === 1 ? "#9D00FF" : "#00F0FF";
                    
                    return (
                      <View
                        key={i}
                        style={{
                          width: 5,
                          height: h,
                          marginHorizontal: 3,
                          borderRadius: 5,
                          backgroundColor: barColor,
                          shadowColor: barColor,
                          shadowOffset: { width: 0, height: 0 },
                          shadowOpacity: isRecording ? 0.9 : 0.5,
                          shadowRadius: isRecording ? 12 : 6,
                          elevation: 10,
                        }}
                      />
                    );
                  })}
                </View>`;

if (content.includes(oldWaveformStart)) {
  content = content.replace(oldWaveformStart, newWaveform);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log("Successfully replaced the waveform.");
} else {
  console.log("Could not find the old waveform to replace.");
}
