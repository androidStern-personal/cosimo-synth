import {
  addMsegPoint,
  deleteMsegPoint,
  moveMsegPoint,
  setMsegSegmentCurvePower,
} from "../../../../../ui/shared/mseg.ts";

const readEditShapeIndex = (editShapeIndexRef) => (
  editShapeIndexRef.current === 1 ? 1 : 0
);

/**
 * Adapt one port-backed MSEG slot to the shared editor controller contract.
 * The slot getter remains live so every gesture starts from the latest port snapshot.
 */
export function createMsegPortController({
  getSlot,
  setShape: writeShape,
  setPlayback: writePlayback = () => {},
  editShapeIndexRef,
}) {
  const controller = {
    getState() {
      const slot = getSlot();
      const editShapeIndex = readEditShapeIndex(editShapeIndexRef);
      return {
        shape: editShapeIndex === 0 ? slot.shapeA : slot.shapeB,
        shapeA: slot.shapeA,
        shapeB: slot.shapeB,
        referenceShape: editShapeIndex === 0 ? slot.shapeB : slot.shapeA,
        editShapeIndex,
        morph: slot.morph,
        playback: slot.playback,
        depth: 1,
      };
    },

    setShape(nextShape) {
      writeShape(readEditShapeIndex(editShapeIndexRef), nextShape);
    },

    setEditShapeIndex(shapeIndex) {
      editShapeIndexRef.current = shapeIndex === 1 ? 1 : 0;
    },

    setPlayback(nextPlayback) {
      writePlayback(nextPlayback);
    },

    addPoint(x, y) {
      controller.setShape(addMsegPoint(controller.getState().shape, x, y));
    },

    movePoint(pointIndex, x, y) {
      controller.setShape(moveMsegPoint(controller.getState().shape, pointIndex, x, y));
    },

    deletePoint(pointIndex) {
      controller.setShape(deleteMsegPoint(controller.getState().shape, pointIndex));
    },

    setSegmentCurvePower(segmentIndex, curvePower) {
      controller.setShape(setMsegSegmentCurvePower(
        controller.getState().shape,
        segmentIndex,
        curvePower,
      ));
    },
  };

  return controller;
}
