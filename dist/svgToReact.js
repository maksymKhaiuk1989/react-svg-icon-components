#!/usr/bin/env node
const fs = require("fs-extra");
const path = require("path");
const { transform } = require("@svgr/core");

const CONFIG_FILE = "react-svg-icon-components.json";
const configPath = path.resolve(process.cwd(), CONFIG_FILE);

if (!fs.existsSync(configPath)) {
  console.error(`❌ Config file "${CONFIG_FILE}" not found!\n`);
  console.error("👉 To create a new config file, run the following command:");
  console.error(`   touch ${CONFIG_FILE}\n`);
  console.error("📌 Then, add following config into created file:");
  console.error(`
{
  "iconsPath": "icons",
  "outputDir": "ui-kit/icons",
  "jsxRuntime": "classic",
  "typescript": true,
  "useDefaultOptimization": true,
  "componentPrefix": "Icon"
}
  `);
  process.exit(1);
}

const {
  iconsPath,
  outputDir,
  jsxRuntime = "classic",
  typescript = true,
  componentPrefix = "SvgIcon",
  useDefaultOptimization,
  svgoConfig,
} = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));

async function generateIcons() {
  if (!fs.existsSync(iconsPath)) {
    console.error(`Icons folder "${iconsPath}" does not exist.`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(iconsPath)
    .filter((file) => file.endsWith(".svg"));

  if (files.length === 0) {
    console.log(
      `⚠️ No SVG files found in the specified: "${iconsPath}" icons folder.`
    );
    process.exit(0);
  }

  if (fs.existsSync(outputDir)) {
    fs.emptyDirSync(outputDir);
  } else {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  let exports = [];
  let componentNames = [];
  let totalSize = 0;

  for (const file of files) {
    const iconName = path.basename(file, ".svg");
    const componentName =
      componentPrefix + iconName.charAt(0).toUpperCase() + iconName.slice(1);
    const filePath = path.join(iconsPath, file);

    let svgCode = fs.readFileSync(filePath, "utf-8");

    let selectedSvgoConfig = svgoConfig;

    if (!selectedSvgoConfig && !useDefaultOptimization) {
      const isMultiColor = isMultiColorSvg(svgCode);

      selectedSvgoConfig = {
        plugins: [
          {
            name: "preset-default",
            params: {
              overrides: {
                removeViewBox: false,
              },
            },
          },
          "removeDimensions",
          "convertStyleToAttrs",
          "cleanupAttrs",
          "removeEmptyContainers",
          "removeHiddenElems",
          "removeMetadata",
          "collapseGroups",
          { name: "cleanupIds", remove: true },
          ...(isMultiColor
            ? []
            : [{ name: "convertColors", params: { currentColor: true } }]),
        ],
      };
    }

    const reactComponent = await transform(
      svgCode,
      {
        plugins: ["@svgr/plugin-svgo", "@svgr/plugin-jsx"],
        svgoConfig: selectedSvgoConfig,
        icon: false,
        typescript,
        jsxRuntime,
        native: false,
        expandProps: "end",
      },
      { componentName }
    );

    const fileExtension = typescript ? "tsx" : "jsx";

    const componentFile = path.join(
      outputDir,
      `${componentName}.${fileExtension}`
    );

    fs.writeFileSync(componentFile, reactComponent, "utf-8");

    const fileSize = fs.statSync(componentFile).size;
    totalSize += fileSize;

    componentNames.push(componentName);

    exports.push(
      `export { default as ${componentName} } from "./${componentName}";`
    );
  }

  const indexFileExtension = typescript ? "ts" : "js";

  fs.writeFileSync(
    path.join(outputDir, `index.${indexFileExtension}`),
    exports.join("\n"),
    "utf-8"
  );

  const totalSizeKB = (totalSize / 1024).toFixed(2);

  console.log("\n✅ Icon generation completed!");
  console.log(`🔢 Components generated: ${componentNames.length}`);
  console.log(`📦 Total size: ${totalSizeKB} KB`);
  console.log(`📂 Output directory: ${outputDir}`);
  console.log(`📜 Components: ${componentNames.join(", ")}`);
}

generateIcons();

function isMultiColorSvg(svgContent) {
  const colorMatches = svgContent.match(/#[0-9A-Fa-f]{3,6}|rgb\(|hsl\(/g) || [];
  return new Set(colorMatches).size > 1;
}
