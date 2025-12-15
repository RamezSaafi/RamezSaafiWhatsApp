import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ImageBackground 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useHeaderHeight } from '@react-navigation/elements'; 
import MediaGalleryModal from '../components/MediaGalleryModal';

// SDK 54 Audio
import { useAudioRecorder, useAudioRecorderState, AudioModule, RecordingPresets } from 'expo-audio';

// Firebase
import {
  collection, addDoc, orderBy, query, onSnapshot, serverTimestamp,
  doc, updateDoc, getDoc, writeBatch, arrayUnion
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { uploadImageToCloudinary, uploadAudioToCloudinary } from '../cloudinaryConfig';

// Components
import MessageBubble from '../components/MessageBubble';
import ChatInput from '../components/ChatInput';
import ImagePreviewModal from '../components/ImagePreviewModal';
import Avatar from '../components/Avatar';

export default function ChatScreen({ route, navigation }) {
  const { chatId, chatName } = route.params;
  const currentUser = auth.currentUser;
  
  const headerHeight = useHeaderHeight();

  // --- STATE ---
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [mediaGalleryVisible, setMediaGalleryVisible] = useState(false);
  
  // Chat Metadata
  const [chatData, setChatData] = useState(null);
  const [friendProfile, setFriendProfile] = useState(null);
  const [isFriendTyping, setIsFriendTyping] = useState(false);
  
  // Call State
  const [activeCall, setActiveCall] = useState(false); 
  const [incomingCallType, setIncomingCallType] = useState('video'); // 'video' or 'audio'
  
  const typingTimeoutRef = useRef(null);
  const audioRecorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY });
  const recorderState = useAudioRecorderState(audioRecorder, 200);

  // --- 1. PERMISSIONS ---
  useEffect(() => {
    (async () => {
      await AudioModule.requestRecordingPermissionsAsync();
      await AudioModule.setAudioModeAsync({ 
        playsInSilentMode: true, 
        allowsRecording: true 
      });
    })();
  }, []);

  // --- 2. LISTENERS ---
  useEffect(() => {
    // A. Chat Listener
    const unsubChat = onSnapshot(doc(db, 'chats', chatId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setChatData(data);
        if (data.typing) {
          const othersTyping = Object.entries(data.typing)
            .some(([uid, isTyping]) => uid !== currentUser.uid && isTyping);
          setIsFriendTyping(othersTyping);
        }
        if (!data.isGroup) {
          const friendId = data.participants.find(uid => uid !== currentUser.uid);
          if (friendId) {
            getDoc(doc(db, 'users', friendId)).then(u => {
              if (u.exists()) setFriendProfile(u.data());
            });
          }
        }
      }
    });

    // B. Call Room Listener (Detects Active Call & Type)
    const roomRef = doc(db, 'rooms', chatId);
    const unsubRoom = onSnapshot(roomRef, (roomSnap) => {
      if (roomSnap.exists()) {
        const data = roomSnap.data();
        // Room exists = Call is active
        setActiveCall(true);
        // Check if it's audio or video to update the banner UI
        setIncomingCallType(data.callType || 'video');
      } else {
        // Room deleted = Call ended
        setActiveCall(false);
      }
    });

    return () => {
      unsubChat();
      unsubRoom();
    };
  }, [chatId]);

  // Messages Listener
  useEffect(() => {
    const q = query(
      collection(db, 'chats', chatId, 'messages'), 
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => ({ 
        _id: d.id, 
        ...d.data(), 
        createdAt: d.data().createdAt?.toDate() || new Date(), 
        isMyMessage: d.data().senderId === currentUser.uid 
      }));
      setMessages(msgs);

      // Read Receipts
      const batch = writeBatch(db);
      let batchCount = 0;
      snap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.senderId !== currentUser.uid) {
           const readBy = data.readBy || [];
           if (!readBy.includes(currentUser.uid)) {
             batch.update(docSnap.ref, { readBy: arrayUnion(currentUser.uid) });
             batchCount++;
           }
        }
      });
      if (batchCount > 0) batch.commit().catch(e => {});
    });
    return unsub;
  }, [chatId]);

  // --- 3. HEADER ---
  useLayoutEffect(() => {
    const displayName = chatData?.isGroup 
      ? chatData.groupName 
      : (friendProfile?.displayName || chatName);

    const avatarUri = chatData?.isGroup 
      ? chatData.groupPhoto 
      : friendProfile?.photoURL;

    const subtitle = chatData?.isGroup 
      ? `${chatData.participants?.length || 0} members` 
      : (friendProfile?.isOnline ? 'Online' : 'Offline');
    
    const subtitleColor = (!chatData?.isGroup && friendProfile?.isOnline) ? '#25D366' : '#8E8E93';

    navigation.setOptions({
      headerTitle: () => (
        <View style={styles.headerContainer}>
          <TouchableOpacity onPress={handleGroupPhotoChange} disabled={!chatData?.isGroup}>
            <View>
              <Avatar 
                uri={avatarUri} 
                name={displayName} 
                size={40} 
                isGroup={chatData?.isGroup} 
                participants={chatData?.participants} 
              />
              {chatData?.isGroup && (
                <View style={styles.editIconBadge}>
                  <Ionicons name="pencil" size={10} color="#fff" />
                </View>
              )}
            </View>
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerName} numberOfLines={1}>{displayName}</Text>
            <Text style={[styles.headerStatus, { color: subtitleColor }]}>{subtitle}</Text>
          </View>
        </View>
      ),
      headerBackTitleVisible: false,
     headerRight: () => (
        <View style={styles.headerIcons}>
          {/* 1. MEDIA GALLERY BUTTON (New) */}
          <TouchableOpacity onPress={() => setMediaGalleryVisible(true)}>
             <Ionicons name="images-outline" size={24} color="#007AFF" />
          </TouchableOpacity>

          {/* 2. WALLPAPER BUTTON */}
          <TouchableOpacity onPress={handleChangeWallpaper}>
            <Ionicons name="color-palette-outline" size={24} color="#007AFF" />
          </TouchableOpacity>

          {/* 3. CALL BUTTONS */}
          <TouchableOpacity onPress={() => startCall(false)}> 
            <Ionicons name="call-outline" size={24} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => startCall(true)}> 
             <Ionicons name="videocam-outline" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, chatData, friendProfile, chatName]);

  // --- ACTIONS ---

  const startCall = (isVideo) => {
    // We are the initiator
    navigation.navigate('CallScreen', { 
      chatId, 
      user: { uid: currentUser.uid, displayName: currentUser.displayName },
      chatName: chatData?.isGroup ? chatData.groupName : (friendProfile?.displayName || chatName),
      isVideoCall: isVideo, 
      isInitiator: true 
    });
  };

  const joinCall = () => {
    // We are joining an existing call
    // Use the type detected from the room (incomingCallType)
    const isVideo = incomingCallType === 'video';
    
    navigation.navigate('CallScreen', { 
      chatId, 
      user: { uid: currentUser.uid, displayName: currentUser.displayName },
      chatName: chatData?.isGroup ? chatData.groupName : (friendProfile?.displayName || chatName),
      isVideoCall: isVideo, 
      isInitiator: false
    });
  };

  // --- STANDARD HELPERS ---
  const handleGroupPhotoChange = () => {
    Alert.alert("Group Photo", "Change photo?", [
      { text: "Cancel", style: "cancel" },
      { text: "Select", onPress: async () => {
         const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.5 });
         if(!r.canceled) {
            setIsUploading(true);
            const url = await uploadImageToCloudinary(r.assets[0].uri);
            if(url) updateDoc(doc(db, 'chats', chatId), { groupPhoto: url });
            setIsUploading(false);
         }
      }}
    ]);
  };

  const handleInput = (text) => {
    setInputText(text);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    updateDoc(doc(db, 'chats', chatId), { [`typing.${currentUser.uid}`]: text.length > 0 }).catch(()=>{});
    if (text.length > 0) {
      typingTimeoutRef.current = setTimeout(() => {
        updateDoc(doc(db, 'chats', chatId), { [`typing.${currentUser.uid}`]: false }).catch(()=>{});
      }, 2500);
    }
  };

   const handleChangeWallpaper = () => {
    Alert.alert(
      "Chat Wallpaper",
      "Change background for everyone in this chat?",
      [
        {
          text: "Default (White)",
          onPress: async () => {
            // Remove the field from Firestore
            await updateDoc(doc(db, 'chats', chatId), { chatWallpaper: null });
          }
        },
        {
          text: "WhatsApp Doodle",
          onPress: async () => {
            // Set a preset URL
            const doodleUrl = "https://i.pinimg.com/originals/97/c0/07/97c00759d90d786d9b6096d274ad3e07.png";
            await updateDoc(doc(db, 'chats', chatId), { chatWallpaper: doodleUrl });
          }
        },
        {
          text: "Upload from Gallery",
          onPress: async () => {
            // Pick image
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              quality: 0.5,
            });

            if (!result.canceled) {
              setIsUploading(true);
              // Upload to Cloudinary
              const url = await uploadImageToCloudinary(result.assets[0].uri);
              if (url) {
                // Save URL to the CHAT document
                await updateDoc(doc(db, 'chats', chatId), { chatWallpaper: url });
              }
              setIsUploading(false);
            }
          }
        },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };
  
  const sendMessage = async (text = null, imageUrl = null, audioUrl = null, audioDuration = 0, locationData = null) => {
    const textToSend = text !== null ? text : inputText.trim();
    if (!textToSend && !imageUrl && !audioUrl && !locationData) return;
    
    if (!imageUrl && !audioUrl && !locationData) setInputText('');
    updateDoc(doc(db, 'chats', chatId), { [`typing.${currentUser.uid}`]: false }).catch(()=>{});

    try {
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        text: textToSend || '',
        image: imageUrl || null,
        audio: audioUrl || null,
        audioDuration,
        location: locationData || null,
        createdAt: serverTimestamp(),
        senderId: currentUser.uid,
        senderName: currentUser.displayName || 'User',
        senderImage: currentUser.photoURL,
        readBy: [],
        isDeleted: false
      });
      
      let preview = 'Message';
      if (imageUrl) preview = '📷 Photo';
      else if (audioUrl) preview = '🎤 Audio';
      else if (locationData) preview = '📍 Location';
      else preview = textToSend;

      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: preview,
        lastMessageTime: serverTimestamp(),
        lastMessageSenderId: currentUser.uid,
      });
    } catch (err) { 
      console.error(err);
    }
  };

  const handleCameraOptions = () => {
    Alert.alert("Send Photo", "Choose source", [
      { text: "Camera", onPress: async () => {
         const r = await ImagePicker.requestCameraPermissionsAsync();
         if(r.granted) {
           const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
           if(!res.canceled) uploadAndSend(res.assets[0].uri);
         }
      }},
      { text: "Gallery", onPress: async () => {
         const r = await ImagePicker.requestMediaLibraryPermissionsAsync();
         if(r.granted) {
           const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
           if(!res.canceled) uploadAndSend(res.assets[0].uri);
         }
      }},
      { text: "Cancel", style: "cancel" }
    ]);
  };

  const uploadAndSend = async (uri) => {
    setIsUploading(true);
    const url = await uploadImageToCloudinary(uri);
    setIsUploading(false);
    if(url) sendMessage(null, url);
  };

  const handleSendLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission Denied');
    setIsUploading(true);
    let location = await Location.getCurrentPositionAsync({});
    setIsUploading(false);
    sendMessage(null, null, null, 0, { latitude: location.coords.latitude, longitude: location.coords.longitude });
  };

  const startRecording = async () => { try { await audioRecorder.prepareToRecordAsync(); audioRecorder.record(); } catch(e){} };
  const stopAndSendRecording = async () => {
    try {
      const dur = recorderState.durationMillis || 0;
      await audioRecorder.stop();
      if (!audioRecorder.uri) return;
      setIsUploading(true);
      const url = await uploadAudioToCloudinary(audioRecorder.uri);
      setIsUploading(false);
      if (url) sendMessage(null, null, url, dur);
    } catch (e) { setIsUploading(false); }
  };
  const cancelRecording = async () => { try{ await audioRecorder.stop(); }catch(e){} };
  const renderBackground = (children) => {
    if (chatData?.chatWallpaper) {
      return (
        <ImageBackground 
          source={{ uri: chatData.chatWallpaper }} 
          style={styles.backgroundImage} 
          resizeMode="cover"
        >
          {children}
        </ImageBackground>
      );
    } else {
      return <View style={styles.whiteBackground}>{children}</View>;
    }
  };
  // --- RENDER ---
  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      
      {/* 1. Wrap content using our helper */}
      {renderBackground(
        <>
          {/* INCOMING CALL BANNER */}
          {activeCall && (
            <TouchableOpacity style={styles.callBanner} onPress={joinCall}>
              <Ionicons name={incomingCallType === 'video' ? "videocam" : "call"} size={20} color="#fff" />
              <Text style={styles.callBannerText}>
                Incoming {incomingCallType === 'video' ? "Video" : "Voice"} Call • Tap to Join
              </Text>
            </TouchableOpacity>
          )}

          {/* KEYBOARD HANDLING & LISTS (Paste your existing list code here) */}
          {Platform.OS === 'android' ? (
            <View style={{ flex: 1 }}>
              <FlatList 
                data={messages} 
                keyExtractor={i => i._id} 
                inverted 
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => (
                  <MessageBubble 
                    item={item} isMe={item.isMyMessage} 
                    onImagePress={() => {}} onLongPress={()=>{}}
                    isGroup={chatData?.isGroup} participantsCount={chatData?.participants?.length} showStatus={true} 
                  />
                )} 
              />
              {/* Typing & Input Components... */}
              {isFriendTyping && <View style={styles.typingContainer}><Text style={styles.typingText}>typing...</Text></View>}
              {isUploading && <View style={styles.uploadingOverlay}><ActivityIndicator size="small" color="#007AFF" /><Text style={styles.uploadingText}>Uploading...</Text></View>}
              
              <ChatInput 
                inputText={inputText} onTextChange={handleInput} onSend={() => sendMessage(null)}
                isRecording={recorderState.isRecording} recordingDuration={recorderState.durationMillis}
                onStartRecording={startRecording} onStopRecording={stopAndSendRecording} onCancelRecording={cancelRecording}
                onCameraPress={handleCameraOptions} onLocationPress={handleSendLocation}
              />
            </View>
          ) : (
            <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={headerHeight}>
              <FlatList 
                data={messages} 
                keyExtractor={i => i._id} 
                inverted 
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => (
                  <MessageBubble 
                    item={item} isMe={item.isMyMessage} 
                    onImagePress={() => {}} onLongPress={()=>{}}
                    isGroup={chatData?.isGroup} participantsCount={chatData?.participants?.length} showStatus={true} 
                  />
                )} 
              />
              {/* Typing & Input Components... */}
              {isFriendTyping && <View style={styles.typingContainer}><Text style={styles.typingText}>typing...</Text></View>}
              {isUploading && <View style={styles.uploadingOverlay}><ActivityIndicator size="small" color="#007AFF" /><Text style={styles.uploadingText}>Uploading...</Text></View>}
              
              <ChatInput 
                inputText={inputText} onTextChange={handleInput} onSend={() => sendMessage(null)}
                isRecording={recorderState.isRecording} recordingDuration={recorderState.durationMillis}
                onStartRecording={startRecording} onStopRecording={stopAndSendRecording} onCancelRecording={cancelRecording}
                onCameraPress={handleCameraOptions} onLocationPress={handleSendLocation}
              />
            </KeyboardAvoidingView>
          )}
        </>
      )}

      <ImagePreviewModal visible={modalVisible} imageUri={selectedImage} onClose={() => setModalVisible(false)} />
      <MediaGalleryModal 
        visible={mediaGalleryVisible} 
        onClose={() => setMediaGalleryVisible(false)} 
        chatId={chatId} 
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  backgroundImage: { flex: 1, width: '100%', height: '100%' },
  whiteBackground: { flex: 1, backgroundColor: '#fff' }, // Pure white default
  listContent: { paddingHorizontal: 15, paddingBottom: 10, paddingTop: 10, flexGrow: 1 },
  headerContainer: { flexDirection: 'row', alignItems: 'center' },
  headerTextContainer: { marginLeft: 10, justifyContent: 'center' },
  headerName: { fontSize: 16, fontWeight: '600', color: '#000', maxWidth: 200 },
  headerStatus: { fontSize: 11, fontWeight: '500' },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 20, marginRight: 5 },
  editIconBadge: { position: 'absolute', bottom: -2, right: -2, backgroundColor: '#007AFF', width: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#fff' },
  callBanner: { backgroundColor: '#34C759', padding: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, width: '100%' },
  callBannerText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  typingContainer: { paddingLeft: 15, paddingBottom: 6 },
  typingText: { fontSize: 12, color: '#8E8E93', fontStyle: 'italic' },
  uploadingOverlay: { flexDirection: 'row', alignItems: 'center', padding: 10, marginLeft: 10 },
  uploadingText: { marginLeft: 10, color: '#007AFF', fontSize: 12 },
});