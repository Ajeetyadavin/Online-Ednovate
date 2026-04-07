import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProfessorAuth } from "@/context/ProfessorAuthContext";
import { professorApi, type ProfessorCourseItem, type ProfessorMonthlyItem, type ProfessorPayoutItem, type ProfessorSaleItem } from "@/services/professorApi";

const toCsv = (rows: ProfessorSaleItem[]) => {
  const header = [
    "Order ID",
    "Student Name",
    "Student Email",
    "Course",
    "Sale Date",
    "Allocated Amount",
    "Professor Share",
    "Currency",
  ];

  const body = rows.map((row) => [
    row.orderId,
    row.studentName,
    row.studentEmail,
    row.courseTitle,
    row.orderDate,
    row.amount,
    row.facultyShareAmount,
    row.currency,
  ]);

  return [header, ...body]
    .map((line) => line.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
};

export default function ProfessorDashboard() {
  const navigate = useNavigate();
  const { token, user, isAuthenticated, isLoading, logout } = useProfessorAuth();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");

  const [monthly, setMonthly] = useState<ProfessorMonthlyItem[]>([]);
  const [courses, setCourses] = useState<ProfessorCourseItem[]>([]);
  const [sales, setSales] = useState<ProfessorSaleItem[]>([]);
  const [salesTotal, setSalesTotal] = useState(0);
  const [salesPage, setSalesPage] = useState(1);
  const [salesLimit] = useState(25);
  const [payouts, setPayouts] = useState<ProfessorPayoutItem[]>([]);
  const [pendingAmount, setPendingAmount] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [currency, setCurrency] = useState("INR");
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/professor/login");
    }
  }, [isLoading, isAuthenticated, navigate]);

  const loadData = async (pageOverride?: number) => {
    if (!token) return;
    const page = Math.max(1, Number(pageOverride || salesPage || 1));
    setLoadingData(true);
    setError("");
    try {
      const [monthlyRes, coursesRes, salesRes, payoutRes] = await Promise.all([
        professorApi.monthly(token, { from, to }),
        professorApi.courses(token, { from, to }),
        professorApi.sales(token, { from, to, search, page, limit: salesLimit }),
        professorApi.payouts(token),
      ]);
      setMonthly(Array.isArray(monthlyRes.items) ? monthlyRes.items : []);
      setCourses(Array.isArray(coursesRes.items) ? coursesRes.items : []);
      setSales(Array.isArray(salesRes.items) ? salesRes.items : []);
      setSalesTotal(Number(salesRes.total || 0));
      setSalesPage(Number(salesRes.page || page));
      setPendingAmount(Number(payoutRes.pendingAmount || 0));
      setPaidAmount(Number(payoutRes.paidAmount || 0));
      setCurrency(String(payoutRes.currency || "INR"));
      setPayouts(Array.isArray(payoutRes.payouts) ? payoutRes.payouts : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (!token || !isAuthenticated) return;
    void loadData();
  }, [token, isAuthenticated]);

  const totals = useMemo(() => {
    const gross = monthly.reduce((sum, row) => sum + Number(row.gross_amount || 0), 0);
    const share = monthly.reduce((sum, row) => sum + Number(row.faculty_share || 0), 0);
    return {
      gross: Number(gross.toFixed(2)),
      share: Number(share.toFixed(2)),
    };
  }, [monthly]);

  const formatDate = (value?: string) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-IN");
  };

  const formatMoney = (value: number) => Number(value || 0).toFixed(2);

  const totalSalesPages = Math.max(1, Math.ceil((salesTotal || 0) / salesLimit));
  const canPrev = salesPage > 1;
  const canNext = salesPage < totalSalesPages;
  const currentRangeStart = salesTotal === 0 ? 0 : ((salesPage - 1) * salesLimit) + 1;
  const currentRangeEnd = Math.min(salesPage * salesLimit, salesTotal);

  const handleRefresh = async () => {
    await loadData(salesPage);
  };

  const handleApplyFilters = async () => {
    await loadData(1);
  };

  const handlePrevPage = async () => {
    if (!canPrev) return;
    await loadData(salesPage - 1);
  };

  const handleNextPage = async () => {
    if (!canNext) return;
    await loadData(salesPage + 1);
  };

  const handleExportCsv = async () => {
    if (!token) return;
    setLoadingData(true);
    setError("");
    try {
      const exportRes = await professorApi.sales(token, { from, to, search, page: 1, limit: 200 });
      const csv = toCsv(Array.isArray(exportRes.items) ? exportRes.items : []);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `professor-sales-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "CSV export failed");
    } finally {
      setLoadingData(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/professor/login");
  };

  if (isLoading || (!isAuthenticated && !user)) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#666" }}>Loading...</div>;
  }

  const containerStyle: React.CSSProperties = {
    minHeight: "100vh",
    backgroundColor: "#f5f5f5",
    padding: "20px",
  };

  const headerStyle: React.CSSProperties = {
    backgroundColor: "#fff",
    border: "1px solid #ddd",
    padding: "20px",
    marginBottom: "20px",
    borderRadius: "4px",
  };

  const headerTopStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "15px",
  };

  const titleStyle: React.CSSProperties = {
    fontSize: "20px",
    fontWeight: "bold",
    color: "#333",
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: "12px",
    color: "#666",
    marginTop: "4px",
  };

  const buttonGroupStyle: React.CSSProperties = {
    display: "flex",
    gap: "8px",
  };

  const buttonStyle: React.CSSProperties = {
    padding: "8px 16px",
    backgroundColor: "#007bff",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "600",
  };

  const secondaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: "#6c757d",
  };

  const disabledButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: "#999",
    cursor: "not-allowed",
  };

  const filterRowStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 2fr 1fr",
    gap: "10px",
    boarderTop: "1px solid #eee",
    paddingTop: "15px",
  };

  const inputStyle: React.CSSProperties = {
    padding: "8px",
    border: "1px solid #ccc",
    borderRadius: "4px",
    fontSize: "13px",
    boxSizing: "border-box",
  };

  const statsStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "15px",
    marginBottom: "20px",
  };

  const statCardStyle: React.CSSProperties = {
    backgroundColor: "#fff",
    border: "1px solid #ddd",
    padding: "15px",
    borderRadius: "4px",
  };

  const statLabelStyle: React.CSSProperties = {
    fontSize: "11px",
    fontWeight: "600",
    color: "#999",
    textTransform: "uppercase",
    marginBottom: "8px",
  };

  const statValueStyle: React.CSSProperties = {
    fontSize: "18px",
    fontWeight: "bold",
    color: "#333",
  };

  const sectionStyle: React.CSSProperties = {
    backgroundColor: "#fff",
    border: "1px solid #ddd",
    borderRadius: "4px",
    marginBottom: "20px",
    overflow: "hidden",
  };

  const sectionHeaderStyle: React.CSSProperties = {
    padding: "15px",
    borderBottom: "1px solid #eee",
    fontWeight: "600",
    color: "#333",
    fontSize: "14px",
  };

  const tableContainerStyle: React.CSSProperties = {
    overflowX: "auto",
    maxHeight: "400px",
    overflowY: "auto",
  };

  const tableStyle: React.CSSProperties = {
    width: "100%",
    fontSize: "12px",
    borderCollapse: "collapse",
  };

  const tableHeadStyle: React.CSSProperties = {
    backgroundColor: "#f8f9fa",
    borderBottom: "1px solid #ddd",
    position: "sticky",
    top: 0,
  };

  const tableHeaderCellStyle: React.CSSProperties = {
    padding: "10px",
    textAlign: "left",
    fontWeight: "600",
    color: "#666",
  };

  const tableCellStyle: React.CSSProperties = {
    padding: "10px",
    borderBottom: "1px solid #eee",
    color: "#333",
  };

  const paginationStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "15px",
    borderTop: "1px solid #eee",
    fontSize: "12px",
    color: "#666",
  };

  const errorStyle: React.CSSProperties = {
    display: error ? "block" : "none",
    backgroundColor: "#fee",
    border: "1px solid #fcc",
    color: "#c33",
    padding: "10px",
    marginBottom: "15px",
    borderRadius: "4px",
    fontSize: "12px",
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={headerTopStyle}>
          <div>
            <div style={titleStyle}>Professor Dashboard</div>
            <div style={subtitleStyle}>{user?.name} • Share {Number(user?.revenueSharePercent || 0)}%</div>
          </div>
          <div style={buttonGroupStyle}>
            <button style={loadingData ? disabledButtonStyle : secondaryButtonStyle} onClick={handleRefresh} disabled={loadingData}>
              Refresh
            </button>
            <button style={loadingData || salesTotal <= 0 ? disabledButtonStyle : secondaryButtonStyle} onClick={() => void handleExportCsv()} disabled={loadingData || salesTotal <= 0}>
              Export CSV
            </button>
            <button style={secondaryButtonStyle} onClick={() => void handleLogout()}>
              Logout
            </button>
          </div>
        </div>

        <div style={filterRowStyle}>
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: "600", marginBottom: "4px", color: "#666" }}>From Date</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: "600", marginBottom: "4px", color: "#666" }}>To Date</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: "600", marginBottom: "4px", color: "#666" }}>Search</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Student / Order / Course" style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: "600", marginBottom: "4px", color: "#666" }}>&nbsp;</label>
            <button style={loadingData ? disabledButtonStyle : buttonStyle} onClick={() => void handleApplyFilters()} disabled={loadingData}>
              {loadingData ? "Loading..." : "Apply"}
            </button>
          </div>
        </div>

        <div style={errorStyle}>{error}</div>
      </div>

      <div style={statsStyle}>
        <div style={statCardStyle}>
          <div style={statLabelStyle}>Total Allocated</div>
          <div style={statValueStyle}>{currency} {totals.gross.toFixed(2)}</div>
        </div>
        <div style={statCardStyle}>
          <div style={statLabelStyle}>Your Share</div>
          <div style={statValueStyle}>{currency} {totals.share.toFixed(2)}</div>
        </div>
        <div style={statCardStyle}>
          <div style={statLabelStyle}>Pending Payout</div>
          <div style={{ ...statValueStyle, color: "#ff9800" }}>{currency} {pendingAmount.toFixed(2)}</div>
        </div>
        <div style={statCardStyle}>
          <div style={statLabelStyle}>Paid Amount</div>
          <div style={{ ...statValueStyle, color: "#4caf50" }}>{currency} {paidAmount.toFixed(2)}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>Month-wise Revenue</div>
          <div style={tableContainerStyle}>
            <table style={tableStyle}>
              <thead style={tableHeadStyle}>
                <tr>
                  <th style={tableHeaderCellStyle}>Month</th>
                  <th style={tableHeaderCellStyle}>Sales</th>
                  <th style={tableHeaderCellStyle}>Students</th>
                  <th style={tableHeaderCellStyle}>Gross</th>
                  <th style={tableHeaderCellStyle}>Share</th>
                </tr>
              </thead>
              <tbody>
                {monthly.map((row) => (
                  <tr key={row.month}>
                    <td style={tableCellStyle}>{row.month}</td>
                    <td style={tableCellStyle}>{row.sales_count}</td>
                    <td style={tableCellStyle}>{row.students_count}</td>
                    <td style={tableCellStyle}>{formatMoney(row.gross_amount)}</td>
                    <td style={{ ...tableCellStyle, fontWeight: "600" }}>{formatMoney(row.faculty_share)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>Course-wise Sales</div>
          <div style={tableContainerStyle}>
            <table style={tableStyle}>
              <thead style={tableHeadStyle}>
                <tr>
                  <th style={tableHeaderCellStyle}>Course</th>
                  <th style={tableHeaderCellStyle}>Sales</th>
                  <th style={tableHeaderCellStyle}>Gross</th>
                  <th style={tableHeaderCellStyle}>Share</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((row) => (
                  <tr key={`${row.course_id}-${row.course_title}`}>
                    <td style={tableCellStyle}>{row.course_title || row.course_id}</td>
                    <td style={tableCellStyle}>{row.sales_count}</td>
                    <td style={tableCellStyle}>{formatMoney(row.gross_amount)}</td>
                    <td style={{ ...tableCellStyle, fontWeight: "600" }}>{formatMoney(row.faculty_share)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px", borderBottom: "1px solid #eee" }}>
          <div style={{ fontWeight: "600", color: "#333", fontSize: "14px" }}>Sales Register</div>
          <div style={{ fontSize: "11px", color: "#666" }}>
            Showing {currentRangeStart}-{currentRangeEnd} of {salesTotal}
          </div>
        </div>
        <div style={tableContainerStyle}>
          <table style={tableStyle}>
            <thead style={tableHeadStyle}>
              <tr>
                <th style={tableHeaderCellStyle}>Date</th>
                <th style={tableHeaderCellStyle}>Order ID</th>
                <th style={tableHeaderCellStyle}>Student</th>
                <th style={tableHeaderCellStyle}>Course</th>
                <th style={tableHeaderCellStyle}>Amount</th>
                <th style={tableHeaderCellStyle}>Share</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((row) => (
                <tr key={`${row.id}-${row.courseId}`}>
                  <td style={tableCellStyle}>{formatDate(row.orderDate)}</td>
                  <td style={tableCellStyle}>{row.orderId}</td>
                  <td style={tableCellStyle}>{row.studentName}</td>
                  <td style={tableCellStyle}>{row.courseTitle || row.courseId}</td>
                  <td style={tableCellStyle}>{row.currency} {formatMoney(row.amount)}</td>
                  <td style={{ ...tableCellStyle, fontWeight: "600" }}>{row.currency} {formatMoney(row.facultyShareAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={paginationStyle}>
          <button style={!canPrev || loadingData ? disabledButtonStyle : buttonStyle} disabled={!canPrev || loadingData} onClick={() => void handlePrevPage()}>
            ← Prev
          </button>
          <span>Page {salesPage} of {totalSalesPages}</span>
          <button style={!canNext || loadingData ? disabledButtonStyle : buttonStyle} disabled={!canNext || loadingData} onClick={() => void handleNextPage()}>
            Next →
          </button>
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>Payout History</div>
        {payouts.length === 0 ? (
          <div style={{ padding: "15px", color: "#666", fontSize: "12px" }}>No payouts recorded yet.</div>
        ) : (
          <div style={tableContainerStyle}>
            <table style={tableStyle}>
              <thead style={tableHeadStyle}>
                <tr>
                  <th style={tableHeaderCellStyle}>Date</th>
                  <th style={tableHeaderCellStyle}>Reference</th>
                  <th style={tableHeaderCellStyle}>Status</th>
                  <th style={tableHeaderCellStyle}>Amount</th>
                  <th style={tableHeaderCellStyle}>Note</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((row) => (
                  <tr key={row.id}>
                    <td style={tableCellStyle}>{formatDate(row.payout_date)}</td>
                    <td style={tableCellStyle}>{row.reference_id || "-"}</td>
                    <td style={tableCellStyle}>
                      <span style={{ backgroundColor: "#f0f0f0", padding: "3px 8px", borderRadius: "3px", fontSize: "11px", fontWeight: "600" }}>
                        {row.status || "paid"}
                      </span>
                    </td>
                    <td style={tableCellStyle}>{row.currency} {formatMoney(row.amount)}</td>
                    <td style={tableCellStyle}>{row.note || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
