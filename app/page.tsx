"use client";

import { useCallback, useEffect, useState } from "react";
import "./home.css";

type PublicRoom = {
  id: string;
  room_code: string;
  room_name: string | null;
  status: string;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const CONTACT_PHONE = "0902666859";
const CONTACT_PHONE_DISPLAY = "0902 666 859";

function isVacant(status: string) {
  const value = (status || "").trim().toLowerCase();
  return ["vacant", "available", "empty", "trống", "đang trống"].includes(value);
}

export default function HomePage() {
  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRooms = useCallback(async () => {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      setError("Website chưa được cấu hình kết nối dữ liệu phòng.");
      setLoading(false);
      return;
    }

    try {
      setError("");
      const url = `${SUPABASE_URL}/rest/v1/nhatro_rooms?select=id,room_code,room_name,status&order=room_code.asc`;
      const response = await fetch(url, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        cache: "no-store",
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error("Chưa bật quyền đọc công khai tình trạng phòng trong Supabase.");
        }
        throw new Error(`Không tải được tình trạng phòng (HTTP ${response.status}).`);
      }

      const data = (await response.json()) as PublicRoom[];
      setRooms(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được tình trạng phòng.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRooms();
    const timer = window.setInterval(() => void loadRooms(), 30000);
    return () => window.clearInterval(timer);
  }, [loadRooms]);

  const vacantRooms = rooms.filter((room) => isVacant(room.status));

  return (
    <main className="st-home">
      <header className="st-header">
        <a className="st-brand" href="/" aria-label="Trang chủ Nhà Trọ gần Bệnh Viện Thánh Tâm">
          <span className="st-brand-icon" aria-hidden="true">⌂</span>
          <span>Nhà Trọ gần Bệnh Viện Thánh Tâm</span>
        </a>
        <a className="st-admin-link" href="/admin">♙ <span>Đăng nhập quản lý</span></a>
      </header>

      <section className="st-hero">
        <div className="st-hero-copy">
          <p className="st-eyebrow">NHÀ TRỌ • THÔNG TIN PHÒNG</p>
          <h1>Nhà Trọ gần <span>Bệnh Viện Thánh Tâm</span></h1>
          <p className="st-intro">
            Cung cấp thông tin phòng trọ cho người đang tìm nơi ở thuận tiện gần Bệnh Viện Thánh Tâm.
          </p>

          <div className="st-contact-buttons">
            <a className="st-call-button" href={`tel:${CONTACT_PHONE}`}>
              <span className="st-contact-icon" aria-hidden="true">☎</span>
              <span><strong>Gọi ngay</strong><small>{CONTACT_PHONE_DISPLAY}</small></span>
            </a>
            <a className="st-zalo-button" href={`https://zalo.me/${CONTACT_PHONE}`} target="_blank" rel="noopener noreferrer">
              <span className="st-zalo-mark" aria-hidden="true">Zalo</span>
              <span><strong>Liên hệ Zalo</strong><small>{CONTACT_PHONE_DISPLAY}</small></span>
            </a>
          </div>

          <div className="st-highlights">
            <div className="st-highlight">
              <span className="st-highlight-icon">⌖</span>
              <span><strong>Vị trí thuận tiện</strong><small>Gần Bệnh Viện Thánh Tâm</small></span>
            </div>
            <div className="st-highlight">
              <span className="st-highlight-icon">✓</span>
              <span><strong>Khu vực an ninh</strong><small>Yên tĩnh, an toàn</small></span>
            </div>
            <div className="st-highlight">
              <span className="st-highlight-icon">♟</span>
              <span><strong>Phù hợp</strong><small>Bệnh nhân, người nhà, nhân viên y tế</small></span>
            </div>
          </div>
        </div>

        <div className="st-hero-photo-wrap">
          <img
            className="st-hero-photo"
            src="/benh-vien-thanh-tam.jpeg"
            alt="Hình ảnh Bệnh Viện Thánh Tâm"
          />
        </div>
      </section>

      <section className="st-rooms-section" id="phong-trong">
        <div className="st-rooms-heading">
          <div>
            <p className="st-eyebrow">CẬP NHẬT TỪ HỆ THỐNG QUẢN LÝ</p>
            <h2>Danh sách phòng trống</h2>
            <p className="st-rooms-subtitle">
              {loading ? "Đang tải tình trạng phòng..." : `${vacantRooms.length} phòng đang trống`}
              {" · "}Tự động cập nhật mỗi 30 giây
            </p>
          </div>
          <button className="st-refresh-button" onClick={() => void loadRooms()} disabled={loading}>
            ↻ Làm mới
          </button>
        </div>

        {error && (
          <div className="st-message st-error" role="alert">
            <strong>Chưa thể tải danh sách phòng.</strong>
            <p>{error}</p>
            <p>Kiểm tra biến môi trường Supabase trên Vercel và quyền đọc công khai bảng phòng.</p>
          </div>
        )}

        {!error && loading && <div className="st-message">Đang kết nối dữ liệu phòng...</div>}

        {!error && !loading && rooms.length === 0 && (
          <div className="st-message">Chưa có dữ liệu phòng. Vui lòng quay lại sau.</div>
        )}

        {!error && !loading && rooms.length > 0 && vacantRooms.length === 0 && (
          <div className="st-message">Hiện chưa có phòng trống. Vui lòng gọi hoặc nhắn Zalo để hỏi thêm.</div>
        )}

        {vacantRooms.length > 0 && (
          <div className="st-room-grid">
            {vacantRooms.map((room) => (
              <article className="st-room-card" key={room.id}>
                <div className="st-room-card-top">
                  <span className="st-room-icon" aria-hidden="true">⌂</span>
                  <span className="st-room-status">Đang trống</span>
                </div>
                <h3>{room.room_name || `Phòng ${room.room_code}`}</h3>
                <p className="st-room-code">Mã phòng: {room.room_code}</p>
                <p className="st-room-description">Phòng hiện đang trống. Vui lòng liên hệ để hỏi thông tin và hẹn xem phòng.</p>
                <div className="st-room-actions">
                  <a href={`tel:${CONTACT_PHONE}`} className="st-room-call">☎ Gọi 0902 666 859</a>
                  <a href={`https://zalo.me/${CONTACT_PHONE}`} target="_blank" rel="noopener noreferrer" className="st-room-zalo">Nhắn Zalo</a>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer className="st-footer">
        <span>© {new Date().getFullYear()} Nhà Trọ gần Bệnh Viện Thánh Tâm</span>
        <a href={`tel:${CONTACT_PHONE}`}>Liên hệ: {CONTACT_PHONE_DISPLAY}</a>
      </footer>
    </main>
  );
}
