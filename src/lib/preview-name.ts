// What the visitor is typing in the Instagram box, so the tag over their plot updates live.
// The 3D land reads it every frame, so no React re-render is needed.
let previewName = "";

export const setPreviewName = (name: string) => {
  previewName = name;
};

export const getPreviewName = () => previewName;
