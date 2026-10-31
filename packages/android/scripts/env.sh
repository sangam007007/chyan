# Shared by the other scripts: finds the Android SDK and a JDK 17 (it needs `javac`, a plain JRE is not enough).
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
if [ -z "${JAVA_HOME:-}" ] || [ ! -x "$JAVA_HOME/bin/javac" ]; then
  for j in "$HOME"/jdk/jdk-17* /usr/lib/jvm/java-17-openjdk-amd64; do
    [ -x "$j/bin/javac" ] && export JAVA_HOME="$j" && break
  done
fi
[ -x "${JAVA_HOME:-/nonexistent}/bin/javac" ] || { echo "No JDK 17 found (need javac). Install openjdk-17-jdk and set JAVA_HOME." >&2; exit 1; }
[ -d "$ANDROID_HOME/platforms" ] || { echo "Android SDK not found at $ANDROID_HOME" >&2; exit 1; }
export PATH="$JAVA_HOME/bin:$PATH"
cd "$(dirname "${BASH_SOURCE[0]}")/.."
