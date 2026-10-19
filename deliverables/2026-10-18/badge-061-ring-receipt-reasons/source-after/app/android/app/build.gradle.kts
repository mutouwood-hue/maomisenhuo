plugins { id("com.android.application") }
android {
    namespace = "com.catforest.htmlcandidate"
    compileSdk = 35
    buildToolsVersion = "35.0.0"
    buildFeatures { buildConfig = true }
    defaultConfig {
        applicationId = "com.catforest.htmlcandidate"
        minSdk = 26
        targetSdk = 35
        versionCode = 38
        versionName = "0.4.7-care-reasons"
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    signingConfigs {
        getByName("debug") {
            storeFile = rootProject.file("../.build/debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
    }
    buildTypes { release { isMinifyEnabled = false } }
}
