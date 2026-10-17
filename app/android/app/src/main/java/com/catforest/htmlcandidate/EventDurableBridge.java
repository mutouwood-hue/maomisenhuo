package com.catforest.htmlcandidate;

import android.app.Activity;
import android.net.Uri;
import android.system.Os;
import android.system.OsConstants;
import android.util.AtomicFile;
import android.webkit.WebMessage;
import android.webkit.WebMessagePort;
import android.webkit.WebView;
import org.json.JSONObject;
import org.json.JSONArray;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileDescriptor;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

/** Private main-frame storage. No Bluetooth, network, permissions or JavascriptInterface. */
public final class EventDurableBridge {
    private static final String ORIGIN="https://appassets.androidplatform.net";
    private static final int MAX_BYTES=8_000_000;
    private static final long MAX_REVISION=9_007_199_254_740_991L;
    private static final Object FILE_LOCK=new Object();
    private static final Set<String> KEYS=new HashSet<>(Arrays.asList("pixel-cat-pet-v1","pg-social-v1","cat-cflocal2-source-identities-v1","cat-cflocal2-journal-v1","cat-cflocal2-event-ledger-v1","cat-cflocal2-memorial-v1","cat-cflocal2-commit-marker"));
    private final Activity activity;
    private final WebView web;
    private final String slot;
    private final AtomicFile file;
    private final ThreadPoolExecutor worker=new ThreadPoolExecutor(1,1,0L,TimeUnit.MILLISECONDS,new ArrayBlockingQueue<>(8));
    private WebMessagePort port,transfer;
    private long epoch;
    private volatile boolean foreground,disposed;

    public EventDurableBridge(Activity activity,WebView web,String slot){
        this.activity=activity;this.web=web;this.slot=slot;
        file=new AtomicFile(new File(activity.getFilesDir(),"cflocal2-authority-"+(slot.isEmpty()?"main":slot)+".json"));
    }
    static boolean trusted(String url,String slot){
        try {Uri u=Uri.parse(url);String expected=slot.isEmpty()?null:"slot="+slot;
            return "https".equals(u.getScheme())&&"appassets.androidplatform.net".equals(u.getHost())&&(u.getPort()==-1||u.getPort()==443)&&u.getUserInfo()==null&&"/offline/index.html".equals(u.getPath())&&u.getFragment()==null&&java.util.Objects.equals(expected,u.getQuery());
        }catch(Exception e){return false;}
    }
    public void onPageStarted(){epoch++;closePorts();}
    public void setForeground(boolean value){foreground=value;sendState();}
    public void attachPort(String url){
        if(disposed||!trusted(url,slot)||!trusted(web.getUrl(),slot))return;
        if(port!=null)return;final long generation=++epoch;
        WebMessagePort[] pair=web.createWebMessageChannel();port=pair[0];transfer=pair[1];
        final WebMessagePort accepted=port;
        port.setWebMessageCallback(new WebMessagePort.WebMessageCallback(){
            @Override public void onMessage(WebMessagePort sender,WebMessage message){
                if(disposed||sender!=accepted||generation!=epoch||!trusted(web.getUrl(),slot))return;
                String raw=message.getData();
                if(message.getPorts()!=null&&message.getPorts().length!=0)return;
                if(raw==null||raw.length()>MAX_BYTES)return;
                try {worker.execute(()->handle(raw,generation,accepted));}
                catch(RuntimeException busy){replyFailure(null,"STORE_BUSY","原生存档队列繁忙，请稍后重试。",generation,accepted);}
            }
        });
        String token="cat-durable-port:"+UUID.randomUUID();
        web.evaluateJavascript("Boolean(window===window.top&&window.CatOfflineDurable&&window.CatOfflineDurable.preparePort("+JSONObject.quote(token)+"))",result->{
            if(!"true".equals(result)||generation!=epoch||port!=accepted)return;
            web.postWebMessage(new WebMessage(token,new WebMessagePort[]{transfer}),Uri.parse(ORIGIN));
        });
    }
    private static void exact(JSONObject value,String... allowed)throws Exception{
        Set<String> permitted=new HashSet<>(Arrays.asList(allowed));Iterator<String> keys=value.keys();while(keys.hasNext())if(!permitted.contains(keys.next()))throw new Exception("Unknown field");
    }
    private static String hash(String value)throws Exception{
        byte[] digest=MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));StringBuilder out=new StringBuilder();for(byte x:digest)out.append(String.format(java.util.Locale.ROOT,"%02x",x&255));return out.toString();
    }
    private static long exactInteger(JSONObject value,String key)throws Exception{
        Object raw=value.get(key);if(!(raw instanceof Integer)&&!(raw instanceof Long))throw new Exception("Integer required");
        long number=((Number)raw).longValue();if(number<0||number>MAX_REVISION)throw new Exception("Integer out of range");return number;
    }
    private JSONObject read()throws Exception{
        if(!file.getBaseFile().exists()&&!new File(file.getBaseFile().getPath()+".bak").exists())return new JSONObject().put("schema",1).put("revision",0).put("entries",new JSONObject());
        byte[] data;
        try(InputStream in=file.openRead();ByteArrayOutputStream out=new ByteArrayOutputStream()){
            byte[] chunk=new byte[8192];int n;while((n=in.read(chunk))!=-1){if(out.size()+n>MAX_BYTES)throw new Exception("Authority file too large");out.write(chunk,0,n);}data=out.toByteArray();
        }
        JSONObject envelope=new JSONObject(new String(data,StandardCharsets.UTF_8));exact(envelope,"body","sha256");String body=envelope.getString("body");
        if(!hash(body).equals(envelope.getString("sha256")))throw new Exception("Authority checksum mismatch");
        JSONObject value=new JSONObject(body);exact(value,"schema","revision","entries");
        if(exactInteger(value,"schema")!=1||exactInteger(value,"revision")<0)throw new Exception("Authority schema invalid");
        validateEntries(value.getJSONObject("entries"));validateMemorialSeal(value.getJSONObject("entries"));return value;
    }
    private static final String MEMORIAL_KEY="cat-cflocal2-memorial-v1";
    private static final int MAX_PHOTO_CHARS=160_000,MAX_MEMORIAL_CHARS=1_200_000,MAX_PHOTOS=64;
    // Android JSONObject.quote 会额外转义斜杠；共享摘要使用 JS JSON.stringify 的字符串规则。
    private static String canonicalString(String value){
        StringBuilder result=new StringBuilder("\"");
        for(int i=0;i<value.length();i++){
            char c=value.charAt(i);
            switch(c){
                case '"':result.append("\\\"");break;
                case '\\':result.append("\\\\");break;
                case '\b':result.append("\\b");break;
                case '\f':result.append("\\f");break;
                case '\n':result.append("\\n");break;
                case '\r':result.append("\\r");break;
                case '\t':result.append("\\t");break;
                default:
                    boolean loneSurrogate=Character.isHighSurrogate(c)?i+1>=value.length()||!Character.isLowSurrogate(value.charAt(i+1)):Character.isLowSurrogate(c)&&(i==0||!Character.isHighSurrogate(value.charAt(i-1)));
                    if(c<0x20||loneSurrogate)result.append(String.format(java.util.Locale.ROOT,"\\u%04x",(int)c));else result.append(c);
            }
        }
        return result.append('"').toString();
    }
    private static String canonical(Object value)throws Exception{
        if(value instanceof JSONObject){JSONObject object=(JSONObject)value;java.util.List<String> names=new java.util.ArrayList<>();object.keys().forEachRemaining(names::add);java.util.Collections.sort(names);StringBuilder result=new StringBuilder("{");for(String key:names){if(result.length()>1)result.append(',');result.append(canonicalString(key)).append(':').append(canonical(object.get(key)));}return result.append('}').toString();}
        if(value instanceof JSONArray){JSONArray array=(JSONArray)value;StringBuilder result=new StringBuilder("[");for(int i=0;i<array.length();i++){if(i>0)result.append(',');result.append(canonical(array.get(i)));}return result.append(']').toString();}
        if(value==null||value==JSONObject.NULL)return "null";
        if(value instanceof String)return canonicalString((String)value);
        if(value instanceof Boolean)return value.toString();
        if(value instanceof Number){double number=((Number)value).doubleValue();if(Double.isNaN(number)||Double.isInfinite(number))throw new Exception("Non-finite canonical number");return JSONObject.numberToString((Number)value);}
        throw new Exception("Canonical type denied");
    }
    // 不接受任意localStorage照片键；仅验证固定包中与游戏毕业记录绑定的JPEG。
    private static void validateMemorial(JSONObject entries)throws Exception{
        if(!entries.has(MEMORIAL_KEY))return;
        String raw=entries.getString(MEMORIAL_KEY);if(raw.length()>MAX_MEMORIAL_CHARS)throw new Exception("Memorial too large");
        JSONObject bundle=new JSONObject(raw);exact(bundle,"schema","photos");if(exactInteger(bundle,"schema")!=1)throw new Exception("Memorial schema invalid");
        JSONArray photos=bundle.getJSONArray("photos");if(photos.length()>MAX_PHOTOS)throw new Exception("Too many photos");Set<String> seen=new HashSet<>();
        for(int i=0;i<photos.length();i++){
            JSONObject photo=photos.getJSONObject(i);exact(photo,"key","type","graduateDigest","sha256","data");
            Object keyValue=photo.get("key"),typeValue=photo.get("type"),dataValue=photo.get("data");if(!(keyValue instanceof String)||!(typeValue instanceof String)||!(dataValue instanceof String))throw new Exception("Photo type invalid");
            String key=(String)keyValue,data=(String)dataValue;
            if(!key.matches("pet-grad-photo:cat-[1-9][0-9]{0,12}")||!seen.add(key)||!"image/jpeg".equals(typeValue)||data.length()>MAX_PHOTO_CHARS||!data.matches("data:image/jpeg;base64,/9j/[A-Za-z0-9+/]*={0,2}")||(data.length()-23)%4!=0||!hash(data).equals(photo.get("sha256"))||!(photo.get("graduateDigest") instanceof String)||!photo.getString("graduateDigest").matches("[0-9a-f]{64}"))throw new Exception("Photo denied");
        }
    }
    private static void validateMemorialSeal(JSONObject entries)throws Exception{
        validateMemorial(entries);if(!entries.has(MEMORIAL_KEY))return;
        String token=entries.getString("cat-cflocal2-commit-marker");JSONObject game=new JSONObject(entries.getString("pixel-cat-pet-v1")),social=new JSONObject(entries.getString("pg-social-v1")),ledger=new JSONObject(entries.getString("cat-cflocal2-event-ledger-v1"));
        if(!token.matches("[0-9a-fA-F-]{36}")||!token.equals(game.getString("__cflocal2Commit"))||!token.equals(social.getString("__cflocal2Commit"))||!token.equals(ledger.getString("commitToken"))||!ledger.isNull("pending"))throw new Exception("Memorial seal mismatch");
        JSONArray graduates=game.optJSONArray("graduates"),photos=new JSONObject(entries.getString(MEMORIAL_KEY)).getJSONArray("photos");
        for(int i=0;i<photos.length();i++){JSONObject photo=photos.getJSONObject(i);String id=photo.getString("key").substring(15);boolean found=false;if(graduates!=null)for(int j=0;j<graduates.length();j++){JSONObject graduate=graduates.getJSONObject(j);if(id.equals(graduate.optString("id"))&&hash(canonical(graduate)).equals(photo.getString("graduateDigest")))found=true;}if(!found)throw new Exception("Photo graduate mismatch");}
    }
    private static void validateEntries(JSONObject entries)throws Exception{
        if(entries.length()>KEYS.size())throw new Exception("Too many storage keys");Iterator<String> keys=entries.keys();int bytes=0;
        while(keys.hasNext()){String key=keys.next();Object value=entries.get(key);if(!KEYS.contains(key)||!(value instanceof String))throw new Exception("Storage key denied");bytes+=((String)value).getBytes(StandardCharsets.UTF_8).length;if(bytes>MAX_BYTES/2)throw new Exception("Storage payload exceeds bound");}
    }
    private JSONObject commit(JSONObject request)throws Exception{
        if(!foreground)throw new Exception("Application is not foreground");
        JSONObject old=read(),updates=request.getJSONObject("updates");validateEntries(updates);if(updates.length()==0)throw new Exception("Empty checkpoint");
        long expected=exactInteger(request,"expectedRevision"),revision=exactInteger(old,"revision");JSONObject entries=old.getJSONObject("entries");
        boolean same=true;Iterator<String> names=updates.keys();while(names.hasNext()){String key=names.next();if(!updates.getString(key).equals(entries.optString(key,null)))same=false;}
        if(expected!=revision)throw new Exception("Storage revision conflict");
        if(same){try(FileOutputStream existing=new FileOutputStream(file.getBaseFile(),true)){existing.getFD().sync();}syncDirectory();return certificate(old,updates);}
        if(revision==MAX_REVISION)throw new Exception("Storage revision conflict");
        JSONObject nextEntries=new JSONObject(entries.toString());names=updates.keys();while(names.hasNext()){String key=names.next();nextEntries.put(key,updates.getString(key));}validateEntries(nextEntries);validateMemorialSeal(nextEntries);
        JSONObject next=new JSONObject().put("schema",1).put("revision",revision+1).put("entries",nextEntries);
        String body=next.toString();byte[] bytes=new JSONObject().put("body",body).put("sha256",hash(body)).toString().getBytes(StandardCharsets.UTF_8);
        if(bytes.length>MAX_BYTES)throw new Exception("Encoded authority exceeds bound");
        FileOutputStream stream=null;
        try {
            stream=file.startWrite();stream.write(bytes);stream.flush();stream.getFD().sync();
            file.finishWrite(stream);stream=null;
            // Sync the directory entry after AtomicFile renames the new base.
            syncDirectory();
            JSONObject verify=read();
            if(verify.getLong("revision")!=revision+1||!hash(verify.toString()).equals(hash(next.toString())))throw new Exception("Authority readback mismatch");
            return certificate(verify,updates);
        }catch(Exception failure){if(stream!=null)file.failWrite(stream);throw failure;}
    }
    private void syncDirectory()throws Exception{
        FileDescriptor directory=Os.open(file.getBaseFile().getParent(),OsConstants.O_RDONLY,0);
        try{if(!OsConstants.S_ISDIR(Os.fstat(directory).st_mode))throw new Exception("Authority parent is not a directory");Os.fsync(directory);}finally{Os.close(directory);}
    }
    private JSONObject certificate(JSONObject value,JSONObject requested)throws Exception{
        JSONObject hashes=new JSONObject();Iterator<String> names=requested.keys();while(names.hasNext()){String key=names.next();hashes.put(key,hash(value.getJSONObject("entries").getString(key)));}
        return new JSONObject().put("persisted",true).put("revision",value.getLong("revision")).put("hashes",hashes).put("foreground",foreground);
    }
    private void handle(String raw,long generation,WebMessagePort accepted){
        String requestId=null;
        try {
            JSONObject request=new JSONObject(raw);requestId=request.getString("requestId");
            if(!requestId.matches("[A-Za-z0-9_-]{1,128}"))throw new Exception("Invalid request id");
            String op=request.getString("op");JSONObject result;
            synchronized(FILE_LOCK){
                if("read".equals(op)){exact(request,"requestId","op");result=read().put("foreground",foreground);}
                else if("commit".equals(op)){exact(request,"requestId","op","expectedRevision","updates");result=commit(request);}
                else throw new Exception("Storage operation denied");
            }
            JSONObject response=new JSONObject().put("requestId",requestId).put("ok",true).put("result",result);post(response,generation,accepted);
        }catch(Exception error){replyFailure(requestId,"DURABLE_STORE_FAILED","原生持久存档未确认，设备事件与未知指令已保留。",generation,accepted);}
    }
    private void replyFailure(String id,String code,String message,long generation,WebMessagePort accepted){try{post(new JSONObject().put("requestId",id==null?JSONObject.NULL:id).put("ok",false).put("error",new JSONObject().put("code",code).put("message",message).put("outcome","unknown")),generation,accepted);}catch(Exception ignored){}}
    private void post(JSONObject response,long generation,WebMessagePort accepted){activity.runOnUiThread(()->{if(disposed||generation!=epoch||port!=accepted||!trusted(web.getUrl(),slot))return;try{accepted.postMessage(new WebMessage(response.toString()));}catch(RuntimeException ignored){}});}
    private void sendState(){if(port!=null)try{port.postMessage(new WebMessage(new JSONObject().put("type","foreground").put("foreground",foreground).toString()));}catch(Exception ignored){}}
    private void closePorts(){try{if(port!=null)port.close();}catch(RuntimeException ignored){}try{if(transfer!=null)transfer.close();}catch(RuntimeException ignored){}port=null;transfer=null;}
    public void dispose(){disposed=true;epoch++;closePorts();worker.shutdown();}
}
