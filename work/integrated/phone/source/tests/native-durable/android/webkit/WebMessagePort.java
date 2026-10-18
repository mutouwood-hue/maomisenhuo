package android.webkit;
public class WebMessagePort {public abstract static class WebMessageCallback{public void onMessage(WebMessagePort p,WebMessage m){}}public void setWebMessageCallback(WebMessageCallback c){}public void postMessage(WebMessage m){}public void close(){}}
