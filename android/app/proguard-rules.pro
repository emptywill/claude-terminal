# Keep WebView JavaScript interface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep BuildConfig
-keep class com.claudeterminal.BuildConfig { *; }
