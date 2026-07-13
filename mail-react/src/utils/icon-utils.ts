export interface IconInfo {
  icon: string;
  width?: number;
  height?: number;
  color?: string;
}

export function getIconByName(filename: string): IconInfo {
  const lower = filename.toLowerCase();
  const ext = lower.includes('.') ? lower.slice(lower.lastIndexOf('.') + 1) : '';

  if (['zip', 'rar', '7z', 'tar', 'tgz'].includes(ext)) {
    return { icon: 'mdi:zip-box', color: '#FBBD08' };
  }
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'jfif'].includes(ext)) {
    return { icon: 'fluent-color:image-24', width: 24, height: 24 };
  }
  if (['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv'].includes(ext)) {
    return { icon: 'fluent:video-clip-20-filled', color: '#658bff' };
  }
  if (['txt', 'md', 'ini', 'conf'].includes(ext)) {
    return { icon: 'fluent-color:document-48', width: 24, height: 24 };
  }
  if (['doc', 'docx'].includes(ext)) {
    return { icon: 'vscode-icons:file-type-word', width: 24, height: 24 };
  }
  if (['xls', 'csv', 'xlsx'].includes(ext)) {
    return { icon: 'vscode-icons:file-type-excel', width: 24, height: 24 };
  }
  if (['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a'].includes(ext)) {
    return { icon: 'lineicons:apple-music', color: '#e91e63' };
  }
  if (['ppt', 'pptx', 'pps', 'potx', 'pot'].includes(ext)) {
    return { icon: 'vscode-icons:file-type-powerpoint', width: 24, height: 24 };
  }
  if (ext === 'pdf') {
    return { icon: 'material-icon-theme:pdf', width: 24, height: 24 };
  }

  return { icon: 'solar:paperclip-rounded-2-bold', color: '#1CBBF0' };
}