import React, { useState, useEffect } from 'react';
import { 
  View, Text, FlatList, TouchableOpacity, StyleSheet, 
  Modal, TextInput, Alert, ActivityIndicator 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { 
  collection, query, where, onSnapshot, addDoc, 
  serverTimestamp, getDocs, orderBy 
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import Avatar from '../components/Avatar'; 

export default function GroupsScreen({ navigation }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [creating, setCreating] = useState(false);
  
  const currentUser = auth.currentUser;

  // --- 1. FETCH ONLY GROUPS ---
  useEffect(() => {
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', currentUser.uid),
      orderBy("lastMessageTime", "desc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const groupsList = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(chat => chat.isGroup === true); 

      setGroups(groupsList);
      setLoading(false);
    });

    return unsub;
  }, []);

  // --- 2. LOAD FRIENDS ---
  const loadFriends = async () => {
    try {
      const q = query(
        collection(db, 'friends'),
        where('participants', 'array-contains', currentUser.uid),
        where('status', '==', 'accepted')
      );

      const snapshot = await getDocs(q);
      const friendsList = [];

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const friendId = data.participants.find(id => id !== currentUser.uid);

        const friendQuery = query(collection(db, 'users'), where('__name__', '==', friendId));
        const friendDocs = await getDocs(friendQuery);

        if (!friendDocs.empty) {
          friendsList.push({
            id: friendId,
            ...friendDocs.docs[0].data()
          });
        }
      }
      setFriends(friendsList);
    } catch (error) {
      console.error('Error loading friends:', error);
      Alert.alert('Error', 'Could not load friends list.');
    }
  };

  const openCreateModal = async () => {
    await loadFriends();
    setModalVisible(true);
  };

  const toggleFriendSelection = (friendId) => {
    if (selectedFriends.includes(friendId)) {
      setSelectedFriends(selectedFriends.filter(id => id !== friendId));
    } else {
      setSelectedFriends([...selectedFriends, friendId]);
    }
  };

  // --- 3. CREATE GROUP (FIXED MESSAGE LOGIC) ---
  const createGroup = async () => {
    if (!groupName.trim()) {
      return Alert.alert('Required', 'Please enter a group name');
    }
    if (selectedFriends.length === 0) {
      return Alert.alert('Required', 'Please select at least one friend');
    }

    setCreating(true);
    try {
      const participants = [currentUser.uid, ...selectedFriends];
      const name = currentUser.displayName || 'A user';

      // 1. Create Group Doc
      const groupRef = await addDoc(collection(db, 'chats'), {
        groupName: groupName.trim(),
        participants,
        isGroup: true,
        createdBy: currentUser.uid,
        createdAt: serverTimestamp(),
        lastMessage: 'Group created',
        lastMessageTime: serverTimestamp(),
        groupPhoto: null
      });

      // 2. Add System Message with Specific Name
      // "Ramez created group 'Work'"
      await addDoc(collection(db, 'chats', groupRef.id, 'messages'), {
        text: `${name} created group "${groupName.trim()}"`,
        createdAt: serverTimestamp(),
        senderId: 'system',
        senderName: 'System',
        isSystemMessage: true,
        readBy: [],
        isDeleted: false
      });

      setModalVisible(false);
      setGroupName('');
      setSelectedFriends([]);
      
      navigation.navigate('Chat', {
        chatId: groupRef.id,
        chatName: groupName
      });

    } catch (error) {
      console.error('Create group error:', error);
      Alert.alert('Error', 'Could not create group');
    }
    setCreating(false);
  };

  const renderGroupItem = ({ item }) => {
    const getTime = () => {
      if (!item.lastMessageTime) return '';
      const d = item.lastMessageTime.toDate();
      return d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
    };

    return (
      <TouchableOpacity
        style={styles.chatRow}
        onPress={() => navigation.navigate('Chat', { 
            chatId: item.id, 
            chatName: item.groupName 
        })}
      >
        <Avatar 
          uri={item.groupPhoto} 
          name={item.groupName} 
          size={55} 
          isGroup={true} 
          participants={item.participants} 
        />
        
        <View style={styles.chatContent}>
          <View style={styles.topRow}>
            <Text style={styles.name}>{item.groupName}</Text>
            <Text style={styles.time}>{getTime()}</Text>
          </View>
          <Text style={styles.message} numberOfLines={1}>
            {item.lastMessageSenderId === currentUser.uid ? "You: " : ""}
            {item.lastMessage || 'No messages yet'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderFriendForModal = ({ item }) => {
    const isSelected = selectedFriends.includes(item.id);
    return (
      <TouchableOpacity 
        style={styles.friendRow} 
        onPress={() => toggleFriendSelection(item.id)}
      >
        <Avatar uri={item.photoURL} name={item.displayName} size={40} />
        <View style={styles.friendInfo}>
          <Text style={styles.friendName}>{item.displayName}</Text>
          <Text style={styles.friendEmail}>{item.email}</Text>
        </View>
        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Groups</Text>
        </View>
        <ActivityIndicator size="large" style={{ marginTop: 50 }} color="#007AFF" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Groups</Text>
        <TouchableOpacity style={styles.createButton} onPress={openCreateModal}>
          <Ionicons name="add-circle" size={32} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={groups}
        keyExtractor={item => item.id}
        renderItem={renderGroupItem}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="albums-outline" size={60} color="#ccc" />
            <Text style={styles.emptyText}>No groups yet</Text>
            <Text style={styles.emptySub}>Tap '+' to create one</Text>
          </View>
        }
      />

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Group</Text>
            <TouchableOpacity onPress={createGroup} disabled={creating}>
              {creating ? (
                <ActivityIndicator size="small" color="#007AFF" />
              ) : (
                <Text style={styles.createText}>Create</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Group Name"
              value={groupName}
              onChangeText={setGroupName}
              maxLength={30}
            />
          </View>

          <Text style={styles.sectionTitle}>
            Participants: {selectedFriends.length}
          </Text>

          <FlatList
            data={friends}
            keyExtractor={item => item.id}
            renderItem={renderFriendForModal}
            contentContainerStyle={{ paddingBottom: 20 }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptySub}>No friends available to add.</Text>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
  title: { fontSize: 28, fontWeight: 'bold' },
  createButton: { padding: 5 },
  chatRow: { flexDirection: 'row', padding: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', alignItems: 'center' },
  chatContent: { flex: 1, marginLeft: 15 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  name: { fontSize: 16, fontWeight: 'bold', color: '#000' },
  time: { fontSize: 12, color: '#999' },
  message: { fontSize: 14, color: '#666' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100, paddingHorizontal: 40 },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: '#333', marginTop: 15 },
  emptySub: { fontSize: 14, color: '#888', marginTop: 5 },
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  cancelText: { fontSize: 16, color: '#FF3B30' },
  createText: { fontSize: 16, color: '#007AFF', fontWeight: '600' },
  inputContainer: { padding: 15 },
  input: { backgroundColor: '#F2F2F7', padding: 12, borderRadius: 10, fontSize: 16 },
  sectionTitle: { paddingHorizontal: 15, paddingVertical: 10, backgroundColor: '#F9F9F9', color: '#666', fontWeight: '600' },
  friendRow: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  friendInfo: { flex: 1, marginLeft: 12 },
  friendName: { fontSize: 16, fontWeight: '600' },
  friendEmail: { fontSize: 13, color: '#888' },
  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#007AFF', justifyContent: 'center', alignItems: 'center' },
  checkboxSelected: { backgroundColor: '#007AFF' }
});