
const fs = require("fs");
const path = "C:/Users/Dragon fly/.gemini/antigravity-ide/scratch/bongo/app/(tabs)/ai-studio.tsx";
let c = fs.readFileSync(path, "utf-8");

c = c.replace(
  /const \[lyricsHistory, setLyricsHistory\] = useState<string\[\]>\(\[""\]\);\s*const \[lyricsHistoryIndex, setLyricsHistoryIndex\] = useState\(0\);\s*const \[isGeneratingLyrics, setIsGeneratingLyrics\] = useState\(false\);/,
  `const [lyricsHistory, setLyricsHistory] = useState<string[]>([""]);
    const [lyricsHistoryIndex, setLyricsHistoryIndex] = useState(0);
    const [isGeneratingLyrics, setIsGeneratingLyrics] = useState(false);
    const [isScanningLyrics, setIsScanningLyrics] = useState(false);`
);

const scanCode = `const handleScanLyrics = async () => {
      try {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission Needed", "Please grant camera permission to scan your lyrics on paper.");
          return;
        }

        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          base64: true,
          quality: 0.5,
        });

        if (!result.canceled && result.assets && result.assets.length > 0 && result.assets[0].base64) {
          setIsScanningLyrics(true);
          const base64Image = "data:image/jpeg;base64," + result.assets[0].base64;
          
          const formData = new FormData();
          formData.append("base64Image", base64Image);
          formData.append("language", "eng");
          formData.append("isOverlayRequired", "false");

          // Using free OCR.space API endpoint
          const response = await fetch("https://api.ocr.space/parse/image", {
            method: "POST",
            headers: {
              apikey: "helloworld",
            },
            body: formData,
          });

          const data = await response.json();
          if (data && data.ParsedResults && data.ParsedResults.length > 0) {
            const parsedText = data.ParsedResults[0].ParsedText;
            if (parsedText && parsedText.trim().length > 0) {
              setLyricsText((prev) => prev ? prev + "\\n\\n" + parsedText.trim() : parsedText.trim());
              Alert.alert("Scan Success", "Lyrics extracted successfully!");
            } else {
              Alert.alert("No Text Found", "Could not read any text from the image.");
            }
          } else {
            Alert.alert("Scan Error", "Failed to parse the image. Please try again.");
          }
        }
      } catch (err) {
        console.error("Scan lyrics error", err);
        Alert.alert("Error", "An error occurred while scanning.");
      } finally {
        setIsScanningLyrics(false);
      }
    };

    const handleGenerateLyrics = async () => {`;

c = c.replace(/const handleGenerateLyrics = async \(\) => {/, scanCode);

c = c.replace(
  /<TouchableOpacity\s*style=\{styles\.lyricsToolIcon\}\s*onPress=\{handleGenerateLyrics\}\s*disabled=\{isGeneratingLyrics\}\s*>/,
  `<TouchableOpacity
                        style={styles.lyricsToolIcon}
                        onPress={handleScanLyrics}
                        disabled={isScanningLyrics}
                      >
                        <Ionicons
                          name="camera-outline"
                          size={20}
                          color={
                            isScanningLyrics
                              ? "rgba(255,255,255,0.3)"
                              : "#10b981"
                          }
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.lyricsToolIcon}
                        onPress={handleGenerateLyrics}
                        disabled={isGeneratingLyrics}
                      >`
);

fs.writeFileSync(path, c, "utf-8");
console.log("Replaced successfully!");

