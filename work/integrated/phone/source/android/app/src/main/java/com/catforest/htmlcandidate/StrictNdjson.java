package com.catforest.htmlcandidate;

import org.json.JSONException;
import org.json.JSONObject;
import java.util.HashSet;
import java.util.Set;

/** 在JSONObject丢失重复键之前核对NDJSON语法；不信任设备或页面输入。 */
final class StrictNdjson {
    private static final int MAX_DEPTH = 16;
    private final String text;
    private int offset;
    private StrictNdjson(String text) { this.text = text; }
    static JSONObject object(String text) throws JSONException {
        if (text == null || text.indexOf('\0') >= 0) throw new JSONException("Invalid JSON input");
        StrictNdjson parser = new StrictNdjson(text);
        parser.space();
        if (parser.peek() != '{') throw new JSONException("Object required");
        parser.value(0); parser.space();
        if (parser.offset != text.length()) throw new JSONException("Trailing JSON input");
        return new JSONObject(text);
    }
    private char peek() { return offset < text.length() ? text.charAt(offset) : '\uffff'; }
    private void space() { while (peek() == ' ' || peek() == '\t' || peek() == '\r' || peek() == '\n') offset++; }
    private void expect(char expected) throws JSONException {
        if (peek() != expected) throw new JSONException("Unexpected JSON token");
        offset++;
    }
    private String string() throws JSONException {
        int start = offset; expect('"');
        boolean closed = false;
        while (offset < text.length()) {
            char value = text.charAt(offset++);
            if (value == '"') { closed = true; break; }
            if (value < 0x20) throw new JSONException("Control character in string");
            if (value == '\\') {
                if (offset >= text.length()) throw new JSONException("Incomplete escape");
                char escape = text.charAt(offset++);
                if (escape == 'u') {
                    for (int index = 0; index < 4; index++) {
                        if (offset >= text.length() || Character.digit(text.charAt(offset++), 16) < 0) throw new JSONException("Invalid Unicode escape");
                    }
                } else if ("\"\\/bfnrt".indexOf(escape) < 0) throw new JSONException("Invalid string escape");
            }
        }
        if (!closed) throw new JSONException("Unclosed string");
        String decoded = new org.json.JSONTokener(text.substring(start, offset)).nextValue().toString();
        for (int index = 0; index < decoded.length(); index++) {
            char unit = decoded.charAt(index);
            if (unit == 0) throw new JSONException("NUL is not protocol data");
            if (Character.isHighSurrogate(unit)) {
                if (++index >= decoded.length() || !Character.isLowSurrogate(decoded.charAt(index))) throw new JSONException("Unpaired surrogate");
            } else if (Character.isLowSurrogate(unit)) throw new JSONException("Unpaired surrogate");
        }
        return decoded;
    }
    private void value(int depth) throws JSONException {
        if (depth > MAX_DEPTH) throw new JSONException("JSON nesting limit exceeded");
        space(); char token = peek();
        if (token == '{' || token == '[') {
            boolean object = token == '{'; char close = object ? '}' : ']'; offset++; space();
            if (peek() == close) { offset++; return; }
            Set<String> names = new HashSet<>();
            while (true) {
                space();
                if (object) {
                    String name = string();
                    if (!names.add(name)) throw new JSONException("Duplicate JSON key");
                    space(); expect(':');
                }
                value(depth + 1); space();
                if (peek() == close) { offset++; return; }
                expect(',');
            }
        }
        if (token == '"') { string(); return; }
        for (String literal : new String[]{"true", "false", "null"}) {
            if (text.startsWith(literal, offset)) { offset += literal.length(); return; }
        }
        int start = offset;
        if (peek() == '-') offset++;
        if (peek() == '0') offset++;
        else { if (peek() < '1' || peek() > '9') throw new JSONException("Invalid JSON number"); digits(); }
        if (peek() == '.') { offset++; requiredDigits(); }
        if (peek() == 'e' || peek() == 'E') { offset++; if (peek() == '+' || peek() == '-') offset++; requiredDigits(); }
        try {
            double number = Double.parseDouble(text.substring(start, offset));
            if (!Double.isFinite(number) || (number == Math.rint(number) && Math.abs(number) > 9007199254740991L)) throw new JSONException("Unsafe JSON number");
        } catch (NumberFormatException error) { throw new JSONException("Invalid JSON number"); }
    }
    private void digits() { while (peek() >= '0' && peek() <= '9') offset++; }
    private void requiredDigits() throws JSONException {
        if (peek() < '0' || peek() > '9') throw new JSONException("Missing JSON number digits");
        digits();
    }
}
