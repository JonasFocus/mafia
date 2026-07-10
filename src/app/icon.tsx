import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
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
            border: "10px solid rgba(255, 247, 239, 0.16)",
            borderRadius: 112,
            display: "flex",
            fontFamily: "sans-serif",
            fontSize: 250,
            fontWeight: 700,
            height: 340,
            justifyContent: "center",
            lineHeight: 1,
            width: 340,
          }}
        >
          M
        </div>
      </div>
    ),
    size,
  );
}
