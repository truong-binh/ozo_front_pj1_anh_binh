import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

export function AppLayout() {
      const location = useLocation();
      const navigate = useNavigate();
      const { user, logout, elevate } = useAuth();
      const path = location.pathname;
      const onProjects = path === "/" || path.startsWith("/projects/");
      const onReport = path.startsWith("/report");
      const onMilestone = path.startsWith("/milestone");
      const onPic = path.startsWith("/pic-members");

      function handleLogout() {
            logout();
            navigate("/login", { replace: true });
      }

      async function handleElevate() {
            const code = window.prompt("Nhập mã quản lý để mở quyền sửa tất cả:");
            if (!code) return;
            try {
                  await elevate(code.trim());
            } catch (err) {
                  window.alert((err as Error).message);
            }
      }

      const roleLabel =
            user?.role === "manager"
                  ? "Quản lý · sửa tất cả"
                  : user?.role === "PIC"
                    ? `PIC · ${user.picName || ""}`
                    : "Chỉ xem";
      const roleClass =
            user?.role === "manager"
                  ? "role-manager"
                  : user?.role === "PIC"
                    ? "role-PIC"
                    : "role-viewer";

      return (
            <>
                  <header className="appbar">
                        <div>
                              <h1>Quản lý dự án ra mắt sản phẩm - Feelex</h1>
                              <div className="subtitle">
                                    React + Node.js + Supabase · 27 bước · 7
                                    nhánh A–G · ngày dự kiến tự tính theo
                                    dependency
                              </div>
                        </div>
                        <div className="toolbar">
                              <Link
                                    to="/"
                                    className={`btn ghost ${onProjects ? "active" : ""}`}
                              >
                                    Các dự án
                              </Link>
                              <Link
                                    to="/report"
                                    className={`btn ghost ${onReport ? "active" : ""}`}
                              >
                                    Báo cáo
                              </Link>
                              <Link
                                    to="/milestone"
                                    className={`btn ghost ${onMilestone ? "active" : ""}`}
                              >
                                    Milestone
                              </Link>
                              {user?.role === "manager" && (
                                    <Link
                                          to="/pic-members"
                                          className={`btn ghost ${onPic ? "active" : ""}`}
                                    >
                                          PIC
                                    </Link>
                              )}
                              {user && (
                                    <span className="user-chip">
                                          <span className="user-email">
                                                {user.email}
                                          </span>
                                          <span
                                                className={`role-badge ${roleClass}`}
                                          >
                                                {roleLabel}
                                          </span>
                                    </span>
                              )}
                              {user && user.role !== "manager" && (
                                    <button
                                          className="btn ghost"
                                          onClick={() => void handleElevate()}
                                    >
                                          Quản lý
                                    </button>
                              )}
                              <button
                                    className="btn ghost"
                                    onClick={handleLogout}
                              >
                                    Đăng xuất
                              </button>
                        </div>
                  </header>
                  <main>
                        <Outlet />
                  </main>
            </>
      );
}
