package com.claudeterminal

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
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

        fun setFirstRunComplete(context: Context) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putBoolean(KEY_FIRST_RUN, false).apply()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)

        val serverUrlInput = findViewById<EditText>(R.id.serverUrlInput)
        val btnPresetHomelab = findViewById<Button>(R.id.btnPresetHomelab)
        val btnPresetLocalhost = findViewById<Button>(R.id.btnPresetLocalhost)
        val btnConnect = findViewById<Button>(R.id.btnConnect)

        // Load current URL
        val currentUrl = getServerUrl(this)
        if (!currentUrl.isNullOrEmpty()) {
            serverUrlInput.setText(currentUrl)
        }

        // Quick presets
        btnPresetHomelab.setOnClickListener {
            serverUrlInput.setText("http://192.168.0.61:3555")
        }

        btnPresetLocalhost.setOnClickListener {
            serverUrlInput.setText("http://10.0.2.2:3555")
        }

        // Connect button
        btnConnect.setOnClickListener {
            var url = serverUrlInput.text.toString().trim()

            if (url.isEmpty()) {
                Toast.makeText(this, "Please enter a server address", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            // Add http if no protocol
            if (!url.startsWith("http://") && !url.startsWith("https://")) {
                url = "http://$url"
            }

            // Save to preferences
            val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putString(KEY_SERVER_URL, url).apply()
            setFirstRunComplete(this)

            Toast.makeText(this, "Connecting...", Toast.LENGTH_SHORT).show()

            // Launch main activity
            val intent = Intent(this, MainActivity::class.java)
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            startActivity(intent)
            finish()
        }
    }
}
