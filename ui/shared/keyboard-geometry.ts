function getPitchClass(noteNumber: number) {
    const safeNoteNumber = Math.round(Number(noteNumber) || 0);
    return ((safeNoteNumber % 12) + 12) % 12;
}

function isNaturalNoteNumber(noteNumber: number) {
    const pitchClass = getPitchClass(noteNumber);

    return pitchClass === 0 ||
        pitchClass === 2 ||
        pitchClass === 4 ||
        pitchClass === 5 ||
        pitchClass === 7 ||
        pitchClass === 9 ||
        pitchClass === 11;
}

export function countNaturalNotesInRange(rootNote: number, noteCount: number) {
    const safeRootNote = Math.round(Number(rootNote) || 0);
    const safeNoteCount = Math.max(1, Math.round(Number(noteCount) || 0));
    let naturalCount = 0;

    for (let noteOffset = 0; noteOffset < safeNoteCount; noteOffset += 1) {
        if (isNaturalNoteNumber(safeRootNote + noteOffset)) {
            naturalCount += 1;
        }
    }

    return Math.max(1, naturalCount);
}

export function computeKeyboardDimensions({
    rootNote,
    noteCount,
    availableWidth,
    minNaturalWidth = 18,
}: {
    rootNote: number;
    noteCount: number;
    availableWidth: number;
    minNaturalWidth?: number;
}) {
    const naturalCount = countNaturalNotesInRange(rootNote, noteCount);
    const safeAvailableWidth = Math.max(0, Number(availableWidth) || 0);
    const unclampedNaturalWidth = Math.max(1, (safeAvailableWidth - 1) / naturalCount);
    const naturalWidth = Math.max(Number(minNaturalWidth) || 0, unclampedNaturalWidth);
    const accidentalWidth = Math.max(8, naturalWidth * 0.58);

    return {
        naturalCount,
        naturalWidth,
        accidentalWidth,
    };
}
