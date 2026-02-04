const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");

const copyDir = (src, dest) => {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    const srcPath = path.join(src, entry);
    const destPath = path.join(dest, entry);
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
};

const expoRouterAssetsSrc = path.join(projectRoot, "assets", "expo-router");
const expoRouterAssetsDest = path.join(projectRoot, "node_modules", "expo-router", "assets");
copyDir(expoRouterAssetsSrc, expoRouterAssetsDest);

const vectorIconsFontsSrc = path.join(
  projectRoot,
  "node_modules",
  "react-native-vector-icons",
  "Fonts"
);
const vectorIconsFontsDest = path.join(
  projectRoot,
  "node_modules",
  "@expo",
  "vector-icons",
  "build",
  "vendor",
  "react-native-vector-icons",
  "Fonts"
);
copyDir(vectorIconsFontsSrc, vectorIconsFontsDest);

