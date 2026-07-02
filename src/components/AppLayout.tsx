import { Link, Outlet, useLocation } from "react-router-dom";

export function AppLayout() {
      const location = useLocation();
      const path = location.pathname;
      const onProjects = path === "/" || path.startsWith("/projects/");
      const onReport = path.startsWith("/report");
      const onMilestone = path.startsWith("/milestone");

      return (
            <>
                  <header className="appbar">
                        <div>
                              <h1>Quản lý dự án ra mắt sản phẩm - Feelex</h1>
                              <div className="subtitle">
                                    React + Node.js + SupTheo lưu đồ v2 · 27
                                    bước · 7 nhánh A–G · ngày dự kiến tự tính
                                    theo dependencyabase
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
                        </div>
                  </header>
                  <main>
                        <Outlet />
                  </main>
            </>
      );
}
