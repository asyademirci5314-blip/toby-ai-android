package com.toby.ai;

import android.app.Activity;
import android.os.Bundle;
import android.content.SharedPreferences;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.JavascriptInterface;
import android.view.WindowManager;
import android.widget.Toast;

public class MainActivity extends Activity {
    private WebView webView;
    private SharedPreferences prefs;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        prefs = getSharedPreferences("TobySettings", MODE_PRIVATE);

        webView = new WebView(this);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient());
        webView.addJavascriptInterface(new TobyBridge(), "TobyAndroid");

        setContentView(webView);
        webView.loadUrl("file:///android_asset/index.html");
    }

    public class TobyBridge {
        @JavascriptInterface
        public String verifyOrSetPin(String pin) {
            if (pin == null || !pin.matches("[0-9]{4}")) {
                return "INVALID";
            }

            String saved = prefs.getString("pin", null);

            if (saved == null) {
                prefs.edit().putString("pin", pin).apply();
                return "SET";
            }

            return saved.equals(pin) ? "OK" : "WRONG";
        }

        @JavascriptInterface
        public void setBrightness(int percent) {
            runOnUiThread(() -> {
                WindowManager.LayoutParams params =
                    getWindow().getAttributes();
                params.screenBrightness =
                    Math.max(0.1f, Math.min(1.0f, percent / 100f));
                getWindow().setAttributes(params);
            });
        }

        @JavascriptInterface
        public void showMessage(String message) {
            runOnUiThread(() ->
                Toast.makeText(MainActivity.this, message,
                    Toast.LENGTH_SHORT).show()
            );
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
