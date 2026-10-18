package com.catforest.htmlcandidate;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.JsResult;
import android.webkit.JsPromptResult;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceError;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;
import android.widget.Toast;
import android.widget.EditText;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

/** Isolated full-HTML candidate. No native pet store, cloud login or automatic permissions. */
public final class MainActivity extends Activity {
    private static final String ORIGIN = "https://appassets.androidplatform.net";
    private static final String ENTRY = ORIGIN + "/offline/index.html";
    private static final int OPEN_FILE = 100, EXPORT_FILE = 101, MEDIA_PERMISSION = 102, GEO_PERMISSION = 103;
    private WebView web;
    private LocalBleBridge localBle;
    private LocalV2BleBridge localV2Ble;
    private EventDurableBridge eventDurable;
    private CatDialogueBridge dialogue;
    private String activeMode = "off";
    private TextView error;
    private ValueCallback<Uri[]> fileCallback;
    private PermissionRequest mediaRequest;
    private GeolocationPermissions.Callback geoCallback;
    private String geoOrigin;
    private String exportText;
    private boolean active, backPending;
    private int insetTop, insetRight, insetBottom, insetLeft;
    private String playerSlot;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        playerSlot = "B".equals(getIntent().getStringExtra("slot")) ? "B" : "A".equals(getIntent().getStringExtra("slot")) ? "A" : "";
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.rgb(255,250,242));
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        FrameLayout root = new FrameLayout(this);
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(255,250,242));
        root.addView(web, new FrameLayout.LayoutParams(-1,-1));
        error = new TextView(this);
        error.setTextSize(16); error.setTextColor(Color.rgb(91,70,50));
        error.setBackgroundColor(Color.rgb(255,250,242)); error.setPadding(24,60,24,24);
        error.setVisibility(View.GONE);
        error.setOnClickListener(v -> { error.setVisibility(View.GONE); web.setVisibility(View.VISIBLE); web.reload(); });
        root.addView(error, new FrameLayout.LayoutParams(-1,-1));
        setContentView(root);
        root.setOnApplyWindowInsetsListener((view,insets) -> {
            insetTop=insets.getSystemWindowInsetTop(); insetRight=insets.getSystemWindowInsetRight();
            insetBottom=insets.getSystemWindowInsetBottom(); insetLeft=insets.getSystemWindowInsetLeft();
            applyInsets(); return insets;
        });
        root.requestApplyInsets();
        configureWeb();
        web.loadUrl(ENTRY + (playerSlot.isEmpty() ? "" : "?slot=" + playerSlot));
    }
    private boolean isLocal(Uri uri) {
        return uri != null && "https".equals(uri.getScheme()) && "appassets.androidplatform.net".equals(uri.getHost()) && uri.getPath() != null && uri.getPath().startsWith("/offline/");
    }
    private boolean sameOrigin(String origin) {
        return ORIGIN.equals(origin) || (ORIGIN + "/").equals(origin);
    }
    private void configureWeb() {
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setDatabaseEnabled(true);
        web.getSettings().setGeolocationEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(true);
        web.getSettings().setMediaPlaybackRequiresUserGesture(true);
        web.getSettings().setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.getSettings().setSupportMultipleWindows(false);
        web.addJavascriptInterface(new LocalBridge(), "CatOfflineNative");
        eventDurable=new EventDurableBridge(this,web,playerSlot);
        dialogue=new CatDialogueBridge(this,web,playerSlot);
        localBle=new LocalBleBridge(this,web);
        web.addJavascriptInterface(localBle,"CatOfflineBleNative");
        localV2Ble=new LocalV2BleBridge(this,web,mode -> {
            activeMode="off";
            localBle.setForeground(false);
            if("legacy".equals(mode))localBle.setForeground(active);
            activeMode=mode;
        });
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        web.setWebViewClient(new WebViewClient() {
            @Override public void onPageStarted(WebView view,String url,Bitmap icon) {
                if(eventDurable!=null)eventDurable.onPageStarted();
                if(dialogue!=null)dialogue.onPageStarted();
                activeMode="off";
                if(localBle!=null){localBle.setForeground(false);localBle.onPageStarted(url);}
                if(localV2Ble!=null)localV2Ble.onPageStarted(url);
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return !isLocal(request.getUrl()); }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri=request.getUrl();
                if (isLocal(uri)) {
                    String name=uri.getPath().substring("/offline/".length());
                    // All generated assets are flat. No path traversal or workspace file access.
                    if (name.isEmpty() || name.contains("/") || name.contains("\\") || name.contains("..")) return blocked();
                    String mime=name.endsWith(".js")?"application/javascript":name.endsWith(".css")?"text/css":name.endsWith(".json")?"application/json":"text/html";
                    try {
                        Map<String,String> headers=new HashMap<>();
                        headers.put("Cache-Control","no-store");
                        headers.put("X-Content-Type-Options","nosniff");
                        headers.put("Content-Security-Policy","default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' data: blob:; frame-src 'none'; object-src 'none'; base-uri 'none'");
                        return new WebResourceResponse(mime,"UTF-8",200,"OK",headers,getAssets().open(name));
                    } catch (Exception failure) { return blocked(); }
                }
                if ("data".equals(uri.getScheme()) || "blob".equals(uri.getScheme())) return null;
                return blocked();
            }
            @Override public void onPageFinished(WebView view,String url) {
                applyInsets();
                if(dialogue!=null){dialogue.setForeground(active);dialogue.attachPort(url);}
                if(eventDurable!=null){eventDurable.setForeground(active);eventDurable.attachPort(url);}
                if(localV2Ble!=null){localV2Ble.setForeground(active);localV2Ble.attachPort(url);}
                if(active)evaluate("window.CatOfflineHost&&window.CatOfflineHost.resume()");
            }
            @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError failure) {
                if (request.isForMainFrame()) showError("房间暂时无法打开。点这里重试，原存档会保留。");
            }
            @Override public boolean onRenderProcessGone(WebView view,android.webkit.RenderProcessGoneDetail detail) {
                showError("房间显示已暂停。请重新打开此测试应用，原存档会保留。",false);
                rootRemove(view); return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onJsAlert(WebView view,String url,String message,JsResult result) {
                new AlertDialog.Builder(MainActivity.this).setMessage(message).setPositiveButton("知道了",(d,w)->result.confirm()).setOnCancelListener(d->result.cancel()).show(); return true;
            }
            @Override public boolean onJsConfirm(WebView view,String url,String message,JsResult result) {
                new AlertDialog.Builder(MainActivity.this).setMessage(message).setPositiveButton("确认",(d,w)->result.confirm()).setNegativeButton("取消",(d,w)->result.cancel()).setOnCancelListener(d->result.cancel()).show(); return true;
            }
            @Override public boolean onJsPrompt(WebView view,String url,String message,String initial,JsPromptResult result) {
                EditText input=new EditText(MainActivity.this);input.setText(initial);input.setSingleLine(false);
                new AlertDialog.Builder(MainActivity.this).setMessage(message).setView(input).setPositiveButton("确认",(d,w)->result.confirm(input.getText().toString())).setNegativeButton("取消",(d,w)->result.cancel()).setOnCancelListener(d->result.cancel()).show();return true;
            }
            @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params) {
                if (fileCallback!=null) fileCallback.onReceiveValue(null);
                fileCallback=callback;
                Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE);
                String[] accepted=params.getAcceptTypes();
                intent.setType(accepted.length==1 && !accepted[0].isEmpty()?accepted[0]:"*/*");
                if (accepted.length>1) intent.putExtra(Intent.EXTRA_MIME_TYPES,accepted);
                try { startActivityForResult(intent,OPEN_FILE); } catch (Exception e) { callback.onReceiveValue(null);fileCallback=null; }
                return true;
            }
            @Override public void onPermissionRequest(PermissionRequest request) { runOnUiThread(() -> requestMedia(request)); }
            @Override public void onPermissionRequestCanceled(PermissionRequest request) { if (mediaRequest==request) mediaRequest=null; }
            @Override public void onGeolocationPermissionsShowPrompt(String origin,GeolocationPermissions.Callback callback) {
                if (!active || !sameOrigin(origin) || geoCallback!=null) { callback.invoke(origin,false,false);return; }
                if (checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED || checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED) { callback.invoke(origin,true,false);return; }
                geoOrigin=origin;geoCallback=callback;
                requestPermissions(new String[]{Manifest.permission.ACCESS_COARSE_LOCATION,Manifest.permission.ACCESS_FINE_LOCATION},GEO_PERMISSION);
            }
            @Override public void onGeolocationPermissionsHidePrompt() { denyGeo(); }
        });
    }
    private WebResourceResponse blocked() {
        return new WebResourceResponse("text/plain","UTF-8",403,"Unavailable in offline candidate",new HashMap<>(),new ByteArrayInputStream(new byte[0]));
    }
    private void rootRemove(WebView view) {
        if(dialogue!=null){dialogue.dispose();dialogue=null;}
        if(eventDurable!=null){eventDurable.dispose();eventDurable=null;}
        if(localV2Ble!=null){localV2Ble.dispose();localV2Ble=null;}
        if(localBle!=null){localBle.dispose();localBle=null;}
        if (view.getParent() instanceof android.view.ViewGroup) ((android.view.ViewGroup)view.getParent()).removeView(view);
        view.destroy();web=null;
        error.setOnClickListener(v->recreate());
    }
    private void showError(String text) { showError(text,true); }
    private void showError(String text,boolean suspendJs) {
        if(dialogue!=null)dialogue.setForeground(false);
        if(eventDurable!=null)eventDurable.setForeground(false);
        activeMode="off";
        if(localBle!=null)localBle.setForeground(false);
        if(localV2Ble!=null)localV2Ble.setForeground(false);
        if(suspendJs)evaluate("window.CatOfflineHost&&window.CatOfflineHost.suspend()");
        error.setText(text);error.setVisibility(View.VISIBLE);if(web!=null)web.setVisibility(View.GONE);
    }
    private void evaluate(String script) { if(web!=null)web.evaluateJavascript(script,null); }
    private void applyInsets() {
        float density=getResources().getDisplayMetrics().density;
        evaluate("(()=>{const root=document.documentElement;if(!root)return;const s=root.style;s.setProperty('--safe-area-inset-top','"+(insetTop/density)+"px');s.setProperty('--safe-area-inset-right','"+(insetRight/density)+"px');s.setProperty('--safe-area-inset-bottom','"+(insetBottom/density)+"px');s.setProperty('--safe-area-inset-left','"+(insetLeft/density)+"px')})()");
    }
    private void requestMedia(PermissionRequest request) {
        if (!active || !sameOrigin(request.getOrigin().toString()) || mediaRequest!=null) { request.deny();return; }
        ArrayList<String> permissions=new ArrayList<>();
        for (String resource:request.getResources()) {
            String permission=PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)?Manifest.permission.CAMERA:PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)?Manifest.permission.RECORD_AUDIO:null;
            if (permission==null) { request.deny();return; }
            if (checkSelfPermission(permission)!=PackageManager.PERMISSION_GRANTED) permissions.add(permission);
        }
        if (permissions.isEmpty()) { request.grant(request.getResources());return; }
        mediaRequest=request;requestPermissions(permissions.toArray(new String[0]),MEDIA_PERMISSION);
    }
    private void denyGeo() {
        if (geoCallback!=null) { geoCallback.invoke(geoOrigin,false,false);geoCallback=null;geoOrigin=null; }
    }
    @Override public void onRequestPermissionsResult(int code,String[] permissions,int[] results) {
        super.onRequestPermissionsResult(code,permissions,results);
        if(localV2Ble!=null&&localV2Ble.onRequestPermissionsResult(code,permissions,results))return;
        if(localBle!=null&&localBle.onRequestPermissionsResult(code,permissions,results))return;
        if (code==MEDIA_PERMISSION && mediaRequest!=null) {
            PermissionRequest request=mediaRequest;mediaRequest=null;
            // Recheck platform state; backgrounded Activity never grants capture.
            boolean granted=active && results.length>0;
            for(int result:results)if(result!=PackageManager.PERMISSION_GRANTED)granted=false;
            if(granted)request.grant(request.getResources());else request.deny();
        }
        if (code==GEO_PERMISSION && geoCallback!=null) {
            boolean granted=active&&(checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED || checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED);
            geoCallback.invoke(geoOrigin,granted,false);geoCallback=null;geoOrigin=null;
        }
    }
    public final class LocalBridge {
        @JavascriptInterface public void exportSave(String filename,String text) {
            runOnUiThread(() -> {
                if(!active||exportText!=null||text==null||text.length()>8_000_000)return;
                exportText=text;
                Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("application/json");
                intent.putExtra(Intent.EXTRA_TITLE,filename.replaceAll("[\\\\/:*?\"<>|]","-").substring(0,Math.min(120,filename.length())));
                try{startActivityForResult(intent,EXPORT_FILE);}catch(Exception e){exportText=null;toast("未能打开文件保存位置。");}
            });
        }
        @JavascriptInterface public void openPlayer(String slot) {
            runOnUiThread(() -> { if(active) startActivity(new Intent(MainActivity.this,MainActivity.class).putExtra("slot","B".equals(slot)?"B":"A")); });
        }
    }
    @Override protected void onActivityResult(int request,int result,Intent data) {
        super.onActivityResult(request,result,data);
        if(request==OPEN_FILE&&fileCallback!=null){fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result,data));fileCallback=null;}
        if(request==EXPORT_FILE&&exportText!=null){
            String text=exportText;exportText=null;
            if(result==RESULT_OK&&data!=null&&data.getData()!=null){
                try(OutputStream output=getContentResolver().openOutputStream(data.getData(),"wt")){if(output==null)throw new Exception();output.write(text.getBytes(StandardCharsets.UTF_8));toast("存档已导出。");}
                catch(Exception e){toast("导出未完成，原存档仍在本机。");}
            }
        }
    }
    private void toast(String text) { Toast.makeText(this,text,Toast.LENGTH_SHORT).show(); }
    @Override public void onBackPressed() {
        if(web==null){super.onBackPressed();return;}
        if(backPending)return;backPending=true;
        web.evaluateJavascript("Boolean(window.CatOfflineHost&&window.CatOfflineHost.handleBack())",value->{backPending=false;if(!"true".equals(value))MainActivity.super.onBackPressed();});
    }
    @Override protected void onResume() {
        super.onResume();active=true;
        if(dialogue!=null)dialogue.setForeground(true);
        if(eventDurable!=null)eventDurable.setForeground(true);
        if(localBle!=null)localBle.setForeground("legacy".equals(activeMode));
        if(localV2Ble!=null)localV2Ble.setForeground(true);
        if(web!=null){web.onResume();evaluate("window.CatOfflineHost&&window.CatOfflineHost.resume()");}
    }
    @Override protected void onPause() {
        active=false;denyGeo();if(mediaRequest!=null){mediaRequest.deny();mediaRequest=null;}
        if(dialogue!=null)dialogue.setForeground(false);
        if(eventDurable!=null)eventDurable.setForeground(false);
        if(localBle!=null)localBle.setForeground(false);
        if(localV2Ble!=null)localV2Ble.setForeground(false);
        if(web!=null){evaluate("window.CatOfflineHost&&window.CatOfflineHost.suspend()");web.onPause();}
        super.onPause();
    }
    @Override protected void onDestroy() {
        if(dialogue!=null){dialogue.dispose();dialogue=null;}
        if(eventDurable!=null){eventDurable.dispose();eventDurable=null;}
        if(localV2Ble!=null){localV2Ble.dispose();localV2Ble=null;}
        if(localBle!=null){localBle.dispose();localBle=null;}
        if(fileCallback!=null){fileCallback.onReceiveValue(null);fileCallback=null;}
        if(web!=null){web.removeJavascriptInterface("CatOfflineBleNative");web.removeJavascriptInterface("CatOfflineNative");web.destroy();web=null;}
        super.onDestroy();
    }
}
