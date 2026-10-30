"""Verify a reviewed static ZIP before extraction; never accepts arbitrary paths."""
import hashlib
import json
import os
import re
import stat
import sys
import zipfile
from pathlib import Path, PurePosixPath


def verify(archive, expected, destination):
    if not re.fullmatch(r"[a-f0-9]{64}", expected):
        raise ValueError("Invalid reviewed archive SHA")
    raw = Path(archive).read_bytes()
    if len(raw) > 32 * 1024 * 1024 or hashlib.sha256(raw).hexdigest() != expected:
        raise ValueError("Archive differs from reviewed bytes")
    with zipfile.ZipFile(archive) as source:
        entries = source.infolist()
        if len(entries) > 200 or sum(x.file_size for x in entries) > 64 * 1024 * 1024:
            raise ValueError("Archive exceeds static release bounds")
        names = set()
        for entry in entries:
            name = entry.filename.rstrip("/")
            path = PurePosixPath(name)
            mode = entry.external_attr >> 16
            if (not re.fullmatch(r"[-a-zA-Z0-9_./]+", name)
                    or path.is_absolute() or any(x in (".", "..") for x in name.split("/"))
                    or "//" in name or name in names
                    or (name != "release-manifest.json" and name != "site" and not name.startswith("site/"))
                    or stat.S_ISLNK(mode) or stat.S_IFMT(mode) not in (0, stat.S_IFREG, stat.S_IFDIR)):
                raise ValueError("Unsafe or duplicate archive entry")
            names.add(name)
        manifest = json.loads(source.read("release-manifest.json"))
        if (manifest.get("schema") != 1 or manifest.get("origin") != "https://wie116.github.io"
                or manifest.get("base") != "/tempo/" or manifest.get("pilot") != "/tempo/pilot/pilot.html"):
            raise ValueError("Unreviewed publication target")
        files = manifest["files"]
        expected_files = {"site/" + item["path"] for item in files}
        actual_files = {x.filename for x in entries if not x.is_dir()} - {"release-manifest.json"}
        if expected_files != actual_files or len(expected_files) != len(files):
            raise ValueError("ZIP inventory differs from reviewed manifest")
        for item in files:
            payload = source.read("site/" + item["path"])
            if len(payload) != item["bytes"] or hashlib.sha256(payload).hexdigest() != item["sha256"]:
                raise ValueError("Static file integrity mismatch")
        target = Path(destination)
        target.mkdir(exist_ok=False)
        source.extractall(target)
    return manifest


if __name__ == "__main__":
    try:
        result = verify(os.environ["C4_ARCHIVE"], os.environ["C4_ARCHIVE_SHA256"], os.environ["C4_UNPACK"])
        print(json.dumps({"verifiedFiles": len(result["files"]), "legacyDeploymentSha": result["legacyDeploymentSha"]}))
    except Exception:
        sys.exit("Reviewed release verification refused; nothing published")
