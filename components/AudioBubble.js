import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

const formatDuration = (millis) => {
  if (!millis || millis < 0 || isNaN(millis)) return '0:00';
  const minutes = Math.floor(millis / 60000);
  const seconds = Math.floor((millis % 60000) / 1000);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

const AudioBubble = ({ uri, initialDuration, isMe }) => {
  const player = useAudioPlayer(uri, { updateInterval: 100 });
  const status = useAudioPlayerStatus(player);
  const totalDuration = (initialDuration && initialDuration > 0) ? initialDuration / 1000 : (status.duration || 0);
  const currentPosition = status.currentTime || 0;
  const progress = totalDuration > 0 ? (currentPosition / totalDuration) : 0;

  const togglePlayback = () => {
    if (status.playing) player.pause();
    else {
      if (totalDuration > 0 && currentPosition >= totalDuration - 0.1) player.seekTo(0);
      player.play();
    }
  };

  return (
    <View style={styles.audioContainer}>
      <TouchableOpacity onPress={togglePlayback} style={styles.playButton}>
        <Ionicons name={status.playing ? "pause" : "play"} size={24} color={isMe ? "#fff" : "#007AFF"} />
      </TouchableOpacity>
      <View style={styles.audioContent}>
        <View style={[styles.progressBarBackground, { backgroundColor: isMe ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)' }]}>
          <View style={[styles.progressBarFill, { width: `${Math.min(progress * 100, 100)}%`, backgroundColor: isMe ? '#fff' : '#007AFF' }]} />
        </View>
        <Text style={[styles.audioText, { color: isMe ? '#eee' : '#555' }]}>
          {formatDuration(currentPosition * 1000)} / {formatDuration(totalDuration * 1000)}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  audioContainer: { flexDirection: 'row', alignItems: 'center', width: 220, paddingVertical: 5 },
  playButton: { marginRight: 10 },
  audioContent: { flex: 1, justifyContent: 'center' },
  progressBarBackground: { height: 4, borderRadius: 2, marginBottom: 6 },
  progressBarFill: { height: 4, borderRadius: 2 },
  audioText: { fontSize: 11, fontWeight: '500' },
});

export default AudioBubble;