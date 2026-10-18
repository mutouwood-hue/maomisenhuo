import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.util.Random;
import java.util.ArrayList;
import java.util.List;
import java.lang.reflect.Proxy;
import java.lang.reflect.Field;

/** Actual production static policy only: no Android/Bluetooth/permission/port instance. */
public final class NativeV2FragmentPolicyTest {
    private static Method valid;
    private static Method next;
    private static int checks;
    private static boolean valid(byte[] value) throws Exception { return (Boolean) valid.invoke(null, (Object) value); }
    private static int next(int count, byte[] value) throws Exception { return (Integer) next.invoke(null, count, value); }
    private static void check(boolean value) { checks++; if (!value) throw new AssertionError("Fragment policy check " + checks); }
    private static void rejected(int count, byte[] value) throws Exception {
        try { next(count, value); throw new AssertionError("Expected rejection"); }
        catch (InvocationTargetException error) { check(error.getCause() instanceof IllegalArgumentException); }
    }
    private static Object field(Object object, String key) throws Exception {
        Field field = object.getClass().getDeclaredField(key); field.setAccessible(true); return field.get(object);
    }
    private static void routes(Class<?> bridge) throws Exception {
        Class<?> routerType = Class.forName(bridge.getName() + "$ModeRouter");
        Method route = bridge.getDeclaredMethod("route", routerType, String.class, String.class); route.setAccessible(true);
        for (int scenario = 0; scenario < 3; scenario++) {
            final int failure = scenario;
            List<String> calls = new ArrayList<>();
            Object router = Proxy.newProxyInstance(routerType.getClassLoader(), new Class<?>[]{routerType}, (proxy, method, args) -> {
                String mode = (String) args[0]; calls.add(mode);
                if (failure > 0 && mode.equals("cflocal2") || failure == 2 && mode.equals("legacy")) throw new Exception("Injected owner route failure");
                return null;
            });
            Object result = route.invoke(null, router, "legacy", "cflocal2");
            if (scenario == 0) {
                check(field(result, "success").equals(true)); check(field(result, "mode").equals("cflocal2")); check(calls.equals(List.of("cflocal2")));
            } else if (scenario == 1) {
                check(field(result, "success").equals(false)); check(field(result, "confirmed").equals(true));
                check(field(result, "mode").equals("legacy")); check(calls.equals(List.of("cflocal2", "legacy")));
            } else {
                check(field(result, "success").equals(false)); check(field(result, "confirmed").equals(false));
                check(field(result, "mode").equals("off")); check(calls.equals(List.of("cflocal2", "legacy", "off")));
            }
        }
    }
    public static void main(String[] args) throws Exception {
        Class<?> bridge = Class.forName("com.catforest.htmlcandidate.LocalV2BleBridge");
        valid = bridge.getDeclaredMethod("validFragment", byte[].class); valid.setAccessible(true);
        next = bridge.getDeclaredMethod("nextLineBytes", int.class, byte[].class); next.setAccessible(true);
        check(!valid(null)); check(!valid(new byte[0])); check(!valid(new byte[21]));
        for (int size = 1; size <= 20; size++) check(valid(new byte[size]));
        // UTF-8 may be split anywhere; Native must not corrupt/reject individual code-unit bytes.
        for (byte octet : "猫咪".getBytes(StandardCharsets.UTF_8)) check(valid(new byte[]{octet}));
        check(valid(new byte[]{0})); // No invented per-byte NUL/opcode grant policy; full JSON is app-layer.
        check(next(2047, new byte[]{10}) == 0); // 2048 including LF is valid.
        rejected(2048, new byte[]{10}); rejected(2040, new byte[9]);
        rejected(-1, new byte[]{10}); rejected(2049, new byte[]{10});
        rejected(0, new byte[0]); rejected(0, new byte[21]); rejected(0, null);
        check(next(12, new byte[]{1, 10, 2, 3, 10, 4}) == 1);
        check(next(2047, new byte[]{10, 42}) == 1);
        Random random = new Random(20261016);
        for (int trial = 0; trial < 10000; trial++) {
            int count = random.nextInt(2049); byte[] fragment = new byte[1 + random.nextInt(20)]; random.nextBytes(fragment);
            int expected = count; boolean overflow = false;
            for (byte octet : fragment) { expected++; if (expected > 2048) { overflow = true; break; } if (octet == 10) expected = 0; }
            if (overflow) rejected(count, fragment); else check(next(count, fragment) == expected);
        }
        routes(bridge);
        System.out.println("PASS " + checks + " production local-v2 fragment/line-boundary and owner-route checks; pure JVM, no device");
    }
}
