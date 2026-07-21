const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../../');
const DIST_DIR = path.resolve(__dirname, '../dist');
const TREE_FILE = path.resolve(__dirname, '../src/tree.json');

// Ensure dist directory exists
if (!fs.existsSync(DIST_DIR)) {
  console.error("dist directory does not exist! Run vite build first.");
  process.exit(1);
}

const treeData = JSON.parse(fs.readFileSync(TREE_FILE, 'utf-8'));

function copyFiles(nodes) {
  for (const node of nodes) {
    if (node.type === 'directory') {
      copyFiles(node.children || []);
    } else if (node.type === 'file' && node.name.toLowerCase().endsWith('.pdf')) {
      const sourcePath = path.join(ROOT_DIR, node.path);
      const destPath = path.join(DIST_DIR, node.path);
      
      const destDir = path.dirname(destPath);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      
      if (fs.existsSync(sourcePath)) {
        console.log(`Copying ${node.path}...`);
        fs.copyFileSync(sourcePath, destPath);
      } else {
        console.warn(`File not found: ${sourcePath}`);
      }
    }
  }
}

console.log("Starting to copy PDFs into dist...");
copyFiles(treeData);
console.log("Copy completed.");
