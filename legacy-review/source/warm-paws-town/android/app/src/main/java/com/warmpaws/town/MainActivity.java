package com.warmpaws.town;

import com.getcapacitor.BridgeActivity;

import android.os.Bundle;
import com.warmpaws.town.ble.BleLocalPlugin;
import com.warmpaws.town.motion.MotionPlugin;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BleLocalPlugin.class);
        registerPlugin(com.warmpaws.town.location.NativeLocationPlugin.class);
        registerPlugin(MotionPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
