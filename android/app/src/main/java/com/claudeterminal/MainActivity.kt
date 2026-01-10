package com.claudeterminal

import android.annotation.SuppressLint
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

class MainActivity : AppCompatActivity() {

    private var webView: WebView? = null
    private var settingsButton: ImageButton? = null
    private var currentUrl: String? = null

    // Colors
    private val colorBg = Color.parseColor("#0a0a0f")
    private val colorAccent = Color.parseColor("#ff9100")
    private val colorText = Color.parseColor("#e4e4e7")
    private val colorTextDim = Color.parseColor("#a1a1aa")
    private val colorCard = Color.parseColor("#1a1a24")
    private val colorBorder = Color.parseColor("#2a2a3a")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Fullscreen immersive mode
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val prefs = getSharedPreferences("claude_prefs", MODE_PRIVATE)
        val serverUrl = prefs.getString("server_url", null)

        if (serverUrl.isNullOrEmpty()) {
            showSetup()
        } else {
            currentUrl = serverUrl
            showWebView(serverUrl)
        }
    }

    private fun showSetup() {
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(80, 160, 80, 80)
            setBackgroundColor(colorBg)
        }

        // Logo/Icon
        val icon = TextView(this).apply {
            text = "⚡"
            textSize = 48f
            gravity = Gravity.CENTER
        }
        layout.addView(icon, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { bottomMargin = 32 })

        // Title
        val title = TextView(this).apply {
            text = "Claude Terminal"
            textSize = 28f
            setTextColor(colorText)
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
        }
        layout.addView(title, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { bottomMargin = 8 })

        // Subtitle
        val subtitle = TextView(this).apply {
            text = "Enter your server address"
            textSize = 16f
            setTextColor(colorTextDim)
            gravity = Gravity.CENTER
        }
        layout.addView(subtitle, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { bottomMargin = 48 })

        // Input field with rounded background
        val inputBg = GradientDrawable().apply {
            setColor(colorCard)
            cornerRadius = 24f
            setStroke(2, colorBorder)
        }
        val input = EditText(this).apply {
            hint = "http://192.168.0.61:3555"
            setText("http://192.168.0.61:3555")
            setTextColor(colorText)
            setHintTextColor(colorTextDim)
            textSize = 16f
            setPadding(48, 40, 48, 40)
            background = inputBg
            isSingleLine = true
        }
        layout.addView(input, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { bottomMargin = 24 })

        // Preset buttons row
        val presetRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
        }

        val presetBg = GradientDrawable().apply {
            setColor(colorCard)
            cornerRadius = 16f
        }

        val btnHomelab = Button(this).apply {
            text = "Homelab"
            setTextColor(colorText)
            textSize = 12f
            background = presetBg
            isAllCaps = false
            setPadding(32, 24, 32, 24)
            setOnClickListener {
                input.setText("http://192.168.0.61:3555")
            }
        }
        presetRow.addView(btnHomelab, LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f
        ).apply { marginEnd = 12 })

        val presetBg2 = GradientDrawable().apply {
            setColor(colorCard)
            cornerRadius = 16f
        }
        val btnLocalhost = Button(this).apply {
            text = "Localhost"
            setTextColor(colorText)
            textSize = 12f
            background = presetBg2
            isAllCaps = false
            setPadding(32, 24, 32, 24)
            setOnClickListener {
                input.setText("http://10.0.2.2:3555")
            }
        }
        presetRow.addView(btnLocalhost, LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f
        ))

        layout.addView(presetRow, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { bottomMargin = 48 })

        // Connect button
        val buttonBg = GradientDrawable().apply {
            setColor(colorAccent)
            cornerRadius = 28f
        }
        val button = Button(this).apply {
            text = "Connect"
            setTextColor(colorBg)
            textSize = 16f
            typeface = Typeface.DEFAULT_BOLD
            background = buttonBg
            isAllCaps = false
            setPadding(48, 40, 48, 40)
            setOnClickListener {
                var url = input.text.toString().trim()
                if (url.isEmpty()) {
                    Toast.makeText(this@MainActivity, "Please enter a URL", Toast.LENGTH_SHORT).show()
                    return@setOnClickListener
                }
                if (!url.startsWith("http://") && !url.startsWith("https://")) {
                    url = "http://$url"
                }
                getSharedPreferences("claude_prefs", MODE_PRIVATE)
                    .edit()
                    .putString("server_url", url)
                    .apply()
                currentUrl = url
                showWebView(url)
            }
        }
        layout.addView(button, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ))

        setContentView(layout)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun showWebView(url: String) {
        val container = FrameLayout(this).apply {
            setBackgroundColor(colorBg)
        }

        webView = WebView(this).apply {
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                cacheMode = WebSettings.LOAD_DEFAULT
                mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                loadWithOverviewMode = true
                useWideViewPort = true
                setSupportZoom(false)
                builtInZoomControls = false
                userAgentString = "$userAgentString ClaudeTerminalApp/1.0"
            }

            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    settingsButton?.visibility = View.GONE
                    injectHelpers()
                }

                override fun onReceivedError(
                    view: WebView?,
                    request: WebResourceRequest?,
                    error: WebResourceError?
                ) {
                    super.onReceivedError(view, request, error)
                    if (request?.isForMainFrame == true) {
                        settingsButton?.visibility = View.VISIBLE
                        showError(error?.description?.toString() ?: "Connection failed")
                    }
                }
            }

            loadUrl(url)
        }
        container.addView(webView, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ))

        // Settings button (gear icon)
        val settingsBg = GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setColor(colorCard)
            setStroke(2, colorBorder)
        }
        settingsButton = ImageButton(this).apply {
            background = settingsBg
            setColorFilter(colorText)
            setPadding(24, 24, 24, 24)
            contentDescription = "Settings"
            visibility = View.GONE
            setOnClickListener {
                showSetup()
            }
            // Simple gear using text since we can't load drawables reliably
            setImageDrawable(null)
        }

        // Use a text button instead for reliability
        val settingsTextBtn = Button(this).apply {
            text = "⚙"
            textSize = 20f
            background = settingsBg
            setPadding(24, 24, 24, 24)
            visibility = View.GONE
            setOnClickListener {
                showSetup()
            }
        }
        settingsButton = null // Not using ImageButton

        container.addView(settingsTextBtn, FrameLayout.LayoutParams(
            140, 140
        ).apply {
            gravity = Gravity.TOP or Gravity.END
            topMargin = 48
            marginEnd = 48
        })

        // Store reference for showing/hiding
        settingsTextBtn.tag = "settings"

        setContentView(container)
        hideSystemUI()
    }

    private fun showError(error: String) {
        webView?.loadDataWithBaseURL(null, """
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
                    h1 { font-size: 48px; margin-bottom: 20px; }
                    p { color: #a1a1aa; text-align: center; }
                    .url { font-family: monospace; color: #ff9100; font-size: 14px; margin: 20px 0; }
                    button {
                        background: #ff9100;
                        color: #0a0a0f;
                        border: none;
                        padding: 16px 32px;
                        border-radius: 12px;
                        font-size: 16px;
                        font-weight: 600;
                        margin: 8px;
                    }
                    button.secondary { background: #2a2a3a; color: #e4e4e7; }
                </style>
            </head>
            <body>
                <h1>⚡</h1>
                <p>Unable to connect</p>
                <p class="url">${currentUrl ?: "No URL"}</p>
                <p style="font-size: 12px;">$error</p>
                <div>
                    <button onclick="location.reload()">Retry</button>
                </div>
            </body>
            </html>
        """.trimIndent(), "text/html", "UTF-8", null)

        // Show settings button
        (webView?.parent as? FrameLayout)?.let { container ->
            for (i in 0 until container.childCount) {
                val child = container.getChildAt(i)
                if (child.tag == "settings") {
                    child.visibility = View.VISIBLE
                }
            }
        }
    }

    private fun injectHelpers() {
        webView?.evaluateJavascript("""
            (function() {
                window.sendEscKey = function() {
                    if (window.claudeSocket && window.currentSession) {
                        window.claudeSocket.emit('terminal_input', {
                            session: window.currentSession,
                            data: '\x1b'
                        });
                    }
                    var escBtn = document.getElementById('btnEsc');
                    if (escBtn) escBtn.click();
                };
                window.sendCtrlKey = function(char) {
                    var code = char.charCodeAt(0) - 96;
                    if (window.claudeSocket && window.currentSession) {
                        window.claudeSocket.emit('terminal_input', {
                            session: window.currentSession,
                            data: String.fromCharCode(code)
                        });
                    }
                };
                console.log('Claude Terminal App ready');
            })();
        """.trimIndent(), null)
    }

    // Hardware keyboard support
    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        when (keyCode) {
            KeyEvent.KEYCODE_ESCAPE -> {
                webView?.evaluateJavascript("if(window.sendEscKey) window.sendEscKey();", null)
                return true
            }
            KeyEvent.KEYCODE_BACK -> {
                if (webView?.canGoBack() == true) {
                    webView?.goBack()
                    return true
                }
            }
        }
        return super.onKeyDown(keyCode, event)
    }

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
                webView?.evaluateJavascript("if(window.sendCtrlKey) window.sendCtrlKey('$char');", null)
                return true
            }
        }
        return super.onKeyUp(keyCode, event)
    }

    override fun onResume() {
        super.onResume()
        webView?.onResume()
        hideSystemUI()
    }

    override fun onPause() {
        super.onPause()
        webView?.onPause()
    }

    private fun hideSystemUI() {
        WindowInsetsControllerCompat(window, window.decorView).let { controller ->
            controller.hide(WindowInsetsCompat.Type.systemBars())
            controller.systemBarsBehavior =
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    override fun onDestroy() {
        webView?.destroy()
        super.onDestroy()
    }
}
