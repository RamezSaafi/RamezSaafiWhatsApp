import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, onSnapshot, orderBy, doc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import Avatar from '../components/Avatar';

export default function HomeScreen({ navigation }) {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const currentUser = auth.currentUser;

  useEffect(() => {
    // 1. Query ALL chats user is in
    const q = query(
      collection(db, "chats"),
      where("participants", "array-contains", currentUser.uid),
      orderBy("lastMessageTime", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedChats = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        // 2. FILTER: Only show chats that are NOT groups
        .filter(chat => chat.isGroup === false); 
        
      setChats(loadedChats);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const ChatItem = ({ item }) => {
    const [friend, setFriend] = useState(null);

    useEffect(() => {
      // Find the other person
      const friendId = item.participants.find(uid => uid !== currentUser.uid);
      if (friendId) {
        const unsub = onSnapshot(doc(db, "users", friendId), s => setFriend(s.data()));
        return unsub;
      }
    }, [item]);

    const getTime = () => {
      if (!item.lastMessageTime) return '';
      const d = item.lastMessageTime.toDate();
      return d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
    };

    const chatName = friend?.displayName || 'Loading...';

    return (
      <TouchableOpacity 
        style={styles.chatRow} 
        onPress={() => navigation.navigate('Chat', { chatId: item.id, chatName: chatName })}
      >
        <Avatar uri={friend?.photoURL} name={chatName} size={55} isGroup={false} />

        <View style={styles.chatContent}>
          <View style={styles.topRow}>
            <Text style={styles.name}>{chatName}</Text>
            <Text style={styles.time}>{getTime()}</Text>
          </View>
          <Text style={styles.message} numberOfLines={1}>
            {item.lastMessageSenderId === currentUser.uid ? "You: " : ""} 
            {item.lastMessage || "No messages yet"}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) return <ActivityIndicator style={{flex:1}} size="large" color="#007AFF" />;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Chats</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Users')} style={styles.newChatBtn}>
             <Ionicons name="create-outline" size={28} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={chats}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <ChatItem item={item} />}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
             <Ionicons name="chatbubbles-outline" size={60} color="#ccc" />
             <Text style={styles.emptyText}>No private chats</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
  title: { fontSize: 28, fontWeight: 'bold' },
  newChatBtn: { padding: 5 },
  chatRow: { flexDirection: 'row', padding: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', alignItems: 'center' },
  chatContent: { flex: 1, marginLeft: 15 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  name: { fontSize: 16, fontWeight: 'bold' },
  time: { fontSize: 12, color: '#999' },
  message: { fontSize: 14, color: '#666' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyText: { fontSize: 16, color: '#999', marginTop: 10 },
});