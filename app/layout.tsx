import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nhà Trọ gần Bệnh Viện Thánh Tâm",
  description:
    "Thông tin và quản lý nhà trọ gần Bệnh Viện Thánh Tâm. Tra cứu phòng trọ, người thuê, điện nước, hóa đơn và thanh toán.",
  applicationName: "Nhà Trọ gần Bệnh Viện Thánh Tâm",
  openGraph: {
    title: "Nhà Trọ gần Bệnh Viện Thánh Tâm",
    description:
      "Thông tin nhà trọ gần Bệnh Viện Thánh Tâm và công cụ quản lý phòng trọ.",
    type: "website",
    locale: "vi_VN",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
