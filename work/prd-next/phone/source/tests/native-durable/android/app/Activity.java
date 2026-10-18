package android.app;
import java.io.File;
public class Activity {private final File files;public Activity(File files){this.files=files;}public File getFilesDir(){return files;}public void runOnUiThread(Runnable r){r.run();}}
