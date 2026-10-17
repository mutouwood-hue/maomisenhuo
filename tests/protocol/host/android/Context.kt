package android.content

import java.io.File

/** Host-only filesDir provider; not an Android platform substitute. */
class Context(val filesDir: File)
