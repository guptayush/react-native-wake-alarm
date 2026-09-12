const ANDROID_EXT = new Set(['.mp3', '.wav', '.ogg']);
const IOS_EXT = new Set(['.caf', '.wav', '.aiff']);
const ANDROID_NAME = /^[a-z][a-z0-9_]*$/;

function classifySounds(fileNames) {
  const android = [];
  const ios = [];
  const rejected = [];
  for (const f of fileNames) {
    const dot = f.lastIndexOf('.');
    if (dot <= 0) continue;
    const ext = f.slice(dot).toLowerCase();
    const base = f.slice(0, dot);
    if (IOS_EXT.has(ext)) ios.push(f);
    if (ANDROID_EXT.has(ext)) {
      if (ANDROID_NAME.test(base)) android.push(f);
      else rejected.push(f);
    }
  }
  return { android, ios, rejected };
}

module.exports = { classifySounds };
