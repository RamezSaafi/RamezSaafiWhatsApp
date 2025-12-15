import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AudioBubble from './AudioBubble';
import Avatar from './Avatar'; // Import our new Avatar

const MessageBubble = ({ item, isMe, onImagePress, onLongPress, showStatus, isGroup, participantsCount }) => {
  const isDeleted = item.isDeleted === true;

  // --- NEW READ LOGIC ---
  // If everyone besides me (1 person) has read it.
  // participantsCount includes me. So if readBy.length === participantsCount - 1, everyone read it.
  const readByCount = item.readBy ? item.readBy.length : (item.read ? 1 : 0); // fallback for old messages
  const isReadByAll = participantsCount ? (readByCount >= participantsCount - 1) : item.read;

  const handleLocationPress = () => {
    if (item.location) {
      const { latitude, longitude } = item.location;
      const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
      Linking.openURL(url);
    }
  };

  return (
    <View style={[styles.messageRow, isMe ? styles.rowRight : styles.rowLeft]}>
      
      {/* --- SHOW SENDER AVATAR IN GROUP CHAT (LEFT SIDE) --- */}
      {!isMe && isGroup && (
        <View style={{ marginRight: 8, alignSelf: 'flex-end' }}>
          <Avatar uri={item.senderImage} name={item.senderName} size={30} />
        </View>
      )}

      {/* --- IF 1-on-1 Chat, show standard small avatar --- */}
      {!isMe && !isGroup && item.senderImage && (
         <Image source={{ uri: item.senderImage }} style={styles.msgAvatar} />
      )}

      <TouchableOpacity 
        activeOpacity={0.9} 
        onLongPress={() => onLongPress(item)}
        onPress={item.location ? handleLocationPress : undefined}
        style={[
          styles.bubble, 
          isMe ? styles.bubbleRight : styles.bubbleLeft,
          isDeleted && styles.bubbleDeleted
        ]}
      >
        {/* Show Sender Name in Group Chat */}
        {!isMe && isGroup && (
          <Text style={{ fontSize: 11, color: '#FF9500', marginBottom: 2, fontWeight: 'bold' }}>
            {item.senderName}
          </Text>
        )}

        {/* IMAGE */}
        {item.image && (
          <TouchableOpacity onPress={() => onImagePress(item.image)} onLongPress={() => onLongPress(item)}>
            <Image source={{ uri: item.image }} style={styles.messageImage} resizeMode="cover" />
          </TouchableOpacity>
        )}
        
        {/* AUDIO */}
        {item.audio && <AudioBubble uri={item.audio} initialDuration={item.audioDuration} isMe={isMe} />}
        
        {/* LOCATION */}
        {item.location && (
          <View style={styles.locationContainer}>
            <View style={[styles.mapIcon, { backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : '#f0f0f0' }]}>
              <Ionicons name="location" size={32} color="#FF3B30" />
            </View>
            <View style={styles.locationTextContainer}>
              <Text style={[styles.locationTitle, { color: isMe ? '#fff' : '#000' }]}>Shared Location</Text>
              <Text style={[styles.locationSub, { color: isMe ? 'rgba(255,255,255,0.8)' : '#666' }]}>Tap to view on map</Text>
            </View>
          </View>
        )}

        {/* TEXT */}
        {item.text ? (
          <Text style={[styles.msgText, isMe ? styles.textRight : styles.textLeft, isDeleted && styles.deletedText]}>
            {item.text}
          </Text>
        ) : null}
        
        {/* TIME & TICKS */}
        <View style={styles.metaContainer}>
          <Text style={[styles.timeText, isMe ? styles.timeRight : styles.timeLeft]}>
            {item.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          
          {/* --- UPDATED TICK LOGIC --- */}
          {isMe && !isDeleted && showStatus && (
            <Ionicons 
              name="checkmark-done" 
              size={16} 
              color={isReadByAll ? '#34B7F1' : 'rgba(255,255,255,0.7)'} 
              style={{ marginLeft: 4 }} 
            />
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  messageRow: { marginVertical: 6, flexDirection: 'row', alignItems: 'flex-end' },
  rowRight: { justifyContent: 'flex-end' },
  rowLeft: { justifyContent: 'flex-start' },
  msgAvatar: { width: 30, height: 30, borderRadius: 15, marginRight: 8, marginBottom: 2 },
  bubble: { maxWidth: '75%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18 },
  bubbleRight: { backgroundColor: '#007AFF', borderBottomRightRadius: 4 },
  bubbleLeft: { backgroundColor: '#fff', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#E5E5EA' },
  bubbleDeleted: { opacity: 0.8 },
  messageImage: { width: 200, height: 150, borderRadius: 10, marginBottom: 6, backgroundColor: '#f0f0f0' },
  msgText: { fontSize: 16, lineHeight: 22 },
  deletedText: { fontStyle: 'italic', opacity: 0.6 },
  textRight: { color: '#fff' },
  textLeft: { color: '#000' },
  metaContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 },
  timeText: { fontSize: 10 }, 
  timeRight: { color: 'rgba(255, 255, 255, 0.7)' },
  timeLeft: { color: '#8E8E93' },
  locationContainer: { flexDirection: 'row', alignItems: 'center', padding: 5, marginBottom: 5, width: 200 },
  mapIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  locationTextContainer: { flex: 1 },
  locationTitle: { fontWeight: 'bold', fontSize: 14 },
  locationSub: { fontSize: 12, textDecorationLine: 'underline' }
});

export default MessageBubble;