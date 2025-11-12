import React from 'react';
import { StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';

// --- STEP 1: Import an icon set ---
import { Ionicons } from '@expo/vector-icons'; 

// Import the screens that will be used in the tabs
import Group from './HomeScreens/Group';
import List from './HomeScreens/List';
import MyProfile from './HomeScreens/MyProfile';

// Create the tab navigator instance
const Tab = createBottomTabNavigator();

export default function HomeScreen() {
  return (
    <Tab.Navigator
      backBehavior='order'
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#6200ee',
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarBackground: () => (
          <BlurView
            tint="light"
            intensity={90}
            style={StyleSheet.absoluteFill}
          />
        ),
        // We can remove tabBarLabelStyle and tabBarLabelPosition from here
        // as they are default or can be set per screen if needed.
      }}
    >
      <Tab.Screen 
        name="List" 
        component={List} 
        options={{
          // --- STEP 2: Add the tabBarIcon option ---
          tabBarIcon: ({ focused, color, size }) => {
            const iconName = focused ? 'list' : 'list-outline';
            return <Ionicons name={iconName} size={size} color={color} />;
          },
        }} 
      />
      <Tab.Screen 
        name="Group" 
        component={Group} 
        options={{
          tabBarIcon: ({ focused, color, size }) => {
            const iconName = focused ? 'people' : 'people-outline';
            return <Ionicons name={iconName} size={size} color={color} />;
          },
        }} 
      />
      <Tab.Screen 
        name="MyProfile" 
        component={MyProfile} 
        options={{ 
          title: 'Profile',
          tabBarIcon: ({ focused, color, size }) => {
            const iconName = focused ? 'person-circle' : 'person-circle-outline';
            return <Ionicons name={iconName} size={size} color={color} />;
          },
        }} 
      />
    </Tab.Navigator>
  );
}