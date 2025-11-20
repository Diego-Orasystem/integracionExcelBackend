const path = require('path');

const DEFAULT_REMOTE_BASE_DIR = process.env.REMOTE_STORAGE_ROOT_DIR || '/lek-files';

function sanitizeSegment(value = '', { maxLength = 80, collapseSpaces = true, upperCase = false, removeSpaces = false } = {}) {
  if (value === null || value === undefined) {
    return '';
  }

  let result = value.toString().trim();
  // Remove characters that could break paths or special tokens
  result = result.replace(/[/\\:?*"<>|]/g, ' ');
  if (collapseSpaces) {
    result = result.replace(/\s+/g, ' ');
  }
  if (removeSpaces) {
    result = result.replace(/\s+/g, '');
  }
  if (maxLength && result.length > maxLength) {
    result = result.substring(0, maxLength);
  }
  result = result.trim();
  if (upperCase) {
    result = result.toUpperCase();
  }
  return result;
}

function deriveCompanyPrefix(company, explicitPrefix) {
  if (explicitPrefix) {
    return sanitizeSegment(explicitPrefix, { removeSpaces: true, upperCase: true, maxLength: 40 }) || 'FILE';
  }
  if (company?.name) {
    return sanitizeSegment(company.name, { removeSpaces: true, upperCase: true, maxLength: 40 }) || 'FILE';
  }
  return 'FILE';
}

function deriveCompanyDirectory() {
  return 'can';
}

function buildRemoteFilename({ prefix, groupName, serieName, branchCode, extension, useBranchCode }) {
  const safePrefix = sanitizeSegment(prefix, { removeSpaces: true, upperCase: true, maxLength: 40 }) || 'FILE';
  const safeGroup = sanitizeSegment(groupName, { maxLength: 80 }) || 'DEFAULT';
  const safeSerie = sanitizeSegment(serieName || groupName, { maxLength: 80 }) || safeGroup;
  const safeBranch = branchCode ? sanitizeSegment(branchCode, { maxLength: 40 }) : '';
  const ext = extension ? (extension.startsWith('.') ? extension : `.${extension}`) : '';
  const timestamp = new Date().toISOString().replace(/[:]/g, '-');

  // Lógica del símbolo: @+ se usa cuando NO hay BranchCode, @ se usa cuando SÍ hay BranchCode
  // Ejemplos:
  // - CAPEX@+GroupName=...@+SerieName=... (sin BranchCode)
  // - LEK2@GroupName=...@SerieName=...@BranchCode=ALL (con BranchCode)
  const symbol = useBranchCode && safeBranch ? '@' : '@+';
  const groupSegment = `${symbol}GroupName=${safeGroup}`;
  const serieSegment = `${symbol}SerieName=${safeSerie}`;
  const branchSegment = useBranchCode && safeBranch ? `@BranchCode=${safeBranch}` : '';

  return `${safePrefix}${groupSegment}${serieSegment}${branchSegment}-upld-${timestamp}${ext}`;
}

function normalizeRemoteSegment(segment = '') {
  return segment.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
}

function buildRemoteDirectoryPath({ baseDir = DEFAULT_REMOTE_BASE_DIR, companyDir, subdirectories = [] }) {
  const segments = [
    normalizeRemoteSegment(baseDir || DEFAULT_REMOTE_BASE_DIR),
    normalizeRemoteSegment(companyDir || '')
  ];
  subdirectories.forEach((dir) => {
    if (dir) {
      segments.push(normalizeRemoteSegment(dir));
    }
  });
  return `/${segments.filter(Boolean).join('/')}`;
}

function buildRemoteFilePath({ baseDir = DEFAULT_REMOTE_BASE_DIR, companyDir, subdirectories = [], filename }) {
  const directory = buildRemoteDirectoryPath({ baseDir, companyDir, subdirectories });
  const cleanFilename = normalizeRemoteSegment(filename || 'archivo.xlsx');
  return path.posix.join(directory, cleanFilename);
}

module.exports = {
  buildRemoteDirectoryPath,
  buildRemoteFilePath,
  buildRemoteFilename,
  deriveCompanyDirectory,
  deriveCompanyPrefix,
  sanitizeSegment
};

