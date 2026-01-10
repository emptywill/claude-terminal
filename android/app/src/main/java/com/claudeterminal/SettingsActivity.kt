package com.claudeterminal

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.claudeterminal.databinding.ActivitySettingsBinding

class SettingsActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySettingsBinding
    private lateinit var prefs: SharedPreferences

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
        binding = ActivitySettingsBinding.inflate(layoutInflater)
        setContentView(binding.root)

        prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        // Load current URL
        val currentUrl = prefs.getString(KEY_SERVER_URL, "")
        binding.serverUrlInput.setText(currentUrl)

        // Protocol toggle
        binding.protocolToggle.check(
            if (currentUrl?.startsWith("https") == true) R.id.btnHttps else R.id.btnHttp
        )

        // Quick presets
        binding.btnPresetLocal.setOnClickListener {
            binding.serverUrlInput.setText("192.168.0.61:3555")
            binding.protocolToggle.check(R.id.btnHttp)
        }

        binding.btnPresetLocalhost.setOnClickListener {
            binding.serverUrlInput.setText("localhost:3000")
            binding.protocolToggle.check(R.id.btnHttp)
        }

        // Save button
        binding.btnSave.setOnClickListener {
            saveAndConnect()
        }

        // Back button
        binding.btnBack.setOnClickListener {
            finish()
        }

        // If first run, hide back button
        if (isFirstRun(this)) {
            binding.btnBack.visibility = android.view.View.GONE
            binding.headerTitle.text = "Welcome to Claude Terminal"
            binding.headerSubtitle.text = "Enter your server address to get started"
        }
    }

    private fun saveAndConnect() {
        var url = binding.serverUrlInput.text.toString().trim()

        if (url.isEmpty()) {
            Toast.makeText(this, "Please enter a server address", Toast.LENGTH_SHORT).show()
            return
        }

        // Remove any existing protocol
        url = url.removePrefix("http://").removePrefix("https://")

        // Add selected protocol
        val protocol = if (binding.protocolToggle.checkedButtonId == R.id.btnHttps) "https" else "http"
        val fullUrl = "$protocol://$url"

        // Save to preferences
        prefs.edit().putString(KEY_SERVER_URL, fullUrl).apply()
        setFirstRunComplete(this)

        Toast.makeText(this, "Connecting to $fullUrl", Toast.LENGTH_SHORT).show()

        // Launch main activity
        val intent = Intent(this, MainActivity::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        finish()
    }

    override fun onBackPressed() {
        // Prevent back if first run (must configure server)
        if (!isFirstRun(this)) {
            super.onBackPressed()
        }
    }
}
