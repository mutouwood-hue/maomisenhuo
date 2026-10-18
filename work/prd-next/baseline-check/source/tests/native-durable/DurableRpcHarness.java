import android.app.Activity;
import android.webkit.WebView;
import com.catforest.htmlcandidate.EventDurableBridge;
import java.io.*;
import java.lang.reflect.*;
import org.json.*;
/** Actual production Java commit/read, JVM Android I/O stand-ins. No phone/fsync claim. */
public class DurableRpcHarness {
 public static void main(String[] args)throws Exception{
  File dir=new File(args[0]);dir.mkdirs();EventDurableBridge bridge=new EventDurableBridge(new Activity(dir),new WebView(),args.length>1?args[1]:"");bridge.setForeground(true);
  Method read=EventDurableBridge.class.getDeclaredMethod("read"),commit=EventDurableBridge.class.getDeclaredMethod("commit",JSONObject.class),trusted=EventDurableBridge.class.getDeclaredMethod("trusted",String.class,String.class);read.setAccessible(true);commit.setAccessible(true);trusted.setAccessible(true);
  try(BufferedReader in=new BufferedReader(new InputStreamReader(System.in,java.nio.charset.StandardCharsets.UTF_8))){String line;while((line=in.readLine())!=null){JSONObject response=new JSONObject();try{
    JSONObject request=new JSONObject(line);String op=request.getString("op");Object result;
    if(op.equals("read"))result=((JSONObject)read.invoke(bridge)).put("foreground",true);
    else if(op.equals("commit")){android.util.AtomicFile.failure=request.optString("fixtureFailure","");android.system.Os.failSync=request.optBoolean("fixtureDirectoryFailure",false);result=commit.invoke(bridge,request);}
    else if(op.equals("foreground")){bridge.setForeground(request.getBoolean("value"));result=true;}
    else if(op.equals("trusted"))result=trusted.invoke(null,request.getString("url"),request.optString("slot",""));
    else throw new Exception("fixture unknown op");
    response.put("ok",true).put("result",result);
   }catch(Throwable failure){Throwable cause=failure instanceof InvocationTargetException?failure.getCause():failure;response.put("ok",false).put("error",cause.toString());}
   finally{android.system.Os.failSync=false;}System.out.println(response);System.out.flush();}}
  bridge.dispose();
 }
}
