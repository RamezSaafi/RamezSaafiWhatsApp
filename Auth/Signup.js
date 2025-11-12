import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore"; // Import Firestore functions
import { auth, db } from '../firebaseConfig';

export default function Signup({ onNavigate }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isPasswordVisible, setPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handleRegisterPress = async () => {
    // ... your validation logic is already correct ...
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    setEmailError('');
    setPasswordError('');
    if (!emailRegex.test(email)) { setEmailError('Please enter a valid email address.'); return; }
    if (!password) { setPasswordError('Password cannot be empty.'); return; }
    if (password !== confirmPassword) { setPasswordError('Passwords do not match.'); return; }

     try {
      // Step A: Create the user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log('User registered in Auth:', user.uid);

      // --- Step B: Create the user document in Firestore ---
      // We create a "document reference" which is like a pointer to where the file should be.
      // We use the user's UID from Auth as the document ID. This links them forever.
      const userDocRef = doc(db, "users", user.uid);

      // Now, we set the data for that document.
      await setDoc(userDocRef, {
        displayName: 'Anonymous User', // A default display name
        email: user.email,
        photoURL: null, // No photo yet
        createdAt: serverTimestamp(), // A special Firestore timestamp
      });

      console.log('User document created in Firestore!');
      // The onAuthStateChanged listener in App.js will handle the navigation to the home screen.

    } catch (error) {
      // Handle errors from both Auth and Firestore
      if (error.code === 'auth/email-already-in-use') {
        setEmailError('That email address is already in use!');
      } else {
        setPasswordError('An error occurred. Please try again.');
      }
      console.error("Registration error:", error);
    }
  };

  return (
    <View style={styles.content}>
      <Text style={styles.title}>Create Your Account</Text>

      <TextInput
        style={[styles.input, emailError ? styles.inputError : null]}
        placeholder='Enter your email'
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

      {/* --- STYLING FIX --- */}
      {/* Removed `styles.input` from the container's style array */}
      <View style={[styles.inputContainer, passwordError ? styles.inputError : null]}>
        <TextInput
          style={styles.inputField}
          placeholder='Enter your password'
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!isPasswordVisible}
        />
        <TouchableOpacity onPress={() => setPasswordVisible(!isPasswordVisible)}>
          <Ionicons name={isPasswordVisible ? "eye-off" : "eye"} size={24} color="gray" />
        </TouchableOpacity>
      </View>

      {/* --- STYLING FIX --- */}
      {/* Removed `styles.input` from the container's style array */}
      <View style={[styles.inputContainer, passwordError ? styles.inputError : null]}>
        <TextInput
          style={styles.inputField}
          placeholder='Confirm your password'
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={!isConfirmPasswordVisible}
        />
        <TouchableOpacity onPress={() => setConfirmPasswordVisible(!isConfirmPasswordVisible)}>
          <Ionicons name={isConfirmPasswordVisible ? "eye-off" : "eye"} size={24} color="gray" />
        </TouchableOpacity>
      </View>
      {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

      <TouchableOpacity 
        style={styles.button} 
        onPress={handleRegisterPress}
      >
        <Text style={styles.buttonText}>Register</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Already have an account? </Text>
        <TouchableOpacity onPress={onNavigate}>
          <Text style={styles.linkText}>Log In</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Re-using the same, corrected stylesheet structure from Login.js
const styles = StyleSheet.create({
    content: { width: '85%', alignItems: 'center' },
    title: { fontSize: 26, fontWeight: 'bold', color: '#333', marginBottom: 30 },
    input: { width: '100%', height: 50, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 15, fontSize: 16, marginBottom: 15 },
    inputError: { borderColor: 'red' },
    errorText: { color: 'red', alignSelf: 'flex-start', marginLeft: 5, marginBottom: 10, marginTop: -10 },
    inputContainer: { flexDirection: 'row', alignItems: 'center', width: '100%', height: 50, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 15, marginBottom: 15 },
    inputField: { flex: 1, fontSize: 16, height: '100%' },
    linkText: { color: '#6200ee', fontSize: 14, fontWeight: '500' },
    button: { width: '100%', backgroundColor: '#6200ee', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
    buttonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
    footer: { marginTop: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    footerText: { fontSize: 14, color: '#555' }
});