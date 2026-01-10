package com.claudeterminal

import android.annotation.SuppressLint
import android.content.Context
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.view.inputmethod.InputMethodManager
import android.webkit.*
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.claudeterminal.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Fullscreen immersive mode
        WindowCompat.setDecorFitsSystemWindows(window, false)

        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        webView = binding.webView

        // Configure WebView
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT

            // Allow mixed content (http from https) for local dev
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW

            // Better text/viewport handling
            loadWithOverviewMode = true
            useWideViewPort = true

            // Disable zoom (terminal handles its own)
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false

            // User agent to identify app
            userAgentString = "$userAgentString ClaudeTerminalApp/1.0"
        }

        // Add JavaScript interface for native features
        webView.addJavascriptInterface(WebAppInterface(this), "AndroidBridge")

        // Handle page loading
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                // Inject CSS to hide browser chrome if needed
                injectCustomCSS()
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                // Show error page
                if (request?.isForMainFrame == true) {
                    showErrorPage(error?.description?.toString() ?: "Connection failed")
                }
            }
        }

        // Handle JavaScript alerts/confirms
        webView.webChromeClient = object : WebChromeClient() {
            override fun onJsAlert(
                view: WebView?,
                url: String?,
                message: String?,
                result: JsResult?
            ): Boolean {
                return super.onJsAlert(view, url, message, result)
            }
        }

        // Load the terminal
        loadTerminal()

        // Keep screen on while terminal is active
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }

    private fun loadTerminal() {
        val serverUrl = BuildConfig.SERVER_URL
        webView.loadUrl(serverUrl)
    }

    private fun showErrorPage(error: String) {
        val html = """
            <!DOCTYPE html>
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        background: #0a0a0f;
                        color: #e4e4e7;
                        font-family: -apple-system, sans-serif;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        height: 100vh;
                        margin: 0;
                        padding: 20px;
                        box-sizing: border-box;
                    }
                    h1 { color: #ff9100; font-size: 48px; margin-bottom: 20px; }
                    p { color: #a1a1aa; text-align: center; margin-bottom: 30px; }
                    button {
                        background: #ff9100;
                        color: #000;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 8px;
                        font-size: 16px;
                        font-weight: 600;
                        cursor: pointer;
                    }
                </style>
            </head>
            <body>
                <h1>⚡</h1>
                <p>Unable to connect to server<br><small>$error</small></p>
                <button onclick="location.reload()">Retry</button>
            </body>
            </html>
        """.trimIndent()
        webView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null)
    }

    private fun injectCustomCSS() {
        // Hide any elements not needed in app mode
        val css = """
            /* App-specific overrides */
            body {
                -webkit-user-select: none;
                user-select: none;
            }
            /* Allow text selection in terminal */
            .xterm-screen, .xterm-rows {
                -webkit-user-select: text !important;
                user-select: text !important;
            }
        """.trimIndent()

        val js = """
            (function() {
                var style = document.createElement('style');
                style.textContent = `$css`;
                document.head.appendChild(style);
            })();
        """.trimIndent()

        webView.evaluateJavascript(js, null)
    }

    // Handle hardware keyboard special keys
    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        when (keyCode) {
            KeyEvent.KEYCODE_ESCAPE -> {
                // Send ESC to terminal
                webView.evaluateJavascript(
                    "if(window.sendEscKey) window.sendEscKey();",
                    null
                )
                return true
            }
            KeyEvent.KEYCODE_BACK -> {
                if (webView.canGoBack()) {
                    webView.goBack()
                    return true
                }
            }
        }
        return super.onKeyDown(keyCode, event)
    }

    // Handle Ctrl key combinations for hardware keyboards
    override fun onKeyUp(keyCode: Int, event: KeyEvent?): Boolean {
        if (event?.isCtrlPressed == true) {
            val char = when (keyCode) {
                KeyEvent.KEYCODE_C -> 'c'
                KeyEvent.KEYCODE_D -> 'd'
                KeyEvent.KEYCODE_Z -> 'z'
                KeyEvent.KEYCODE_L -> 'l'
                else -> null
            }
            if (char != null) {
                webView.evaluateJavascript(
                    "if(window.sendCtrlKey) window.sendCtrlKey('$char');",
                    null
                )
                return true
            }
        }
        return super.onKeyUp(keyCode, event)
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
        // Go fullscreen
        hideSystemUI()
    }

    override fun onPause() {
        super.onPause()
        webView.onPause()
    }

    private fun hideSystemUI() {
        WindowInsetsControllerCompat(window, binding.root).let { controller ->
            controller.hide(WindowInsetsCompat.Type.systemBars())
            controller.systemBarsBehavior =
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }
}

/**
 * JavaScript interface for native Android features
 */
class WebAppInterface(private val context: Context) {

    @JavascriptInterface
    fun showKeyboard() {
        val imm = context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
        imm.toggleSoftInput(InputMethodManager.SHOW_FORCED, 0)
    }

    @JavascriptInterface
    fun hideKeyboard() {
        val imm = context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
        imm.toggleSoftInput(InputMethodManager.HIDE_IMPLICIT_ONLY, 0)
    }

    @JavascriptInterface
    fun vibrate(duration: Long) {
        // Could add haptic feedback
    }

    @JavascriptInterface
    fun getAppVersion(): String {
        return BuildConfig.VERSION_NAME
    }
}
