package com.warmpaws.town.location;

import android.content.Context;
import android.util.AtomicFile;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

/** Native durable owner queue: bridge reads then acknowledges only after JS persistence. */
final class LocationQueue {
    private static final long TTL = 7L * 86400000L;
    private static final int LIMIT = 10080;
    private static LocationQueue instance;
    static synchronized LocationQueue get(Context context) { if (instance == null) instance = new LocationQueue(context.getApplicationContext()); return instance; }
    private final AtomicFile file;
    private JSONObject state;
    LocationQueue(Context context) {
        file = new AtomicFile(new File(context.getNoBackupFilesDir(), "companion-location.json"));
        try {
            state = new JSONObject(new String(file.readFully(), StandardCharsets.UTF_8));
            if (state.optInt("version") != 1 || state.optJSONArray("samples") == null || state.getJSONArray("samples").length() > LIMIT || !(state.opt("enabled") instanceof Boolean)) throw new IllegalStateException("Invalid native location schema");
        } catch (java.io.FileNotFoundException absent) { state = new JSONObject(); }
        catch (Exception error) { state = new JSONObject(); storageError = true; BackgroundLocationService.lastError = "Native location cache corrupt; collection disabled"; }
    }
    synchronized JSONObject read() throws Exception {
        prune(); return new JSONObject(state.toString());
    }
    synchronized String begin(String owner) throws Exception {
        if (!owner.equals(state.optString("owner"))) state = new JSONObject();
        String generation = UUID.randomUUID().toString();
        state.put("owner", owner); state.put("generation", generation); state.put("enabled", true);
        state.put("samples", state.optJSONArray("samples") == null ? new JSONArray() : state.getJSONArray("samples"));
        save(); return generation;
    }
    synchronized void stop(boolean clear) throws Exception {
        state.put("enabled", false); state.put("generation", UUID.randomUUID().toString());
        if (clear) { state.put("samples", new JSONArray()); state.put("owner", ""); }
        save();
    }
    synchronized boolean append(String generation, JSONObject sample) throws Exception {
        if (!state.optBoolean("enabled") || !generation.equals(state.optString("generation"))) return false;
        prune(); JSONArray samples = state.optJSONArray("samples"); if (samples == null) samples = new JSONArray();
        if (samples.length() >= LIMIT) { state.put("dropped", state.optInt("dropped") + 1); save(); return false; }
        sample.put("id", UUID.randomUUID().toString()); samples.put(sample); state.put("samples", samples); save(); return true;
    }
    synchronized void acknowledge(String owner, String generation, JSONArray ids) throws Exception {
        if (!owner.equals(state.optString("owner")) || !generation.equals(state.optString("generation"))) throw new IllegalStateException("Stale location queue acknowledgement");
        java.util.HashSet<String> confirmed = new java.util.HashSet<>();
        for (int i = 0; i < ids.length(); i++) confirmed.add(ids.getString(i));
        JSONArray kept = new JSONArray(), samples = state.optJSONArray("samples");
        if (samples != null) for (int i = 0; i < samples.length(); i++) if (!confirmed.contains(samples.getJSONObject(i).optString("id"))) kept.put(samples.getJSONObject(i));
        state.put("samples", kept); prune(); save();
    }
    private void prune() throws Exception {
        JSONArray samples = state.optJSONArray("samples"), kept = new JSONArray(); long now = System.currentTimeMillis();
        if (samples != null) for (int i = 0; i < samples.length(); i++) {
            JSONObject sample = samples.getJSONObject(i); long time = sample.optLong("timestamp");
            if (time > now - TTL && time <= now) kept.put(sample);
        }
        state.put("samples", kept); save();
    }
    private boolean storageError;
    boolean hasStorageError() { return storageError; }
    private void save() throws Exception {
        if (storageError) throw new IllegalStateException("Location storage is fail-closed");
        state.put("version", 1);
        if (!state.has("enabled")) state.put("enabled", false);
        if (!state.has("owner")) state.put("owner", "");
        if (!state.has("generation")) state.put("generation", UUID.randomUUID().toString());
        FileOutputStream stream = null;
        try { stream = file.startWrite(); stream.write(state.toString().getBytes(StandardCharsets.UTF_8)); file.finishWrite(stream); }
        catch (Exception error) { storageError = true; state.put("enabled", false); if (stream != null) file.failWrite(stream); throw error; }
    }
}
