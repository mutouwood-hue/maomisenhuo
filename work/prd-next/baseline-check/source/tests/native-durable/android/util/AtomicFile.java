package android.util;
import java.io.*;
import java.nio.file.*;
/** Explicit JVM stand-in; does not validate Android AtomicFile implementation. */
public class AtomicFile {private final File base,tmp;public static String failure="";public AtomicFile(File base){this.base=base;this.tmp=new File(base+".new");}public File getBaseFile(){return base;}public InputStream openRead()throws Exception{return new FileInputStream(base);}public FileOutputStream startWrite()throws Exception{return new FileOutputStream(tmp);}public void finishWrite(FileOutputStream s)throws Exception{s.close();if(failure.equals("beforeRename")){failure="";throw new IOException("fixture before rename");}Files.move(tmp.toPath(),base.toPath(),StandardCopyOption.REPLACE_EXISTING,StandardCopyOption.ATOMIC_MOVE);if(failure.equals("afterRename")){failure="";throw new IOException("fixture after rename");}}public void failWrite(FileOutputStream s){try{s.close();}catch(Exception e){}tmp.delete();}}
