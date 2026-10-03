const fs = require('fs');
const filePath = 'app/(tabs)/ai-studio.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const brokenBlock = `<TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View
            style={{
              flex: 1,
              backgroundColor: COLORS.black,
            }}>
              paddingTop: Math.max(insets.top, Platform.OS === "ios" ? 40 : 20),
            }}
          >`;

const fixedBlock = `<TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View
            style={{
              flex: 1,
              backgroundColor: COLORS.black,
              paddingTop: Math.max(insets.top, Platform.OS === "ios" ? 40 : 20),
            }}
          >`;

if (content.includes(brokenBlock)) {
  content = content.replace(brokenBlock, fixedBlock);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log("Successfully fixed the layout issue.");
} else {
  console.log("Could not find the broken block.");
}
