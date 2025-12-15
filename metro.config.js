// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Fix for react-native-webrtc dependency issue
  if (moduleName === 'event-target-shim') {
    return context.resolveRequest(
      context,
      'event-target-shim/dist/event-target-shim.js',
      platform
    );
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;