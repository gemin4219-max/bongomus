export const Audio = {
  requestPermissionsAsync: async () => ({ status: 'granted' }),
  setAudioModeAsync: async () => {},
  Sound: {
    createAsync: async () => ({ sound: { playAsync: async () => {}, pauseAsync: async () => {}, stopAsync: async () => {}, unloadAsync: async () => {}, setPositionAsync: async () => {}, setOnPlaybackStatusUpdate: () => {}, getStatusAsync: async () => ({ isLoaded: true, positionMillis: 0, durationMillis: 0, playableDurationMillis: 0 }) } }),
  },
  Recording: {
    createAsync: async (options, callback, interval = 100) => {
      let durationMillis = 0;
      let isRecording = true;
      const intervalId = setInterval(() => {
        durationMillis += interval;
        const metering = -160 + Math.random() * 160; // Simulate audio metering
        if (callback && isRecording) {
          callback({ isRecording: true, durationMillis, metering });
        }
      }, interval);

      return {
        recording: {
          stopAndUnloadAsync: async () => {
            isRecording = false;
            clearInterval(intervalId);
          },
          getURI: () => 'mock-uri',
          setProgressUpdateInterval: () => {},
          setOnRecordingStatusUpdate: () => {}
        }
      };
    },
  },
  RecordingOptionsPresets: {
    HIGH_QUALITY: {}
  }
};
