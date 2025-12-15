import React, { useState, useEffect } from 'react';
import { 
  Modal, View, Text, StyleSheet, FlatList, Image, 
  TouchableOpacity, Dimensions, ActivityIndicator 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import ImagePreviewModal from './ImagePreviewModal'; // Reuse your existing previewer

const { width } = Dimensions.get('window');
const IMAGE_SIZE = width / 3 - 2; // 3 columns with tiny gaps

const MediaGalleryModal = ({ visible, onClose, chatId }) => {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewVisible, setPreviewVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchImages();
    }
  }, [visible]);

  const fetchImages = async () => {
    setLoading(true);
    try {
      // Query: Get messages in this chat that have an image, sorted by newest
      const q = query(
        collection(db, 'chats', chatId, 'messages'),
        where('image', '!=', null),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      const imageMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        uri: doc.data().image
      }));

      setImages(imageMessages);
    } catch (error) {
      console.error("Error fetching media:", error);
      // NOTE: If you get a "Missing or insufficient permissions" or "Index required" error,
      // check your Firebase Console console log for a link to create the index.
    }
    setLoading(false);
  };

  const handleImagePress = (uri) => {
    setSelectedImage(uri);
    setPreviewVisible(true);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity onPress={() => handleImagePress(item.uri)}>
      <Image 
        source={{ uri: item.uri }} 
        style={{ width: IMAGE_SIZE, height: IMAGE_SIZE, margin: 1, backgroundColor: '#eee' }} 
        resizeMode="cover"
      />
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Media Sent</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        {loading ? (
          <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 50 }} />
        ) : (
          <FlatList
            data={images}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            numColumns={3}
            contentContainerStyle={styles.grid}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="images-outline" size={60} color="#ccc" />
                <Text style={styles.emptyText}>No media sent yet</Text>
              </View>
            }
          />
        )}

        {/* Full Screen Preview */}
        <ImagePreviewModal 
          visible={previewVisible} 
          imageUri={selectedImage} 
          onClose={() => setPreviewVisible(false)} 
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' 
  },
  title: { fontSize: 18, fontWeight: 'bold' },
  closeText: { fontSize: 16, color: '#007AFF', fontWeight: '600' },
  grid: { paddingBottom: 20 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyText: { color: '#999', marginTop: 10, fontSize: 16 }
});

export default MediaGalleryModal;