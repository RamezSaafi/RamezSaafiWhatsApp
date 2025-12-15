import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Alert, Platform, PermissionsAndroid } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RTCPeerConnection, RTCView, mediaDevices, RTCIceCandidate, RTCSessionDescription } from 'react-native-webrtc';
import { db } from '../firebaseConfig';
import { doc, onSnapshot, collection, addDoc, query, where, getDocs, setDoc, deleteDoc, updateDoc, limit } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const METERED_URL = "https://ramezsaafiwhatsapp.metered.live/api/v1/turn/credentials?apiKey=8776ac5774c92d62b6097573805b43fe8d95";

export default function CallScreen({ route, navigation }) {
  const { chatId, user, chatName, isVideoCall, isInitiator } = route.params;
  
  // Local Media
  const [localStream, setLocalStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(!isVideoCall); 

  // Peers State
  const [peers, setPeers] = useState({});
  
  // Refs
  const pcs = useRef({}); 
  const localStreamRef = useRef(null);
  const unsubscribes = useRef([]);
  const isRoomDeleted = useRef(false);
  
  // Queue to store ICE candidates that arrive before the connection is ready
  const candidateQueues = useRef({}); 

  // Default Config (Updated via API later)
  const rtcConfigRef = useRef({
    iceServers: [
      { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }
    ]
  });

  useEffect(() => {
    const initializeCall = async () => {
      // 1. Request Permissions (CRITICAL for Android)
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.CAMERA,
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        ]);
        if (
          granted['android.permission.CAMERA'] !== PermissionsAndroid.RESULTS.GRANTED ||
          granted['android.permission.RECORD_AUDIO'] !== PermissionsAndroid.RESULTS.GRANTED
        ) {
          Alert.alert('Permissions Required', 'Camera and Audio permissions are required.');
          navigation.goBack();
          return;
        }
      }

      // 2. FETCH METERED CREDENTIALS (WAIT for them)
      try {
        const response = await fetch(METERED_URL);
        const iceServers = await response.json();
        rtcConfigRef.current = { iceServers: iceServers };
        console.log("Metered TURN servers loaded.");
      } catch (error) {
        console.error("Failed to fetch Metered credentials, using default STUN:", error);
      }

      // 3. Start the media and logic only AFTER config is ready
      startCall();
    };

    initializeCall();

    return () => leaveCall(false); 
  }, []);

  const startCall = async () => {
    try {
      const stream = await mediaDevices.getUserMedia({ 
        audio: true, 
        video: isVideoCall ? { width: 640, height: 480, frameRate: 30 } : false 
      });

      setLocalStream(stream);
      localStreamRef.current = stream;

      await joinRoom();
    } catch (err) {
      console.error("Error starting call:", err);
      Alert.alert("Error", "Could not access Camera/Mic");
      navigation.goBack();
    }
  };

  const joinRoom = async () => {
    const roomRef = doc(db, 'rooms', chatId);
    const participantsRef = collection(roomRef, 'participants');
    const signalsRef = collection(roomRef, 'signals');

    // Add self to participants
    await setDoc(doc(participantsRef, user.uid), {
      name: user.displayName || 'User',
      cameraOff: !isVideoCall, 
      joinedAt: Date.now()
    });

    // Initiator sets up the room doc
    if (isInitiator) {
      await setDoc(roomRef, {
        createdAt: Date.now(),
        callType: isVideoCall ? 'video' : 'audio',
        active: true
      }, { merge: true });
    }

    // Listener: Room deletion (End Call)
    const unsubRoom = onSnapshot(roomRef, (snap) => {
      if (!snap.exists()) {
        isRoomDeleted.current = true;
        Alert.alert("Call Ended", "The call has ended.");
        leaveCall(true); 
      }
    });
    unsubscribes.current.push(unsubRoom);

    // Listener: New Participants
    const unsubPart = onSnapshot(participantsRef, (snap) => {
        snap.docChanges().forEach(async (change) => {
            const memberId = change.doc.id;
            const data = change.doc.data();
            if (memberId === user.uid) return;

            if (change.type === 'added') {
              // Initiate connection ONLY if we are the older participant (prevents dual offers)
              // Or purely if we are the initiator.
              if (isInitiator) {
                initiateConnection(memberId, data.name);
              }
            }
            
            if (change.type === 'modified') {
               setPeers(prev => ({
                 ...prev,
                 [memberId]: { 
                   ...prev[memberId], 
                   name: data.name, 
                   cameraOff: data.cameraOff === true 
                 }
               }));
            }
            if (change.type === 'removed') {
                removePeer(memberId);
            }
        });
    });
    unsubscribes.current.push(unsubPart);

    // Listener: Signaling (Offers/Answers/Candidates)
    const q = query(signalsRef, where('to', '==', user.uid));
    const unsubSig = onSnapshot(q, (snap) => {
        snap.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
                const signal = change.doc.data();
                const senderId = signal.from;
                
                // Process Signal
                if (signal.type === 'offer') {
                    await handleOffer(senderId, signal.senderName, signal.data);
                } else if (signal.type === 'answer') {
                    await handleAnswer(senderId, signal.data);
                } else if (signal.type === 'candidate') {
                    await handleCandidate(senderId, signal.data);
                }
                
                // Delete signal after processing to keep DB clean
                deleteDoc(change.doc.ref); 
            }
        });
    });
    unsubscribes.current.push(unsubSig);
  };

  // --- WEBRTC CORE ---

  const createPeerConnection = (targetUserId, targetName) => {
    // Check if PC already exists
    if (pcs.current[targetUserId]) return pcs.current[targetUserId];

    const pc = new RTCPeerConnection(rtcConfigRef.current);
    pcs.current[targetUserId] = pc;
    candidateQueues.current[targetUserId] = []; // Init queue

    // Add local tracks
    if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
            pc.addTrack(track, localStreamRef.current);
        });
    }
    
    // On ICE Candidate
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            addDoc(collection(db, 'rooms', chatId, 'signals'), {
                to: targetUserId, from: user.uid, type: 'candidate', data: event.candidate.toJSON()
            });
        }
    };
    
    // On Remote Stream
    pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
            setPeers(prev => ({
                ...prev,
                [targetUserId]: { 
                    stream: event.streams[0], 
                    name: targetName,
                    cameraOff: prev[targetUserId]?.cameraOff || false 
                }
            }));
        }
    };

    return pc;
  };

  const initiateConnection = async (targetUserId, targetName) => {
    const pc = createPeerConnection(targetUserId, targetName);
    
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    await addDoc(collection(db, 'rooms', chatId, 'signals'), {
        to: targetUserId, from: user.uid, senderName: user.displayName, type: 'offer', data: { type: offer.type, sdp: offer.sdp }
    });
  };

  const handleOffer = async (senderId, senderName, offerData) => {
    const pc = createPeerConnection(senderId, senderName);
    
    await pc.setRemoteDescription(new RTCSessionDescription(offerData));
    
    // Process queued candidates now that RemoteDescription is set
    processCandidateQueue(senderId, pc);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    
    await addDoc(collection(db, 'rooms', chatId, 'signals'), {
        to: senderId, from: user.uid, type: 'answer', data: { type: answer.type, sdp: answer.sdp }
    });
  };

  const handleAnswer = async (senderId, answerData) => {
      const pc = pcs.current[senderId];
      if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(answerData));
          processCandidateQueue(senderId, pc);
      }
  };

  const handleCandidate = async (senderId, candidateData) => {
      const pc = pcs.current[senderId];
      if (!pc) return;

      const candidate = new RTCIceCandidate(candidateData);

      // CRITICAL FIX: Only add candidate if remote description is set
      if (pc.remoteDescription) {
          await pc.addIceCandidate(candidate);
      } else {
          // Otherwise, queue it
          candidateQueues.current[senderId].push(candidate);
      }
  };

  const processCandidateQueue = (senderId, pc) => {
      const queue = candidateQueues.current[senderId] || [];
      queue.forEach(async (candidate) => {
          try {
            await pc.addIceCandidate(candidate);
          } catch (e) {
            console.warn("Failed to add queued candidate", e);
          }
      });
      candidateQueues.current[senderId] = []; // Clear queue
  };

  const removePeer = (userId) => {
    if (pcs.current[userId]) {
        pcs.current[userId].close();
        delete pcs.current[userId];
    }
    delete candidateQueues.current[userId];
    setPeers(prev => {
        const newPeers = { ...prev };
        delete newPeers[userId];
        return newPeers;
    });
  };

  // --- ACTIONS ---
  const toggleCamera = () => {
    const newState = !isCameraOff;
    setIsCameraOff(newState);
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(t => t.enabled = !newState);
    }
    updateDoc(doc(db, 'rooms', chatId, 'participants', user.uid), { cameraOff: newState });
  };

  const toggleMic = () => {
    const newState = !isMuted;
    setIsMuted(newState);
    if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach(t => t.enabled = !newState);
    }
  };

  const leaveCall = async (navigate = true) => {
    // Clean up WebRTC
    if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
        localStreamRef.current.release();
    }
    Object.values(pcs.current).forEach(pc => pc.close());
    unsubscribes.current.forEach(fn => fn());

    try {
        // Remove SELF from participants
        await deleteDoc(doc(db, 'rooms', chatId, 'participants', user.uid));

        // Optional: If you want to delete the room when the *last* person leaves:
        // const parts = await getDocs(collection(db, 'rooms', chatId, 'participants'));
        // if (parts.empty) { await deleteDoc(doc(db, 'rooms', chatId)); }
        
        // For now, if initiator leaves, we kill the room (your original logic)
        if (isInitiator && !isRoomDeleted.current) {
             await deleteDoc(doc(db, 'rooms', chatId));
        }
    } catch(e) {
        console.log("Error leaving call", e);
    }

    if (navigate) navigation.goBack();
  };

  // --- RENDER ---
  const peerIds = Object.keys(peers);
  const isOneOnOne = peerIds.length === 1;

  return (
    <SafeAreaView style={styles.container}>
      {isOneOnOne && (
        <View style={styles.fullScreenContainer}>
           {(() => {
             const peerId = peerIds[0];
             const peer = peers[peerId];
             // Ensure peer.stream is valid and has video tracks
             const hasVideo = peer.stream && peer.stream.getVideoTracks().length > 0;

             if (hasVideo && !peer.cameraOff) {
                return <RTCView streamURL={peer.stream.toURL()} objectFit="cover" style={styles.fullScreenVideo} zOrder={1} />;
             }
             return (
               <View style={styles.placeholderFull}>
                 <View style={styles.avatarCircleLarge}><Text style={styles.avatarTextLarge}>{peer.name?.[0]}</Text></View>
                 <Text style={styles.placeholderText}>{peer.name} (Camera Off)</Text>
               </View>
             );
           })()}
           
           {localStream && !isCameraOff && (
             <View style={styles.pipContainer}>
               <RTCView streamURL={localStream.toURL()} objectFit="cover" style={styles.videoStream} zOrder={2} />
             </View>
           )}
        </View>
      )}

      {!isOneOnOne && (
        <ScrollView contentContainerStyle={styles.gridContainer}>
           {peerIds.map(id => {
             const peer = peers[id];
             const hasVideo = peer.stream && peer.stream.getVideoTracks().length > 0;
             return (
               <View key={id} style={styles.gridVideoContainer}>
                 {hasVideo && !peer.cameraOff ? (
                   <RTCView streamURL={peer.stream.toURL()} objectFit="cover" style={styles.videoStream} zOrder={1} />
                 ) : (
                   <View style={styles.placeholderGrid}>
                     <View style={styles.avatarCircle}><Text style={styles.avatarText}>{peer.name?.[0]}</Text></View>
                   </View>
                 )}
                 <View style={styles.nameTag}><Text style={styles.nameText}>{peer.name}</Text></View>
               </View>
             );
           })}

           {localStream && !isCameraOff && (
             <View style={styles.gridVideoContainer}>
                <RTCView streamURL={localStream.toURL()} objectFit="cover" style={styles.videoStream} zOrder={1} />
                <View style={styles.nameTag}><Text style={styles.nameText}>Me</Text></View>
             </View>
           )}

           {peerIds.length === 0 && (
             <View style={styles.waitingContainer}>
               <Text style={styles.waitingText}>Waiting for others...</Text>
               <Text style={styles.roomName}>{chatName}</Text>
             </View>
           )}
        </ScrollView>
      )}

      <View style={styles.controlsContainer}>
        <TouchableOpacity style={[styles.controlBtn, isCameraOff && styles.offBtn]} onPress={toggleCamera}>
          <Ionicons name={isCameraOff ? "videocam-off" : "videocam"} size={30} color={isCameraOff ? "#000" : "#fff"} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.controlBtn, styles.endCallBtn]} onPress={() => leaveCall(true)}>
          <Ionicons name="call" size={35} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.controlBtn, isMuted && styles.offBtn]} onPress={toggleMic}>
          <Ionicons name={isMuted ? "mic-off" : "mic"} size={30} color={isMuted ? "#000" : "#fff"} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#202124' },
  
  fullScreenContainer: { flex: 1, position: 'relative' },
  fullScreenVideo: { width: '100%', height: '100%' },
  placeholderFull: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#333' },
  avatarCircleLarge: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#555', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  avatarTextLarge: { fontSize: 40, color: '#fff', fontWeight: 'bold' },
  pipContainer: { position: 'absolute', bottom: 120, right: 20, width: 100, height: 150, borderRadius: 10, overflow: 'hidden', borderWidth: 2, borderColor: '#fff', elevation: 10, zIndex: 10, backgroundColor: '#000' },

  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', paddingBottom: 100, paddingTop: 20 },
  gridVideoContainer: { width: width / 2 - 20, height: 200, margin: 10, borderRadius: 12, overflow: 'hidden', backgroundColor: '#333', position: 'relative', borderWidth: 1, borderColor: '#444' },
  videoStream: { width: '100%', height: '100%' },
  placeholderGrid: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  avatarCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#555', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 24, color: '#fff', fontWeight: 'bold' },
  nameTag: { position: 'absolute', bottom: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  nameText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  
  waitingContainer: { height: 300, justifyContent: 'center', alignItems: 'center', width: '100%' },
  waitingText: { color: '#ccc', fontSize: 18 },
  roomName: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginTop: 10 },
  placeholderText: { color: '#aaa' },

  controlsContainer: { position: 'absolute', bottom: 30, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' },
  controlBtn: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  endCallBtn: { backgroundColor: '#FF3B30', width: 70, height: 70, borderRadius: 35 },
  offBtn: { backgroundColor: '#fff' }
});