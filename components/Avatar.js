import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const Avatar = ({ uri, name, size = 50, isGroup, participants = [] }) => {
  // Store objects: { uri: string | null, name: string }
  const [collageData, setCollageData] = useState([]);

  // --- 1. FETCH GROUP PARTICIPANTS DATA ---
  useEffect(() => {
    if (isGroup && !uri && participants.length > 0) {
      const fetchData = async () => {
        const idsToFetch = participants.slice(0, 4);
        const results = [];
        
        for (const uid of idsToFetch) {
          try {
            const snap = await getDoc(doc(db, 'users', uid));
            if (snap.exists()) {
              results.push({
                uri: snap.data().photoURL || null,
                name: snap.data().displayName || 'User'
              });
            } else {
              results.push({ uri: null, name: '?' });
            }
          } catch (e) {
            results.push({ uri: null, name: '?' });
          }
        }
        setCollageData(results);
      };
      fetchData();
    }
  }, [isGroup, uri, participants]);

  // --- HELPER: GET INITIAL ---
  const getInitial = (userName) => {
    if (!userName) return 'A';
    if (userName === 'Anonymous User') return 'A';
    return userName.charAt(0).toUpperCase();
  };

  // --- HELPER: RENDER SINGLE QUADRANT ---
  const renderQuadrant = (data) => {
    if (data && data.uri) {
      return <Image source={{ uri: data.uri }} style={styles.fullSize} resizeMode="cover" />;
    }
    // Fallback: Colored Box with Initial
    const initial = data ? getInitial(data.name) : '?';
    return (
      <View style={[styles.fullSize, styles.placeholderContainer]}>
        <Text style={[styles.placeholderText, { fontSize: size * 0.25 }]}>
          {initial}
        </Text>
      </View>
    );
  };

  // --- RENDER: GROUP COLLAGE ---
  if (isGroup && !uri) {
    const count = collageData.length;

    if (count === 0) {
      return (
        <View style={[styles.container, { width: size, height: size, backgroundColor: '#007AFF' }]}>
          <Text style={[styles.text, { fontSize: size * 0.4 }]}>{name?.[0] || 'G'}</Text>
        </View>
      );
    }

    // 2 Participants (Split Vertical)
    if (count === 2) {
      return (
        <View style={[styles.collageContainer, { width: size, height: size, borderRadius: size / 2 }]}>
          {collageData.map((data, i) => (
            <View key={i} style={[styles.halfVertical, i === 0 && styles.borderRight]}>
              {renderQuadrant(data)}
            </View>
          ))}
        </View>
      );
    }

    // 3 Participants (1 Big Left, 2 Small Right)
    if (count === 3) {
      return (
        <View style={[styles.collageContainer, { width: size, height: size, borderRadius: size / 2 }]}>
          <View style={[styles.halfVertical, styles.borderRight]}>
             {renderQuadrant(collageData[0])}
          </View>
          <View style={styles.halfVertical}>
            <View style={[styles.halfHorizontal, styles.borderBottom]}>
              {renderQuadrant(collageData[1])}
            </View>
            <View style={styles.halfHorizontal}>
              {renderQuadrant(collageData[2])}
            </View>
          </View>
        </View>
      );
    }

    // 4+ Participants (2x2 Grid)
    return (
      <View style={[styles.collageContainer, { width: size, height: size, borderRadius: size / 2, flexWrap: 'wrap' }]}>
        {collageData.map((data, index) => (
          <View key={index} style={[
            styles.quarter, 
            (index === 0 || index === 2) && styles.borderRight,
            (index === 0 || index === 1) && styles.borderBottom
          ]}>
             {renderQuadrant(data)}
          </View>
        ))}
      </View>
    );
  }

  // --- RENDER: SINGLE USER OR GROUP WITH PHOTO ---
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#eee' }} />;
  }

  // --- RENDER: DEFAULT INITIALS (No Random Images) ---
  return (
    <View style={[styles.container, { width: size, height: size, backgroundColor: '#007AFF' }]}>
      <Text style={[styles.text, { fontSize: size * 0.4 }]}>
        {getInitial(name)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  collageContainer: { overflow: 'hidden', backgroundColor: '#eee', flexDirection: 'row' },
  text: { color: '#fff', fontWeight: 'bold' },
  
  // Collage Helpers
  fullSize: { width: '100%', height: '100%' },
  halfVertical: { width: '50%', height: '100%' },
  halfHorizontal: { width: '100%', height: '50%' },
  quarter: { width: '50%', height: '50%' },
  
  // Borders for separation
  borderRight: { borderRightWidth: 1, borderColor: '#fff' },
  borderBottom: { borderBottomWidth: 1, borderColor: '#fff' },
  
  // Fallback Placeholder inside Collage
  placeholderContainer: { backgroundColor: '#ccc', justifyContent: 'center', alignItems: 'center' },
  placeholderText: { color: '#fff', fontWeight: 'bold' }
});

export default Avatar;