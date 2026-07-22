const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../../');
const OUTPUT_FILE = path.resolve(__dirname, '../src/tree.json');

const SUPPORTED_EXTENSIONS = ['.pdf', '.txt', '.md'];

function buildTree(dirPath, rootPath = ROOT_DIR) {
  const stats = fs.statSync(dirPath);
  const name = path.basename(dirPath);
  
  // Use posix path separator for URLs
  let relativePath = path.posix.join(...path.relative(rootPath, dirPath).split(path.sep));
  if (relativePath === '.') relativePath = ''; // Root directory
  else relativePath = '/' + relativePath; // prepend / for absolute path in URL

  if (stats.isDirectory()) {
    // Exclude certain directories
    if (['.git', 'pdf-viewer', 'node_modules', '.gemini', 'scripts', '.vscode'].includes(name)) return null;

    const children = fs.readdirSync(dirPath)
      .map(child => buildTree(path.join(dirPath, child), rootPath))
      .filter(Boolean);
      
    // Only return directory if it contains at least one file or non-empty subdirectory
    if (children.length === 0 && dirPath !== rootPath) return null;
    
    return {
      type: 'directory',
      name: dirPath === rootPath ? 'root' : name,
      path: relativePath,
      children
    };
  } else {
    const ext = path.extname(name).toLowerCase();
    if (SUPPORTED_EXTENSIONS.includes(ext)) {
      return {
        type: 'file',
        name,
        path: relativePath
      };
    }
  }
  return null;
}

const tree = buildTree(ROOT_DIR);
const finalTree = tree ? tree.children : [];

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalTree, null, 2));
console.log('tree.json generated at', OUTPUT_FILE);
