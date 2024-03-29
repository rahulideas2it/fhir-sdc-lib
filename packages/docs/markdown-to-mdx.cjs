const fs = require('fs');
const path = require('path');

function copyDir(sourceDir, targetDir) {
  const files = fs.readdirSync(sourceDir, { withFileTypes: true });
  fs.mkdirSync(targetDir, { recursive: true });

  for (const file of files) {
    const sourceFilePath = path.join(sourceDir, file.name);
    const targetFilePath = path.join(targetDir, file.name);
    if (file.isDirectory()) {
      copyDir(sourceFilePath, targetFilePath);
    } else {
      copyFile(sourceFilePath, targetFilePath);
    }
  }
}

function copyFile(sourceFile, targetFile) {
  if (sourceFile.endsWith('.md')) {
    fs.writeFileSync(targetFile.replace('.md', '.mdx'), escapeMdx(sourceFile, fs.readFileSync(sourceFile, 'utf8')));
  } else {
    fs.copyfileSync(sourceFile, targetFile);
  }
}

function escapeMdx(fileName, text) {
  text = text
    .replace('<!-- Do not edit this file. It is automatically generated by API Documenter. -->', '')
    .trimStart()
    .replaceAll('.md)', ')');

  if (path.basename(fileName) === 'index.md') {
    // In Docusaurus, the index.mdx file is used as the landing page for the folder.
    // Relative links are relative to the parent, not the index.mdx file.
    text = text.replaceAll('](./index)', '](../)').replaceAll('](./', '](./sdk/');
  } else {
    text = text.replaceAll('[Home](./index)', '[Home](./)');
  }

  const specialChars = ['{', '}'];
  let inSingleBacktick = false;
  let inTripleBacktick = false;
  let backtickCount = 0;
  let result = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    // Check for backtick
    if (char === '`') {
      result += char;
      backtickCount++;

      if (backtickCount === 3) {
        inTripleBacktick = !inTripleBacktick;
        backtickCount = 0;
      } else if (backtickCount === 1 && i < text.length - 1 && text[i + 1] !== '`') {
        inSingleBacktick = !inSingleBacktick;
        backtickCount = 0;
      }
    } else {
      if (backtickCount > 0 && backtickCount < 3) {
        // Add missed backticks to result
        result += '`'.repeat(backtickCount);
        backtickCount = 0;
      }

      if (!inSingleBacktick && !inTripleBacktick && specialChars.includes(char)) {
        // Escape character if not in backtick block
        result += '\\' + char;
      } else {
        // Add character as is
        result += char;
      }
    }
  }

  // Append any remaining backticks
  if (backtickCount > 0) {
    result += '`'.repeat(backtickCount);
  }

  return result;
}

if (require.main === module) {
  if (process.argv.length < 4) {
    console.log('Usage: node copy-markdown.cjs <sourceDir> <targetDir>');
    process.exit(1);
  }
  const [_node, _script, source, target] = process.argv;
  try {
    copyDir(source, target);
  } catch (error) {
    console.error('Error processing files:', error);
  }
}
