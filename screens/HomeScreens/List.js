import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Image, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { db, auth } from '../../firebaseConfig';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';

export default function List() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigation = useNavigation();

  useEffect(() => {
    // --- This real-time logic is unchanged and correct ---
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    const q = query(collection(db, "users"), where('__name__', '!=', currentUser.uid));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const usersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersData);
      if (isLoading) {
        setIsLoading(false);
      }
    }, (error) => {
      console.error("Error fetching users: ", error);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6200ee" />
      </View>
    );
  }

  if (users.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>No other users found.</Text>
      </View>
    );
  }

  // --- A HELPER COMPONENT FOR A CLEAN SEPARATOR ---
  const ItemSeparator = () => <View style={styles.separator} />;
  
  return (
    <View style={styles.container}>
      <FlatList
        data={users}
        keyExtractor={item => item.id}
        ItemSeparatorComponent={ItemSeparator} // Use the separator component
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.userCard}
            onPress={() => navigation.navigate('Chat', { 
              userId: item.id, 
              userName: item.displayName 
            })}
          >
            {/* --- AVATAR --- */}
            <View style={styles.avatarWrapper}>
              {item.photoURL ? (
                <Image source={{ uri: item.photoURL }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Ionicons name="person-outline" size={24} color="#fff" />
                </View>
              )}
            </View>
            
            {/* --- USER INFO --- */}
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{item.displayName}</Text>
              <Text style={styles.userEmail}>{item.email}</Text>
            </View>

            {/* --- CHEVRON ICON --- */}
            <Ionicons name="chevron-forward" size={24} color="#ccc" />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

// --- NEW, BEAUTIFUL STYLESHEET ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff', // A clean white background for the list
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
  },
  avatarWrapper: {
    // Adding a wrapper allows for things like online status indicators later
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    backgroundColor: '#cccccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1, // This makes the user info take up all available space
    marginLeft: 15,
  },
  userName: {
    fontSize: 17,
    fontWeight: '600', // A bit bolder than normal
    color: '#333',
  },
  userEmail: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0', // A very light gray
    marginLeft: 85, // Start the separator after the avatar
  },
});