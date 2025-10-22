const sharp = require('sharp');
const fs = require('fs');

const svgPath = './public/icon.svg';
if (!fs.existsSync(svgPath)) {
  console.error('Missing public/icon.svg');
  process.exit(1);
}
const svgBuffer = fs.readFileSync(svgPath);

async function generateIcon(size, outPath) {
  await sharp(svgBuffer).resize(size, size).png().toFile(outPath);
  console.log(`Generated ${outPath}`);
}

(async () => {
  try {
    await generateIcon(192, './public/icon-192.png');
    await generateIcon(512, './public/icon-512.png');
    await generateIcon(180, './public/apple-touch-icon.png');
    // Favicon 32x32
    await sharp(svgBuffer).resize(32, 32).png().toFile('./public/favicon.ico');
    console.log('Generated ./public/favicon.ico');
  } catch (err) {
    console.error('Error generating icons:', err);
    process.exit(1);
  }
})();
