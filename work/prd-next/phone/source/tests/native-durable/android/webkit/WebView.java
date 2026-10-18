package android.webkit;
public class WebView {public String getUrl(){return "https://appassets.androidplatform.net/offline/index.html";}public WebMessagePort[] createWebMessageChannel(){return new WebMessagePort[]{new WebMessagePort(),new WebMessagePort()};}public void evaluateJavascript(String s,java.util.function.Consumer<String> c){}public void postWebMessage(WebMessage m,android.net.Uri u){}}
