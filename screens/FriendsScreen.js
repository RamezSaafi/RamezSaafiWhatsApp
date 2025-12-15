import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, FlatList, TouchableOpacity, 
  StyleSheet, Alert, ActivityIndicator 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { 
  collection, query, where, getDocs, addDoc, deleteDoc, 
  doc, updateDoc, onSnapshot, serverTimestamp 
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import Avatar from '../components/Avatar'; // <--- IMPORT AVATAR

export default function FriendsScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('list');
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [friendStatus, setFriendStatus] = useState({}); // Map: userId -> 'friends' | 'sent' | 'received'
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const currentUser = auth.currentUser;

  // ===== 1. TRACK FRIEND STATUS (For Search Tab Logic) =====
  useEffect(() => {
    // Listen to ALL friend connections to determine status (Sent, Friends, etc.)
    const q = query(
      collection(db, 'friends'),
      where('participants', 'array-contains', currentUser.uid)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const map = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const otherId = data.participants.find(id => id !== currentUser.uid);
        
        if (data.status === 'accepted') {
          map[otherId] = 'friends';
        } else if (data.status === 'pending') {
          map[otherId] = data.senderId === currentUser.uid ? 'sent' : 'received';
        }
      });
      setFriendStatus(map);
    });

    return unsub;
  }, []);

  // ===== 2. LOAD FRIENDS LIST (Accepted) =====
  useEffect(() => {
    const q = query(
      collection(db, 'friends'),
      where('participants', 'array-contains', currentUser.uid),
      where('status', '==', 'accepted')
    );

    const unsub = onSnapshot(q, async (snapshot) => {
      const friendsList = [];
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const friendId = data.participants.find(id => id !== currentUser.uid);
        
        const friendDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', friendId)));
        if (!friendDoc.empty) {
          friendsList.push({ id: docSnap.id, friendId, ...friendDoc.docs[0].data() });
        }
      }
      setFriends(friendsList);
    });
    return unsub;
  }, []);

  // ===== 3. LOAD REQUESTS (Pending Received) =====
  useEffect(() => {
    const q = query(
      collection(db, 'friends'),
      where('receiverId', '==', currentUser.uid),
      where('status', '==', 'pending')
    );

    const unsub = onSnapshot(q, async (snapshot) => {
      const requestsList = [];
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const senderDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', data.senderId)));
        if (!senderDoc.empty) {
          requestsList.push({ id: docSnap.id, senderId: data.senderId, ...senderDoc.docs[0].data() });
        }
      }
      setRequests(requestsList);
    });
    return unsub;
  }, []);

  // ===== SEARCH LOGIC =====
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setLoading(true);
    try {
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      
      const results = snapshot.docs
        .filter(doc => {
          const data = doc.data();
          if (doc.id === currentUser.uid) return false;
          const term = searchQuery.toLowerCase();
          return (data.email?.toLowerCase().includes(term) || data.displayName?.toLowerCase().includes(term));
        })
        .map(doc => ({ id: doc.id, ...doc.data() }));

      setSearchResults(results);
    } catch (error) { console.error(error); }
    setLoading(false);
  };

  // ===== ACTIONS =====
  const sendFriendRequest = async (userId) => {
    try {
      await addDoc(collection(db, 'friends'), {
        senderId: currentUser.uid, receiverId: userId, participants: [currentUser.uid, userId], status: 'pending', createdAt: serverTimestamp()
      });
      // UI updates automatically via listener
    } catch (error) { Alert.alert('Error', 'Could not send request'); }
  };

  const acceptRequest = async (requestId) => {
    try { await updateDoc(doc(db, 'friends', requestId), { status: 'accepted' }); } 
    catch (e) { Alert.alert('Error'); }
  };

  const declineRequest = async (requestId) => {
    try { await deleteDoc(doc(db, 'friends', requestId)); } 
    catch (e) { Alert.alert('Error'); }
  };

  const removeFriend = async (friendshipId, friendName) => {
    Alert.alert('Remove Friend', `Remove ${friendName}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
          try { await deleteDoc(doc(db, 'friends', friendshipId)); } catch (e) {}
      }}
    ]);
  };

  const startChatWithFriend = async (friendId, displayName) => {
    try {
      const q = query(collection(db, 'chats'), where('participants', 'array-contains', currentUser.uid));
      const snapshot = await getDocs(q);
      const existingChat = snapshot.docs.find(doc => !doc.data().isGroup && doc.data().participants.includes(friendId));

      if (existingChat) {
        navigation.navigate('Chat', { chatId: existingChat.id, chatName: displayName });
      } else {
        const newChat = await addDoc(collection(db, 'chats'), {
          participants: [currentUser.uid, friendId], isGroup: false, createdAt: serverTimestamp(), lastMessage: '', lastMessageTime: serverTimestamp()
        });
        navigation.navigate('Chat', { chatId: newChat.id, chatName: displayName });
      }
    } catch (e) { Alert.alert('Error'); }
  };

  // ===== RENDER ITEMS =====

  const renderFriendItem = ({ item }) => (
    <View style={styles.userRow}>
      <Avatar uri={item.photoURL} name={item.displayName} size={50} />
      <View style={styles.info}>
        <Text style={styles.name}>{item.displayName || 'User'}</Text>
        <Text style={styles.email}>{item.email}</Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity onPress={() => startChatWithFriend(item.friendId, item.displayName)} style={styles.iconButton}>
          <Ionicons name="chatbubble" size={24} color="#007AFF" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => removeFriend(item.id, item.displayName)} style={styles.iconButton}>
          <Ionicons name="person-remove" size={24} color="#FF3B30" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderRequestItem = ({ item }) => (
    <View style={styles.userRow}>
      <Avatar uri={item.photoURL} name={item.displayName} size={50} />
      <View style={styles.info}>
        <Text style={styles.name}>{item.displayName || 'User'}</Text>
        <Text style={styles.email}>{item.email}</Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity onPress={() => acceptRequest(item.id)} style={[styles.button, styles.acceptButton]}>
          <Ionicons name="checkmark" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => declineRequest(item.id)} style={[styles.button, styles.declineButton]}>
          <Ionicons name="close" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSearchItem = ({ item }) => {
    const status = friendStatus[item.id]; // 'friends' | 'sent' | 'received' | undefined

    return (
      <View style={styles.userRow}>
        <Avatar uri={item.photoURL} name={item.displayName} size={50} />
        <View style={styles.info}>
          <Text style={styles.name}>{item.displayName || 'User'}</Text>
          <Text style={styles.email}>{item.email}</Text>
        </View>
        
        {/* Dynamic Action Button based on Status */}
        {status === 'friends' ? (
          <TouchableOpacity onPress={() => startChatWithFriend(item.id, item.displayName)} style={styles.statusButton}>
             <Ionicons name="chatbubble-outline" size={24} color="#007AFF" />
          </TouchableOpacity>
        ) : status === 'sent' ? (
          <View style={styles.statusContainer}>
            <Text style={styles.statusText}>Sent</Text>
          </View>
        ) : status === 'received' ? (
           <View style={styles.statusContainer}>
            <Text style={[styles.statusText, {color: '#FF9500'}]}>Received</Text>
          </View>
        ) : (
          <TouchableOpacity onPress={() => sendFriendRequest(item.id)} style={[styles.button, styles.addButton]}>
            <Ionicons name="person-add" size={20} color="#fff" />
            <Text style={styles.buttonText}>Add</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderContent = () => {
    if (activeTab === 'search') {
      return (
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#8E8E93" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or email"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
                <Ionicons name="close-circle" size={20} color="#8E8E93" />
              </TouchableOpacity>
            )}
          </View>
          
          {loading ? <ActivityIndicator style={{ marginTop: 20 }} /> : 
           searchResults.length > 0 ? <FlatList data={searchResults} keyExtractor={item => item.id} renderItem={renderSearchItem} /> :
           searchQuery.trim() !== '' ? (
             <View style={styles.emptyContainer}>
               <Ionicons name="search-outline" size={60} color="#ccc" />
               <Text style={styles.emptyText}>No users found</Text>
             </View>
           ) : (
             <View style={styles.emptyContainer}>
               <Ionicons name="people-outline" size={60} color="#ccc" />
               <Text style={styles.emptyText}>Search for friends</Text>
             </View>
           )}
        </View>
      );
    }
    if (activeTab === 'requests') {
      return requests.length > 0 ? 
        <FlatList data={requests} keyExtractor={item => item.id} renderItem={renderRequestItem} /> : 
        <View style={styles.emptyContainer}>
          <Ionicons name="mail-open-outline" size={60} color="#ccc" />
          <Text style={styles.emptyText}>No friend requests</Text>
        </View>;
    }
    return friends.length > 0 ? 
      <FlatList data={friends} keyExtractor={item => item.id} renderItem={renderFriendItem} /> : 
      <View style={styles.emptyContainer}>
        <Ionicons name="people-outline" size={60} color="#ccc" />
        <Text style={styles.emptyText}>No friends yet</Text>
        <Text style={styles.emptySub}>Search for people to add!</Text>
      </View>;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Friends</Text>
        <View style={styles.tabs}>
          <TouchableOpacity onPress={() => setActiveTab('list')} style={[styles.tab, activeTab === 'list' && styles.activeTab]}>
            <Text style={[styles.tabText, activeTab === 'list' && styles.activeText]}>My Friends</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveTab('requests')} style={[styles.tab, activeTab === 'requests' && styles.activeTab]}>
            <Text style={[styles.tabText, activeTab === 'requests' && styles.activeText]}>Requests</Text>
            {requests.length > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{requests.length}</Text></View>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveTab('search')} style={[styles.tab, activeTab === 'search' && styles.activeTab]}>
            <Ionicons name="search" size={20} color={activeTab === 'search' ? "#fff" : "#000"} />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.content}>{renderContent()}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 15 },
  tabs: { flexDirection: 'row', backgroundColor: '#F2F2F7', borderRadius: 10, padding: 4 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8, flexDirection: 'row', justifyContent: 'center' },
  activeTab: { backgroundColor: '#007AFF' },
  tabText: { fontWeight: '600', color: '#000' },
  activeText: { color: '#fff' },
  badge: { position: 'absolute', right: 10, top: 4, backgroundColor: '#FF3B30', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  content: { flex: 1 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: '#333', marginTop: 15 },
  emptySub: { fontSize: 14, color: '#888', marginTop: 5, textAlign: 'center' },
  searchContainer: { flex: 1 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F2F2F7', margin: 15, paddingHorizontal: 15, paddingVertical: 10, borderRadius: 10 },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16, color: '#000' },
  userRow: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  info: { flex: 1, marginLeft: 15 },
  name: { fontSize: 16, fontWeight: 'bold', color: '#000' },
  email: { fontSize: 14, color: '#888', marginTop: 2 },
  actions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  iconButton: { padding: 5 },
  button: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 5 },
  acceptButton: { backgroundColor: '#34C759' },
  declineButton: { backgroundColor: '#FF3B30' },
  addButton: { backgroundColor: '#007AFF' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  
  // Status Styles
  statusButton: { padding: 8 },
  statusContainer: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#F2F2F7', borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: '600', color: '#8E8E93', fontStyle: 'italic' }
});