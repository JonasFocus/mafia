import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "linear-gradient(145deg, #21191d 0%, #070506 72%)",
          color: "#fff7ef",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <div
          style={{
            alignItems: "center",
            background: "linear-gradient(180deg, #e04b55 0%, #b8202b 62%, #6f1118 100%)",
            border: "4px solid rgba(255, 247, 239, 0.16)",
            borderRadius: 38,
            display: "flex",
            fontFamily: "sans-serif",
            fontSize: 88,
            fontWeight: 700,
            height: 122,
            justifyContent: "center",
            lineHeight: 1,
            width: 122,
          }}
        >
          M
        </div>
      </div>
    ),
    size,
  );
}
