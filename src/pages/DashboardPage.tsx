import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { ProjectCard } from "../components/ProjectCard";
import type { ProjectDetail, ProjectSummary } from "../types";
import { computeAllDates, lateDays } from "../datePlanner";
import {
      PRODUCT_CATEGORIES,
      PRODUCT_GROUPS,
      PRODUCT_TYPES,
} from "../constants";

export function DashboardPage() {
      const [projects, setProjects] = useState<ProjectSummary[]>([]);
      const [projectDetails, setProjectDetails] = useState<ProjectDetail[]>([]);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState<string | null>(null);
      const [showCreate, setShowCreate] = useState(false);
      const [filterCode, setFilterCode] = useState("");
      const [filterType, setFilterType] = useState("");
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


      async function handleExportJson() {
            const full = await api.listProjectsWithNodes();
            const payload = {
                  projects: full.map((item) => ({
                        id: item.project.code,
                        name: item.project.name,
                        type: item.project.type,
                        category: item.project.category || "",
                        group: item.project.product_group || "",
                        owner: item.project.owner || "",
                        startDate: item.project.start_date,
                        nodes: Object.fromEntries(
                              item.nodes.map((n) => [
                                    n.node_id,
                                    {
                                          status: n.status,
                                          pic: n.pic || "",
                                          duration: n.duration,
                                          actualDate: n.actual_date || "",
                                          notes: n.notes || "",
                                          after: n.after || [],
                                          dept: n.dept || "",
                                          attachments: [],
                                    },
                              ]),
                        ),
                  })),
            };
            const blob = new Blob([JSON.stringify(payload, null, 2)], {
                  type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `feelex-backup-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
      }

      async function handleExportCsv() {
            const full = await api.listProjectsWithNodes();
            const headers = [
                  "ProjectCode",
                  "ProjectName",
                  "Type",
                  "Group",
                  "Owner",
                  "NodeId",
                  "NodeName",
                  "Status",
                  "PIC",
                  "Duration",
                  "ActualDate",
                  "Dept",
                  "After",
                  "Notes",
            ];
            const rows: string[][] = [headers];
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
                              String(n.duration),
                              n.actual_date || "",
                              n.dept || "",
                              (n.after || []).join("|"),
                              n.notes || "",
                        ]);
                  });
            });
            const csv = rows
                  .map((row) =>
                        row
                              .map((cell) => {
                                    const s = String(cell);
                                    if (
                                          s.includes(",") ||
                                          s.includes('"') ||
                                          s.includes("\n")
                                    ) {
                                          return `"${s.replace(/"/g, '""')}"`;
                                    }
                                    return s;
                              })
                              .join(","),
                  )
                  .join("\n");
            const blob = new Blob([`\ufeff${csv}`], {
                  type: "text/csv;charset=utf-8;",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `feelex-report-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
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

      const filteredProjects = useMemo(() => {
            const codeNeedle = filterCode.trim().toLowerCase();
            return projects.filter((project) => {
                  const byCode =
                        !codeNeedle ||
                        project.code.toLowerCase().includes(codeNeedle) ||
                        project.name.toLowerCase().includes(codeNeedle);
                  const industry = (project.category || "").trim();
                  const byType = !filterType || industry === filterType;
                  return byCode && byType;
            });
      }, [projects, filterCode, filterType]);

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
                              <button
                                    className="btn action-btn"
                                    onClick={() => void handleExportCsv()}
                              >
                                    Xuất Excel (CSV)
                              </button>
                              <button
                                    className="btn action-btn"
                                    onClick={() => void handleExportJson()}
                              >
                                    Backup JSON
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
                                    {projects.map((project) => (
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
                              <label htmlFor="filter-project-type">
                                    Lọc theo ngành hàng
                              </label>
                              <select
                                    id="filter-project-type"
                                    value={filterType}
                                    onChange={(e) =>
                                          setFilterType(e.target.value)
                                    }
                              >
                                    <option value="">Tất cả ngành hàng</option>
                                    {categoryOptions.map((category) => (
                                          <option
                                                key={category}
                                                value={category}
                                          >
                                                {category}
                                          </option>
                                    ))}
                              </select>
                        </div>
                        <button
                              className="btn action-btn compact-btn"
                              onClick={() => {
                                    setFilterCode("");
                                    setFilterType("");
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
