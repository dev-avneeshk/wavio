import { ImageResponse } from "next/og";

// The home-screen icon on iPhones (Add to Home Screen opens the game full screen).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#d23f2f" }}>
        <svg width="112" height="112" viewBox="0 0 64 64">
          <path fill="#fff" d="M32 13.5 12.5 30.2h5.5V50h10.4V38.4h7.2V50h10.4V30.2h5.5z" />
        </svg>
      </div>
    ),
    size,
  );
}
