export interface EditSnapshot {
  input: string;
  start: number;
  end: number;
  format: string;
  resolution: string;
  frameRate: string;
}

export function isEditDirty(current: EditSnapshot, saved: EditSnapshot): boolean {
  const normalize = (edit: EditSnapshot) => {
    const audio = edit.format === 'mp3' || edit.format === 'wav';
    return [edit.input, edit.start.toFixed(6), edit.end.toFixed(6), edit.format,
      audio ? '' : edit.resolution, audio ? '' : edit.frameRate];
  };
  return JSON.stringify(normalize(current)) !== JSON.stringify(normalize(saved));
}
