import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import {
      PRODUCT_CATEGORIES,
      PRODUCT_GROUPS,
      PRODUCT_TYPES,
      STAGE_ORDER,
      STATUS_OPTIONS,
} from "../constants";
import { NodeTable } from "../components/NodeTable";
import { useAuth } from "../auth";
import type { NodePatchPayload, ProjectDetail } from "../types";
import { formatDate } from "../utils";
import { computeAllDates, lateDays } from "../datePlanner";

export function ProjectDetailPage() {
      const { projectId = "" } = useParams();
      const navigate = useNavigate();
      const { canEditNode, canEditProject } = useAuth();
      const [detail, setDetail] = useState<ProjectDetail | null>(null);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState<string | null>(null);
      const [toast, setToast] = useState<string | null>(null);
      const [hiddenStages, setHiddenStages] = useState<string[]>([]);
      // Mặc định vào trang: ẩn sẵn các bước 'Bỏ qua' (tích sẵn ở bộ lọc trạng thái).
      const [hiddenStatuses, setHiddenStatuses] = useState<string[]>(["Bỏ qua"]);
      const [stageMenuOpen, setStageMenuOpen] = useState(false);
      const [statusMenuOpen, setStatusMenuOpen] = useState(false);
      const stageMenuRef = useRef<HTMLDivElement>(null);
      const statusMenuRef = useRef<HTMLDivElement>(null);
      const [showEditProject, setShowEditProject] = useState(false);
      const [projectForm, setProjectForm] = useState({
            code: "",
            name: "",
            type: "",
            category: "",
            product_group: "",
            owner: "",
            start_date: "",
      });

      useEffect(() => {
            setLoading(true);
            api.getProjectDetail(projectId)
                  .then(setDetail)
                  .catch((err: Error) => setError(err.message))
                  .finally(() => setLoading(false));
      }, [projectId]);

      useEffect(() => {
            if (!stageMenuOpen && !statusMenuOpen) return;
            function onDown(e: MouseEvent) {
                  const target = e.target as Node;
                  if (
                        stageMenuRef.current &&
                        !stageMenuRef.current.contains(target)
                  ) {
                        setStageMenuOpen(false);
                  }
                  if (
                        statusMenuRef.current &&
                        !statusMenuRef.current.contains(target)
                  ) {
                        setStatusMenuOpen(false);
                  }
            }
            document.addEventListener("mousedown", onDown);
            return () => document.removeEventListener("mousedown", onDown);
      }, [stageMenuOpen, statusMenuOpen]);

      useEffect(() => {
            if (!detail) return;
            setProjectForm({
                  code: detail.project.code || "",
                  name: detail.project.name || "",
                  type: detail.project.type || "",
                  category: (detail.project.category as string) || "",
                  product_group: detail.project.product_group || "",
                  owner: detail.project.owner || "",
                  start_date: detail.project.start_date || "",
            });
      }, [detail]);

      async function handleSaveNode(nodeId: string, payload: NodePatchPayload) {
            if (!detail) return;
            const projectId = detail.project.id;
            try {
                  await api.patchProjectNode(projectId, nodeId, payload);
            } catch (err) {
                  // Lưu bị từ chối -> khôi phục dữ liệu đúng từ server rồi ném lỗi lên
                  // để bảng hiển thị thông báo.
                  try {
                        const r = await api.getProjectDetail(String(projectId));
                        setDetail(r);
                  } catch {
                        /* giữ nguyên */
                  }
                  throw err;
            }
            // Refetch để phản ánh tự động hoá phía server (điền ngày -> Đã xong,
            // và các bước kế tiếp tự chuyển 'Đang làm').
            try {
                  const refreshed = await api.getProjectDetail(String(projectId));
                  setDetail(refreshed);
            } catch {
                  setDetail((prev) =>
                        prev
                              ? {
                                      ...prev,
                                      nodes: prev.nodes.map((n) =>
                                            n.node_id === nodeId
                                                  ? { ...n, ...payload }
                                                  : n,
                                      ),
                                }
                              : prev,
                  );
            }
      }

      const deptList = useMemo(() => {
            if (!detail) return [] as string[];
            const set = new Set<string>();
            for (const n of detail.nodes) {
                  const dept = (n.dept || "").trim();
                  if (dept) set.add(dept);
            }
            return Array.from(set).sort((a, b) => a.localeCompare(b, "vi"));
      }, [detail]);

      const datesByNodeId = useMemo(() => {
            if (!detail) return {};
            return computeAllDates(detail);
      }, [detail]);

      const lateByNodeId = useMemo(() => {
            if (!detail) return {};
            const out: Record<string, number> = {};
            for (const n of detail.nodes) {
                  out[n.node_id] = lateDays(detail, n.node_id, datesByNodeId);
            }
            return out;
      }, [detail, datesByNodeId]);

      const projectStats = useMemo(() => {
            if (!detail) return { done: 0, total: 0, late: 0, pct: 0 };
            let done = 0;
            let total = 0;
            let late = 0;
            for (const node of detail.nodes) {
                  if (node.status === "Bỏ qua") continue;
                  total += 1;
                  if (node.status === "Đã xong") done += 1;
                  if (lateByNodeId[node.node_id] > 0) late += 1;
            }
            return { done, total, late, pct: total > 0 ? done / total : 0 };
      }, [detail, lateByNodeId]);

      const stageList = useMemo(() => {
            if (!detail) return STAGE_ORDER;
            const set = new Set(
                  detail.nodes.map((n) =>
                        (n.node_id.charAt(0) || "").toUpperCase(),
                  ),
            );
            return STAGE_ORDER.filter((s) => set.has(s));
      }, [detail]);

      const stageLabelByLetter = useMemo(() => {
            const out: Record<string, string> = {};
            for (const n of detail?.nodes || []) {
                  const letter = (n.node_id.charAt(0) || "").toUpperCase();
                  if (letter && n.stage && !out[letter]) out[letter] = n.stage;
            }
            return out;
      }, [detail]);

      const typeOptions = useMemo(() => {
            return Array.from(
                  new Set(
                        [projectForm.type, ...PRODUCT_TYPES].filter(Boolean),
                  ),
            );
      }, [projectForm.type]);

      const groupOptions = useMemo(() => {
            return Array.from(
                  new Set(
                        [projectForm.product_group, ...PRODUCT_GROUPS].filter(
                              Boolean,
                        ),
                  ),
            );
      }, [projectForm.product_group]);

      const categoryOptions = PRODUCT_CATEGORIES;

      if (loading)
            return (
                  <div className="empty-state">Đang tải chi tiết dự án...</div>
            );
      if (error)
            return <div className="empty-state">Lỗi tải dữ liệu: {error}</div>;
      if (!detail)
            return <div className="empty-state">Không tìm thấy dự án.</div>;

      async function handleSaveProjectInfo() {
            if (!detail) return;
            await api.patchProject(detail.project.id, {
                  code: projectForm.code.trim(),
                  name: projectForm.name.trim(),
                  type: projectForm.type.trim(),
                  category: projectForm.category.trim() || null,
                  product_group: projectForm.product_group.trim() || null,
                  owner: projectForm.owner.trim() || null,
                  start_date: projectForm.start_date,
            });
            const refreshed = await api.getProjectDetail(projectId);
            setDetail(refreshed);
            setShowEditProject(false);
      }

      async function handleDeleteProject() {
            if (!detail) return;
            const ok = window.confirm(
                  `Xóa dự án ${detail.project.code} - ${detail.project.name}?`,
            );
            if (!ok) return;
            await api.deleteProject(detail.project.id);
            navigate("/");
      }

      function showToast(message: string) {
            setToast(message);
            window.setTimeout(() => setToast(null), 2800);
      }

      return (
            <div className="project-detail-page">
                  <Link to="/" className="back-link">
                        ← Quay lại danh sách
                  </Link>

                  <div className="project-info-card">
                        <h2>{detail.project.name}</h2>
                        <div className="project-info-meta">
                              <span>
                                    <b>Mã:</b> {detail.project.code}
                              </span>
                              <span>
                                    <b>Loại:</b> {detail.project.type || "-"}
                              </span>
                              <span>
                                    <b>Nhóm:</b>{" "}
                                    {detail.project.product_group || "-"}
                              </span>
                              <span>
                                    <b>Ngành hàng:</b>{" "}
                                    {(detail.project.category as string) || "-"}
                              </span>
                              <span>
                                    <b>Chủ trì:</b>{" "}
                                    {detail.project.owner || "-"}
                              </span>
                              <span>
                                    <b>Bắt đầu:</b>{" "}
                                    {formatDate(detail.project.start_date)}
                              </span>
                              <span>
                                    <b>Tiến độ:</b> {projectStats.done}/
                                    {projectStats.total} (
                                    {Math.round(projectStats.pct * 100)}%)
                              </span>
                              <span
                                    className={
                                          projectStats.late > 0
                                                ? "late-inline"
                                                : ""
                                    }
                              >
                                    <b>Trễ:</b> {projectStats.late} bước
                              </span>
                        </div>
                        {canEditProject && (
                              <div className="project-info-actions">
                                    <button
                                          className="btn action-btn"
                                          onClick={() =>
                                                setShowEditProject(true)
                                          }
                                    >
                                          Sửa thông tin dự án
                                    </button>
                              </div>
                        )}
                  </div>

                  <div className="project-filter-bar">
                        <span>Lọc:</span>
                        <div
                              className="cat-multiselect stage-filter"
                              ref={stageMenuRef}
                        >
                              <button
                                    type="button"
                                    className="cat-multiselect-btn"
                                    onClick={() => {
                                          setStageMenuOpen((v) => !v);
                                          setStatusMenuOpen(false);
                                    }}
                              >
                                    <span>
                                          {hiddenStages.length === 0
                                                ? "Tất cả nhánh"
                                                : `Đang ẩn ${hiddenStages.length} nhánh`}
                                    </span>
                                    <span className="cat-caret">▾</span>
                              </button>
                              {stageMenuOpen && (
                                    <div className="cat-multiselect-menu">
                                          {stageList.map((stage) => {
                                                const checked =
                                                      hiddenStages.includes(
                                                            stage,
                                                      );
                                                return (
                                                      <label
                                                            key={stage}
                                                            className="cat-multiselect-item"
                                                      >
                                                            <input
                                                                  type="checkbox"
                                                                  checked={
                                                                        checked
                                                                  }
                                                                  onChange={() =>
                                                                        setHiddenStages(
                                                                              (
                                                                                    prev,
                                                                              ) =>
                                                                                    checked
                                                                                          ? prev.filter(
                                                                                                  (s) =>
                                                                                                        s !==
                                                                                                        stage,
                                                                                            )
                                                                                          : [
                                                                                                  ...prev,
                                                                                                  stage,
                                                                                            ],
                                                                        )
                                                                  }
                                                            />
                                                            {stageLabelByLetter[
                                                                  stage
                                                            ] ||
                                                                  `Nhánh ${stage}`}
                                                      </label>
                                                );
                                          })}
                                    </div>
                              )}
                        </div>
                        <div className="cat-multiselect" ref={statusMenuRef}>
                              <button
                                    type="button"
                                    className="cat-multiselect-btn"
                                    onClick={() => {
                                          setStatusMenuOpen((v) => !v);
                                          setStageMenuOpen(false);
                                    }}
                              >
                                    <span>
                                          {hiddenStatuses.length === 0
                                                ? "Mọi trạng thái"
                                                : `Đang ẩn ${hiddenStatuses.length} trạng thái`}
                                    </span>
                                    <span className="cat-caret">▾</span>
                              </button>
                              {statusMenuOpen && (
                                    <div className="cat-multiselect-menu">
                                          {STATUS_OPTIONS.map((status) => {
                                                const checked =
                                                      hiddenStatuses.includes(
                                                            status,
                                                      );
                                                return (
                                                      <label
                                                            key={status}
                                                            className="cat-multiselect-item"
                                                      >
                                                            <input
                                                                  type="checkbox"
                                                                  checked={
                                                                        checked
                                                                  }
                                                                  onChange={() =>
                                                                        setHiddenStatuses(
                                                                              (
                                                                                    prev,
                                                                              ) =>
                                                                                    checked
                                                                                          ? prev.filter(
                                                                                                  (s) =>
                                                                                                        s !==
                                                                                                        status,
                                                                                            )
                                                                                          : [
                                                                                                  ...prev,
                                                                                                  status,
                                                                                            ],
                                                                        )
                                                                  }
                                                            />
                                                            {status}
                                                      </label>
                                                );
                                          })}
                                    </div>
                              )}
                        </div>
                  </div>

                  {STAGE_ORDER.map((stage) => {
                        if (hiddenStages.includes(stage)) return null;
                        const allStageNodes = (detail.nodes || []).filter(
                              (n) =>
                                    (n.node_id.charAt(0) || "").toUpperCase() ===
                                    stage,
                        );
                        const nodes = allStageNodes.filter(
                              (node) => !hiddenStatuses.includes(node.status),
                        );
                        if (!nodes.length) return null;

                        const stageDone = allStageNodes.filter(
                              (n) => n.status === "Đã xong",
                        ).length;
                        const stageActive = allStageNodes.filter(
                              (n) => n.status !== "Bỏ qua",
                        ).length;
                        const stageLabel =
                              allStageNodes[0]?.stage || `Giai đoạn ${stage}`;

                        return (
                              <section
                                    key={stage}
                                    className={`stage-group stage-${stage}`}
                              >
                                    <div className={`stage-header stage-${stage}`}>
                                          <span>{stageLabel}</span>
                                          <span className="stage-progress">
                                                {stageDone}/{stageActive} hoàn thành
                                          </span>
                                    </div>
                                    <NodeTable
                                          nodes={nodes}
                                          allNodes={detail.nodes}
                                          deptList={deptList}
                                          datesByNodeId={datesByNodeId}
                                          lateByNodeId={lateByNodeId}
                                          onSaveNode={handleSaveNode}
                                          onToast={showToast}
                                          canEditRow={canEditNode}
                                          canEditManagerFields={canEditProject}
                                          projectInfo={{
                                                code: detail.project.code,
                                                name: detail.project.name,
                                          }}
                                    />
                              </section>
                        );
                  })}

                  {toast && <div className="toast show">{toast}</div>}

                  {showEditProject && (
                        <div
                              className="modal-backdrop"
                              onClick={() => setShowEditProject(false)}
                        >
                              <div
                                    className="modal-card edit-project-modal"
                                    onClick={(e) => e.stopPropagation()}
                              >
                                    <h3 className="edit-modal-title">
                                          Sửa thông tin dự án
                                    </h3>
                                    <div className="modal-sub edit-modal-sub">
                                          Tạo dự án mới sẽ khởi tạo đủ 27 bước
                                          với trạng thái "Chưa làm".
                                    </div>

                                    <div className="edit-form-layout">
                                          <div className="edit-row-full">
                                                <label>Mã dự án</label>
                                                <input
                                                      value={projectForm.code}
                                                      onChange={(e) =>
                                                            setProjectForm(
                                                                  (s) => ({
                                                                        ...s,
                                                                        code: e
                                                                              .target
                                                                              .value,
                                                                  }),
                                                            )
                                                      }
                                                />
                                          </div>
                                          <div className="edit-row-full">
                                                <label>Tên dự án</label>
                                                <input
                                                      value={projectForm.name}
                                                      onChange={(e) =>
                                                            setProjectForm(
                                                                  (s) => ({
                                                                        ...s,
                                                                        name: e
                                                                              .target
                                                                              .value,
                                                                  }),
                                                            )
                                                      }
                                                />
                                          </div>
                                          <div>
                                                <label>Loại sản phẩm</label>
                                                <select
                                                      value={projectForm.type}
                                                      onChange={(e) =>
                                                            setProjectForm(
                                                                  (s) => ({
                                                                        ...s,
                                                                        type: e
                                                                              .target
                                                                              .value,
                                                                  }),
                                                            )
                                                      }
                                                >
                                                      {(typeOptions.length
                                                            ? typeOptions
                                                            : [
                                                                    projectForm.type ||
                                                                          "Mỹ phẩm",
                                                              ]
                                                      ).map((v) => (
                                                            <option
                                                                  key={v}
                                                                  value={v}
                                                            >
                                                                  {v}
                                                            </option>
                                                      ))}
                                                </select>
                                          </div>
                                          <div>
                                                <label>
                                                      Phân nhóm sản phẩm
                                                </label>
                                                <select
                                                      value={
                                                            projectForm.product_group
                                                      }
                                                      onChange={(e) =>
                                                            setProjectForm(
                                                                  (s) => ({
                                                                        ...s,
                                                                        product_group:
                                                                              e
                                                                                    .target
                                                                                    .value,
                                                                  }),
                                                            )
                                                      }
                                                >
                                                      {(groupOptions.length
                                                            ? groupOptions
                                                            : [
                                                                    projectForm.product_group ||
                                                                          "A1",
                                                              ]
                                                      ).map((v) => (
                                                            <option
                                                                  key={v}
                                                                  value={v}
                                                            >
                                                                  {v}
                                                            </option>
                                                      ))}
                                                </select>
                                          </div>
                                          <div className="edit-row-full">
                                                <label>
                                                      Phân loại ngành hàng
                                                </label>
                                                <select
                                                      value={
                                                            projectForm.category
                                                      }
                                                      onChange={(e) =>
                                                            setProjectForm(
                                                                  (s) => ({
                                                                        ...s,
                                                                        category: e
                                                                              .target
                                                                              .value,
                                                                  }),
                                                            )
                                                      }
                                                >
                                                      {Array.from(
                                                            new Set(
                                                                  [
                                                                        projectForm.category,
                                                                        ...categoryOptions,
                                                                  ].filter(
                                                                        Boolean,
                                                                  ),
                                                            ),
                                                      ).map((v) => (
                                                            <option
                                                                  key={v}
                                                                  value={v}
                                                            >
                                                                  {v}
                                                            </option>
                                                      ))}
                                                </select>
                                          </div>
                                          <div className="edit-owner-field">
                                                <label>Người chủ trì</label>
                                                <input
                                                      value={projectForm.owner}
                                                      style={{ width: "90%" }}
                                                      onChange={(e) =>
                                                            setProjectForm(
                                                                  (s) => ({
                                                                        ...s,
                                                                        owner: e
                                                                              .target
                                                                              .value,
                                                                  }),
                                                            )
                                                      }
                                                />
                                          </div>
                                          <div className="edit-start-field">
                                                <label>Ngày bắt đầu</label>
                                                <input
                                                      type="date"
                                                      style={{ width: "90%" }}
                                                      value={
                                                            projectForm.start_date
                                                      }
                                                      onChange={(e) =>
                                                            setProjectForm(
                                                                  (s) => ({
                                                                        ...s,
                                                                        start_date:
                                                                              e
                                                                                    .target
                                                                                    .value,
                                                                  }),
                                                            )
                                                      }
                                                />
                                          </div>
                                    </div>

                                    <div className="edit-modal-actions">
                                          <button
                                                className="btn danger"
                                                onClick={() =>
                                                      void handleDeleteProject()
                                                }
                                          >
                                                Xoá dự án
                                          </button>
                                          <div className="edit-modal-actions-right">
                                                <button
                                                      className="btn action-btn"
                                                      onClick={() =>
                                                            setShowEditProject(
                                                                  false,
                                                            )
                                                      }
                                                >
                                                      Huỷ
                                                </button>
                                                <button
                                                      className="btn primary"
                                                      onClick={() =>
                                                            void handleSaveProjectInfo()
                                                      }
                                                >
                                                      Lưu
                                                </button>
                                          </div>
                                    </div>
                              </div>
                        </div>
                  )}
            </div>
      );
}
