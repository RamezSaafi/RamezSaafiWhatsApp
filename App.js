import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebaseConfig'; // Import your auth object
import { StatusBar } from 'expo-status-bar';
import AuthScreen from './screens/AuthScreen';
import HomeScreen from './screens/HomeScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  // State to hold the user's authentication status
  const [user, setUser] = useState(null);

  // useEffect runs when the component mounts
  useEffect(() => {
    // onAuthStateChanged returns an unsubscriber function
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      // If a user is logged in, currentUser will be a user object.
      // If logged out, it will be null.
      setUser(currentUser);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []); // The empty dependency array ensures this runs only once

  return (
    <NavigationContainer>
      <StatusBar style="auto" backgroundColor="transparent" translucent={true} />
      <Stack.Navigator>
        {/* 
          Conditionally render screens based on the user state.
          If a user is logged in, show the HomeScreen.
          If not, show the AuthScreen.
        */}
        {user ? (
          <Stack.Screen 
            name="Home" 
            component={HomeScreen} 
            options={{ headerShown: false }} 
          />
        ) : (
          <Stack.Screen 
            name="Auth" 
            component={AuthScreen} 
            options={{ headerShown: false }} 
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}