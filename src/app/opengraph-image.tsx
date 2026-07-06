import { ImageResponse } from "next/og";

export const alt = "Mafia - a party game of bluffing and deduction";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(ellipse at 50% -10%, #2a2140, #0a0912 60%)",
          color: "#f3f2f8",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 150, fontWeight: 800, letterSpacing: -6 }}>Mafia</div>
        <div
          style={{
            fontSize: 40,
            color: "#94909f",
            marginTop: 8,
            maxWidth: 800,
            textAlign: "center",
          }}
        >
          One of you is faking it. Blend in, or expose the impostor.
        </div>
      </div>
    ),
    { ...size },
  );
}
