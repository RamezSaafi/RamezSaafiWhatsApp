import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Alert, TouchableOpacity,
  Image, TextInput, ActivityIndicator, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { auth, db } from '../firebaseConfig';
import { signOut, updateProfile } from 'firebase/auth';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { uploadImageToCloudinary } from '../cloudinaryConfig';

export default function ProfileScreen() {
  const [userData, setUserData] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const currentUser = auth.currentUser;

  // ===== LOAD USER DATA =====
  useEffect(() => {
    if (!currentUser) return;

    const unsub = onSnapshot(doc(db, 'users', currentUser.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserData(data);
        setDisplayName(data.displayName || '');
      }
    });

    return unsub;
  }, [currentUser]);

  // ===== HANDLE PHOTO UPLOAD =====
  const handlePhotoUpload = () => {
    Alert.alert('Change Photo', 'Choose a source', [
      {
        text: 'Camera',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') return Alert.alert('Permission Needed');
          const result = await ImagePicker.launchCameraAsync({
            quality: 0.5,
            allowsEditing: true,
            aspect: [1, 1]
          });
          if (!result.canceled) uploadPhoto(result.assets[0].uri);
        }
      },
      {
        text: 'Gallery',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') return Alert.alert('Permission Needed');
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.5,
            allowsEditing: true,
            aspect: [1, 1]
          });
          if (!result.canceled) uploadPhoto(result.assets[0].uri);
        }
      },
      { text: 'Cancel', style: 'cancel' }
    ]);
  };

  const uploadPhoto = async (uri) => {
    setUploading(true);
    try {
      const photoURL = await uploadImageToCloudinary(uri);
      if (photoURL) {
        // Update Firebase Auth profile
        await updateProfile(currentUser, { photoURL });
        // Update Firestore
        await updateDoc(doc(db, 'users', currentUser.uid), { photoURL });
        Alert.alert('Success', 'Profile photo updated!');
      } else {
        Alert.alert('Error', 'Could not upload photo');
      }
    } catch (error) {
      console.error('Photo upload error:', error);
      Alert.alert('Error', 'Could not update photo');
    }
    setUploading(false);
  };

  // ===== SAVE PROFILE CHANGES =====
  const saveChanges = async () => {
    if (!displayName.trim()) return Alert.alert('Required', 'Display name cannot be empty');

    setSaving(true);
    try {
      await updateProfile(currentUser, { displayName: displayName.trim() });
      await updateDoc(doc(db, 'users', currentUser.uid), {
        displayName: displayName.trim()
      });
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      Alert.alert('Error', 'Could not save changes');
    }
    setSaving(false);
  };

  // ===== HANDLE LOGOUT =====
  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          try {
            // Set offline BEFORE signing out
            await updateDoc(doc(db, 'users', currentUser.uid), { isOnline: false });
            await signOut(auth);
          } catch (error) {
            console.error('Logout error:', error);
            // Force sign out even if firestore update fails
            await signOut(auth);
          }
        }
      }
    ]);
  };

  if (!userData) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" style={{ marginTop: 50 }} color="#007AFF" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          {!isEditing ? (
            <TouchableOpacity onPress={() => setIsEditing(true)}>
              <Ionicons name="create-outline" size={28} color="#007AFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => setIsEditing(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Profile Photo */}
        <View style={styles.photoSection}>
          <View style={styles.photoContainer}>
            {userData.photoURL ? (
              <Image source={{ uri: userData.photoURL }} style={styles.photo} />
            ) : (
              <View style={[styles.photo, styles.photoPlaceholder]}>
                <Text style={styles.photoInitials}>
                  {displayName?.[0]?.toUpperCase() || '?'}
                </Text>
              </View>
            )}
            
            {uploading && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator color="#fff" />
              </View>
            )}

            <TouchableOpacity
              style={styles.cameraButton}
              onPress={handlePhotoUpload}
              disabled={uploading}
            >
              <Ionicons name="camera" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Profile Info */}
        <View style={styles.infoSection}>
          {/* Display Name */}
          <View style={styles.infoRow}>
            <Text style={styles.label}>Display Name</Text>
            {isEditing ? (
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Enter your name"
                maxLength={30}
              />
            ) : (
              <Text style={styles.value}>{userData.displayName || 'Anonymous User'}</Text>
            )}
          </View>

          {/* Email */}
          <View style={styles.infoRow}>
            <Text style={styles.label}>Email</Text>
            <Text style={[styles.value, styles.emailValue]}>{userData.email}</Text>
          </View>

          {/* Account Created */}
          <View style={styles.infoRow}>
            <Text style={styles.label}>Member Since</Text>
            <Text style={styles.value}>
              {userData.createdAt?.toDate().toLocaleDateString() || 'N/A'}
            </Text>
          </View>

          {/* Online Status */}
          <View style={styles.infoRow}>
            <Text style={styles.label}>Status</Text>
            <View style={styles.statusContainer}>
              <View style={[styles.statusDot, userData.isOnline && styles.statusDotOnline]} />
              <Text style={styles.value}>
                {userData.isOnline ? 'Online' : 'Offline'}
              </Text>
            </View>
          </View>
        </View>

        {/* Save Button (only show when editing) */}
        {isEditing && (
          <TouchableOpacity
            style={styles.saveButton}
            onPress={saveChanges}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        {/* App Info */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>WhatsApp Clone v1.0</Text>
          <Text style={styles.footerSubtext}>Made with React Native & Firebase</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { paddingBottom: 30 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  title: { fontSize: 28, fontWeight: 'bold' },
  cancelText: { fontSize: 16, color: '#007AFF' },
  
  // Photo Section
  photoSection: {
    alignItems: 'center',
    paddingVertical: 30
  },
  photoContainer: {
    position: 'relative'
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#eee'
  },
  photoPlaceholder: {
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center'
  },
  photoInitials: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff'
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center'
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff'
  },

  // Info Section
  infoSection: {
    paddingHorizontal: 20
  },
  infoRow: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0'
  },
  label: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 5,
    fontWeight: '500'
  },
  value: {
    fontSize: 17,
    color: '#000',
    fontWeight: '400'
  },
  emailValue: {
    color: '#007AFF'
  },
  input: {
    fontSize: 17,
    color: '#000',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF'
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#8E8E93'
  },
  statusDotOnline: {
    backgroundColor: '#34C759'
  },

  // Buttons
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#34C759',
    marginHorizontal: 20,
    marginTop: 30,
    paddingVertical: 15,
    borderRadius: 12
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600'
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 15,
    paddingVertical: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF3B30'
  },
  logoutText: {
    color: '#FF3B30',
    fontSize: 17,
    fontWeight: '600'
  },

  // Footer
  footer: {
    alignItems: 'center',
    marginTop: 40
  },
  footerText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500'
  },
  footerSubtext: {
    fontSize: 12,
    color: '#C7C7CC',
    marginTop: 5
  }
});