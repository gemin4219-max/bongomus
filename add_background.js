const fs = require('fs');
const filePath = 'app/(tabs)/ai-studio.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add AnimatedBackground component
const animatedBgComp = `
const AnimatedBackground = () => {
  const anim1 = useRef(new Animated.Value(0)).current;
  const anim2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim1, { toValue: 1, duration: 8000, useNativeDriver: true }),
        Animated.timing(anim1, { toValue: 0, duration: 8000, useNativeDriver: true })
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(anim2, { toValue: 1, duration: 12000, useNativeDriver: true }),
        Animated.timing(anim2, { toValue: 0, duration: 12000, useNativeDriver: true })
      ])
    ).start();
  }, []);

  return (
    <View style={StyleSheet.absoluteFillObject}>
      <LinearGradient colors={['#05001a', '#0a0005']} style={StyleSheet.absoluteFillObject} />
      <Animated.View style={{
        position: 'absolute', top: -100, left: -100, width: 400, height: 400, borderRadius: 200,
        backgroundColor: 'rgba(255, 42, 117, 0.15)',
        transform: [
          { translateX: anim1.interpolate({ inputRange: [0, 1], outputRange: [0, 150] }) },
          { translateY: anim1.interpolate({ inputRange: [0, 1], outputRange: [0, 100] }) },
          { scale: anim1.interpolate({ inputRange: [0, 1], outputRange: [1, 1.2] }) }
        ]
      }} />
      <Animated.View style={{
        position: 'absolute', bottom: -100, right: -100, width: 500, height: 500, borderRadius: 250,
        backgroundColor: 'rgba(240, 152, 25, 0.12)',
        transform: [
          { translateX: anim2.interpolate({ inputRange: [0, 1], outputRange: [0, -100] }) },
          { translateY: anim2.interpolate({ inputRange: [0, 1], outputRange: [0, -150] }) },
          { scale: anim2.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] }) }
        ]
      }} />
      <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFillObject} />
    </View>
  );
};
`;

if (!content.includes('const AnimatedBackground = () => {')) {
  content = content.replace('export default function AIStudio() {', animatedBgComp + '\nexport default function AIStudio() {');
}

// 2. Wrap main return with AnimatedBackground
if (!content.includes('<AnimatedBackground />')) {
  content = content.replace(
    /return \(\n\s*<SafeAreaView\n\s*style=\{\[styles\.container, \{ backgroundColor: COLORS\.black \}\]\}\n\s*edges=\{\["top"\]\}\n\s*>/,
    `return (
    <View style={{ flex: 1, backgroundColor: '#05001a' }}>
      <AnimatedBackground />
      <SafeAreaView
        style={[styles.container, { backgroundColor: 'transparent' }]}
        edges={["top"]}
      >`
  );
  
  // Close the wrapping view at the end. We know `</SafeAreaView>` is the last thing.
  content = content.replace(/<\/SafeAreaView>\n\s*\);\n\}/g, `</SafeAreaView>\n    </View>\n  );\n}`);
}

// 3. Update the Expanded Input Modal background as well
content = content.replace(
  /<View\n\s*style=\{\{\n\s*flex: 1,\n\s*backgroundColor: COLORS\.black,/g,
  `<View
            style={{
              flex: 1,
              backgroundColor: 'transparent',`
);

// In the Modal, add AnimatedBackground before the inner views
if (content.includes('<Modal\n        visible={isInputExpanded}')) {
  // We need to inject <AnimatedBackground /> right inside the Modal's <View> wrapping the content.
  content = content.replace(
    /<TouchableWithoutFeedback onPress=\{Keyboard\.dismiss\}>\n\s*<View\n\s*style=\{\{\n\s*flex: 1,\n\s*backgroundColor: 'transparent',/g,
    `<TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View
            style={{
              flex: 1,
              backgroundColor: 'transparent',
            }}>
            <AnimatedBackground />`
  );
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully injected AnimatedBackground');
