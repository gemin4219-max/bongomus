const fs = require('fs');
const filePath = 'app/(tabs)/ai-studio.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const oldModalStart = `<View style={{ flex: 1, backgroundColor: "#1A1A1D", paddingTop: 20 }}>`;
const newModalStart = `<View style={{ flex: 1, backgroundColor: "#000", overflow: 'hidden' }}>
          <LinearGradient
            colors={['#0F0C29', '#302B63', '#24243E']}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <BlurView intensity={30} tint="dark" style={{ flex: 1, paddingTop: 20 }}>`;

const oldModalEnd = `</View>
      </Modal>`;
const newModalEnd = `</BlurView>
        </View>
      </Modal>`;

// Replace the modal wrapper
if (content.includes(oldModalStart)) {
  content = content.replace(oldModalStart, newModalStart);
  
  // Now we must replace the closing tag of this View.
  // The structure is:
  // <View style={{ flex: 1, backgroundColor: "#1A1A1D", paddingTop: 20 }}>
  // ...
  //         )}
  //       </View>
  //     </Modal>
  content = content.replace(
    /<\/View>\n\s*<\/Modal>/, 
    `</BlurView>\n        </View>\n      </Modal>`
  );
}

// Enhance Step 1 UI
const oldStep1 = `<View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingHorizontal: 20,
                  marginBottom: 40,
                }}
              >
                <View style={{ width: 32 }} />
                <Text
                  style={{ color: "#FFF", fontSize: 18, fontWeight: "500" }}
                >
                  {voiceWizardStep === 1
                    ? "Sing or rap your favorite song"
                    : "0:05"}
                </Text>
                {voiceWizardStep === 1 ? (
                  <TouchableOpacity
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: "rgba(255,255,255,0.1)",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Ionicons name="help" size={16} color="#FFF" />
                  </TouchableOpacity>
                ) : (
                  <View style={{ width: 32 }} />
                )}
              </View>`;

const newStep1 = `<View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingHorizontal: 20,
                  marginBottom: 40,
                }}
              >
                <TouchableOpacity onPress={() => setIsVoiceWizardOpen(false)} style={{
                  width: 40, height: 40, borderRadius: 20,
                  backgroundColor: "rgba(255,255,255,0.1)",
                  justifyContent: "center", alignItems: "center",
                  borderWidth: 1, borderColor: "rgba(255,255,255,0.15)"
                }}>
                  <Ionicons name="close" size={20} color="#FFF" />
                </TouchableOpacity>
                
                <View style={{
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  paddingHorizontal: 20, paddingVertical: 10,
                  borderRadius: 20,
                  borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
                }}>
                  <Text style={{ color: "#FFF", fontSize: 16, fontWeight: "600", letterSpacing: 0.5 }}>
                    {voiceWizardStep === 1 ? "Sing or rap your favorite song" : "Recording... 0:05"}
                  </Text>
                </View>

                {voiceWizardStep === 1 ? (
                  <TouchableOpacity
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: "rgba(255,255,255,0.1)",
                      justifyContent: "center",
                      alignItems: "center",
                      borderWidth: 1, borderColor: "rgba(255,255,255,0.15)"
                    }}
                  >
                    <Ionicons name="help" size={20} color="#FFF" />
                  </TouchableOpacity>
                ) : (
                  <View style={{ width: 40 }} />
                )}
              </View>
              
              {voiceWizardStep === 1 && (
                <View style={{ paddingHorizontal: 40, alignItems: 'center', marginBottom: 20 }}>
                  <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, textAlign: 'center', lineHeight: 22 }}>
                    We need a clean sample of your voice to generate your AI persona. Make sure there is no background noise.
                  </Text>
                </View>
              )}`;

content = content.replace(oldStep1, newStep1);

// Enhance buttons
const oldButtons = `<View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-evenly",
                    width: "100%",
                  }}
                >
                  {voiceWizardStep === 1 ? (
                    <TouchableOpacity style={{ alignItems: "center" }}>
                      <View
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 22,
                          backgroundColor: "rgba(255,255,255,0.05)",
                          justifyContent: "center",
                          alignItems: "center",
                          marginBottom: 8,
                        }}
                      >
                        <Ionicons
                          name="cloud-upload-outline"
                          size={20}
                          color="#FFF"
                        />
                      </View>
                      <Text
                        style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}
                      >
                        Upload
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={{ width: 60 }} />
                  )}

                  <TouchableOpacity
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 40,
                      backgroundColor: "rgba(255,255,255,0.05)",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                    onPress={() => {`;

const newButtons = `<View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-evenly",
                    width: "100%",
                  }}
                >
                  {voiceWizardStep === 1 ? (
                    <TouchableOpacity style={{ alignItems: "center" }}>
                      <LinearGradient
                        colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.05)']}
                        style={{
                          width: 50,
                          height: 50,
                          borderRadius: 25,
                          justifyContent: "center",
                          alignItems: "center",
                          marginBottom: 10,
                          borderWidth: 1, borderColor: "rgba(255,255,255,0.2)"
                        }}
                      >
                        <Ionicons
                          name="cloud-upload-outline"
                          size={22}
                          color="#FFF"
                        />
                      </LinearGradient>
                      <Text
                        style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "600" }}
                      >
                        Upload
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={{ width: 60 }} />
                  )}

                  <TouchableOpacity
                    style={{
                      width: 90,
                      height: 90,
                      borderRadius: 45,
                      backgroundColor: "rgba(255, 42, 117, 0.15)",
                      justifyContent: "center",
                      alignItems: "center",
                      borderWidth: 2,
                      borderColor: "rgba(255, 42, 117, 0.4)",
                      shadowColor: "#FF2A75",
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.6,
                      shadowRadius: 15,
                      elevation: 10,
                    }}
                    onPress={() => {`;

content = content.replace(oldButtons, newButtons);

const oldLibBtn = `{voiceWizardStep === 1 ? (
                    <TouchableOpacity style={{ alignItems: "center" }}>
                      <View
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 22,
                          backgroundColor: "rgba(255,255,255,0.05)",
                          justifyContent: "center",
                          alignItems: "center",
                          marginBottom: 8,
                        }}
                      >
                        <Ionicons
                          name="library-outline"
                          size={20}
                          color="#FFF"
                        />
                      </View>
                      <Text
                        style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}
                      >
                        Library
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: "rgba(255,255,255,0.05)",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                      onPress={() => setVoiceWizardStep(2)}
                    >
                      <Ionicons name="chevron-forward" size={20} color="#FFF" />
                    </TouchableOpacity>
                  )}`;

const newLibBtn = `{voiceWizardStep === 1 ? (
                    <TouchableOpacity style={{ alignItems: "center" }}>
                      <LinearGradient
                        colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.05)']}
                        style={{
                          width: 50,
                          height: 50,
                          borderRadius: 25,
                          justifyContent: "center",
                          alignItems: "center",
                          marginBottom: 10,
                          borderWidth: 1, borderColor: "rgba(255,255,255,0.2)"
                        }}
                      >
                        <Ionicons
                          name="library-outline"
                          size={22}
                          color="#FFF"
                        />
                      </LinearGradient>
                      <Text
                        style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "600" }}
                      >
                        Library
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={{
                        width: 50,
                        height: 50,
                        borderRadius: 25,
                        backgroundColor: "rgba(255,255,255,0.15)",
                        justifyContent: "center",
                        alignItems: "center",
                        borderWidth: 1, borderColor: "rgba(255,255,255,0.3)"
                      }}
                      onPress={() => setVoiceWizardStep(2)}
                    >
                      <Ionicons name="chevron-forward" size={24} color="#FFF" />
                    </TouchableOpacity>
                  )}`;
content = content.replace(oldLibBtn, newLibBtn);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully upgraded the Voice Wizard modal.');
