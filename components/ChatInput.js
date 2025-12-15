import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const formatDuration = (millis) => {
  if (!millis || millis < 0 || isNaN(millis)) return '0:00';
  const minutes = Math.floor(millis / 60000);
  const seconds = Math.floor((millis % 60000) / 1000);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

const ChatInput = ({ 
  isRecording, 
  inputText, 
  onTextChange, 
  onSend, 
  onCameraPress, 
  onLocationPress, // <--- NEW PROP
  onStartRecording, 
  onStopRecording, 
  onCancelRecording,
  recordingDuration 
}) => {
  
  if (isRecording) {
    return (
      <View style={styles.recordingBar}>
         <View style={styles.recordingInfo}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingTimer}>{formatDuration(recordingDuration)}</Text>
         </View>
         <View style={styles.recordingActions}>
           <TouchableOpacity onPress={onCancelRecording} style={styles.actionButton}>
             <Ionicons name="trash-outline" size={26} color="#FF3B30" />
           </TouchableOpacity>
           <TouchableOpacity onPress={onStopRecording} style={styles.sendRecordingButton}>
             <Ionicons name="arrow-up" size={24} color="#fff" />
           </TouchableOpacity>
         </View>
      </View>
    );
  }

  return (
    <View style={styles.inputContainer}>
      {/* CAMERA BUTTON */}
      <TouchableOpacity onPress={onCameraPress} style={styles.iconButton}>
        <Ionicons name="camera-outline" size={24} color="#007AFF" />
      </TouchableOpacity>

      {/* NEW: LOCATION BUTTON */}
      <TouchableOpacity onPress={onLocationPress} style={styles.iconButton}>
        <Ionicons name="location-outline" size={24} color="#007AFF" />
      </TouchableOpacity>
      
      <TextInput 
        style={styles.inputField} 
        value={inputText} 
        onChangeText={onTextChange} 
        placeholder="Message" 
        placeholderTextColor="#999" 
        multiline 
      />
      
      {inputText.trim().length > 0 ? (
        <TouchableOpacity onPress={onSend} style={styles.sendButton}>
          <Ionicons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity onPress={onStartRecording} style={styles.micButton}>
          <Ionicons name="mic" size={22} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5E5EA' },
  iconButton: { padding: 8, marginBottom: 2 },
  inputField: { flex: 1, backgroundColor: '#F2F2F7', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10, fontSize: 16, maxHeight: 100, marginRight: 10, color: '#000' },
  sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center' },
  micButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center' },
  recordingBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5E5EA' },
  recordingInfo: { flexDirection: 'row', alignItems: 'center' },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF3B30', marginRight: 10 },
  recordingTimer: { fontSize: 18, color: '#000', fontWeight: '500', minWidth: 60 },
  recordingActions: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  actionButton: { padding: 5 },
  sendRecordingButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center' },
});

export default ChatInput;