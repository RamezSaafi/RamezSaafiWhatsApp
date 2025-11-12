import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

// Import the two new screen components
import Login from '../Auth/Login';
import SignUp from '../Auth/Signup';

export default function AuthScreen({navigation }) {
  // This state will control which screen we show. true = Login, false = Sign Up.
  const [isLogin, setIsLogin] = useState(true);

  // This function will be passed to our screens to handle the navigation logic.
  // It simply flips the boolean value of isLogin.
  const handleNavigation = () => {
    setIsLogin(!isLogin);
  };
  const onNavigateHome = () => {
    navigation.navigate("HomeScreen")
  }


  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        {/* Conditional rendering: show LoginScreen or SignUpScreen based on state */}
        {isLogin ? (
          <Login onNavigate={handleNavigation} onNavigateHome={onNavigateHome} />
        ) : (
          <SignUp onNavigate={handleNavigation} />
        )}
        <StatusBar style="auto" />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
});