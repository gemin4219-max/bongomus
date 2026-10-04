const TrackPlayer = require('react-native-track-player').default;
const { Event } = require('react-native-track-player');


module.exports = async function() {
  // Handle play/pause from notification shade, lock screen, Bluetooth, headphones, etc.
  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    TrackPlayer.play();
  });

  TrackPlayer.addEventListener(Event.RemotePause, () => {
    TrackPlayer.pause();
  });

  TrackPlayer.addEventListener(Event.RemoteStop, () => {
    TrackPlayer.stop();
  });

  TrackPlayer.addEventListener(Event.RemoteNext, () => {
    // Delegate to the store so queue logic (shuffle, repeat, auto-play) is respected
    try {
      const { usePlayerStore } = require('./store/playerStore');
      usePlayerStore.getState().skipNext();
    } catch (e) {
      TrackPlayer.skipToNext().catch(() => {});
    }
  });

  TrackPlayer.addEventListener(Event.RemotePrevious, () => {
    try {
      const { usePlayerStore } = require('./store/playerStore');
      usePlayerStore.getState().skipPrev();
    } catch (e) {
      TrackPlayer.skipToPrevious().catch(() => {});
    }
  });

  TrackPlayer.addEventListener(Event.RemoteSeek, (event) => {
    TrackPlayer.seekTo(event.position);
  });
};
