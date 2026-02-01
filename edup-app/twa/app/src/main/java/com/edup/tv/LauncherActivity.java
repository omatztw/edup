package com.edup.tv;

import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebSettings;
import android.view.KeyEvent;
import androidx.browser.trusted.TrustedWebActivityIntentBuilder;
import com.google.androidbrowserhelper.trusted.TwaLauncher;

public class LauncherActivity extends android.app.Activity {
    private static final String URL = "https://edup-nine.vercel.app/";
    private TwaLauncher mTwaLauncher;
    private WebView mWebView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Try TWA first, fall back to WebView
        try {
            mTwaLauncher = new TwaLauncher(this);
            mTwaLauncher.launch(
                new TrustedWebActivityIntentBuilder(Uri.parse(URL)),
                null,
                null,
                new Runnable() {
                    @Override
                    public void run() {
                        // TWA launch failed - fall back to WebView
                        runOnUiThread(() -> launchWebView());
                    }
                }
            );
        } catch (Exception e) {
            launchWebView();
        }
    }

    private void launchWebView() {
        mWebView = new WebView(this);
        setContentView(mWebView);

        WebSettings settings = mWebView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setUserAgentString(settings.getUserAgentString() + " EdupTV/1.0");

        mWebView.setWebViewClient(new WebViewClient());
        mWebView.requestFocus();
        mWebView.loadUrl(URL);
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (mWebView != null && keyCode == KeyEvent.KEYCODE_BACK && mWebView.canGoBack()) {
            mWebView.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (mTwaLauncher != null) {
            mTwaLauncher.destroy();
        }
        if (mWebView != null) {
            mWebView.destroy();
        }
    }
}
