const path = require('path');

const METADATA_DIR = process.env.REMOTE_METADATA_CONFIG_DIR || '/lek-files/.config';

function buildCueEntry({ title, remarks = [] }) {
  const lines = [
    `FILE "${title}" BINARY`,
    '  TRACK 01 AUDIO'
  ];
  remarks.forEach((remark) => {
    if (remark && remark.label) {
      lines.push(`  REM ${remark.label.toUpperCase()} "${remark.value || ''}"`);
    }
  });
  return lines.join('\n');
}

async function appendCue(remoteStorageService, relativePath, entry) {
  if (!remoteStorageService || !remoteStorageService.isConnected()) {
    return;
  }

  const posixPath = path.posix.join(METADATA_DIR, relativePath);

  // Asegurar que el directorio de metadata existe
  try {
    const metadataDirPath = METADATA_DIR.replace(/\\/g, '/');
    // ensureRemoteDirectory ya maneja la construcción desde userHomeDirectory si es necesario
    await remoteStorageService.ensureRemoteDirectory(metadataDirPath);
  } catch (dirError) {
    console.warn('⚠️  No se pudo crear directorio de metadata, continuando:', dirError.message);
  }

  let existingContent = '';
  try {
    const buffer = await remoteStorageService.downloadFileAsBuffer(posixPath);
    existingContent = buffer.toString('utf-8').trim();
  } catch (error) {
    // Es normal que el archivo no exista la primera vez
    existingContent = '';
  }

  const newContent = existingContent
    ? `${existingContent}\n\n${entry}`
    : entry;

  try {
    await remoteStorageService.uploadBuffer(Buffer.from(newContent, 'utf-8'), posixPath);
  } catch (uploadError) {
    console.warn('⚠️  No se pudo escribir metadata CUE:', uploadError.message);
    // No lanzar error, solo registrar advertencia
  }
}

async function appendMetadataEntries(remoteStorageService, {
  prefix,
  groupName,
  serieName,
  branchCode,
  remoteFilePath,
  user,
  company
}) {
  if (!remoteStorageService || !remoteStorageService.isConnected()) {
    return;
  }

  const timestamp = new Date().toISOString();
  const userLabel = user?.email || user?.name || 'unknown';
  const companyLabel = company?.name || 'unknown';

  const prefixEntry = buildCueEntry({
    title: prefix || 'FILE',
    remarks: [
      { label: 'FILE', value: remoteFilePath },
      { label: 'COMPANY', value: companyLabel },
      { label: 'USER', value: userLabel },
      { label: 'TIMESTAMP', value: timestamp }
    ]
  });

  const groupEntry = buildCueEntry({
    title: groupName || serieName || 'GROUP',
    remarks: [
      { label: 'FILE', value: remoteFilePath },
      { label: 'SERIE', value: serieName || groupName || '' },
      { label: 'BRANCH', value: branchCode || 'N/A' },
      { label: 'PREFIX', value: prefix || 'FILE' },
      { label: 'TIMESTAMP', value: timestamp }
    ]
  });

  await appendCue(remoteStorageService, 'prefijos.cue', prefixEntry);
  await appendCue(remoteStorageService, 'groupnames.cue', groupEntry);
}

module.exports = {
  appendMetadataEntries
};

