package com.claudeterminal

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import androidx.appcompat.app.AppCompatActivity

class SettingsActivity : AppCompatActivity() {

    companion object {
        private const val PREFS_NAME = "claude_terminal_prefs"
        private const val KEY_SERVER_URL = "server_url"
        private const val KEY_FIRST_RUN = "first_run"

        fun getServerUrl(context: Context): String? {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            return prefs.getString(KEY_SERVER_URL, null)
        }

        fun isFirstRun(context: Context): Boolean {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            return prefs.getBoolean(KEY_FIRST_RUN, true)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)

        val serverUrlInput = findViewById<EditText>(R.id.serverUrlInput)
        val btnConnect = findViewById<Button>(R.id.btnConnect)

        // Load current URL if exists
        val currentUrl = getServerUrl(this)
        if (!currentUrl.isNullOrEmpty()) {
            serverUrlInput.setText(currentUrl)
        }

        btnConnect.setOnClickListener {
            var url = serverUrlInput.text.toString().trim()

            if (url.isEmpty()) {
                url = "http://192.168.0.61:3555"
            }

            // Add http if no protocol
            if (!url.startsWith("http://") && !url.startsWith("https://")) {
                url = "http://$url"
            }

            // Save
            val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit()
                .putString(KEY_SERVER_URL, url)
                .putBoolean(KEY_FIRST_RUN, false)
                .apply()

            // Launch main
            val intent = Intent(this, MainActivity::class.java)
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            startActivity(intent)
            finish()
        }
    }
}
