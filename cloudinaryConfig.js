// --- IMPORTANT ---
// Double-check these credentials!
const CLOUD_NAME = 'dvze2hs9c';
const UPLOAD_PRESET = 'RamezSaafiWhatsApp';

const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

export const uploadImageToCloudinary = async (image) => {
  if (!image || !image.uri) {
    throw new Error('Image data is invalid.');
  }

  // --- DIAGNOSTIC LOG 1: What image are we getting? ---
  console.log('Attempting to upload image:', image.uri);

  const formData = new FormData();
  formData.append('file', {
    uri: image.uri,
    // Using the mimeType from the image picker is more reliable
    type: image.mimeType || `image/${image.uri.split('.').pop()}`, 
    name: `upload.${image.uri.split('.').pop()}`,
  });
  formData.append('upload_preset', UPLOAD_PRESET);

  try {
    // --- DIAGNOSTIC LOG 2: Are we sending the request? ---
    console.log('Sending request to Cloudinary...');

    const response = await fetch(UPLOAD_URL, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    // --- DIAGNOSTIC LOG 3: What was the raw response? ---
    console.log('Received response from Cloudinary. Status:', response.status);

    // It's very helpful to see the raw text of the response
    const responseText = await response.text();
    console.log('Cloudinary response text:', responseText);

    // Now, try to parse it as JSON
    const data = JSON.parse(responseText);

    if (data.secure_url) {
      console.log('Upload successful! URL:', data.secure_url);
      return data.secure_url;
    } else {
      throw new Error(data.error?.message || 'Cloudinary upload failed after response.');
    }
  } catch (error) {
    // --- DIAGNOSTIC LOG 4: Did an error occur? ---
    console.error('An error occurred during the upload process:', error);
    throw error;
  }
};