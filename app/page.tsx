"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type PublicRoom = {
  id: string;
  room_code: string;
  room_name: string | null;
  status: "occupied" | "vacant" | "maintenance";
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";


export default function HomePage() {
  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [roomsError, setRoomsError] = useState("");

  const loadPublicRooms = useCallback(async () => {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      setRoomsError("Website chưa được cấu hình kết nối dữ liệu phòng.");
      setLoadingRooms(false);
      return;
    }
    try {
      setRoomsError("");
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/nhatro_rooms?select=id,room_code,room_name,status&order=room_code.asc`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
          },
          cache: "no-store",
        }
      );
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(
          response.status === 401 || response.status === 403
            ? "Chưa bật quyền xem tình trạng phòng công khai trong Supabase."
            : `Không tải được danh sách phòng (${response.status}). ${detail}`
        );
      }
      const data = (await response.json()) as PublicRoom[];
      setRooms(data);
    } catch (error) {
      setRoomsError(
        error instanceof Error ? error.message : "Không tải được tình trạng phòng."
      );
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  useEffect(() => {
    void loadPublicRooms();
    const timer = window.setInterval(() => void loadPublicRooms(), 30000);
    return () => window.clearInterval(timer);
  }, [loadPublicRooms]);

  const vacantRooms = rooms.filter((room) => room.status === "vacant");
  const vacantCount = vacantRooms.length;

  return (
    <main className="public-home">
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon">🏠</span>
          <span>Nhà Trọ gần Bệnh Viện Thánh Tâm</span>
        </div>
        <Link className="admin-link" href="/admin">Đăng nhập quản lý</Link>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">NHÀ TRỌ • THÔNG TIN PHÒNG</p>
          <h1>Nhà Trọ gần<br /><span>Bệnh Viện Thánh Tâm</span></h1>
          <p className="intro">
            Trang thông tin nhà trọ dành cho người đang tìm nơi ở thuận tiện
            gần Bệnh Viện Thánh Tâm.
          </p>
          <div className="hero-actions">
            <a className="primary-btn" href="#thong-tin">Xem thông tin</a>
            <Link className="secondary-btn" href="/admin">Khu vực quản lý</Link>
          </div>
        </div>
        <div className="hero-art" aria-label="Minh họa ngôi nhà">
          <div className="sun" />
          <div className="house">
            <div className="roof" />
            <div className="house-body">
              <div className="window window-left" />
              <div className="door" />
              <div className="window window-right" />
            </div>
          </div>
          <div className="ground" />
          <div className="art-caption">Một nơi ở gọn gàng, thuận tiện</div>
        </div>
      </section>

      <section className="room-section" id="thong-tin">
        <div className="room-section-heading">
          <div>
            <p className="eyebrow">CẬP NHẬT TỪ HỆ THỐNG QUẢN LÝ</p>
            <h2>Tình trạng phòng trọ</h2>
            <p className="room-subtitle">
              {loadingRooms
                ? "Đang tải danh sách phòng..."
                : `${vacantCount} phòng đang trống`}
              {" · "}Tự động làm mới mỗi 30 giây
            </p>
          </div>
          <button className="refresh-btn" onClick={() => void loadPublicRooms()} disabled={loadingRooms}>
            {loadingRooms ? "Đang tải..." : "↻ Làm mới"}
          </button>
        </div>

        {roomsError && (
          <div className="room-error" role="alert">
            <b>Chưa thể tải tình trạng phòng.</b>
            <p>{roomsError}</p>
            <p>Quản trị viên cần bật quyền đọc công khai bảng phòng theo hướng dẫn đi kèm trong ZIP.</p>
          </div>
        )}

        {!roomsError && !loadingRooms && rooms.length === 0 && (
          <div className="empty-rooms">Chưa có dữ liệu phòng. Vui lòng quay lại sau.</div>
        )}

        {!roomsError && !loadingRooms && rooms.length > 0 && vacantRooms.length === 0 && (
          <div className="empty-rooms">Hiện chưa có phòng trống. Vui lòng liên hệ để hỏi thêm thông tin.</div>
        )}

        {loadingRooms && rooms.length === 0 && (
          <div className="empty-rooms">Đang kết nối dữ liệu phòng...</div>
        )}

        {vacantRooms.length > 0 && (
          <div className="room-grid">
            {vacantRooms.map((room) => (
              <article className="room-card" key={room.id}>
                <div className="room-card-top">
                  <span className="room-symbol">🏠</span>
                  <span className="room-status vacant">Đang trống</span>
                </div>
                <h3>{room.room_name || `Phòng ${room.room_code}`}</h3>
                <p className="room-code">Mã phòng: {room.room_code}</p>
                <p className="room-card-note">
                  Phòng hiện đang trống. Vui lòng liên hệ để hỏi thông tin và hẹn xem phòng.
                </p>
                <div className="room-contact-actions">
                  <a className="room-contact-call" href="tel:0902666859">☎ Gọi 0902 666 859</a>
                  <a className="room-contact-zalo" href="https://zalo.me/0902666859" target="_blank" rel="noopener noreferrer">💬 Liên hệ Zalo</a>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="notice">
        <div>
          <p className="eyebrow">THÔNG TIN CHO NGƯỜI TÌM PHÒNG</p>
          <h2>{vacantCount > 0 ? `Hiện có ${vacantCount} phòng trống` : "Vui lòng liên hệ để hỏi phòng"}</h2>
          <p>Tình trạng phòng được lấy từ hệ thống quản lý. Gọi điện hoặc nhắn Zalo để hỏi thông tin và hẹn xem phòng.</p>
          <div className="notice-contact-actions">
            <a className="primary-btn" href="tel:0902666859">☎ 0902 666 859</a>
            <a className="secondary-btn" href="https://zalo.me/0902666859" target="_blank" rel="noopener noreferrer">💬 Nhắn Zalo</a>
          </div>
        </div>
        <span className="notice-icon">🔑</span>
      </section>

      <footer>
        <span>© {new Date().getFullYear()} Nhà Trọ gần Bệnh Viện Thánh Tâm</span>
        <Link href="/admin">Đăng nhập quản lý</Link>
      </footer>

      <style jsx>{`
        :global(*) { box-sizing: border-box; }
        :global(html) { scroll-behavior: smooth; }
        :global(body) { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #172b4d; background: #f5f8fc; }
        .public-home { min-height: 100vh; overflow: hidden; }
        .topbar { max-width: 1180px; margin: 0 auto; padding: 22px 24px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
        .brand { display: flex; align-items: center; gap: 10px; font-size: 18px; font-weight: 800; }
        .brand-icon { display: grid; place-items: center; background: white; border-radius: 12px; width: 42px; height: 42px; box-shadow: 0 6px 18px #19365b12; }
        .admin-link { color: #1e4fd7; text-decoration: none; font-weight: 700; padding: 11px 16px; border: 1px solid #d7e1f0; background: white; border-radius: 12px; }
        .hero { max-width: 1180px; margin: 18px auto 0; padding: 42px 24px 56px; display: grid; grid-template-columns: 1.05fr .95fr; align-items: center; gap: 42px; }
        .eyebrow { color: #2457d6; letter-spacing: .14em; font-size: 12px; font-weight: 800; }
        h1 { font-size: clamp(38px, 5vw, 62px); line-height: 1.08; margin: 18px 0; letter-spacing: -.04em; color: #10264a; }
        h1 span { color: #2457d6; }
        .intro { color: #5d6d84; font-size: 18px; line-height: 1.75; max-width: 570px; }
        .hero-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 28px; }
        .primary-btn, .secondary-btn { display: inline-flex; align-items: center; justify-content: center; text-decoration: none; border-radius: 12px; padding: 14px 19px; font-weight: 800; }
        .primary-btn { color: white; background: #2457d6; box-shadow: 0 8px 18px #2457d633; }
        .secondary-btn { color: #1c3762; background: white; border: 1px solid #dce5f2; }
        .hero-art { min-height: 360px; border-radius: 30px; background: linear-gradient(145deg, #e3edff, #f4f8ff 65%, #d8e9ff); position: relative; display: flex; justify-content: center; align-items: center; overflow: hidden; }
        .sun { position: absolute; right: 16%; top: 12%; width: 76px; height: 76px; border-radius: 50%; background: #ffd77c; }
        .house { position: relative; width: 260px; margin-top: 40px; z-index: 2; }
        .roof { height: 140px; background: #2457d6; clip-path: polygon(50% 0, 100% 58%, 88% 69%, 50% 28%, 12% 69%, 0 58%); }
        .house-body { height: 165px; background: #fff; margin: -1px 20px 0; border-radius: 5px 5px 12px 12px; display: flex; justify-content: space-around; align-items: center; box-shadow: 0 15px 25px #19365b15; }
        .window { width: 42px; height: 48px; background: #bfe4ff; border: 5px solid #2457d6; border-radius: 5px; }
        .door { width: 48px; height: 85px; background: #f0b86b; border-radius: 7px 7px 0 0; align-self: end; }
        .ground { position: absolute; height: 25px; bottom: 56px; width: 75%; border-radius: 50%; background: #b6d9b9; }
        .art-caption { position: absolute; bottom: 20px; color: #526884; font-size: 13px; font-weight: 700; }
        .features { max-width: 1180px; margin: 0 auto; padding: 0 24px 54px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
        .feature-card { padding: 24px; background: white; border: 1px solid #e4ebf5; border-radius: 18px; box-shadow: 0 8px 24px #19365b08; }
        .feature-icon { font-size: 28px; }
        .feature-card h2 { font-size: 18px; margin: 14px 0 8px; }
        .feature-card p, .notice p { color: #65758c; line-height: 1.7; margin-bottom: 0; }
        .notice { max-width: 1132px; margin: 0 auto 48px; padding: 28px 32px; border-radius: 22px; background: #eaf1ff; display: flex; justify-content: space-between; align-items: center; gap: 20px; }
        .notice h2 { margin: 8px 0; font-size: 24px; }
        .notice-icon { font-size: 42px; }
        footer { border-top: 1px solid #e0e8f3; padding: 22px 24px; max-width: 1180px; margin: 0 auto; display: flex; justify-content: space-between; gap: 16px; color: #748198; font-size: 13px; }
        footer a { color: #2457d6; text-decoration: none; font-weight: 700; }
        .room-section { max-width: 1180px; margin: 0 auto; padding: 0 24px 42px; }
        .room-section-heading { display: flex; justify-content: space-between; align-items: end; gap: 16px; margin-bottom: 20px; }
        .room-section-heading h2 { margin: 8px 0; font-size: 30px; color: #10264a; }
        .room-subtitle { color: #65758c; margin: 0; line-height: 1.6; }
        .refresh-btn { border: 1px solid #d7e1f0; background: white; color: #1c3762; border-radius: 10px; padding: 11px 14px; font-weight: 700; cursor: pointer; white-space: nowrap; }
        .refresh-btn:disabled { opacity: .6; cursor: wait; }
        .room-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
        .room-card { background: white; border: 1px solid #e4ebf5; border-radius: 18px; padding: 20px; box-shadow: 0 8px 24px #19365b08; }
        .room-card-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .room-symbol { display: grid; place-items: center; width: 42px; height: 42px; background: #f0f5ff; border-radius: 12px; font-size: 22px; }
        .room-status { font-size: 12px; font-weight: 800; padding: 7px 9px; border-radius: 999px; white-space: nowrap; }
        .room-status.vacant { background: #dcfce7; color: #166534; }
        .room-status.occupied { background: #e7eefb; color: #36527b; }
        .room-status.maintenance { background: #fff0cc; color: #8a4b08; }
        .room-card h3 { font-size: 20px; margin: 18px 0 5px; color: #172b4d; }
        .room-code { color: #77869b; font-size: 13px; margin: 0; }
        .room-price { margin-top: 18px; color: #2457d6; font-size: 24px; font-weight: 800; }
        .room-price span { color: #718096; font-size: 13px; font-weight: 500; margin-left: 5px; }
        .room-card-note { color: #65758c; line-height: 1.6; font-size: 14px; margin: 12px 0 0; }
        .room-contact-actions, .notice-contact-actions { display: flex; gap: 9px; flex-wrap: wrap; margin-top: 18px; }
        .room-contact-actions a { display: inline-flex; justify-content: center; align-items: center; border-radius: 10px; padding: 10px 12px; text-decoration: none; font-size: 13px; font-weight: 800; }
        .room-contact-call { background: #2457d6; color: white; }
        .room-contact-zalo { background: #e8f2ff; color: #1455a5; border: 1px solid #cfe2ff; }
        .notice-contact-actions .primary-btn, .notice-contact-actions .secondary-btn { margin-top: 4px; }
        .room-error, .empty-rooms { background: white; border: 1px solid #e4ebf5; border-radius: 16px; padding: 22px; color: #526884; line-height: 1.6; }
        .room-error { border-color: #fecaca; background: #fff7f7; color: #991b1b; }
        .room-error p { margin: 6px 0; }
        @media (max-width: 760px) {
          .topbar { padding: 16px; align-items: flex-start; }
          .brand { font-size: 15px; max-width: 230px; }
          .admin-link { font-size: 12px; white-space: nowrap; padding: 10px; }
          .hero { grid-template-columns: 1fr; padding: 30px 16px 38px; gap: 26px; margin-top: 0; }
          .intro { font-size: 16px; }
          .hero-art { min-height: 300px; }
          .features { grid-template-columns: 1fr; padding: 0 16px 36px; }
          .room-section { padding: 0 16px 32px; }
          .room-section-heading { align-items: flex-start; }
          .room-section-heading h2 { font-size: 25px; }
          .room-grid { grid-template-columns: 1fr; }
          .room-contact-actions { flex-direction: column; }
          .room-contact-actions a { width: 100%; }
          .notice-contact-actions { flex-direction: column; }
          .notice-contact-actions a { width: 100%; }
          .notice { margin: 0 16px 32px; padding: 22px; }
          .notice h2 { font-size: 20px; }
          footer { padding: 20px 16px; flex-direction: column; }
        }
      `}</style>
    </main>
  );
}
