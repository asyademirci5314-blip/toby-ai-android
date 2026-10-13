package com.toby.ai;

import android.app.Activity;
import android.Manifest;
import android.content.pm.PackageManager;
import android.webkit.PermissionRequest;
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
    private static final int MIC_PERMISSION_REQUEST = 4102;

    private void requestMicrophonePermission() {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(
                new String[] { Manifest.permission.RECORD_AUDIO },
                MIC_PERMISSION_REQUEST
            );
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        prefs = getSharedPreferences("TobySettings", MODE_PRIVATE);

        webView = new WebView(this);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> {
                    boolean wantsAudio = false;

                    for (String resource : request.getResources()) {
                        if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) {
                            wantsAudio = true;
                        }
                    }

                    if (wantsAudio &&
                        checkSelfPermission(Manifest.permission.RECORD_AUDIO)
                            == PackageManager.PERMISSION_GRANTED) {
                        request.grant(new String[] {
                            PermissionRequest.RESOURCE_AUDIO_CAPTURE
                        });
                    } else {
                        request.deny();
                        if (wantsAudio) {
                            requestMicrophonePermission();
                        }
                    }
                });
            }
        });
        webView.addJavascriptInterface(new TobyBridge(), "TobyAndroid");

        setContentView(webView);
        webView.loadUrl("file:///android_asset/index.html");
    }

    @Override
    public void onRequestPermissionsResult(
            int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode == MIC_PERMISSION_REQUEST &&
                grantResults.length > 0 &&
                grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            Toast.makeText(this,
                "Mikrofon izni verildi. Toby'de sesli komutu yeniden başlat.",
                Toast.LENGTH_LONG).show();
        }
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
