# Claude Terminal Android App

A native Android wrapper for the Claude Terminal web interface.

## Features

- **Fullscreen immersive mode** - No system bars for maximum terminal space
- **Hardware keyboard support** - ESC, Ctrl+C, Ctrl+D, Ctrl+Z, Ctrl+L
- **Keep screen on** - Prevents sleep while terminal is active
- **Persistent sessions** - WebView maintains cookies/localStorage
- **JavaScript bridge** - Native keyboard control from web app
- **Offline error handling** - Clean error page with retry button

## Building

### Prerequisites

- Android Studio Hedgehog (2023.1.1) or later
- JDK 17
- Android SDK 34

### Steps

1. Open the `android` folder in Android Studio
2. Update the server URL in `app/build.gradle`:
   ```gradle
   buildConfigField "String", "SERVER_URL", "\"https://your-server.com:3000\""
   ```
3. Build > Generate Signed Bundle/APK

### Debug Build

```bash
cd android
./gradlew assembleDebug
```

APK will be at `app/build/outputs/apk/debug/app-debug.apk`

## Configuration

### Server URL

Edit `app/build.gradle`:

```gradle
defaultConfig {
    // Production URL
    buildConfigField "String", "SERVER_URL", "\"https://claude.example.com\""
}

buildTypes {
    debug {
        // Local development URL
        buildConfigField "String", "SERVER_URL", "\"http://192.168.0.61:3555\""
    }
}
```

### Allow HTTP (non-HTTPS)

For local development, `android:usesCleartextTraffic="true"` is enabled in the manifest.
For production, use HTTPS and remove this flag.

## JavaScript Bridge

The app exposes `AndroidBridge` to JavaScript:

```javascript
// Show/hide soft keyboard
AndroidBridge.showKeyboard();
AndroidBridge.hideKeyboard();

// Get app version
const version = AndroidBridge.getAppVersion();

// Haptic feedback (if implemented)
AndroidBridge.vibrate(50);
```

### Keyboard Shortcuts (Hardware Keyboard)

Add these to your web app to receive hardware keyboard shortcuts:

```javascript
window.sendEscKey = function() {
    // Handle ESC key
    socket.emit('terminal_input', { data: '\x1b' });
};

window.sendCtrlKey = function(char) {
    // Handle Ctrl+C, Ctrl+D, etc.
    const code = char.charCodeAt(0) - 96; // Convert to control code
    socket.emit('terminal_input', { data: String.fromCharCode(code) });
};
```

## App Icon

The app uses a vector icon (lightning bolt on dark background) that works with adaptive icons on Android 8+.

To customize:
1. Edit `res/drawable/ic_launcher_foreground.xml`
2. Or use Android Studio's Image Asset Studio

## Signing for Release

1. Generate a keystore:
   ```bash
   keytool -genkey -v -keystore release.keystore -alias claude -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Create `keystore.properties`:
   ```properties
   storePassword=your_store_password
   keyPassword=your_key_password
   keyAlias=claude
   storeFile=../release.keystore
   ```

3. Build release:
   ```bash
   ./gradlew assembleRelease
   ```

## License

MIT
