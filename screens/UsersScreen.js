import React, { useState, useEffect } from 'react';
import { 
  View, Text, FlatList, TouchableOpacity, StyleSheet, 
  ActivityIndicator, Alert 
} from 'react-native';
import { 
  collection, query, where, getDocs, addDoc, 
  serverTimestamp, onSnapshot 
} from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import Avatar from '../components/Avatar'; // Uses your custom Avatar component

export default function UsersScreen({ navigation }) {
  const [users, setUsers] = useState([]);
  const [friendStatus, setFriendStatus] = useState({}); // Map: userId -> 'accepted' | 'sent' | 'received' | null
  const [loading, setLoading] = useState(true);
  const currentUser = auth.currentUser;

  // --- 1. FETCH USERS & FRIEND STATUS ---
  useEffect(() => {
    let unsubUsers;
    let unsubFriends;

    const fetchData = async () => {
      try {
        setLoading(true);

        // A. Listen to All Users (except me)
        const usersQ = query(collection(db, "users"), where("__name__", "!=", currentUser.uid));
        unsubUsers = onSnapshot(usersQ, (snapshot) => {
          const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setUsers(list);
        });

        // B. Listen to Friendships to determine status
        const friendsQ = query(
          collection(db, 'friends'),
          where('participants', 'array-contains', currentUser.uid)
        );

        unsubFriends = onSnapshot(friendsQ, (snapshot) => {
          const statusMap = {};
          snapshot.docs.forEach(doc => {
            const data = doc.data();
            const otherId = data.participants.find(id => id !== currentUser.uid);
            
            if (data.status === 'accepted') {
              statusMap[otherId] = 'friends';
            } else if (data.status === 'pending') {
              if (data.senderId === currentUser.uid) {
                statusMap[otherId] = 'sent';
              } else {
                statusMap[otherId] = 'received';
              }
            }
          });
          setFriendStatus(statusMap);
          setLoading(false);
        });

      } catch (e) {
        console.error(e);
        setLoading(false);
      }
    };

    fetchData();

    return () => {
      if (unsubUsers) unsubUsers();
      if (unsubFriends) unsubFriends();
    };
  }, []);

  // --- 2. SEND FRIEND REQUEST ---
  const handleAddFriend = async (otherUser) => {
    try {
      await addDoc(collection(db, 'friends'), {
        senderId: currentUser.uid,
        receiverId: otherUser.id,
        participants: [currentUser.uid, otherUser.id],
        status: 'pending',
        createdAt: serverTimestamp()
      });
      // The snapshot listener will automatically update the UI to "Sent"
      Alert.alert("Success", "Friend request sent!");
    } catch (error) {
      Alert.alert('Error', 'Could not send request');
    }
  };

  // --- 3. OPEN CHAT (Only if friends) ---
  const handleOpenChat = async (otherUser) => {
    // Check if chat exists
    const q = query(collection(db, "chats"), where("participants", "array-contains", currentUser.uid));
    const snapshot = await getDocs(q);
    
    // Find non-group chat
    const existingChat = snapshot.docs.find(doc => 
      !doc.data().isGroup && doc.data().participants.includes(otherUser.id)
    );

    if (existingChat) {
      navigation.replace('Chat', { chatId: existingChat.id, chatName: otherUser.displayName });
    } else {
      // Create new chat
      const newChat = await addDoc(collection(db, "chats"), {
        participants: [currentUser.uid, otherUser.id],
        isGroup: false,
        createdAt: new Date(),
        lastMessage: '',
        lastMessageTime: new Date()
      });
      navigation.replace('Chat', { chatId: newChat.id, chatName: otherUser.displayName });
    }
  };

  // --- 4. HANDLE ROW PRESS ---
  const handleAction = (item) => {
    const status = friendStatus[item.id];
    
    if (status === 'friends') {
      handleOpenChat(item);
    } else if (status === 'sent') {
      Alert.alert("Pending", "You have already sent a request to this user.");
    } else if (status === 'received') {
      Alert.alert("Request Received", "Go to the Friends tab to accept this request.");
    } else {
      handleAddFriend(item);
    }
  };

  if (loading) return <ActivityIndicator style={{marginTop:50}} size="large" color="#007AFF" />;

  return (
    <View style={styles.container}>
      <FlatList 
        data={users}
        keyExtractor={item => item.id}
        renderItem={({ item }) => {
          const status = friendStatus[item.id];

          return (
            <TouchableOpacity 
              style={styles.userRow} 
              onPress={() => handleAction(item)}
              activeOpacity={0.7}
            >
              {/* CORRECT AVATAR IMPLEMENTATION */}
              <Avatar 
                uri={item.photoURL} 
                name={item.displayName} 
                size={50} 
              />
              
              <View style={styles.info}>
                <Text style={styles.name}>{item.displayName || 'Anonymous User'}</Text>
                <Text style={styles.email}>{item.email}</Text>
              </View>

              {/* DYNAMIC STATUS ICON/TEXT */}
              <View style={styles.actionContainer}>
                {status === 'friends' && (
                  <Ionicons name="chatbubble" size={24} color="#007AFF" />
                )}
                
                {status === 'sent' && (
                  <Text style={styles.statusText}>Sent</Text>
                )}

                {status === 'received' && (
                  <Text style={[styles.statusText, {color: '#FF9500'}]}>Received</Text>
                )}

                {!status && (
                  <View style={styles.addButton}>
                    <Ionicons name="person-add" size={20} color="#007AFF" />
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  userRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 15, 
    borderBottomWidth: 1, 
    borderBottomColor: '#f0f0f0' 
  },
  info: { flex: 1, marginLeft: 15 },
  name: { fontSize: 16, fontWeight: 'bold', color: '#000' },
  email: { fontSize: 14, color: '#888' },
  actionContainer: {
    paddingLeft: 10,
    justifyContent: 'center',
    alignItems: 'center'
  },
  statusText: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '600',
    fontStyle: 'italic'
  },
  addButton: {
    padding: 8,
    backgroundColor: '#F2F2F7',
    borderRadius: 20
  }
});