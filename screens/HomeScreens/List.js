import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Image } from 'react-native';
import { db, auth } from '../../firebaseConfig'; // Import your db and auth objects
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';

export default function List() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // --- FUNCTION TO FETCH USERS FROM FIRESTORE ---
    const fetchUsers = async () => {
      try {
        // Get the UID of the currently logged-in user
        const currentUser = auth.currentUser;
        if (!currentUser) {
          setIsLoading(false);
          return;
        }

        // 1. Create a query to get all documents from the "users" collection...
        // 2. ...where the document ID ('__name__') is NOT EQUAL TO the current user's UID.
        // This is how we exclude the current user from the list.
        const q = query(collection(db, "users"), where('__name__', '!=', currentUser.uid));
        
        // 3. Execute the query
        const querySnapshot = await getDocs(q);
        
        // 4. Map over the results and create a clean array of user objects
        const usersData = querySnapshot.docs.map(doc => ({
          id: doc.id, // The user's UID is the document ID
          ...doc.data() // Spread the rest of the data (displayName, email, photoURL)
        }));

        setUsers(usersData);

      } catch (error) {
        console.error("Error fetching users: ", error);
        // In a real app, you might want to show an error message to the user
      } finally {
        // 5. Set loading to false once we're done, regardless of success or failure
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, []); // The empty dependency array means this effect runs only once when the component mounts

  // --- RENDER THE LOADING INDICATOR ---
  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6200ee" />
      </View>
    );
  }

  // --- RENDER THE "EMPTY" MESSAGE ---
  if (users.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>No other users found.</Text>
      </View>
    );
  }
  
  // --- RENDER THE USER LIST ---
  return (
    <View style={styles.container}>
      <FlatList
        data={users}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.userCard}>
            {item.photoURL ? (
              <Image source={{ uri: item.photoURL }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Ionicons name="person-outline" size={24} color="#fff" />
              </View>
            )}
            <Text style={styles.userName}>{item.displayName}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  avatarPlaceholder: {
    backgroundColor: '#cccccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: {
    fontSize: 18,
    fontWeight: '500',
  },
});