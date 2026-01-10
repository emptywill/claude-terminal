package com.claudeterminal

import android.os.Bundle
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private var webView: WebView? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val prefs = getSharedPreferences("claude_prefs", MODE_PRIVATE)
        val serverUrl = prefs.getString("server_url", null)

        if (serverUrl.isNullOrEmpty()) {
            showSetup()
        } else {
            showWebView(serverUrl)
        }
    }

    private fun showSetup() {
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(64, 128, 64, 64)
            setBackgroundColor(0xFF0a0a0f.toInt())
        }

        val title = TextView(this).apply {
            text = "Claude Terminal"
            textSize = 24f
            setTextColor(0xFFff9100.toInt())
        }
        layout.addView(title)

        val input = EditText(this).apply {
            hint = "Server URL (e.g. http://192.168.0.61:3555)"
            setText("http://192.168.0.61:3555")
            setTextColor(0xFFe4e4e7.toInt())
            setHintTextColor(0xFF71717a.toInt())
        }
        layout.addView(input)

        val button = Button(this).apply {
            text = "Connect"
            setOnClickListener {
                val url = input.text.toString().trim()
                if (url.isNotEmpty()) {
                    getSharedPreferences("claude_prefs", MODE_PRIVATE)
                        .edit()
                        .putString("server_url", url)
                        .apply()
                    showWebView(url)
                }
            }
        }
        layout.addView(button)

        setContentView(layout)
    }

    private fun showWebView(url: String) {
        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            webViewClient = WebViewClient()
            loadUrl(url)
        }
        setContentView(webView)
    }

    override fun onDestroy() {
        webView?.destroy()
        super.onDestroy()
    }
}
