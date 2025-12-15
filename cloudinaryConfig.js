// cloudinaryConfig.js
const CLOUD_NAME = 'dvze2hs9c';
const UPLOAD_PRESET = 'RamezSaafiWhatsApp';

// Note: For audio, we use "video" or "auto" in the URL, not "image"
const IMAGE_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
const AUDIO_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`; 

// 1. UPLOAD IMAGE
export const uploadImageToCloudinary = async (imageUri) => {
  try {
    const data = new FormData();
    data.append("file", { uri: imageUri, type: "image/jpeg", name: "upload.jpg" });
    data.append("upload_preset", UPLOAD_PRESET);

    const res = await fetch(IMAGE_UPLOAD_URL, { method: "POST", body: data });
    const result = await res.json();
    return result.secure_url || null;
  } catch (error) {
    console.error("Image Upload Error:", error);
    return null;
  }
};

// 2. UPLOAD AUDIO (NEW)
export const uploadAudioToCloudinary = async (audioUri) => {
  try {
    const data = new FormData();
    // Valid mime type for m4a (iOS/Android default for Expo)
    data.append("file", { uri: audioUri, type: "audio/m4a", name: "upload.m4a" });
    data.append("upload_preset", UPLOAD_PRESET);
    data.append("resource_type", "video"); // Cloudinary often classifies audio as video

    const res = await fetch(AUDIO_UPLOAD_URL, { method: "POST", body: data });
    const result = await res.json();
    return result.secure_url || null;
  } catch (error) {
    console.error("Audio Upload Error:", error);
    return null;
  }
};