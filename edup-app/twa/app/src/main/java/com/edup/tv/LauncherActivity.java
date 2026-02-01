package com.edup.tv;

import android.net.Uri;
import android.os.Bundle;
import androidx.browser.customtabs.CustomTabsIntent;
import androidx.browser.trusted.TrustedWebActivityIntentBuilder;
import com.google.androidbrowserhelper.trusted.TwaLauncher;

public class LauncherActivity extends android.app.Activity {
    private TwaLauncher mTwaLauncher;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        mTwaLauncher = new TwaLauncher(this);
        mTwaLauncher.launch(
            new TrustedWebActivityIntentBuilder(Uri.parse("https://edup-nine.vercel.app/")),
            null, null, null
        );
        finish();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (mTwaLauncher != null) {
            mTwaLauncher.destroy();
        }
    }
}
