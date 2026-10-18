package android.system;
import java.io.*;
public class Os {public static boolean failSync=false;public static int syncs=0;public static FileDescriptor open(String p,int f,int m)throws Exception{if(!new File(p).isDirectory())throw new IOException("not directory");return new FileDescriptor();}public static class Stat{public int st_mode=1;}public static Stat fstat(FileDescriptor d){return new Stat();}public static void fsync(FileDescriptor d)throws Exception{syncs++;if(failSync)throw new IOException("fixture directory fsync failed");}public static void close(FileDescriptor d){}}
