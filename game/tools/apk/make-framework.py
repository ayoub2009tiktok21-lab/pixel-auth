#!/usr/bin/env python3
"""Build a stub framework.apk (package id 1 = android) from android.jar R-constants.

aapt2 assigns resource entry IDs sequentially in definition order, so we
define every framework attr/id in its exact real ID order (filling the
~143 historical gaps with dummy names) — the resulting stub has the
real platform's exact IDs without using --stable-ids (which aapt2 30.0.3
handles incorrectly for framework packages).
"""
import re
import subprocess
import sys
import os
import shutil

ANDROID_JAR = sys.argv[1] if len(sys.argv) > 1 else "/home/user/pixel-auth/.tools/android-sdk/platforms/android-30/android.jar"
OUT = sys.argv[2] if len(sys.argv) > 2 else "/tmp/fwstub"
AAPT2 = "/home/user/pixel-auth/.tools/android-sdk/build-tools/30.0.3/aapt2"
JAVA_HOME = "/home/user/pixel-auth/.tools/node_modules/javajre-linux-64/jre"

# 1. extract R constants
os.makedirs("/tmp/rcls", exist_ok=True)
subprocess.run(["unzip", "-o", "-q", ANDROID_JAR, "android/R*.class", "-d", "/tmp/rcls"], check=True)
env = dict(os.environ, JAVA_HOME=JAVA_HOME, PATH=JAVA_HOME + "/bin:" + os.environ["PATH"])

const_re = re.compile(r"public static final int (\w+) = (\d+);")

def extract(cls):
    out = subprocess.run(["javap", "-constants", "-p", "-cp", "/tmp/rcls", "android." + cls],
                         env=env, capture_output=True, text=True)
    m = {}
    for line in out.stdout.splitlines():
        mm = const_re.search(line)
        if mm:
            m[mm.group(1)] = int(mm.group(2))
    return m

attrs = extract("R$attr")
ids = extract("R$id")
print(f"extracted {len(attrs)} attrs, {len(ids)} ids")
assert attrs.get("screenOrientation") == 16842782, hex(attrs.get("screenOrientation", 0))
assert attrs.get("versionCode") == 16843291, hex(attrs.get("versionCode", 0))
assert attrs.get("configChanges") == 16842783, hex(attrs.get("configChanges", 0))

# 2. ordered lists (real names in exact ID order + gap fillers)
def ordered(name_to_id, base, gap_prefix):
    by_id = {v: k for k, v in name_to_id.items()}
    out = []
    for i in range(min(by_id.keys()) - base, max(by_id.keys()) - base + 1):
        v = base + i
        if v in by_id:
            out.append(by_id[v])
        else:
            out.append(f"{gap_prefix}{i:04x}")
    return out

attr_order = ordered(attrs, 0x01010000, "zgap")
id_order = ordered(ids, 0x01020000, "zgap")
n_gaps = sum(1 for n in attr_order if n.startswith("zgap"))
print(f"attr slots: {len(attr_order)} ({n_gaps} gap fillers), id slots: {len(id_order)}")

# 3. generate stub res (order matters!)
shutil.rmtree(OUT, ignore_errors=True)
os.makedirs(OUT + "/res/values", exist_ok=True)
with open(OUT + "/res/values/attrs.xml", "w") as f:
    f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n')
    for name in attr_order:
        f.write(f'  <attr name="{name}"/>\n')
    f.write("</resources>\n")
with open(OUT + "/res/values/ids.xml", "w") as f:
    f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n')
    for name in id_order:
        f.write(f'  <item type="id" name="{name}"/>\n')
    f.write("</resources>\n")
with open(OUT + "/res/values/public.xml", "w") as f:
    f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n')
    for name in attr_order:
        f.write(f'  <public type="attr" name="{name}"/>\n')
    for name in id_order:
        f.write(f'  <public type="id" name="{name}"/>\n')
    f.write("</resources>\n")

with open(OUT + "/AndroidManifest.xml", "w") as f:
    f.write('<?xml version="1.0" encoding="utf-8"?>\n<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="android"/>\n')

# 4. compile + link (NO --stable-ids: sequential order already pins the IDs)
subprocess.run([AAPT2, "compile", "--dir", OUT + "/res", "-o", OUT + "/fw.zip"], check=True)
subprocess.run([AAPT2, "link",
                "-o", OUT + "/framework.apk",
                "--manifest", OUT + "/AndroidManifest.xml",
                "--min-sdk-version", "24",
                "--target-sdk-version", "30",
                OUT + "/fw.zip"], check=True)

# 5. verify key IDs
dump = subprocess.run([AAPT2, "dump", "resources", OUT + "/framework.apk"],
                      capture_output=True, text=True).stdout
def id_of(type_, name):
    m = re.search(r"resource (0x[0-9a-f]+) " + type_ + "/" + re.escape(name) + r" ", dump)
    return int(m.group(1), 16) if m else None
checks = [("attr", n, attrs[n]) for n in
          ["screenOrientation", "versionCode", "configChanges", "label", "icon",
           "minSdkVersion", "targetSdkVersion", "exported", "allowBackup",
           "hardwareAccelerated", "name", "theme"] if n in attrs]
checks = [c for c in checks if c[1] in attrs]
checks += [("id", n, ids[n]) for n in ["home", "content", "empty", "message"] if n in ids]
for t, n, want in checks:
    got = id_of(t, n)
    status = "OK " if got == want else "MISMATCH"
    print(f"  {status} {t}/{n}: got {hex(got) if got else None} want {hex(want)}")
    assert got == want, f"{t}/{n} id mismatch"
print("framework.apk built:", os.path.getsize(OUT + "/framework.apk"), "bytes — all checked IDs correct")
