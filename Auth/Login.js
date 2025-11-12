import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// --- SIMPLIFIED IMPORT ---
// We only need signInWithEmailAndPassword now
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from '../firebaseConfig'; // This auth object is now pre-configured!

export default function Login({ onNavigate }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // We no longer need the isChecked state for Firebase logic, but it's fine for the UI
  const [isPasswordVisible, setPasswordVisible] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // --- SIMPLIFIED LOGIN HANDLER ---
  const handleLoginPress = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    setEmailError('');
    setPasswordError('');

    let isValid = true;
    if (!emailRegex.test(email)) { setEmailError('Please enter a valid email address.'); isValid = false; }
    if (!password) { setPasswordError('Password cannot be empty.'); isValid = false; }
    if (!isValid) { return; }

    try {
      // We can now directly call signInWithEmailAndPassword.
      // The persistence is handled automatically by our new auth object.
      // NOTE: With this setup, the user session will ALWAYS be remembered by default.
      // The "Remember Me" checkbox becomes a purely UI element unless you
      // want to add more complex logic to sign the user out manually on app close.
      await signInWithEmailAndPassword(auth, email, password);
      console.log('Logged in successfully!');

    } catch (error) {
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setPasswordError('Invalid email or password.');
      } else {
        setPasswordError('An error occurred. Please try again.');
        console.error(error);
      }
    } 
  };

  // The rest of your JSX is unchanged
  return (
    <View style={styles.content}>
      <Text style={styles.title}>Great To Have You Back!</Text>
      <TextInput
        style={[styles.input, emailError ? styles.inputError : null]}
        placeholder='Enter your email'
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
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
      {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
      <View style={styles.optionsRow}>
        <TouchableOpacity>
          <Text style={styles.linkText}>Forgot the password?</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity 
        style={styles.button} 
        onPress={handleLoginPress}
      >
        <Text style={styles.buttonText}>Login</Text>
      </TouchableOpacity>
      <View style={styles.footer}>
        <Text style={styles.footerText}>Don't have an account? </Text>
        <TouchableOpacity onPress={onNavigate}>
          <Text style={styles.linkText}>Sign Up</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
// Styles are unchanged and correct
const styles = StyleSheet.create({
    content: { width: '85%', alignItems: 'center' },
    title: { fontSize: 26, fontWeight: 'bold', color: '#333', marginBottom: 30 },
    input: { width: '100%', height: 50, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 15, fontSize: 16, marginBottom: 15 },
    inputError: { borderColor: 'red' },
    errorText: { color: 'red', alignSelf: 'flex-start', marginLeft: 5, marginBottom: 10, marginTop: -10 },
    inputContainer: { flexDirection: 'row', alignItems: 'center', width: '100%', height: 50, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 15, marginBottom: 15 },
    inputField: { flex: 1, fontSize: 16, height: '100%' },
    optionsRow: { width: '100%', flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'end', marginBottom: 20 },
    checkboxContainer: { flexDirection: 'row', alignItems: 'center' },
    label: { marginLeft: 4, fontSize: 14, color: '#555' },
    linkText: { color: '#6200ee', fontSize: 14, fontWeight: '500' },
    button: { width: '100%', backgroundColor: '#6200ee', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
    buttonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
    footer: { marginTop: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    footerText: { fontSize: 14, color: '#555' }
});