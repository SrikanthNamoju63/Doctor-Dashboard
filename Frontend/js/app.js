const { useState, useEffect, useMemo, useRef } = React;
const API_BASE_URL = 'http://localhost:5000/api/';
const PROFIT_MARGIN = 0.68; // adjustable margin

const formatCurrency = (value) => value && !isNaN(value) ? '₹' + Number(value).toLocaleString('en-IN') : '₹0';
const formatPercent = (value) => value && !isNaN(value) ? `${value >= 0 ? '+' : ''}${Number(value).toFixed(1)}%` : '0%';
const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';
const formatTime = (timeString) => {
    if (!timeString) return 'N/A';
    try {
        return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch (e) { return timeString; }
};
const formatDateTime = (d, t) => `${formatDate(d)} ${formatTime(t)}`;

// Helper for Image URLs
const getImageUrl = (path) => {
    if (!path) return '';
    if (path.startsWith('http') || path.startsWith('data:')) return path; // Already absolute or data URI
    const baseUrl = API_BASE_URL.replace('/api/', ''); // http://localhost:5000
    // Remove leading slash if both have it to avoid double slash, though browser handles it.
    // robust join:
    return `${baseUrl}/${path.replace(/^\//, '')}`;
};

const buildBuckets = (labels) => labels.reduce((acc, label) => {
    acc[label] = { revenue: 0, profit: 0, expenses: 0, completed: 0, total: 0, tickets: [] };
    return acc;
}, {});

const calcDelta = (curr, prev) => {
    if (prev === undefined || prev === null) return 0;
    if (prev === 0) return curr > 0 ? 100 : 0;
    return ((curr - prev) / prev) * 100;
};

const getAppointmentDateObj = (app) => {
    if (app.appointment_date) return new Date(app.appointment_date);
    if (app.date) return new Date(app.date);
    return null;
};

const getAppointmentDateTime = (app) => {
    const dateObj = getAppointmentDateObj(app);
    if (!dateObj) return null;
    if (app.appointment_time) {
        const [h = '00', m = '00'] = app.appointment_time.split(':');
        dateObj.setHours(Number(h), Number(m), 0, 0);
    }
    return dateObj;
};

const getAppointmentFee = (app, fallbackFee) => {
    const feeCandidates = [app.consultation_fee, app.fee, app.amount, fallbackFee];
    const fee = feeCandidates.find(v => v !== undefined && v !== null && !isNaN(Number(v)));
    return Number(fee || 0);
};


const Modal = ({ isOpen, onClose, title, children, actions }) => {
    if (!isOpen) return null;
    return (
        <div className="modal visible" style={{ display: 'flex' }}>
            <div className="modal-content">
                <div className="modal-header">
                    <h3>{title}</h3>
                    <span className="close-btn" onClick={onClose} style={{ cursor: 'pointer' }}>&times;</span>
                </div>
                <div style={{ marginBottom: 20 }}>
                    {children}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    {actions}
                </div>
            </div>
        </div>
    );
};

const buildFinancialSeries = (appointments, fallbackFee) => {

    if (!appointments || !appointments.length) return { day: null, week: null, month: null };

    const now = new Date();
    const todayKey = now.toISOString().split('T')[0];
    const startWeek = new Date(now); startWeek.setDate(now.getDate() - 6);
    const prevWeekStart = new Date(now); prevWeekStart.setDate(now.getDate() - 13);
    const startMonth = new Date(now); startMonth.setDate(now.getDate() - 27);
    const prevMonthStart = new Date(now); prevMonthStart.setDate(now.getDate() - 55);

    const dayLabels = ['8 AM', '10 AM', '12 PM', '2 PM', '4 PM', '6 PM', '8 PM'];
    const dayHours = [8, 10, 12, 14, 16, 18, 20];
    const weekLabels = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date(startWeek); d.setDate(startWeek.getDate() + i);
        return d.toLocaleDateString('en-US', { weekday: 'short' });
    });
    const monthLabels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];





    const dayBuckets = buildBuckets(dayLabels);
    const prevDayBuckets = buildBuckets(dayLabels);
    const weekBuckets = buildBuckets(weekLabels);
    const prevWeekBuckets = buildBuckets(weekLabels);
    const monthBuckets = buildBuckets(monthLabels);
    const prevMonthBuckets = buildBuckets(monthLabels);




    let ytdRevenue = 0;
    let ytdProfit = 0;
    const yesterdayKey = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString().split('T')[0];

    appointments.forEach(app => {
        const apptDate = getAppointmentDateObj(app);
        const apptDateTime = getAppointmentDateTime(app);
        if (!apptDate) return;

        const status = (app.status || '').toLowerCase();
        const completed = status === 'completed';
        const fee = getAppointmentFee(app, fallbackFee);
        const revenue = completed ? fee : 0;
        const profit = revenue * PROFIT_MARGIN;
        const expenses = revenue - profit;

        const yearStart = new Date(now.getFullYear(), 0, 1);
        if (apptDate >= yearStart) {
            ytdRevenue += revenue;
            ytdProfit += profit;
        }

        const dateKey = apptDate.toISOString().split('T')[0];

        if (dateKey === todayKey || dateKey === yesterdayKey) {
            const bucketsRef = dateKey === todayKey ? dayBuckets : prevDayBuckets;
            if (apptDateTime) {
                const hour = apptDateTime.getHours();
                const idx = dayHours.findIndex(h => hour <= h);
                const label = dayLabels[idx >= 0 ? idx : dayLabels.length - 1];
                const bucket = bucketsRef[label];
                bucket.total += 1;
                if (completed) {
                    bucket.completed += 1;
                    bucket.revenue += revenue;
                    bucket.profit += profit;
                    bucket.expenses += expenses;
                    bucket.tickets.push(fee);
                }
            }
        }

        const isCurrentWeek = apptDate >= startWeek && apptDate <= now;
        const isPrevWeek = apptDate >= prevWeekStart && apptDate < startWeek;
        if (isCurrentWeek || isPrevWeek) {
            const dayOffset = Math.floor((apptDate - (isCurrentWeek ? startWeek : prevWeekStart)) / (1000 * 60 * 60 * 24));
            const label = weekLabels[dayOffset] || weekLabels[weekLabels.length - 1];
            const bucket = (isCurrentWeek ? weekBuckets : prevWeekBuckets)[label];
            bucket.total += 1;
            if (completed) {
                bucket.completed += 1;
                bucket.revenue += revenue;
                bucket.profit += profit;
                bucket.expenses += expenses;
                bucket.tickets.push(fee);
            }
        }

        const isCurrentMonth = apptDate >= startMonth && apptDate <= now;
        const isPrevMonth = apptDate >= prevMonthStart && apptDate < startMonth;
        if (isCurrentMonth || isPrevMonth) {
            const base = isCurrentMonth ? startMonth : prevMonthStart;
            const diffDays = Math.floor((apptDate - base) / (1000 * 60 * 60 * 24));
            const idx = Math.min(3, Math.floor(diffDays / 7));
            const label = monthLabels[idx];
            const bucket = (isCurrentMonth ? monthBuckets : prevMonthBuckets)[label];
            bucket.total += 1;
            if (completed) {
                bucket.completed += 1;
                bucket.revenue += revenue;
                bucket.profit += profit;
                bucket.expenses += expenses;
                bucket.tickets.push(fee);
            }
        }
    });

    const bucketToSeries = (buckets) => {
        const labels = Object.keys(buckets);
        const revenue = labels.map(l => buckets[l].revenue);
        const profit = labels.map(l => buckets[l].profit);
        const expenses = labels.map(l => buckets[l].expenses);
        const completed = labels.reduce((acc, l) => acc + buckets[l].completed, 0);
        const total = labels.reduce((acc, l) => acc + buckets[l].total, 0);
        const tickets = labels.flatMap(l => buckets[l].tickets);
        const revenueTotal = revenue.reduce((a, b) => a + b, 0);
        const profitTotal = profit.reduce((a, b) => a + b, 0);
        const avgTicket = tickets.length ? (tickets.reduce((a, b) => a + b, 0) / tickets.length) : 0;
        const collection = total ? Math.round((completed / total) * 100) : 0;
        return { labels, revenue, profit, expenses, totals: { revenue: revenueTotal, profit: profitTotal, avgTicket, collection } };
    };

    const daySeries = bucketToSeries(dayBuckets);
    const prevDaySeries = bucketToSeries(prevDayBuckets);
    const weekSeries = bucketToSeries(weekBuckets);
    const prevWeekSeries = bucketToSeries(prevWeekBuckets);
    const monthSeries = bucketToSeries(monthBuckets);
    const prevMonthSeries = bucketToSeries(prevMonthBuckets);

    const yoy = calcDelta(ytdRevenue, 0);
    const decorate = (series, label, prev) => ({
        label,
        deltaRevenue: calcDelta(series.totals.revenue, prev.totals.revenue),
        deltaProfit: calcDelta(series.totals.profit, prev.totals.profit),
        labels: series.labels,
        revenue: series.revenue,
        profit: series.profit,
        expenses: series.expenses,
        totals: {
            revenue: series.totals.revenue,
            profit: series.totals.profit,
            avgTicket: series.totals.avgTicket,
            collection: series.totals.collection,
            ytd: ytdRevenue,
            yoy
        }
    });

    return {
        day: decorate(daySeries, "Today's performance", prevDaySeries),
        week: decorate(weekSeries, 'This week', prevWeekSeries),
        month: decorate(monthSeries, 'This month', prevMonthSeries)
    };
};

const useChart = (canvasRef, type, data, options) => {
    const chartRef = useRef(null);
    useEffect(() => {
        if (!canvasRef.current || !data) return;
        if (!chartRef.current) {
            chartRef.current = new Chart(canvasRef.current, { type, data, options });
        } else {
            chartRef.current.data = data;
            chartRef.current.options = options || {};
            chartRef.current.update();
        }
    }, [canvasRef, data, options, type]);
};

const Loader = ({ size = 32 }) => (
    <div className="spinner" style={{ width: size, height: size }}></div>
);

const StatCard = ({ title, value, subtitle, icon, type = 'appointments' }) => (
    <div className="card">
        <div className="card-header">
            <h3>{title}</h3>
            <div className={`card-icon ${type}`}><span className="material-symbols-rounded">{icon}</span></div>
        </div>
        <div className="card-value">{value}</div>
        <div className="card-title">{subtitle}</div>
    </div>
);

const FinancialSection = ({ series, activeRange, onRangeChange }) => {
    const revenueCanvas = useRef(null);
    const profitCanvas = useRef(null);

    const revenueData = useMemo(() => {
        if (!series) return null;
        return {
            labels: series.labels,
            datasets: [
                {
                    label: 'Revenue',
                    data: series.revenue,
                    borderColor: 'rgba(52, 152, 219, 1)',
                    backgroundColor: 'rgba(52, 152, 219, 0.15)',
                    tension: 0.35,
                    fill: true,
                    pointRadius: 3,
                    pointHoverRadius: 5
                },
                {
                    label: 'Profit',
                    data: series.profit,
                    borderColor: 'rgba(39, 174, 96, 1)',
                    backgroundColor: 'rgba(39, 174, 96, 0.15)',
                    tension: 0.35,
                    fill: false,
                    pointRadius: 3,
                    pointHoverRadius: 5
                }
            ]
        };
    }, [series]);

    const profitData = useMemo(() => {
        if (!series) return null;
        return {
            labels: series.labels,
            datasets: [
                {
                    label: 'Expenses',
                    data: series.expenses,
                    backgroundColor: 'rgba(243, 156, 18, 0.75)',
                    borderRadius: 8
                },
                {
                    label: 'Profit',
                    data: series.profit,
                    backgroundColor: 'rgba(39, 174, 96, 0.8)',
                    borderRadius: 8
                }
            ]
        };
    }, [series]);

    useChart(revenueCanvas, 'line', revenueData, {
        responsive: true,
        plugins: { legend: { display: true, position: 'bottom' } },
        scales: { y: { beginAtZero: true } }
    });

    useChart(profitCanvas, 'bar', profitData, {
        responsive: true,
        plugins: { legend: { display: true, position: 'bottom' } },
        scales: { x: { stacked: false }, y: { beginAtZero: true } }
    });

    return (
        <React.Fragment>
            <div className="section-header">
                <div>
                    <div className="eyebrow">Financial pulse</div>
                    <h2>Revenue & Profit</h2>
                    <div className="microcopy">Track earning momentum across day, week, and month.</div>
                </div>
                <div className="pill-group">
                    {['day', 'week', 'month'].map(r => (
                        <button
                            key={r}
                            className={`pill-btn ${activeRange === r ? 'active' : ''}`}
                            onClick={() => onRangeChange(r)}
                        >
                            {r.charAt(0).toUpperCase() + r.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            <div className="insight-grid">
                <div className="card chart-card">
                    <div className="chart-card__header">
                        <div>
                            <div className="eyebrow">Revenue trend</div>
                            <h3>{series ? `${series.label} revenue` : 'No data'}</h3>
                            <div className="microcopy">Bookings vs profit</div>
                        </div>
                        <div className={`chip ${!series || series.deltaRevenue >= 0 ? 'chip--up' : 'chip--down'}`}>
                            {formatPercent((series && series.deltaRevenue) || 0)}
                        </div>
                    </div>
                    <canvas ref={revenueCanvas} height="160"></canvas>
                </div>

                <div className="card chart-card">
                    <div className="chart-card__header">
                        <div>
                            <div className="eyebrow">Profit mix</div>
                            <h3>{series ? `${series.label} margin` : 'No data'}</h3>
                            <div className="microcopy">Profit vs operational cost</div>
                        </div>
                        <div className={`chip ${!series || series.deltaProfit >= 0 ? 'chip--up' : 'chip--down'}`}>
                            {formatPercent((series && series.deltaProfit) || 0)}
                        </div>
                    </div>
                    <canvas ref={profitCanvas} height="160"></canvas>
                </div>
            </div>

            <div className="stat-row" style={{ marginBottom: 26 }}>
                <div className="mini-card">
                    <h4>Total revenue</h4>
                    <div className="value">{formatCurrency((series && series.totals && series.totals.revenue) || 0)}</div>
                    <div className="subtext">Average ticket: <span>{formatCurrency((series && series.totals && series.totals.avgTicket) || 0)}</span></div>
                </div>
                <div className="mini-card">
                    <h4>Net profit</h4>
                    <div className="value">{formatCurrency((series && series.totals && series.totals.profit) || 0)}</div>
                    <div className="subtext">Profit rate: <span>{formatPercent(series ? (series.totals.profit / (series.totals.revenue || 1)) * 100 : 0).replace('+', '')}</span></div>
                </div>
                <div className="mini-card">
                    <h4>Collection rate</h4>
                    <div className="value">{((series && series.totals && series.totals.collection) || 0) + '%'}</div>
                    <div className="subtext">Paid / billed</div>
                </div>
                <div className="mini-card">
                    <h4>Year-to-date</h4>
                    <div className="value">{formatCurrency((series && series.totals && series.totals.ytd) || 0)}</div>
                    <div className="subtext">YoY change: <span>{formatPercent((series && series.totals && series.totals.yoy) || 0)}</span></div>
                </div>
            </div>
        </React.Fragment>
    );
};

const AppointmentsTable = ({ title, loading, data, columns }) => (
    <div className="table-container">
        <h2>{title}</h2>
        {loading && <Loader />}
        <table>
            <thead>
                <tr>
                    {columns.map(col => <th key={col.key}>{col.label}</th>)}
                </tr>
            </thead>
            <tbody>
                {(!data || !data.length) && (
                    <tr><td colSpan={columns.length} style={{ textAlign: 'center', padding: 20, color: 'var(--gray)' }}>No data</td></tr>
                )}
                {data && data.map((row, idx) => (
                    <tr key={idx}>
                        {columns.map(col => <td key={col.key}>{col.render ? col.render(row) : row[col.key]}</td>)}
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

const Sidebar = ({ page, onLogout }) => (
    <div className="sidebar">
        <div className="sidebar-header">
            <h2>Dr. Strip</h2>
        </div>
        <div className="sidebar-menu">
            <ul>
                <li><a href="#dashboard" className={page === 'dashboard' ? 'active' : ''}><span className="material-symbols-rounded">dashboard</span> <span>Dashboard</span></a></li>
                <li><a href="#appointments" className={page === 'appointments' ? 'active' : ''}><span className="material-symbols-rounded">calendar_month</span> <span>Appointments</span></a></li>
                <li><a href="#financials" className={page === 'financials' ? 'active' : ''}><span className="material-symbols-rounded">monitoring</span> <span>Financials</span></a></li>
                <li><a href="#availability" className={page === 'availability' ? 'active' : ''}><span className="material-symbols-rounded">schedule</span> <span>Availability</span></a></li>
                <li><a href="#profile" className={page === 'profile' ? 'active' : ''}><span className="material-symbols-rounded">person</span> <span>Profile</span></a></li>
                <li>
                    <button className="sidebar-link" onClick={onLogout}>
                        <span className="material-symbols-rounded">logout</span> <span>Logout</span>
                    </button>
                </li>
            </ul>
        </div>
    </div>
);

const Header = ({ title, doctor }) => {
    const docName = doctor ? (doctor.full_name || doctor.name) : '';
    return (
        <div className="header">
            <h1>{title}</h1>
            <div className="user-info">
                <div className="user-avatar" style={{ overflow: 'hidden' }}>
                    {doctor && doctor.profile_image ? (
                        <img
                            src={getImageUrl(doctor.profile_image)}
                            alt="Profile"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.textContent = (docName ? docName.split(' ').map(n => n[0]).join('').toUpperCase() : 'DR'); }}
                        />
                    ) : (
                        docName ? docName.split(' ').map(n => n[0]).join('').toUpperCase() : 'DR'
                    )}
                </div>
                <div>
                    <div>{docName || 'Loading...'}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--gray)' }}>{(doctor && doctor.specialization) || 'General Practitioner'}</div>
                </div>
            </div>
        </div>
    );
};

const Login = ({ onLogin, loading, alertMsg }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    return (
        <div className="login-container">
            <div className="login-box">
                <div className="login-header">
                    <div style={{
                        width: 64, height: 64, background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                        borderRadius: '50%', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', boxShadow: '0 10px 15px -3px rgba(14, 165, 233, 0.3)'
                    }}>
                        <span className="material-symbols-rounded" style={{ fontSize: 32 }}>ecg_heart</span>
                    </div>
                    <h2>Dr. Strip</h2>
                    <p style={{ color: 'var(--text-light)' }}>Welcome back, Doctor</p>
                </div>
                {alertMsg && <div className={`alert alert-${alertMsg.type}`}>{alertMsg.text}</div>}
                <form onSubmit={(e) => { e.preventDefault(); onLogin(email, password); }}>
                    <div className="form-group">
                        <label>Email Address</label>
                        <div style={{ position: 'relative' }}>
                            <span className="material-symbols-rounded" style={{ position: 'absolute', left: 12, top: 12, color: '#94a3b8', fontSize: 20 }}>mail</span>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="name@hospital.com"
                                style={{ paddingLeft: 40 }}
                            />
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        <div style={{ position: 'relative' }}>
                            <span className="material-symbols-rounded" style={{ position: 'absolute', left: 12, top: 12, color: '#94a3b8', fontSize: 20 }}>lock</span>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                style={{ paddingLeft: 40 }}
                            />
                        </div>
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: 14, fontSize: '1rem', marginTop: 8 }} disabled={loading}>
                        {loading ? 'Authenticating...' : 'Sign In to Dashboard'}
                    </button>
                </form>
                <div className="login-footer" style={{ textAlign: 'center', marginTop: 24, color: '#94a3b8', fontSize: '0.9rem' }}>
                    <p>Secure Medical Portal &bull; v2.0</p>
                </div>
            </div>
        </div>
    );
};


const GenderStatsCard = ({ doctorId }) => {
    const [range, setRange] = useState('week'); // day, week, month, year
    const [chartData, setChartData] = useState(null);
    const chartRef = React.useRef(null);
    const canvasRef = React.useRef(null);

    useEffect(() => {
        if (!doctorId) return;
        const fetchData = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}appointments/stats/gender/${doctorId}?range=${range}`);
                const json = await res.json();
                if (json.success) {
                    setChartData(json.data);
                }
            } catch (e) {
                console.error("Gender stats error", e);
            }
        };
        fetchData();
    }, [doctorId, range]);

    useEffect(() => {
        if (!chartData || !canvasRef.current) return;

        if (chartRef.current) {
            chartRef.current.destroy();
        }

        const ctx = canvasRef.current.getContext('2d');
        chartRef.current = new Chart(ctx, {
            type: 'bar', // OR 'line'
            data: {
                labels: chartData.labels,
                datasets: [
                    {
                        label: 'Male',
                        data: chartData.male,
                        backgroundColor: 'rgba(54, 162, 235, 0.6)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1,
                        borderRadius: 4
                    },
                    {
                        label: 'Female',
                        data: chartData.female,
                        backgroundColor: 'rgba(255, 99, 132, 0.6)',
                        borderColor: 'rgba(255, 99, 132, 1)',
                        borderWidth: 1,
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' },
                    title: { display: false }
                },
                scales: {
                    y: { beginAtZero: true, grid: { borderDash: [2, 4] } },
                    x: { grid: { display: false } }
                }
            }
        });

        return () => {
            if (chartRef.current) chartRef.current.destroy();
        };
    }, [chartData]);

    return (
        <div className="card" style={{ gridColumn: 'span 3', minHeight: 400 }}>
            <div className="card-header">
                <div>
                    <h3 className="card-title" style={{ fontSize: '1.2rem', color: 'var(--secondary)' }}>Patient Visits by Gender</h3>
                    <div className="microcopy">Demographic analytics</div>
                </div>
                <div className="pill-group">
                    {['day', 'week', 'month', 'year'].map(r => (
                        <button
                            key={r}
                            className={`pill-btn ${range === r ? 'active' : ''}`}
                            onClick={() => setRange(r)}
                        >
                            {r.charAt(0).toUpperCase() + r.slice(1)}
                        </button>
                    ))}
                </div>
            </div>
            <div style={{ height: 300, position: 'relative' }}>
                <canvas ref={canvasRef}></canvas>
            </div>
        </div>
    );
};

const Dashboard = ({ stats, todayAppointments, loadingToday, doctor }) => {
    const columnsToday = useMemo(() => [
        { key: 'appointment_id', label: 'ID' },
        { key: 'patient', label: 'Patient', render: (r) => `${r.patient_name} (${r.age || 'N/A'}, ${r.gender || 'N/A'})` },
        { key: 'time', label: 'Time', render: (r) => formatTime(r.appointment_time) },
        { key: 'contact', label: 'Contact', render: (r) => r.patient_email || 'N/A' },
        { key: 'symptoms', label: 'Symptoms', render: (r) => r.symptoms || 'No symptoms provided' },
        { key: 'status', label: 'Status', render: (r) => <span className={`status-badge status-${(r.status || 'scheduled').toLowerCase()}`}>{r.status || 'Scheduled'}</span> },
        { key: 'actions', label: 'Actions', render: () => '-' }
    ], []);

    return (
        <div className="page-content">
            <div className="dashboard-cards">
                <StatCard title="Today's Appointments" value={(stats && stats.today) || 0} subtitle="Scheduled for today" icon="today" type="appointments" />
                <StatCard title="Tomorrow's Appointments" value={(stats && stats.tomorrow) || 0} subtitle="Scheduled for tomorrow" icon="event" type="pending" />
                <StatCard title="Total Appointments" value={(stats && stats.total) || 0} subtitle="All appointments" icon="folder_shared" type="earnings" />
            </div>

            {/* Gender Analytics Graph */}
            <div className="dashboard-cards" style={{ marginTop: 20, gridTemplateColumns: 'minmax(0, 1fr)' }}>
                {doctor && <GenderStatsCard doctorId={doctor._id} />}
            </div>



            <AppointmentsTable
                title="Today's Appointments"
                loading={loadingToday}
                data={todayAppointments}
                columns={columnsToday}
            />
        </div>
    );
};

const AppointmentsPage = ({ stats, loading, allAppointments, filter, setFilter, loadFiltered }) => {
    const [qrModalOpen, setQrModalOpen] = useState(false);
    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [transactionModalOpen, setTransactionModalOpen] = useState(false);
    const [bookingModalOpen, setBookingModalOpen] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState(null);

    // Mock Booking State
    const [bookingForm, setBookingForm] = useState({
        patient_name: '',
        age: '',
        gender: 'Male',
        symptoms: '',
        payment_method: 'UPI',
        amount: '500',
        transaction_id: ''
    });
    const [bookingLoading, setBookingLoading] = useState(false);

    const [qrInput, setQrInput] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [processingId, setProcessingId] = useState(null);

    const todayApps = allAppointments || [];

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount);
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Checked-In': return '#3b82f6';
            case 'In-Consultation': return '#eab308';
            case 'Completed': return '#22c55e';
            case 'Cancelled': return '#ef4444';
            case 'No-Show': return '#9ca3af';
            default: return '#64748b'; // Booked/Waiting
        }
    };

    const updateStatus = async (id, newStatus, e) => {
        if (e) e.stopPropagation(); // Prevent row click

        if (newStatus === 'Cancelled') {
            if (!confirm("Are you sure you want to CANCEL this appointment? This will auto-initiate a REFUND.")) {
                return;
            }
        }

        setProcessingId(id);
        try {
            const res = await fetch(`${API_BASE_URL}appointments/${id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            const json = await res.json();
            if (res.ok && json.success) {
                const today = new Date().toISOString().split('T')[0];
                loadFiltered(filter.date || today, filter.status);
                if (selectedAppointment && selectedAppointment._id === id) {
                    setDetailsModalOpen(false); // Close details if open
                }
                if (newStatus === 'Cancelled') alert("Appointment Cancelled. Refund Initiated.");
            } else {
                alert(json.message || "Update Failed");
            }
        } catch (e) {
            console.error('Update failed', e);
            alert("Error updating status");
        } finally {
            setProcessingId(null);
        }
    };

    const handleVerifyQR = async () => {
        setVerifying(true);
        try {
            const sessionDoc = JSON.parse(localStorage.getItem('doctor_session'));
            if (!sessionDoc) { alert('Session error'); return; }

            const res = await fetch(`${API_BASE_URL}appointments/verify-qr`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ qr_code_value: qrInput, doctor_id: sessionDoc._id })
            });
            const json = await res.json();
            if (json.success) {
                alert(json.message);
                setQrModalOpen(false);
                setQrInput('');
                const today = new Date().toISOString().split('T')[0];
                loadFiltered(filter.date || today, filter.status);
            } else {
                alert(json.message);
            }
        } catch (e) {
            alert('Verification Failed');
        } finally {
            setVerifying(false);
        }
    };

    const openDetails = (app) => {
        setSelectedAppointment(app);
        setDetailsModalOpen(true);
    };

    const openTransaction = (app, e) => {
        if (e) e.stopPropagation();
        setSelectedAppointment(app);
        setTransactionModalOpen(true);
    };

    const handleMockBooking = async (e) => {
        e.preventDefault();
        setBookingLoading(true);
        try {
            const sessionDoc = JSON.parse(localStorage.getItem('doctor_session'));
            if (!sessionDoc) return alert("Session Error");

            const payload = {
                doctor_id: sessionDoc._id,
                appointment_date: new Date(), // Today
                appointment_time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
                patient_name: bookingForm.patient_name,
                patient_email: 'mock@patient.com',
                age: bookingForm.age,
                gender: bookingForm.gender,
                symptoms: bookingForm.symptoms,
                amount: Number(bookingForm.amount),
                payment_method: bookingForm.payment_method,
                payment_transaction_id: bookingForm.transaction_id || ('TXN_' + Math.floor(Math.random() * 10000000))
            };

            const res = await fetch(`${API_BASE_URL}appointments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const json = await res.json();
            if (json.success) {
                alert(`Booking Confirmed! Token: ${json.data.token_number}`);
                setBookingModalOpen(false);
                const today = new Date().toISOString().split('T')[0];
                loadFiltered(filter.date || today, filter.status);
                loadFiltered(filter.date || today, filter.status);
                // Reset Form
                setBookingForm({ patient_name: '', age: '', gender: 'Male', symptoms: '', payment_method: 'UPI', amount: '500', transaction_id: '' });
            } else {
                alert("Booking Failed: " + json.message);
            }
        } catch (e) {
            console.error(e);
            alert("Error Booking");
        } finally {
            setBookingLoading(false);
        }
    };

    return (
        <div className="page-content">
            <div className="section-header">
                <div>
                    <div className="eyebrow">Patient Queue (Confirmed)</div>
                    <h2>Appointments</h2>
                    <div className="microcopy">View paid appointments and patient details.</div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" className="btn btn-primary" style={{ background: '#7e22ce' }} onClick={() => setBookingModalOpen(true)}>
                        + New Walk-in / Mock
                    </button>
                    <button type="button" className="btn btn-primary" onClick={() => setQrModalOpen(true)}>
                        Scan QR
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="filters-bar" style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                <select className="search-bar" value={filter.status} onChange={e => {
                    const val = e.target.value;
                    setFilter({ ...filter, status: val });
                    loadFiltered(filter.date, val);
                }}>
                    <option value="">All Status</option>
                    <option value="Booked">Booked</option>
                    <option value="Checked-In">Checked-In</option>
                    <option value="In-Consultation">In-Consultation</option>
                    <option value="Completed">Completed</option>
                </select>
                <input
                    type="date"
                    className="search-bar"
                    style={{ width: 'auto' }}
                    value={filter.date}
                    onChange={e => {
                        const val = e.target.value;
                        setFilter({ ...filter, date: val });
                        loadFiltered(val, filter.status);
                    }}
                />
                <button type="button" className="btn btn-primary" style={{ width: 'auto', padding: '0 20px' }} onClick={() => loadFiltered(filter.date, filter.status)}>Refresh</button>
            </div>

            {loading ? <div>Loading queue...</div> : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Token</th>
                                <th>Source</th>
                                <th>Patient</th>
                                <th>Date & Time</th>
                                <th>Payment</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {todayApps.length === 0 ? (
                                <tr><td colSpan="6" style={{ textAlign: 'center', padding: 20, color: '#888' }}>No appointments found.</td></tr>
                            ) : todayApps.map(app => (
                                <tr key={app._id} onClick={() => openDetails(app)} style={{ cursor: 'pointer', opacity: app.status === 'Completed' || app.status === 'No-Show' ? 0.6 : 1 }}>
                                    <td>
                                        <span style={{
                                            display: 'inline-block', width: 35, height: 35, lineHeight: '35px',
                                            textAlign: 'center', borderRadius: '50%', background: '#f8fafc',
                                            border: '2px solid var(--primary)', color: 'var(--primary)', fontWeight: 'bold'
                                        }}>
                                            {app.token_number || '-'}
                                        </span>
                                    </td>
                                    <td>
                                        <span className="badge" style={{ background: app.source === 'UserApp' ? '#e0f2fe' : '#f1f5f9', color: app.source === 'UserApp' ? '#0369a1' : '#475569', fontSize: '0.75rem' }}>
                                            {app.source === 'UserApp' ? 'Online' : 'Walk-in'}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 500 }}>{app.patient_name}</div>
                                        <div style={{ fontSize: '0.8rem', color: '#666' }}>{app.age} Y / {app.gender}</div>
                                    </td>
                                    <td>
                                        <div>{new Date(app.appointment_date).toLocaleDateString()}</div>
                                        <div style={{ fontSize: '0.8rem', color: '#666' }}>{app.appointment_time}</div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                            <span className="badge" style={{ background: '#dcfce7', color: '#166534' }}>
                                                {app.payment_status || 'PAID'}
                                            </span>
                                            <button
                                                className="btn-sm"
                                                style={{ border: '1px solid #ddd', background: 'white', cursor: 'pointer', fontSize: '0.7rem' }}
                                                onClick={(e) => openTransaction(app, e)}
                                            >
                                                View Payment
                                            </button>
                                        </div>
                                    </td>
                                    <td>
                                        <span className="badge" style={{ background: getStatusColor(app.status) + '20', color: getStatusColor(app.status) }}>
                                            {app.status}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 5 }}>
                                            {processingId === app._id ? <span>Processing...</span> : (
                                                <React.Fragment>
                                                    {app.status === 'Booked' && (
                                                        <button type="button" className="btn-secondary" style={{ padding: '5px 10px' }} onClick={(e) => updateStatus(app._id, 'Checked-In', e)} title="Manual Check-In">✔ Check-In</button>
                                                    )}
                                                    {(app.status === 'Checked-In') && (
                                                        <button type="button" className="btn-primary" style={{ padding: '5px 10px' }} onClick={(e) => updateStatus(app._id, 'In-Consultation', e)}>▶ Start</button>
                                                    )}
                                                    {app.status === 'In-Consultation' && (
                                                        <button type="button" className="btn-primary" style={{ padding: '5px 10px', background: 'var(--success)', borderColor: 'var(--success)' }} onClick={(e) => updateStatus(app._id, 'Completed', e)}>✅ Complete</button>
                                                    )}
                                                    {(app.status === 'Booked' || app.status === 'Checked-In') && (
                                                        <button type="button" className="btn-danger" style={{ padding: '5px 10px', marginLeft: 5 }} onClick={(e) => updateStatus(app._id, 'Cancelled', e)}>✕ Cancel</button>
                                                    )}
                                                </React.Fragment>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* QR Modal */}
            <Modal
                isOpen={qrModalOpen}
                onClose={() => setQrModalOpen(false)}
                title="Verify Patient QR"
            >
                <div style={{ padding: 20, textAlign: 'center' }}>
                    <p style={{ marginBottom: 15 }}>Enter Appointment ID to simulate scan:</p>
                    <input
                        type="text"
                        className="search-bar"
                        placeholder="Scan content..."
                        value={qrInput}
                        onChange={e => setQrInput(e.target.value)}
                        style={{ marginBottom: 15 }}
                    />
                    <button className="btn btn-primary" onClick={handleVerifyQR} disabled={verifying}>
                        {verifying ? 'Verifying...' : 'Verify Now'}
                    </button>
                </div>
            </Modal>

            {/* Mock Booking Modal */}
            <Modal
                isOpen={bookingModalOpen}
                onClose={() => setBookingModalOpen(false)}
                title="New Appointment (Simulate Patient)"
            >
                <form onSubmit={handleMockBooking} style={{ padding: 10 }}>
                    <div className="form-group">
                        <label>Patient Name</label>
                        <input type="text" required value={bookingForm.patient_name} onChange={e => setBookingForm({ ...bookingForm, patient_name: e.target.value })} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div className="form-group">
                            <label>Age</label>
                            <input type="number" required value={bookingForm.age} onChange={e => setBookingForm({ ...bookingForm, age: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label>Gender</label>
                            <select value={bookingForm.gender} onChange={e => setBookingForm({ ...bookingForm, gender: e.target.value })}>
                                <option>Male</option>
                                <option>Female</option>
                            </select>
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Symptoms</label>
                        <input type="text" value={bookingForm.symptoms} onChange={e => setBookingForm({ ...bookingForm, symptoms: e.target.value })} />
                    </div>

                    <div style={{ borderTop: '1px solid #eee', paddingTop: 15, marginTop: 15 }}>
                        <h4 style={{ marginBottom: 10, color: '#166534' }}>Payment Details (Simulated)</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <div className="form-group">
                                <label>Amount (₹)</label>
                                <input type="number" value={bookingForm.amount} onChange={e => setBookingForm({ ...bookingForm, amount: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Method</label>
                                <select value={bookingForm.payment_method} onChange={e => setBookingForm({ ...bookingForm, payment_method: e.target.value })}>
                                    <option>UPI</option>
                                    <option>CARD</option>
                                    <option>CASH</option>
                                </select>
                            </div>
                            <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                <label>Transaction ID (Optional)</label>
                                <input
                                    type="text"
                                    placeholder="Enter UPI Ref / Transaction ID (Auto-generated if empty)"
                                    value={bookingForm.transaction_id || ''}
                                    onChange={e => setBookingForm({ ...bookingForm, transaction_id: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 20 }} disabled={bookingLoading}>
                        {bookingLoading ? 'Processing Payment...' : 'Confirm Payment & Book'}
                    </button>
                </form>
            </Modal>

            {/* Transaction Modal */}
            <Modal
                isOpen={transactionModalOpen && selectedAppointment}
                onClose={() => setTransactionModalOpen(false)}
                title="Transaction Details"
            >
                {selectedAppointment && (
                    <div style={{ padding: 10 }}>
                        <div style={{ textAlign: 'center', marginBottom: 20 }}>
                            <div style={{ fontSize: '3rem', color: '#10b981' }}>₹{selectedAppointment.payment_details ? selectedAppointment.payment_details.amount : '500'}</div>
                            <div style={{ color: '#166534', fontWeight: 'bold' }}>PAYMENT SUCCESS</div>
                        </div>

                        <div style={{ display: 'grid', gap: 12, background: '#f8fafc', padding: 16, borderRadius: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#64748b' }}>Transaction ID</span>
                                <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{selectedAppointment.payment_details ? selectedAppointment.payment_details.transaction_id : 'N/A'}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#64748b' }}>Method</span>
                                <span style={{ fontWeight: 600 }}>{selectedAppointment.payment_details ? selectedAppointment.payment_details.payment_method : 'UPI'}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#64748b' }}>Date & Time</span>
                                <span style={{ fontWeight: 600 }}>{selectedAppointment.payment_details ? new Date(selectedAppointment.payment_details.paid_at).toLocaleString() : 'N/A'}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#64748b' }}>Status</span>
                                <span className="badge" style={{ background: '#dcfce7', color: '#166534' }}>{selectedAppointment.payment_details ? selectedAppointment.payment_details.payment_status : 'PAID'}</span>
                            </div>
                        </div>

                        <div style={{ marginTop: 20, textAlign: 'center', fontSize: '0.8rem', color: '#94a3b8' }}>
                            <span className="material-symbols-rounded" style={{ fontSize: '1rem', verticalAlign: 'middle' }}>lock</span> Payment verified by Gateway
                        </div>
                    </div>
                )}
            </Modal>

            {/* Details Modal */}
            <Modal
                isOpen={detailsModalOpen && selectedAppointment}
                onClose={() => setDetailsModalOpen(false)}
                title="Appointment Details"
            >
                {selectedAppointment && (
                    <div style={{ padding: 20 }}>
                        {/* Header Info */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid #eee', paddingBottom: 15 }}>
                            <div>
                                <div style={{ fontSize: '0.9rem', color: '#666', textTransform: 'uppercase' }}>Token Number</div>
                                <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>{selectedAppointment.token_number}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div className="badge" style={{ fontSize: '1rem', background: getStatusColor(selectedAppointment.status) + '20', color: getStatusColor(selectedAppointment.status) }}>
                                    {selectedAppointment.status}
                                </div>
                            </div>
                        </div>

                        {/* Details Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                            <div>
                                <label style={{ fontSize: '0.8rem', color: '#666' }}>Patient Name</label>
                                <div style={{ fontWeight: 500 }}>{selectedAppointment.patient_name}</div>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8rem', color: '#666' }}>Age / Gender</label>
                                <div>{selectedAppointment.age} Years / {selectedAppointment.gender}</div>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8rem', color: '#666' }}>Date</label>
                                <div>{new Date(selectedAppointment.appointment_date).toLocaleDateString()}</div>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8rem', color: '#666' }}>Time</label>
                                <div>{selectedAppointment.appointment_time}</div>
                            </div>
                        </div>

                        {/* Payment Info */}
                        <div style={{ background: '#f8fafc', padding: 15, borderRadius: 8, marginBottom: 20 }}>
                            <h4 style={{ marginTop: 0, marginBottom: 10, color: '#333' }}>Payment Information</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                <div>
                                    <label style={{ fontSize: '0.75rem', color: '#666' }}>Status</label>
                                    <div style={{ color: '#166534', fontWeight: 'bold' }}>PAID</div>
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.75rem', color: '#666' }}>Amount</label>
                                    <div>{selectedAppointment.payment_details ? formatCurrency(selectedAppointment.payment_details.amount) : '₹500.00'}</div>
                                </div>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <label style={{ fontSize: '0.75rem', color: '#666' }}>Transaction ID</label>
                                    <div style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>
                                        {selectedAppointment.payment_details ? selectedAppointment.payment_details.transaction_id : 'TXN_MOCK_123456'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* QR Code Simulation */}
                        <div style={{ textAlign: 'center', marginTop: 20 }}>
                            <label style={{ fontSize: '0.8rem', color: '#666', display: 'block', marginBottom: 5 }}>Verification QR Code</label>
                            <div style={{
                                width: 120, height: 120, margin: '0 auto',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <img
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(selectedAppointment._id)}`}
                                    alt="QR Code"
                                    style={{ width: '100%', height: '100%' }}
                                />
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#999', marginTop: 5 }}>ID: {selectedAppointment._id}</div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

const ProfilePage = ({ doctor, onSave, saving }) => {
    const [form, setForm] = useState({});
    const [previewImage, setPreviewImage] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (doctor) {
            setForm({
                full_name: doctor.full_name || doctor.name || '',
                email: doctor.email || '',
                phone: doctor.phone || '',
                registration_number: (doctor.professional_details && doctor.professional_details.registration_number) || doctor.registration_number || '',
                specialization: doctor.specialization || '',
                experience_years: (doctor.professional_details && doctor.professional_details.experience) || doctor.experience_years || '',
                education: doctor.education || '',
                languages: doctor.languages || '',
                hospital_name: (doctor.hospital_details && doctor.hospital_details.name) || doctor.hospital_name || '',
                hospital_city: (doctor.hospital_details && doctor.hospital_details.city) || doctor.hospital_city || '',
                hospital_state: (doctor.hospital_details && doctor.hospital_details.state) || doctor.hospital_state || '',
                hospital_pincode: (doctor.hospital_details && doctor.hospital_details.pincode) || doctor.hospital_pincode || '',
                hospital_village: (doctor.hospital_details && doctor.hospital_details.village) || doctor.hospital_village || '',
                hospital_landmark: (doctor.hospital_details && doctor.hospital_details.landmark) || doctor.hospital_landmark || '',
                hospital_address: (doctor.hospital_details && doctor.hospital_details.address) || doctor.hospital_address || '',
                consultation_fee: doctor.consultation_fee || '',
                consultation_duration_mins: doctor.consultation_duration_mins || '',
                profile_image: doctor.profile_image || '',
                bio: doctor.bio || '',
                achievements: doctor.achievements || '',
                search_keywords: doctor.search_keywords || '',
                is_active: doctor.is_active === undefined ? true : doctor.is_active
            });
            setPreviewImage(doctor.profile_image || '');
        }
    }, [doctor]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
        if (name === 'profile_image') {
            setPreviewImage(value);
        }
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('profile_image', file);

        try {
            const res = await fetch(`${API_BASE_URL}doctors/${doctor._id}/upload-image`, {
                method: 'POST',
                body: formData // Content-Type handled automatically
            });
            const json = await res.json();
            if (json.success) {
                const fullUrl = 'http://localhost:5000' + json.url; // Assuming dev env
                setPreviewImage(fullUrl);
                setForm(prev => ({ ...prev, profile_image: fullUrl }));
            } else {
                alert('Upload failed: ' + json.message);
            }
        } catch (err) {
            console.error(err);
            alert('Error uploaded file');
        } finally {
            setUploading(false);
        }
    };

    const handleSave = () => {
        // Construct the nested object for the backend
        const payload = {
            ...form,
            // Map flat form fields back to nested structures
            hospital_details: {
                name: form.hospital_name,
                city: form.hospital_city,
                state: form.hospital_state,
                pincode: form.hospital_pincode,
                village: form.hospital_village,
                landmark: form.hospital_landmark,
                address: form.hospital_address
            },
            professional_details: {
                registration_number: form.registration_number,
                experience: form.experience_years
            }
        };
        onSave(payload);
        setIsEditing(false);
    };

    const toggleEdit = () => {
        if (isEditing) {
            // Cancel: Reset form to doctor prop
            if (doctor) {
                setForm({
                    full_name: doctor.full_name || doctor.name || '',
                    email: doctor.email || '',
                    phone: doctor.phone || '',
                    registration_number: (doctor.professional_details && doctor.professional_details.registration_number) || doctor.registration_number || '',
                    specialization: doctor.specialization || '',
                    experience_years: (doctor.professional_details && doctor.professional_details.experience) || doctor.experience_years || '',
                    education: doctor.education || '',
                    languages: doctor.languages || '',
                    hospital_name: (doctor.hospital_details && doctor.hospital_details.name) || doctor.hospital_name || '',
                    hospital_city: (doctor.hospital_details && doctor.hospital_details.city) || doctor.hospital_city || '',
                    hospital_state: (doctor.hospital_details && doctor.hospital_details.state) || doctor.hospital_state || '',
                    hospital_pincode: (doctor.hospital_details && doctor.hospital_details.pincode) || doctor.hospital_pincode || '',
                    hospital_village: (doctor.hospital_details && doctor.hospital_details.village) || doctor.hospital_village || '',
                    hospital_landmark: (doctor.hospital_details && doctor.hospital_details.landmark) || doctor.hospital_landmark || '',
                    hospital_address: (doctor.hospital_details && doctor.hospital_details.address) || doctor.hospital_address || '',
                    consultation_fee: doctor.consultation_fee || '',
                    consultation_duration_mins: doctor.consultation_duration_mins || '',
                    profile_image: doctor.profile_image || '',
                    bio: doctor.bio || '',
                    achievements: doctor.achievements || '',
                    search_keywords: doctor.search_keywords || '',
                    is_active: doctor.is_active === undefined ? true : doctor.is_active
                });
                setPreviewImage(doctor.profile_image || '');
            }
        }
        setIsEditing(!isEditing);
    };

    const sections = [
        {
            title: "Personal Information",
            fields: [
                { name: 'full_name', label: 'Full Name', required: true, disabled: !isEditing },
                { name: 'email', label: 'Email', type: 'email', required: true, disabled: true },
                { name: 'phone', label: 'Phone', disabled: !isEditing },
                { name: 'bio', label: 'Bio', type: 'textarea', full: true, disabled: !isEditing },
            ]
        },
        {
            title: "Professional Details",
            fields: [
                { name: 'registration_number', label: 'Registration Number', disabled: true }, // Sync mapped id, read-only
                { name: 'specialization', label: 'Specialization', disabled: !isEditing },
                { name: 'experience_years', label: 'Experience (Years)', type: 'number', disabled: !isEditing },
                { name: 'education', label: 'Education', disabled: !isEditing },
                { name: 'languages', label: 'Languages', disabled: !isEditing }, // Synced but editable? Assuming yes.
                { name: 'achievements', label: 'Achievements', type: 'textarea', full: true, disabled: !isEditing },
                { name: 'search_keywords', label: 'Search Keywords', type: 'textarea', full: true, disabled: !isEditing },
            ]
        },
        {
            title: "Hospital & Clinic",
            fields: [
                { name: 'hospital_name', label: 'Hospital Name', disabled: !isEditing },
                { name: 'hospital_city', label: 'City', disabled: !isEditing },
                { name: 'hospital_state', label: 'State', disabled: !isEditing },
                { name: 'hospital_pincode', label: 'Pincode', disabled: !isEditing },
                { name: 'hospital_village', label: 'Village', disabled: !isEditing },
                { name: 'hospital_landmark', label: 'Landmark', disabled: !isEditing },
                { name: 'hospital_address', label: 'Full Address', type: 'textarea', full: true, disabled: !isEditing },
            ]
        },
        {
            title: "Consultation Settings",
            fields: [
                { name: 'consultation_fee', label: 'Fee', type: 'number', disabled: !isEditing },
                { name: 'consultation_duration_mins', label: 'Duration (mins)', type: 'number', disabled: !isEditing },
                { name: 'is_active', label: 'Active Profile', type: 'checkbox', disabled: !isEditing },
            ]
        }
    ];

    return (
        <div className="page-content">
            <div className="section-header">
                <div>
                    <div className="eyebrow">Your Identity</div>
                    <h2>Profile Settings</h2>
                    <div className="microcopy">Manage your public profile and professional details.</div>
                </div>
                <div>
                    {!isEditing && (
                        <button onClick={toggleEdit} className="btn btn-primary">
                            Edit Profile
                        </button>
                    )}
                    {isEditing && (
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button onClick={toggleEdit} className="btn" style={{ background: '#e2e8f0', color: 'var(--secondary)' }}>
                                Cancel
                            </button>
                            <button onClick={handleSave} className="btn btn-primary" disabled={saving}>
                                {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="profile-grid">
                {/* Left Column: Profile Card */}
                <div className="profile-card">
                    <div className="profile-avatar-lg">
                        {previewImage || form.profile_image ? (
                            <img
                                src={getImageUrl(previewImage || form.profile_image)}
                                alt="Profile"
                                onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.querySelector('.avatar-placeholder').style.display = 'flex'; }}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                        ) : null}
                        {/* Fallback Initials */}
                        <div className="avatar-placeholder" style={{ display: (previewImage || form.profile_image) ? 'none' : 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                            <span>{form.full_name ? form.full_name.split(' ').map(n => n[0]).join('').toUpperCase() : 'DR'}</span>
                        </div>
                    </div>
                    <h3 style={{ marginBottom: 4 }}>{form.full_name || 'Your Name'}</h3>
                    <div style={{ color: 'var(--gray)', marginBottom: 20 }}>{form.specialization || 'Specialization'}</div>

                    {isEditing && (
                        <div className="form-group" style={{ textAlign: 'left' }}>
                            <label>Profile Image</label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                            />
                            {uploading && <small style={{ color: 'var(--primary)' }}>Uploading...</small>}
                            <small style={{ color: 'var(--gray)', fontSize: '0.8rem', marginTop: 4, display: 'block' }}>
                                Upload a new photo to update.
                            </small>
                            {/* Hidden input to keep form logic happy if needed, though we updated state directly */}
                        </div>
                    )}
                </div>

                {/* Right Column: Details Form */}
                <div className="form-container">
                    {sections.map((section, idx) => (
                        <div key={idx} style={{ marginBottom: 40 }}>
                            <h3 style={{ marginBottom: 20, color: 'var(--secondary)', fontSize: '1.2rem', borderBottom: '1px solid #eee', paddingBottom: 10 }}>{section.title}</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24 }}>
                                {section.fields.map(field => (
                                    <div key={field.name} className="form-group" style={field.full ? { gridColumn: '1 / -1' } : {}}>
                                        <label>{field.label}</label>
                                        {field.type === 'textarea' ? (
                                            <textarea
                                                name={field.name}
                                                value={form[field.name] || ''}
                                                onChange={handleChange}
                                                rows={3}
                                                disabled={field.disabled}
                                            />
                                        ) : field.type === 'checkbox' ? (
                                            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center' }}>
                                                <input
                                                    type="checkbox"
                                                    name={field.name}
                                                    checked={!!form[field.name]}
                                                    onChange={handleChange}
                                                    style={{ width: '20px', height: '20px', marginRight: 10 }}
                                                    disabled={field.disabled}
                                                />
                                                <span>Visible to patients</span>
                                            </div>
                                        ) : (
                                            <input
                                                type={field.type || 'text'}
                                                name={field.name}
                                                value={form[field.name] || ''}
                                                onChange={handleChange}
                                                disabled={field.disabled}
                                                required={field.required}
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                    {isEditing && (
                        <div style={{ textAlign: 'right', marginTop: 20 }}>
                            <button onClick={handleSave} className="btn btn-primary" disabled={saving}>
                                {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};



const AvailabilityPage = ({ doctor }) => {
    const [activeTab, setActiveTab] = useState('weekly');
    const [loading, setLoading] = useState(false);

    // Weekly State
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const [weeklySchedule, setWeeklySchedule] = useState({});
    const [slotDuration, setSlotDuration] = useState(30);

    // Calendar State
    const [calendarMonth, setCalendarMonth] = useState(new Date());
    const [leaves, setLeaves] = useState([]);
    const [blockedSlots, setBlockedSlots] = useState([]);

    // Modal State
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState(null);
    const [modalTab, setModalTab] = useState('leave'); // 'leave' or 'block'
    const [leaveType, setLeaveType] = useState('FULL');
    const [blockTime, setBlockTime] = useState({ start: '', end: '', reason: '' });

    useEffect(() => {
        if (doctor && doctor._id) {
            fetchWeekly();
            fetchCalendarEvents();
        }
    }, [doctor]);

    // --- API Calls ---
    const fetchWeekly = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}availability/weekly/${doctor._id}`);
            const json = await res.json();
            if (json.success) {
                const sched = {};
                json.data.forEach(item => {
                    sched[item.day_of_week] = { ...item, is_active: true };
                });
                setWeeklySchedule(sched);
                if (json.data.length > 0) setSlotDuration(json.data[0].slot_duration_mins);
            }
        } catch (e) {
            console.error("Fetch weekly failed", e);
        }
    };

    const fetchCalendarEvents = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}availability/calendar/${doctor._id}`);
            const json = await res.json();
            if (json.success) {
                setLeaves(json.leaves || []);
                setBlockedSlots(json.blocked || []);
            }
        } catch (e) { console.error(e); }
    };

    const saveWeeklyResult = async (e) => {
        e.preventDefault();
        setLoading(true);
        // Construct payload
        const schedule = days.map(day => {
            const rule = weeklySchedule[day];
            if (!rule || !rule.is_active) return null;
            return {
                day_of_week: day,
                start_time: rule.start_time || '09:00',
                end_time: rule.end_time || '17:00',
                slot_duration_mins: slotDuration
            };
        }).filter(Boolean);

        try {
            const res = await fetch(`${API_BASE_URL}availability/weekly`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ doctor_id: doctor._id, schedule })
            });
            const json = await res.json();
            if (json.success) alert("Weekly schedule saved!");
            else alert("Failed: " + json.message);
        } catch (e) { alert("Error saving"); }
        setLoading(false);
    };

    const handleModalSubmit = async (e) => {
        e.preventDefault();
        if (!selectedDate) return;
        const year = selectedDate.getFullYear();
        const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
        const day = String(selectedDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        try {
            if (modalTab === 'leave') {
                const res = await fetch(`${API_BASE_URL}availability/leave`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ doctor_id: doctor._id, date: dateStr, leave_type: leaveType })
                });
                const json = await res.json();
                if (json.success) { fetchCalendarEvents(); setModalOpen(false); }
                else alert(json.message);
            } else {
                // Block
                const res = await fetch(`${API_BASE_URL}availability/block`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        doctor_id: doctor._id,
                        date: dateStr,
                        start_time: blockTime.start,
                        end_time: blockTime.end,
                        reason: blockTime.reason
                    })
                });
                const json = await res.json();
                if (json.success) { fetchCalendarEvents(); setModalOpen(false); }
                else alert(json.message);
            }
        } catch (e) { alert("Error"); }
    };

    // --- Handlers ---
    const toggleDay = (day) => {
        setWeeklySchedule(prev => ({
            ...prev,
            [day]: {
                ...(prev[day] || { start_time: '09:00', end_time: '17:00' }),
                is_active: !prev[day]?.is_active
            }
        }));
    };

    const updateTime = (day, field, val) => {
        setWeeklySchedule(prev => ({
            ...prev,
            [day]: { ...prev[day], [field]: val, is_active: true }
        }));
    };

    // Calendar Helpers
    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay(); // 0 = Sun
        return { daysInMonth, firstDay };
    };

    const renderCalendar = () => {
        const { daysInMonth, firstDay } = getDaysInMonth(calendarMonth);
        const cells = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Empty slots
        for (let i = 0; i < firstDay; i++) {
            cells.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
        }
        // Days
        for (let d = 1; d <= daysInMonth; d++) {
            const current = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), d);
            const yearStr = current.getFullYear();
            const monthStr = String(current.getMonth() + 1).padStart(2, '0');
            const dayStr = String(current.getDate()).padStart(2, '0');
            const dateStr = `${yearStr}-${monthStr}-${dayStr}`;
            const leave = leaves.find(l => l.date === dateStr);
            const blocks = blockedSlots.filter(b => b.date === dateStr);

            let statusClass = '';
            if (leave) statusClass = leave.leave_type === 'FULL' ? 'status-full' : 'status-half';
            else if (blocks.length > 0) statusClass = 'status-blocked';

            const isPast = current < today;

            cells.push(
                <div key={d}
                    className={`calendar-day ${isPast ? 'disabled' : ''}`}
                    onClick={() => {
                        if (!isPast) {
                            setSelectedDate(current);
                            // Pre-fill if leave exists
                            if (leave) {
                                setLeaveType(leave.leave_type);
                                setModalTab('leave');
                            } else {
                                setLeaveType('FULL'); // Default
                            }
                            setModalOpen(true);
                        }
                    }}
                >
                    <div className="day-number">{d}</div>
                    {leave && <div className={`day-status ${statusClass}`}>{leave.leave_type}</div>}
                    {!leave && blocks.length > 0 && <div className={`day-status ${statusClass}`}>{blocks.length} Blocks</div>}
                </div>
            );
        }
        return cells;
    };

    return (
        <div className="page-content">
            <div className="section-header">
                <div>
                    <div className="eyebrow">Schedule Management</div>
                    <h2>Availability</h2>
                    <div className="microcopy">Set your weekly recurring hours and manage time off.</div>
                </div>
            </div>

            <div className="availability-container">
                <div className="av-tabs">
                    <div className={`av-tab ${activeTab === 'weekly' ? 'active' : ''}`} onClick={() => setActiveTab('weekly')}>Weekly Setup</div>
                    <div className={`av-tab ${activeTab === 'calendar' ? 'active' : ''}`} onClick={() => setActiveTab('calendar')}>Calendar & Leaves</div>
                </div>

                {/* Weekly Tab */}
                <div className={`av-content ${activeTab === 'weekly' ? 'active' : ''}`}>
                    <form onSubmit={saveWeeklyResult}>
                        <div className="form-group">
                            <label>Slot Duration (minutes)</label>
                            <select value={slotDuration} onChange={e => setSlotDuration(Number(e.target.value))}>
                                <option value="10">10 mins</option>
                                <option value="15">15 mins</option>
                                <option value="20">20 mins</option>
                                <option value="30">30 mins</option>
                            </select>
                        </div>
                        <div id="weekly-rows">
                            {days.map(day => {
                                const rule = weeklySchedule[day] || {};
                                return (
                                    <div key={day} className="weekly-row">
                                        <input type="checkbox" checked={!!rule.is_active} onChange={() => toggleDay(day)} style={{ width: 'auto', marginRight: 10 }} />
                                        <label style={{ width: 100 }}>{day}</label>
                                        {rule.is_active && (
                                            <>
                                                <input type="time" value={rule.start_time || '09:00'} onChange={e => updateTime(day, 'start_time', e.target.value)} />
                                                <span>to</span>
                                                <input type="time" value={rule.end_time || '17:00'} onChange={e => updateTime(day, 'end_time', e.target.value)} />
                                            </>
                                        )}
                                        {!rule.is_active && <span style={{ color: '#aaa', marginLeft: 10 }}>Unavailable</span>}
                                    </div>
                                );
                            })}
                        </div>
                        <button type="submit" className="save-btn" disabled={loading}>{loading ? 'Saving...' : 'Save Weekly Schedule'}</button>
                    </form>
                </div>

                {/* Calendar Tab */}
                <div className={`av-content ${activeTab === 'calendar' ? 'active' : ''}`}>
                    <div className="calendar-header">
                        <button className="btn-secondary" style={{ width: 'auto' }} onClick={() => setCalendarMonth(new Date(calendarMonth.setMonth(calendarMonth.getMonth() - 1)))}>&lt;</button>
                        <h3>{calendarMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
                        <button className="btn-secondary" style={{ width: 'auto' }} onClick={() => setCalendarMonth(new Date(calendarMonth.setMonth(calendarMonth.getMonth() + 1)))}>&gt;</button>
                    </div>
                    <div className="calendar-grid">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="calendar-day-header">{d}</div>)}
                        {renderCalendar()}
                    </div>
                </div>
            </div>

            {/* Modal */}
            {modalOpen && (
                <div className="modal visible">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3>{selectedDate ? selectedDate.toDateString() : ''}</h3>
                            <span className="close-modal" onClick={() => setModalOpen(false)}>&times;</span>
                        </div>
                        <div className="av-tabs">
                            <div className={`av-tab ${modalTab === 'leave' ? 'active' : ''}`} onClick={() => setModalTab('leave')}>Mark Leave</div>
                            <div className={`av-tab ${modalTab === 'block' ? 'active' : ''}`} onClick={() => setModalTab('block')}>Block Slot</div>
                        </div>

                        <form onSubmit={handleModalSubmit}>
                            {modalTab === 'leave' && (
                                <div className="form-group">
                                    <label>Leave Type</label>
                                    <select value={leaveType} onChange={e => setLeaveType(e.target.value)}>
                                        <option value="FULL">Full Day</option>
                                        <option value="HALF_MORNING">Half Day (Morning)</option>
                                        <option value="HALF_AFTERNOON">Half Day (Afternoon)</option>
                                    </select>
                                </div>
                            )}

                            {modalTab === 'block' && (
                                <>
                                    <div className="form-group">
                                        <label>Start Time</label>
                                        <input type="time" value={blockTime.start} onChange={e => setBlockTime({ ...blockTime, start: e.target.value })} required />
                                    </div>
                                    <div className="form-group">
                                        <label>End Time</label>
                                        <input type="time" value={blockTime.end} onChange={e => setBlockTime({ ...blockTime, end: e.target.value })} required />
                                    </div>
                                    <div className="form-group">
                                        <label>Reason</label>
                                        <input type="text" value={blockTime.reason} onChange={e => setBlockTime({ ...blockTime, reason: e.target.value })} placeholder="Surgery, Meeting..." />
                                    </div>
                                </>
                            )}

                            <button type="submit" className="btn-primary" style={{ marginTop: 20 }}>
                                {modalTab === 'leave' ? 'Confirm Leave' : 'Block Slot'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};



const App = () => {
    const [doctor, setDoctor] = useState(() => {
        try {
            const saved = localStorage.getItem('doctor_session');
            if (saved && saved !== "undefined") {
                return JSON.parse(saved);
            }
        } catch (e) {
            console.error("Session parsing failed", e);
            localStorage.removeItem('doctor_session'); // Clear corrupted data
        }
        return null;
    });

    // Routing Logic
    const getPageFromHash = () => window.location.hash.replace('#', '') || 'dashboard';
    const [page, setPage] = useState(getPageFromHash());

    useEffect(() => {
        const handleHashChange = () => setPage(getPageFromHash());
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    const [alertMsg, setAlertMsg] = useState(null);
    const [loadingLogin, setLoadingLogin] = useState(false);

    const [stats, setStats] = useState({ today: 0, tomorrow: 0, total: 0, pending: 0 });
    const [todayAppointments, setTodayAppointments] = useState([]);
    const [loadingToday, setLoadingToday] = useState(false);
    const [financialSeries, setFinancialSeries] = useState({ day: null, week: null, month: null });
    const [activeRange, setActiveRange] = useState('day');

    const [allAppointments, setAllAppointments] = useState([]);
    const [loadingAll, setLoadingAll] = useState(false);
    const [filter, setFilter] = useState({ date: new Date().toISOString().split('T')[0], status: '' });

    const [savingProfile, setSavingProfile] = useState(false);

    // Auto-dismiss alert effect
    useEffect(() => {
        if (alertMsg && alertMsg.type === 'success') {
            const timer = setTimeout(() => {
                // Trigger fade out by updating state or using a ref ref approach would be cleaner but for simplicity:
                setAlertMsg(prev => prev ? { ...prev, fading: true } : null);
                setTimeout(() => setAlertMsg(null), 500); // Wait for animation
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [alertMsg]);

    useEffect(() => {
        fetch(`${API_BASE_URL}health`).catch(() => { });
    }, []);

    const showAlert = (text, type = 'error') => setAlertMsg({ text, type });

    const getGreeting = (name) => {
        const hour = new Date().getHours();
        let timeGreeting = 'Good Morning';
        if (hour >= 12 && hour < 17) timeGreeting = 'Good Afternoon';
        else if (hour >= 17) timeGreeting = 'Good Evening';
        return `${timeGreeting}, ${name || 'Doctor'}!`;
    };

    const loadStatsAndToday = async (doc) => {
        // ... (existing load logic)
        if (!doc || !doc._id) return;
        try {
            const statsResp = await fetch(`${API_BASE_URL}appointments/stats/${doc._id}`);
            const statsJson = await statsResp.json();
            if (statsJson.success) {
                setStats({
                    today: statsJson.data.today_appointments || 0,
                    tomorrow: statsJson.data.tomorrow_appointments || 0,
                    total: statsJson.data.total_appointments || 0,
                    pending: statsJson.data.pending_appointments || 0
                });
            }

            setLoadingToday(true);
            // Use local date to avoid UTC shifts
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const today = `${year}-${month}-${day}`;

            const todayResp = await fetch(`${API_BASE_URL}appointments?doctor_id=${doc._id}&date=${today}`);
            const todayJson = await todayResp.json();
            setLoadingToday(false);
            if (todayJson.success) {
                setTodayAppointments(todayJson.data || []);
            } else {
                setTodayAppointments([]);
            }

            // Build financials from all appointments
            const allResp = await fetch(`${API_BASE_URL}appointments?doctor_id=${doc._id}`);
            const allJson = await allResp.json();
            if (allJson.success) {
                setFinancialSeries(buildFinancialSeries(allJson.data || [], doc.consultation_fee));
            } else {
                setFinancialSeries({ day: null, week: null, month: null });
            }
        } catch (err) {
            console.error('Dashboard load error', err);
            setLoadingToday(false);
        }
    };

    // ... (loadAll)

    const loadAll = async (dateFilter = '', statusFilter = '') => {
        // ... (existing loadAll logic)
        if (!doctor || !doctor._id) return;
        try {
            setLoadingAll(true);
            let url = `${API_BASE_URL}appointments?doctor_id=${doctor._id}`;
            if (dateFilter) url += `&date=${dateFilter}`;
            if (statusFilter) url += `&status=${statusFilter}`;
            const resp = await fetch(url);
            const json = await resp.json();
            setLoadingAll(false);
            if (json.success) setAllAppointments(json.data || []);
            else setAllAppointments([]);
        } catch (err) {
            console.error('All appointments load error', err);
            setLoadingAll(false);
        }
    };

    useEffect(() => {
        if (doctor) {
            loadStatsAndToday(doctor);
            // Default load for TODAY
            loadAll(new Date().toISOString().split('T')[0]);
        }
    }, [doctor]);

    const handleLogin = async (email, password) => {
        setAlertMsg(null);
        setLoadingLogin(true);
        try {
            const response = await fetch(`${API_BASE_URL}doctors/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const result = await response.json();
            if (result.success && result.doctor) {
                setDoctor(result.doctor);
                localStorage.setItem('doctor_session', JSON.stringify(result.doctor));
                // Store JWT Token
                if (result.token) localStorage.setItem('auth_token', result.token);

                window.location.hash = 'dashboard';
                showAlert(getGreeting(result.doctor.name), 'success');
            } else {
                showAlert(result.message || 'Invalid email or password', 'error');
            }
        } catch (err) {
            showAlert('Login failed. Please try again.', 'error');
        } finally {
            setLoadingLogin(false);
        }
    };

    const handleProfileSave = async (form) => {
        if (!doctor) return;
        setSavingProfile(true);
        try {
            const response = await fetch(`${API_BASE_URL}doctors/${doctor._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            });
            const result = await response.json();
            if (result.success) {
                const updatedDoctor = { ...doctor, ...result.data };
                setDoctor(updatedDoctor);
                localStorage.setItem('doctor_session', JSON.stringify(updatedDoctor));
                showAlert('Profile updated', 'success');
            } else {
                showAlert(result.message || 'Failed to update profile', 'error');
            }
        } catch (err) {
            showAlert('Profile update failed. Please try again.', 'error');
        } finally {
            setSavingProfile(false);
        }
    };

    // Socket.io Connection (Real-time Updates)
    useEffect(() => {
        const socket = io(API_BASE_URL.replace('/api/', '')); // Connect to root

        socket.on('connect', () => {
            console.log('Connected to WebSocket');
        });

        socket.on('new_appointment', async (data) => {
            if (doctor && data.doctor_id === doctor._id) {
                // strict check for "present date only" using online time
                let todayStr = '';
                try {
                    const timeRes = await fetch('https://worldtimeapi.org/api/ip');
                    const timeJson = await timeRes.json();
                    // datetime format: 2023-11-25T...
                    todayStr = timeJson.datetime.split('T')[0];
                } catch (e) {
                    console.warn('Online time fetch failed, falling back to local system time');
                    const now = new Date();
                    const year = now.getFullYear();
                    const month = String(now.getMonth() + 1).padStart(2, '0');
                    const day = String(now.getDate()).padStart(2, '0');
                    todayStr = `${year}-${month}-${day}`;
                }

                const apptDate = data.date ? data.date.split('T')[0] : '';

                // Only notify if appointment is for TODAY
                if (apptDate === todayStr) {
                    setAlertMsg({
                        type: 'success',
                        title: 'New Appointment',
                        text: `${(data.appointment?.patient_name || 'Patient')} has booked for today at ${(data.appointment?.appointment_time || data.time)}`,
                        fading: false
                    });
                    setTimeout(() => setAlertMsg(prev => prev ? { ...prev, fading: true } : null), 4000);
                    setTimeout(() => setAlertMsg(null), 4500);
                }

                // Refresh Data (Always refresh data even if we don't notify, to keep UI sync)
                loadStatsAndToday(doctor);
                if (page === 'appointments') loadAll(filter.date, filter.status);
            }
        });

        socket.on('appointment_updated', (data) => {
            if (doctor && data.doctor_id === doctor._id) {
                setAlertMsg({ type: 'info', text: `Appointment ${data.status}`, fading: false });
                setTimeout(() => setAlertMsg(prev => prev ? { ...prev, fading: true } : null), 4000);
                setTimeout(() => setAlertMsg(null), 4500);

                loadStatsAndToday(doctor);
                if (page === 'appointments') loadAll(filter.date, filter.status);
            }
        });

        return () => {
            socket.disconnect();
        };
    }, [doctor, page, filter]);

    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    const confirmLogout = () => {
        setShowLogoutConfirm(true);
    };

    const executeLogout = () => {
        localStorage.removeItem('doctor_session');
        localStorage.removeItem('auth_token');
        setDoctor(null);
        setPage('login');
        setShowLogoutConfirm(false);
    };

    const cancelLogout = () => {
        setShowLogoutConfirm(false);
    };

    // Connectivity State
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    if (!isOnline) {
        return (
            <div style={{
                position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                background: 'rgba(255,255,255,0.95)', zIndex: 9999,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                textAlign: 'center', padding: 20
            }}>
                <div style={{
                    width: 100, height: 100, borderRadius: '50%', background: '#dee2e6',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 20, animation: 'pulse 2s infinite'
                }}>
                    <span className="material-symbols-rounded" style={{ fontSize: 50, color: '#adb5bd' }}>wifi_off</span>
                </div>
                <h2 style={{ color: '#343a40', marginBottom: 10 }}>No Internet Connection</h2>
                <p style={{ color: '#6c757d', maxWidth: 300 }}>
                    We are waiting for your connection to return. Please check your network settings.
                </p>
                <style>{`
                    @keyframes pulse {
                        0% { box-shadow: 0 0 0 0 rgba(0, 0, 0, 0.1); }
                        70% { box-shadow: 0 0 0 20px rgba(0, 0, 0, 0); }
                        100% { box-shadow: 0 0 0 0 rgba(0, 0, 0, 0); }
                    }
                `}</style>
            </div>
        );
    }

    if (!doctor) {
        return (
            <div className="login-container">
                <Login onLogin={handleLogin} loading={loadingLogin} alertMsg={alertMsg} />
            </div>
        );
    }

    return (
        <div className="container">
            <Sidebar page={page} onNavigate={setPage} onLogout={confirmLogout} />
            <div className="main-content">
                <Header title={page === 'dashboard' ? 'Overview' : page.charAt(0).toUpperCase() + page.slice(1)} doctor={doctor} />
                {/* Toast Container */}
                <div className="toast-container">
                    {alertMsg && (
                        <div className={`toast ${alertMsg.type} ${alertMsg.fading ? 'fade-out' : ''}`}>
                            <div className="toast-icon">
                                <span className="material-symbols-rounded">
                                    {alertMsg.type === 'success' ? 'check_circle' :
                                        alertMsg.type === 'error' ? 'error' : 'info'}
                                </span>
                            </div>
                            <div className="toast-content">
                                <h4>{alertMsg.title || 'Notification'}</h4>
                                <p>{alertMsg.text}</p>
                            </div>
                        </div>
                    )}
                </div>

                {page === 'dashboard' && (
                    <Dashboard
                        stats={stats}
                        series={financialSeries}
                        loadingToday={loadingToday}
                        todayAppointments={todayAppointments}
                    />
                )}
                {page === 'appointments' && (
                    <AppointmentsPage
                        allAppointments={allAppointments}
                        loading={loadingAll}
                        loadFiltered={loadAll}
                        filter={filter}
                        setFilter={setFilter}
                    />
                )}
                {page === 'financials' && (
                    <div className="page-content">
                        <FinancialSection
                            series={financialSeries ? financialSeries[activeRange] : null}
                            activeRange={activeRange}
                            onRangeChange={setActiveRange}
                        />
                    </div>
                )}
                {page === 'availability' && <AvailabilityPage doctor={doctor} />}
                {page === 'profile' && <ProfilePage doctor={doctor} onSave={handleProfileSave} saving={savingProfile} />}
            </div>

            <Modal
                isOpen={showLogoutConfirm}
                onClose={cancelLogout}
                title="Confirm Logout"
                actions={
                    <React.Fragment>
                        <button className="btn" onClick={cancelLogout} style={{ background: '#f1f5f9', color: 'var(--secondary)' }}>Cancel</button>
                        <button className="btn btn-danger" onClick={executeLogout}>Logout</button>
                    </React.Fragment>
                }
            >
                <p>Are you sure you want to log out?</p>
            </Modal>
        </div>
    );
};

const container = document.getElementById('root');
if (!window.reactRoot) {
    window.reactRoot = ReactDOM.createRoot(container);
}
window.reactRoot.render(<App />);