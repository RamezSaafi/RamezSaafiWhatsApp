import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, TextInput, ActivityIndicator, Alert, Modal, Pressable } from 'react-native';
import { auth, db } from '../../firebaseConfig';
import { signOut, updateProfile } from 'firebase/auth';
import { doc, updateDoc } from "firebase/firestore";
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { uploadImageToCloudinary } from '../../cloudinaryConfig';

export default function MyProfile() {
  const user = auth.currentUser;

  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isModalVisible, setModalVisible] = useState(false);

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  const handleImagePickAndUpload = async () => {
    // 1. Ask for permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions.');
      return;
    }

    // 2. Pick an image
    const result = await ImagePicker.launchImageLibraryAsync({
      // --- THIS IS THE FIX ---
      mediaTypes: ['images'], 
      // --------------------
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      // base64 is not needed for the fetch uploader, which is correct
    });

    if (result.canceled || !result.assets) {
      return;
    }

    const image = result.assets[0];

    try {
      setIsUploading(true);
      // 3. Call the upload function from your (correct) config file
      const downloadURL = await uploadImageToCloudinary(image);
      
      if (!downloadURL) {
        throw new Error('Upload failed, URL not received from Cloudinary.');
      }

      // 4. Update Firebase Auth profile with the new URL
      await updateProfile(user, { photoURL: downloadURL });
       const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        photoURL: downloadURL
      });
      Alert.alert('Success', 'Profile picture updated!');
    } catch (error) {
      console.error("Error updating profile picture: ", error);
      Alert.alert('Error', 'Failed to update picture. Please check the console logs.');
    } finally {
      setIsUploading(false);
    }
  };

  // Edit Name and Logout logic are unchanged
  const handleSave = async () => {
    if (!user) return;
    const newDisplayName = displayName.trim();
    if (newDisplayName !== (user.displayName || '')) {
      setIsLoading(true);
      try {
        await updateProfile(user, {
          displayName: newDisplayName,
        });
        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, {
          displayName: newDisplayName
        });
        console.log('Display name updated successfully in both places!');
      } catch (error) {
        Alert.alert('Error', 'Failed to update name.');
      } finally {
        setIsLoading(false);
      }
    }
    setIsEditing(false);
  };
  
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out: ', error);
    }
  };

  const handleChangePicturePress = async () => {
    // First, close the modal
    setModalVisible(false);
    // Then, start the image picking and uploading process
    await handleImagePickAndUpload();
  };

  return (
    <SafeAreaView style={styles.container}>
      <Modal
        animationType="fade"
        transparent={true}
        visible={isModalVisible}
        onRequestClose={() => setModalVisible(false)} // For Android back button
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <Text style={styles.modalTitle}>Profile Photo</Text>
            {/* Display the large version of the avatar */}
            {user.photoURL ? (
              // If a photo exists, show it
              <Image 
                source={{ uri: user.photoURL }} 
                style={styles.modalAvatar} 
              />
            ) : (
              // Otherwise, show your Ionicons placeholder, styled for the modal
              <View style={[styles.modalAvatar, styles.avatarPlaceholder]}>
                <Ionicons name="person-outline" size={120} color="#fff" />
              </View>
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalButton} onPress={handleChangePicturePress}>
                <Ionicons name="camera-outline" size={20} color="#fff" />
                <Text style={styles.modalButtonText}>Change Picture</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelModalButton]} 
                onPress={() => setModalVisible(false)}
              >
                <Ionicons name="close-outline" size={20} color="#333" />
                <Text style={[styles.modalButtonText, { color: '#333' }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      <View style={styles.profileSection}>
<TouchableOpacity onPress={() => setModalVisible(true)} disabled={isUploading}>
          <View style={styles.avatarContainer}>
            {user.photoURL ? (
              <Image source={{ uri: user.photoURL }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Ionicons name="person-outline" size={60} color="#fff" />
              </View>
            )}
            {isUploading && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator size="large" color="#fff" />
              </View>
            )}
          </View>
        </TouchableOpacity>
        
        {isEditing ? (
          <View style={styles.editSection}>
            <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} autoFocus />
            <View style={styles.editButtons}>
              <TouchableOpacity onPress={handleSave} style={[styles.button, styles.saveButton]} disabled={isLoading}>
                {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setIsEditing(false)} style={[styles.button, styles.cancelButton]} disabled={isLoading}>
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.displaySection}>
            <Text style={styles.displayName}>{user.displayName || 'Anonymous User'}</Text>
            <TouchableOpacity onPress={() => setIsEditing(true)}>
              <Ionicons name="pencil" size={20} color="#6200ee" />
            </TouchableOpacity>
          </View>
        )}
        
        <Text style={styles.email}>{user.email}</Text>
      </View>

      <View style={styles.infoSection}>
        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={20} color="#666" />
          <Text style={styles.infoText}>
            Joined {new Date(user.metadata.creationTime).toLocaleDateString()}
          </Text>
        </View>
      </View>
      
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={22} color="#fff" style={{ marginRight: 10 }} />
        <Text style={styles.logoutButtonText}>Logout</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// Styles are unchanged and correct
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', alignItems: 'center', paddingTop: 40 },
  profileSection: { width: '90%', alignItems: 'center', marginBottom: 30 },
  avatarContainer: { marginBottom: 15, position: 'relative' },
  avatar: { width: 120, height: 120, borderRadius: 60 },
  avatarPlaceholder: { backgroundColor: '#cccccc', justifyContent: 'center', alignItems: 'center' },
  uploadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', borderRadius: 60 },
  displayName: { fontSize: 24, fontWeight: 'bold', color: '#333', marginRight: 10 },
  email: { fontSize: 16, color: '#666', marginTop: 4 },
  displaySection: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  editSection: { width: '100%', alignItems: 'center', marginBottom: 5 },
  input: { width: '90%', height: 45, borderColor: '#ccc', borderWidth: 1, borderRadius: 8, paddingHorizontal: 15, marginBottom: 15, fontSize: 18, textAlign: 'center', backgroundColor: '#fff' },
  editButtons: { flexDirection: 'row' },
  button: { paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20, marginHorizontal: 5, alignItems: 'center', justifyContent: 'center', minWidth: 80 },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  saveButton: { backgroundColor: '#6200ee' },
  cancelButton: { backgroundColor: '#888' },
  infoSection: { width: '90%', backgroundColor: '#fff', borderRadius: 10, padding: 20, marginBottom: 30 },
  infoRow: { flexDirection: 'row', alignItems: 'center' },
  infoText: { fontSize: 16, marginLeft: 15, color: '#333' },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ff4444', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 25, width: '90%', elevation: 5 },
  logoutButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '90%', backgroundColor: '#fff', borderRadius: 20, padding: 20, alignItems: 'center', elevation: 5 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
  modalAvatar: { width: 250, height: 250, borderRadius: 125, marginBottom: 20 },
  modalButtons: { width: '100%', flexDirection: 'column' },
  modalButton: { flexDirection: 'row', backgroundColor: '#6200ee', padding: 15, borderRadius: 10, alignItems: 'center', justifyContent: 'center', width: '100%', marginBottom: 10 },
  cancelModalButton: { backgroundColor: '#f0f0f0' },
  modalButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 10 },
});