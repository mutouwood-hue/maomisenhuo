package android.util;
import java.io.*;
import java.nio.file.*;
/** JVM stand-in. silentBeforeRename models Android finishWrite logging without throw. */
public class AtomicFile {
 private final File base,tmp;public static String failure="";
 public AtomicFile(File base){this.base=base;this.tmp=new File(base+".new");}
 public File getBaseFile(){return base;}
 public InputStream openRead()throws Exception{if(base.exists())tmp.delete();return new FileInputStream(base);}
 public FileOutputStream startWrite()throws Exception{return new FileOutputStream(tmp);}
 public void finishWrite(FileOutputStream stream)throws Exception{
  stream.close();
  if(failure.equals("silentBeforeRename")){failure="";return;}
  if(failure.equals("beforeRename")){failure="";throw new IOException("fixture before rename");}
  Files.move(tmp.toPath(),base.toPath(),StandardCopyOption.REPLACE_EXISTING,StandardCopyOption.ATOMIC_MOVE);
  if(failure.equals("afterRename")){failure="";throw new IOException("fixture after rename");}
 }
 public void failWrite(FileOutputStream stream){try{stream.close();}catch(Exception ignored){}tmp.delete();}
}
