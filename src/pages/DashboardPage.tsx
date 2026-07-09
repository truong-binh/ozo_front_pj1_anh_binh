import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { ProjectCard } from "../components/ProjectCard";
import type { ProjectDetail, ProjectSummary } from "../types";
import { computeAllDates, lateDays } from "../datePlanner";
import { useAuth } from "../auth";
import { exportStyledXlsx } from "../excelStyle";
import {
      PRODUCT_CATEGORIES,
      PRODUCT_GROUPS,
      PRODUCT_TYPES,
} from "../constants";

export function DashboardPage() {
      const { canEditProject } = useAuth();
      const [projects, setProjects] = useState<ProjectSummary[]>([]);
      const [projectDetails, setProjectDetails] = useState<ProjectDetail[]>([]);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState<string | null>(null);
      const [showCreate, setShowCreate] = useState(false);
      const [filterCode, setFilterCode] = useState("");
      const [hiddenCategories, setHiddenCategories] = useState<string[]>([]);
      const [catMenuOpen, setCatMenuOpen] = useState(false);
      const catMenuRef = useRef<HTMLDivElement>(null);
      const [form, setForm] = useState({
            code: "",
            name: "",
            type: "Mỹ phẩm",
            category: "Bao cao su",
            product_group: "A1",
            owner: "RD",
            start_date: new Date().toISOString().slice(0, 10),
      });

      async function loadProjects() {
            setLoading(true);
            setError(null);
            try {
                  const [summary, details] = await Promise.all([
                        api.listProjects(),
                        api.listProjectsWithNodes(),
                  ]);
                  setProjects(summary);
                  setProjectDetails(details);
            } catch (err) {
                  setError((err as Error).message);
            } finally {
                  setLoading(false);
            }
      }

      useEffect(() => {
            void loadProjects();
      }, []);

      useEffect(() => {
            if (!catMenuOpen) return;
            function onDown(e: MouseEvent) {
                  if (
                        catMenuRef.current &&
                        !catMenuRef.current.contains(e.target as Node)
                  ) {
                        setCatMenuOpen(false);
                  }
            }
            document.addEventListener("mousedown", onDown);
            return () => document.removeEventListener("mousedown", onDown);
      }, [catMenuOpen]);

      async function handleCreateProject() {
            if (!form.code.trim() || !form.name.trim()) {
                  setError("Vui lòng nhập mã dự án và tên dự án.");
                  return;
            }
            try {
                  setError(null);
                  await api.createProject({
                        ...form,
                        code: form.code.trim(),
                        name: form.name.trim(),
                        owner: form.owner.trim(),
                  });
                  setShowCreate(false);
                  setForm({
                        code: "",
                        name: "",
                        type: "Mỹ phẩm",
                        category: "Bao cao su",
                        product_group: "A1",
                        owner: "RD",
                        start_date: new Date().toISOString().slice(0, 10),
                  });
                  await loadProjects();
            } catch (err) {
                  setError((err as Error).message);
            }
      }


      async function handleExportCsv() {
            const full = await api.listProjectsWithNodes();
            const header = [
                  "M\u00e3 DA",
                  "D\u1ef1 \u00e1n",
                  "Lo\u1ea1i",
                  "Nh\u00f3m",
                  "Ch\u1ee7 d\u1ef1 \u00e1n",
                  "B\u01b0\u1edbc",
                  "T\u00ean b\u01b0\u1edbc",
                  "Tr\u1ea1ng th\u00e1i",
                  "PIC",
                  "S\u1ed1 ng\u00e0y",
                  "Ng\u00e0y th\u1ef1c t\u1ebf",
                  "Ph\u00f2ng",
                  "Sau b\u01b0\u1edbc",
                  "Ghi ch\u00fa",
            ];
            const rows: (string | number)[][] = [];
            full.forEach((item) => {
                  item.nodes.forEach((n) => {
                        rows.push([
                              item.project.code,
                              item.project.name,
                              item.project.type,
                              item.project.product_group || "",
                              item.project.owner || "",
                              n.node_id,
                              n.node_name || n.node_id,
                              n.status,
                              n.pic || "",
                              n.duration,
                              n.actual_date || "",
                              n.dept || "",
                              (n.after || []).join(", "),
                              n.notes || "",
                        ]);
                  });
            });
            await exportStyledXlsx({
                  filename: `feelex-tong-quan-du-an_${new Date().toISOString().slice(0, 10)}.xlsx`,
                  sheet: "D\u1ef1 \u00e1n",
                  header,
                  rows,
                  colWidths: [8, 30, 10, 8, 14, 6, 28, 12, 18, 8, 13, 8, 12, 30],
            });
      }

      const nextProjectCode = useMemo(() => {
            let bestNum = 0;
            let prefix = "DA";
            let width = 3;
            for (const project of projects) {
                  const match = /^([A-Za-z]+)(\d+)$/.exec(
                        (project.code || "").trim(),
                  );
                  if (!match) continue;
                  const num = Number(match[2]);
                  if (num > bestNum) {
                        bestNum = num;
                        prefix = match[1].toUpperCase();
                        width = match[2].length;
                  }
            }
            return `${prefix}${String(bestNum + 1).padStart(width, "0")}`;
      }, [projects]);

      const categoryOptions = useMemo(() => {
            const unique = new Set<string>(PRODUCT_CATEGORIES);
            for (const project of projects) {
                  const category = (project.category || "").trim();
                  if (category) unique.add(category);
            }
            return Array.from(unique).sort((a, b) => a.localeCompare(b, "vi"));
      }, [projects]);

      // Dropdown lọc mã dự án: liệt kê tất cả dự án, sắp xếp tăng dần theo mã.
      const projectsSortedByCode = useMemo(
            () =>
                  [...projects].sort((a, b) =>
                        a.code.localeCompare(b.code, "vi", { numeric: true }),
                  ),
            [projects],
      );

      const filteredProjects = useMemo(() => {
            const codeNeedle = filterCode.trim().toLowerCase();
            return projects
                  .filter((project) => {
                        const byCode =
                              !codeNeedle ||
                              project.code
                                    .toLowerCase()
                                    .includes(codeNeedle) ||
                              project.name.toLowerCase().includes(codeNeedle);
                        const industry = (project.category || "").trim();
                        // Ẩn (loại) các ngành hàng được chọn khỏi danh sách.
                        const byType = !hiddenCategories.includes(industry);
                        return byCode && byType;
                  })
                  .sort((a, b) =>
                        a.code.localeCompare(b.code, "vi", { numeric: true }),
                  );
      }, [projects, filterCode, hiddenCategories]);

      const statsByProjectId = useMemo(() => {
            const out = new Map<
                  number,
                  {
                        done: number;
                        total: number;
                        late: number;
                        pct: number;
                        currentStep: string;
                  }
            >();
            for (const detail of projectDetails) {
                  const dates = computeAllDates(detail);
                  let done = 0;
                  let total = 0;
                  let late = 0;
                  let currentStep = "Hoàn tất tất cả bước";

                  for (const node of detail.nodes) {
                        if (node.status === "Bỏ qua") continue;
                        total += 1;
                        if (node.status === "Đã xong") done += 1;
                        if (lateDays(detail, node.node_id, dates) > 0)
                              late += 1;
                  }

                  const current =
                        detail.nodes.find((n) => n.status === "Đang làm") ||
                        detail.nodes.find((n) => n.status === "Chưa làm") ||
                        detail.nodes.find((n) => n.status === "Tạm dừng");
                  if (current) {
                        currentStep = `${current.node_id} - ${current.node_name || current.node_id}`;
                  }

                  out.set(detail.project.id, {
                        done,
                        total,
                        late,
                        pct: total > 0 ? done / total : 0,
                        currentStep,
                  });
            }
            return out;
      }, [projectDetails]);

      if (loading)
            return (
                  <div className="empty-state">Đang tải danh sách dự án...</div>
            );
      if (error)
            return <div className="empty-state">Lỗi tải dữ liệu: {error}</div>;

      return (
            <>
                  <div className="project-header">
                        <h2>Tổng quan dự án</h2>
                        <div className="meta">
                              <span>Tổng số dự án: {projects.length}</span>
                              <span>
                                    Đang hiển thị: {filteredProjects.length}
                              </span>
                        </div>
                        <div className="actions">
                              {canEditProject && (
                                    <button
                                          className="btn action-btn"
                                          onClick={() => {
                                                setForm((s) => ({
                                                      ...s,
                                                      code: nextProjectCode,
                                                }));
                                                setShowCreate(true);
                                          }}
                                    >
                                          + Dự án mới
                                    </button>
                              )}
                              <button
                                    className="btn action-btn"
                                    onClick={() => void handleExportCsv()}
                              >
                                    Xuất Excel
                              </button>
                              {/* <label className="btn action-btn file-btn">
            Khôi phục JSON
            <input
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  void handleImportJson(file)
                }
              }}
            />
          </label> */}
                              {/* <button
                                    className="btn action-btn danger-btn"
                                    onClick={() =>
                                          void handleDeleteLastProject()
                                    }
                              >
                                    Xóa dự án cuối
                              </button> */}
                        </div>
                  </div>
                  <div className="dashboard-filters">
                        <div className="dashboard-filter-field">
                              <label htmlFor="filter-project-code">
                                    Lọc theo mã dự án
                              </label>
                              <select
                                    id="filter-project-code"
                                    value={filterCode}
                                    onChange={(e) =>
                                          setFilterCode(e.target.value)
                                    }
                              >
                                    <option value="">Tất cả mã dự án</option>
                                    {projectsSortedByCode.map((project) => (
                                          <option
                                                key={project.id}
                                                value={project.code}
                                          >
                                                {project.code} — {project.name}
                                          </option>
                                    ))}
                              </select>
                        </div>
                        <div className="dashboard-filter-field">
                              <label>Lọc ngành hàng</label>
                              <div
                                    className="cat-multiselect"
                                    ref={catMenuRef}
                              >
                                    <button
                                          type="button"
                                          className="cat-multiselect-btn"
                                          onClick={() =>
                                                setCatMenuOpen((v) => !v)
                                          }
                                    >
                                          <span>
                                                {hiddenCategories.length === 0
                                                      ? "Tất cả ngành hàng"
                                                      : `Đang ẩn ${hiddenCategories.length} ngành`}
                                          </span>
                                          <span className="cat-caret">▾</span>
                                    </button>
                                    {catMenuOpen && (
                                          <div className="cat-multiselect-menu">
                                                {categoryOptions.map(
                                                      (category) => {
                                                            const checked =
                                                                  hiddenCategories.includes(
                                                                        category,
                                                                  );
                                                            return (
                                                                  <label
                                                                        key={
                                                                              category
                                                                        }
                                                                        className="cat-multiselect-item"
                                                                  >
                                                                        <input
                                                                              type="checkbox"
                                                                              checked={
                                                                                    checked
                                                                              }
                                                                              onChange={() =>
                                                                                    setHiddenCategories(
                                                                                          (
                                                                                                prev,
                                                                                          ) =>
                                                                                                checked
                                                                                                      ? prev.filter(
                                                                                                              (c) =>
                                                                                                                    c !==
                                                                                                                    category,
                                                                                                        )
                                                                                                      : [
                                                                                                              ...prev,
                                                                                                              category,
                                                                                                        ],
                                                                                    )
                                                                              }
                                                                        />
                                                                        {category}
                                                                  </label>
                                                            );
                                                      },
                                                )}
                                          </div>
                                    )}
                              </div>
                        </div>
                        <button
                              className="btn action-btn compact-btn"
                              onClick={() => {
                                    setFilterCode("");
                                    setHiddenCategories([]);
                              }}
                        >
                              Xóa bộ lọc
                        </button>
                  </div>
                  <div className="project-grid">
                        {filteredProjects.map((project) => (
                              <ProjectCard
                                    key={project.id}
                                    project={project}
                                    stats={statsByProjectId.get(project.id)}
                              />
                        ))}
                  </div>
                  {showCreate && (
                        <div
                              className="modal-backdrop"
                              onClick={() => setShowCreate(false)}
                        >
                              <div
                                    className="modal-card create-project-modal"
                                    onClick={(e) => e.stopPropagation()}
                              >
                                    <h3 className="create-modal-title">
                                          Tạo dự án mới
                                    </h3>
                                    <div className="modal-sub create-modal-sub">
                                          Tạo dự án mới sẽ khởi tạo đủ 27 bước
                                          với trạng thái "Chưa làm".
                                    </div>
                                    <div className="create-form-layout">
                                          <div className="create-row-full">
                                                <label htmlFor="new-project-code">
                                                      Mã dự án
                                                </label>
                                                <input
                                                      id="new-project-code"
                                                      placeholder="VD: DA048"
                                                      value={form.code}
                                                      onChange={(e) =>
                                                            setForm((s) => ({
                                                                  ...s,
                                                                  code: e.target
                                                                        .value,
                                                            }))
                                                      }
                                                />
                                          </div>
                                          <div className="create-row-full">
                                                <label htmlFor="new-project-name">
                                                      Tên dự án
                                                </label>
                                                <input
                                                      id="new-project-name"
                                                      placeholder="VD: Gel bôi trơn Cooling Mint"
                                                      value={form.name}
                                                      onChange={(e) =>
                                                            setForm((s) => ({
                                                                  ...s,
                                                                  name: e.target
                                                                        .value,
                                                            }))
                                                      }
                                                />
                                          </div>
                                          <div>
                                                <label htmlFor="new-project-type">
                                                      Loại sản phẩm
                                                </label>
                                                <select
                                                      id="new-project-type"
                                                      value={form.type}
                                                      onChange={(e) =>
                                                            setForm((s) => ({
                                                                  ...s,
                                                                  type: e.target
                                                                        .value,
                                                            }))
                                                      }
                                                >
                                                      {PRODUCT_TYPES.map(
                                                            (type) => (
                                                                  <option
                                                                        key={type}
                                                                        value={
                                                                              type
                                                                        }
                                                                  >
                                                                        {type}
                                                                  </option>
                                                            ),
                                                      )}
                                                </select>
                                          </div>
                                          <div>
                                                <label htmlFor="new-project-group">
                                                      Phân nhóm sản phẩm
                                                </label>
                                                <select
                                                      id="new-project-group"
                                                      value={form.product_group}
                                                      onChange={(e) =>
                                                            setForm((s) => ({
                                                                  ...s,
                                                                  product_group:
                                                                        e.target
                                                                              .value,
                                                            }))
                                                      }
                                                >
                                                      {PRODUCT_GROUPS.map(
                                                            (group) => (
                                                                  <option
                                                                        key={
                                                                              group
                                                                        }
                                                                        value={
                                                                              group
                                                                        }
                                                                  >
                                                                        {group}
                                                                  </option>
                                                            ),
                                                      )}
                                                </select>
                                          </div>
                                          <div className="create-row-full">
                                                <label htmlFor="new-project-category">
                                                      Phân loại ngành hàng
                                                </label>
                                                <select
                                                      id="new-project-category"
                                                      value={form.category}
                                                      onChange={(e) =>
                                                            setForm((s) => ({
                                                                  ...s,
                                                                  category:
                                                                        e.target
                                                                              .value,
                                                            }))
                                                      }
                                                >
                                                      {PRODUCT_CATEGORIES.map(
                                                            (category) => (
                                                                  <option
                                                                        key={
                                                                              category
                                                                        }
                                                                        value={
                                                                              category
                                                                        }
                                                                  >
                                                                        {category}
                                                                  </option>
                                                            ),
                                                      )}
                                                </select>
                                          </div>
                                          <div className="field-owner">
                                                <label htmlFor="new-project-owner">
                                                      Người chủ trì
                                                </label>
                                                <input
                                                      id="new-project-owner"
                                                      placeholder="VD: RD"
                                                      value={form.owner}
                                                      onChange={(e) =>
                                                            setForm((s) => ({
                                                                  ...s,
                                                                  owner: e
                                                                        .target
                                                                        .value,
                                                            }))
                                                      }
                                                />
                                          </div>
                                          <div className="field-start-date">
                                                <label htmlFor="new-project-start-date">
                                                      Ngày bắt đầu
                                                </label>
                                                <input
                                                      id="new-project-start-date"
                                                      type="date"
                                                      value={form.start_date}
                                                      onChange={(e) =>
                                                            setForm((s) => ({
                                                                  ...s,
                                                                  start_date:
                                                                        e.target
                                                                              .value,
                                                            }))
                                                      }
                                                />
                                          </div>
                                    </div>
                                    <div className="modal-actions">
                                          <button
                                                className="btn action-btn"
                                                onClick={() =>
                                                      setShowCreate(false)
                                                }
                                          >
                                                Hủy
                                          </button>
                                          <button
                                                className="btn primary"
                                                onClick={() =>
                                                      void handleCreateProject()
                                                }
                                          >
                                                Lưu
                                          </button>
                                    </div>
                              </div>
                        </div>
                  )}
            </>
      );
}
