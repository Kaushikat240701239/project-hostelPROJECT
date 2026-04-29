// Authentication & Global State
let currentUser = null;
const apiBase = '/api';

function formatName(email) {
    if (!email) return '';
    let name = email.split('@')[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
}

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('access_token');
    if (token) {
        fetchMe();
    } else if (window.location.pathname === '/dashboard') {
        window.location.href = '/login';
    }
});

async function fetchMe() {
    const token = localStorage.getItem('access_token');
    try {
        const response = await fetch(`${apiBase}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            currentUser = await response.json();
            updateUI();
        } else {
            handleLogout();
        }
    } catch (err) {
        console.error(err);
    }
}

function handleLogout() {
    localStorage.removeItem('access_token');
    window.location.href = '/login';
}

// UI Rendering
function updateUI() {
    if (!currentUser) return;

    if (document.getElementById('username-display')) {
        document.getElementById('username-display').innerText = formatName(currentUser.username);
        document.getElementById('user-role-badge').innerText = currentUser.role.toUpperCase();
    }
    
    if (document.getElementById('dashboard-greeting')) {
        document.getElementById('dashboard-greeting').innerHTML = `<h3 class="fw-bold text-white">Hello ${formatName(currentUser.username)} 👋</h3>`;
    }

    renderSidebar();
    loadDashboardStats();
    renderRoleSpecificContent();
    startNotificationPolling();
}

function renderSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    let links = '';
    const role = currentUser.role;

    if (role === 'student') {
        links = `
            <a href="#" onclick="showStudentDashboard()" class="active"><i class="fa-solid fa-gauge me-2"></i> Dashboard</a>
            <a href="#" onclick="showComplaintForm()"><i class="fa-solid fa-plus me-2"></i> New Complaint</a>
            <a href="#" onclick="showMyComplaints()"><i class="fa-solid fa-list me-2"></i> My Complaints</a>
        `;
    } else if (role === 'warden') {
        links = `
            <a href="#" onclick="showWardenDashboard()" class="active"><i class="fa-solid fa-gauge me-2"></i> Dashboard</a>
            <a href="#" onclick="showAllComplaints()"><i class="fa-solid fa-tasks me-2"></i> All Complaints</a>
            <a href="#" onclick="showStaffList()"><i class="fa-solid fa-users-gear me-2"></i> Staff List</a>
        `;
    } else if (role === 'staff') {
        links = `
            <a href="#" onclick="showStaffDashboard()" class="active"><i class="fa-solid fa-gauge me-2"></i> Dashboard</a>
            <a href="#" onclick="showAssignedTasks()"><i class="fa-solid fa-wrench me-2"></i> My Tasks</a>
        `;
    } else if (role === 'admin') {
        links = `
            <a href="#" onclick="showAdminDashboard()" class="active"><i class="fa-solid fa-gauge me-2"></i> Dashboard</a>
            <a href="#" onclick="showAdminComplaintsView()"><i class="fa-solid fa-list-check me-2"></i> Complaints</a>
            <a href="#" onclick="showUserManagement()"><i class="fa-solid fa-users me-2"></i> Users</a>
            <a href="#" onclick="showNotificationCenter()"><i class="fa-solid fa-bell me-2"></i> Notifications</a>
            <a href="#" onclick="downloadReport('pdf')"><i class="fa-solid fa-file-pdf me-2"></i> Export PDF</a>
        `;
    }

    sidebar.innerHTML = links;
}

// Stats & Content Loading
async function loadDashboardStats() {
    const role = currentUser.role;
    const token = localStorage.getItem('access_token');
    try {
        const res = await fetch(`${apiBase}/${role}/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const stats = await res.json();
        renderStats(stats);
    } catch (err) {
        console.error(err);
    }
}

function renderStats(stats) {
    const container = document.getElementById('stats-container');
    if (!container) return;

    let html = '';
    const role = currentUser.role;

    if (role === 'admin' || role === 'warden' || role === 'student') {
        html = `
            <div class="col-sm-6 col-lg mb-3">
                <div class="stat-card bg-blue animate-fade">
                    <h6>Total Complaints</h6>
                    <h3>${stats.total || 0}</h3>
                </div>
            </div>
            <div class="col-sm-6 col-lg mb-3">
                <div class="stat-card bg-orange animate-fade">
                    <h6>Pending</h6>
                    <h3>${stats.pending || 0}</h3>
                </div>
            </div>
            <div class="col-sm-6 col-lg mb-3">
                <div class="stat-card bg-cyan animate-fade">
                    <h6>In Progress</h6>
                    <h3>${stats.in_progress || 0}</h3>
                </div>
            </div>
            <div class="col-sm-6 col-lg mb-3">
                <div class="stat-card bg-green animate-fade">
                    <h6>Resolved</h6>
                    <h3>${stats.resolved || 0}</h3>
                </div>
            </div>
            <div class="col-sm-6 col-lg mb-3">
                <div class="stat-card bg-red animate-fade">
                    <h6>Rejected</h6>
                    <h3>${stats.rejected || 0}</h3>
                </div>
            </div>
        `;
    } else if (role === 'staff') {
        html = `
            <div class="col-md-6 mb-3">
                <div class="stat-card bg-cyan animate-fade">
                    <h6>My Tasks (In Progress)</h6>
                    <h3>${stats.in_progress || 0}</h3>
                </div>
            </div>
            <div class="col-md-6 mb-3">
                <div class="stat-card bg-green animate-fade">
                    <h6>Completed Tasks</h6>
                    <h3>${stats.resolved || 0}</h3>
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
    
    if (role === 'admin' || role === 'warden') {
        document.getElementById('charts-row').style.display = 'flex';
        renderCharts(stats);
    } else {
        document.getElementById('charts-row').style.display = 'none';
    }
}

let statusChart = null;
let priorityChart = null;

function renderCharts(stats) {
    const ctxS = document.getElementById('statusChart').getContext('2d');
    const ctxP = document.getElementById('priorityChart').getContext('2d');

    if (statusChart) statusChart.destroy();
    if (priorityChart) priorityChart.destroy();

    statusChart = new Chart(ctxS, {
        type: 'doughnut',
        data: {
            labels: ['Pending', 'In Progress', 'Resolved', 'Rejected'],
            datasets: [{
                data: [stats.pending, stats.in_progress, stats.resolved, stats.rejected],
                backgroundColor: ['#f6c23e', '#36b9cc', '#1cc88a', '#e74a3b']
            }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });

    priorityChart = new Chart(ctxP, {
        type: 'bar',
        data: {
            labels: ['Low', 'Medium', 'High'],
            datasets: [{
                label: 'Complaints by Priority',
                data: [stats.low || 0, stats.medium || 0, stats.high || 0],
                backgroundColor: '#4e73df'
            }]
        },
        options: { responsive: true, scales: { y: { beginAtZero: true } } }
    });
}

// Student Handlers
function showComplaintForm() {
    setActiveLink('showComplaintForm');
    const content = document.getElementById('role-content');
    content.innerHTML = `
        <div class="glass-card animate-fade">
            <h4><i class="fa fa-plus me-2 text-primary"></i> Submit New Complaint</h4>
            <hr>
            <div class="row">
                <div class="col-md-6 mb-3">
                    <label class="form-label">Complaint Type</label>
                    <select id="comp_type" class="form-select">
                        <option>Electrical</option>
                        <option>Appliance</option>
                        <option>Water Service</option>
                        <option>Furniture</option>
                        <option>Internet/WiFi</option>
                        <option>Other</option>
                    </select>
                </div>
                <div class="col-md-3 mb-3">
                    <label class="form-label">Block</label>
                    <input type="text" value="${currentUser.block || ''}" id="comp_block" class="form-control" readOnly>
                </div>
                <div class="col-md-3 mb-3">
                    <label class="form-label">Room No</label>
                    <input type="text" value="${currentUser.room_number || ''}" id="comp_room" class="form-control" readOnly>
                </div>
            </div>
            <div class="mb-3">
                <label class="form-label">Detailed Description</label>
                <textarea id="comp_desc" class="form-control" rows="4" placeholder="Describe the issue..."></textarea>
            </div>
            <button class="btn btn-premium w-25" onclick="submitComplaint()">Submit</button>
        </div>
    `;
}

async function submitComplaint() {
    const data = {
        complaint_type: document.getElementById('comp_type').value,
        description: document.getElementById('comp_desc').value
    };
    const token = localStorage.getItem('access_token');
    const res = await fetch(`${apiBase}/student/complaints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(data)
    });
    if (res.ok) {
        alert("Complaint submitted successfully!");
        showMyComplaints();
    }
}

async function showMyComplaints() {
    setActiveLink('showMyComplaints');
    const token = localStorage.getItem('access_token');
    const res = await fetch(`${apiBase}/student/complaints`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const complaints = await res.json();
    
    document.getElementById('role-content').innerHTML = `
        <div class="glass-card animate-fade">
            <h4>My Complaints</h4>
            <div class="table-responsive">
                <table class="table align-middle">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Type</th>
                            <th>Description</th>
                            <th>Status</th>
                            <th>Submitted On</th>
                            <th>Assigned On</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${complaints.map(c => `
                            <tr>
                                <td>#${c.id}</td>
                                <td>${c.complaint_type}</td>
                                <td>${c.description.substring(0, 30)}...</td>
                                <td><span class="badge-custom ${getStatusClass(c.status)}">${c.status}</span></td>
                                <td>${c.created_at}</td>
                                <td>${c.assigned_at || 'Not Assigned'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function getStatusClass(status) {
    switch (status) {
        case 'Pending': return 'bg-orange';
        case 'In Progress': return 'bg-cyan';
        case 'Resolved': return 'bg-green';
        case 'Rejected': return 'bg-red';
        default: return 'bg-blue';
    }
}

// Warden Handlers
async function showAllComplaints() {
    setActiveLink('showAllComplaints');
    const token = localStorage.getItem('access_token');
    const resStaff = await fetch(`${apiBase}/warden/staff`, { headers: { 'Authorization': `Bearer ${token}` } });
    const staff = await resStaff.json();

    const res = await fetch(`${apiBase}/warden/complaints`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const complaints = await res.json();
    
    document.getElementById('role-content').innerHTML = `
        <div class="glass-card animate-fade">
            <h4>Manage All Complaints</h4>
            <div class="table-responsive">
                <table class="table align-middle">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Student</th>
                            <th>Block/Room</th>
                            <th>Issue</th>
                            <th>Status</th>
                            <th>Priority</th>
                            <th>Staff</th>
                            <th>Submitted On</th>
                            <th>Assigned On</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${complaints.map(c => `
                            <tr>
                                <td>#${c.id}</td>
                                <td>${c.student}</td>
                                <td>${c.block} - ${c.room_number}</td>
                                <td>${c.complaint_type}</td>
                                <td><span class="badge-custom ${getStatusClass(c.status)}">${c.status}</span></td>
                                <td>${c.priority || 'N/A'}</td>
                                <td>${c.staff_name || 'Unassigned'}</td>
                                <td>${c.created_at}</td>
                                <td>${c.assigned_at || 'Not Assigned'}</td>
                                <td>
                                    <div class="d-flex gap-1">
                                        ${c.status === 'Pending' ? `
                                            <button class="btn btn-sm btn-primary" onclick="showAssignModal(${c.id})">Assign</button>
                                            <button class="btn btn-sm btn-danger" onclick="showRejectModal(${c.id})">Reject</button>
                                        ` : `
                                            <select class="form-select form-select-sm" onchange="updateWardenStatus(${c.id}, this.value)" style="width: auto;">
                                                <option value="Pending" ${c.status === 'Pending' ? 'selected' : ''}>Pending</option>
                                                <option value="In Progress" ${c.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                                                <option value="Resolved" ${c.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
                                                <option value="Rejected" ${c.status === 'Rejected' ? 'selected' : ''}>Rejected</option>
                                            </select>
                                        `}
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// Auth Logic
async function handleLogin() {
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    const role = document.getElementById('login_role').value;

    const res = await fetch(`${apiBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pass, role: role })
    });
    if (res.ok) {
        const data = await res.json();
        localStorage.setItem('access_token', data.access_token);
        window.location.href = '/dashboard';
    } else {
        const err = await res.json();
        alert(err.msg || "Invalid Login");
    }
}

async function handleRegister() {
    const username = document.getElementById('reg_username').value.trim();
    const password = document.getElementById('reg_password').value.trim();
    const role = document.getElementById('reg_role').value;
    const block = document.getElementById('reg_block') ? document.getElementById('reg_block').value : '';
    const room_number = document.getElementById('reg_room') ? document.getElementById('reg_room').value.trim() : '';

    if (!username || !password) {
        alert('Username and password are required.');
        return;
    }

    const data = { username, password, role, block, room_number };

    try {
        const res = await fetch(`${apiBase}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (res.ok) {
            alert('✅ Registered successfully! Please log in.');
            toggleAuth();
        } else {
            alert('❌ Registration failed: ' + (result.msg || 'Unknown error'));
        }
    } catch (err) {
        alert('❌ Network error: ' + err.message);
    }
}

function toggleAuth() {
    const lf = document.getElementById('loginForm');
    const rf = document.getElementById('registerForm');
    if (lf.style.display === 'none') {
        lf.style.display = 'block';
        rf.style.display = 'none';
    } else {
        lf.style.display = 'none';
        rf.style.display = 'block';
        toggleStudentFields(); // sync student fields with role dropdown
    }
}

function toggleStudentFields() {
    const roleEl = document.getElementById('reg_role');
    if (!roleEl) return;
    const role = roleEl.value;
    document.getElementById('studentFields').style.display = (role === 'student') ? 'block' : 'none';
}

// Notifications
let notifInterval = null;
function startNotificationPolling() {
    if (notifInterval) clearInterval(notifInterval);
    fetchNotifications();
    notifInterval = setInterval(fetchNotifications, 10000);
}

async function fetchNotifications() {
    const role = currentUser.role;
    if (role === 'admin') return; 

    const token = localStorage.getItem('access_token');
    const res = await fetch(`${apiBase}/${role}/notifications`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
        const data = await res.json();
        updateNotificationUI(data);
    }
}

function updateNotificationUI(notifs) {
    const list = document.getElementById('notif-list');
    const badge = document.getElementById('notif-badge');
    if (!list) return;

    const unread = notifs.filter(n => !n.is_read).length;
    if (unread > 0) {
        badge.innerText = unread;
        badge.classList.remove('d-none');
    } else {
        badge.classList.add('d-none');
    }

    let html = '<li><h6 class="dropdown-header">Notifications</h6></li><li><hr class="dropdown-divider"></li>';
    if (notifs.length === 0) {
        html += '<li class="p-3 text-center text-muted">No notifications</li>';
    } else {
        notifs.forEach(n => {
            html += `
                <li class="px-3 py-2 border-bottom">
                    <p class="mb-0 small">${n.message}</p>
                    <small class="text-muted">${n.created_at}</small>
                </li>
            `;
        });
    }
    list.innerHTML = html;
}

function setActiveLink(onclickFnName) {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    sidebar.querySelectorAll('a').forEach(a => {
        if (a.getAttribute('onclick').includes(onclickFnName)) {
            a.classList.add('active');
        } else {
            a.classList.remove('active');
        }
    });
}

function showStudentDashboard() {
    setActiveLink('showStudentDashboard');
    showMyComplaints();
}

function showWardenDashboard() {
    setActiveLink('showWardenDashboard');
    const content = document.getElementById('role-content');
    content.innerHTML = `
        <div class="glass-card animate-fade">
            <h4>Warden Overview</h4>
            <p>Welcome to the Management Portal. From here, you can oversee all hostel complaints, assign them to the maintenance team, or reject invalid requests with detailed reasons.</p>
            <div class="d-flex gap-2">
                <button class="btn btn-premium" onclick="showAllComplaints()">Manage All Complaints</button>
                <button class="btn btn-outline-primary" onclick="showStaffList()">View Staff List</button>
            </div>
        </div>
    `;
    loadDashboardStats();
}

function showStaffDashboard() {
    setActiveLink('showStaffDashboard');
    const content = document.getElementById('role-content');
    content.innerHTML = `
        <div class="glass-card animate-fade">
            <h4>Maintenance Portal</h4>
            <p>View and manage all your assigned maintenance tasks. Ensure to mark them as resolved once the work is completed to notify the student and administration.</p>
            <button class="btn btn-premium" onclick="showAssignedTasks()">View My Tasks</button>
        </div>
    `;
    loadDashboardStats();
}

function showAdminDashboard() {
    setActiveLink('showAdminDashboard');
    const content = document.getElementById('role-content');
    content.innerHTML = `
        <div class="glass-card animate-fade">
            <h4>System Administration</h4>
            <p>As an administrator, you have full control over user accounts and system reporting. Use the tools below to manage the hostel complaint ecosystem.</p>
            <div class="d-flex gap-2">
                <button class="btn btn-premium" onclick="showUserManagement()">Manage Users</button>
                <button class="btn btn-outline-success" onclick="downloadReport('csv')"><i class="fa-solid fa-file-csv me-1"></i> CSV Report</button>
                <button class="btn btn-outline-danger" onclick="downloadReport('pdf')"><i class="fa-solid fa-file-pdf me-1"></i> PDF Report</button>
            </div>
        </div>
    `;
    loadDashboardStats();
}

async function downloadReport(format = 'csv') {
    const token = localStorage.getItem('access_token');
    try {
        const response = await fetch(`${apiBase}/admin/report?format=${format}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.msg || "Download failed");
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `complaints_report.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (err) {
        alert(err.message);
    }
}

async function showNotificationCenter() {
    setActiveLink('showNotificationCenter');
    const token = localStorage.getItem('access_token');
    const res = await fetch(`${apiBase}/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const users = await res.json();

    const content = document.getElementById('role-content');
    content.innerHTML = `
        <div class="glass-card animate-fade">
            <h4><i class="fa-solid fa-bullhorn me-2 text-warning"></i> Notification Center</h4>
            <hr>
            <div class="mb-3">
                <label class="form-label">Message</label>
                <textarea id="admin-notif-msg" class="form-control" rows="3" placeholder="Enter notification message..."></textarea>
            </div>
            
            <div class="mb-3">
                <label class="form-label">Target Audience</label>
                <select id="notif-target" class="form-select" onchange="toggleSelectiveUsers()">
                    <option value="all">All Users</option>
                    <option value="selective">Specific Users</option>
                </select>
            </div>

            <div id="selective-users-container" style="display:none;" class="mb-3">
                <label class="form-label">Select Users</label>
                <div class="border rounded p-3 bg-light" style="max-height: 200px; overflow-y: auto;">
                    ${users.map(u => `
                        <div class="form-check">
                            <input class="form-check-input user-select-checkbox" type="checkbox" value="${u.id}" id="user-${u.id}">
                            <label class="form-check-label" for="user-${u.id}">
                                ${u.username} (${u.role})
                            </label>
                        </div>
                    `).join('')}
                </div>
            </div>

            <button class="btn btn-premium" onclick="sendAdminNotification()">Send Notification</button>
        </div>
    `;
}

function toggleSelectiveUsers() {
    const target = document.getElementById('notif-target').value;
    document.getElementById('selective-users-container').style.display = (target === 'selective') ? 'block' : 'none';
}

async function sendAdminNotification() {
    const msg = document.getElementById('admin-notif-msg').value;
    const target = document.getElementById('notif-target').value;
    const token = localStorage.getItem('access_token');
    
    if (!msg) return alert("Please enter a message");

    let userIds = [];
    if (target === 'selective') {
        userIds = Array.from(document.querySelectorAll('.user-select-checkbox:checked')).map(cb => cb.value);
        if (userIds.length === 0) return alert("Please select at least one user");
    }

    const res = await fetch(`${apiBase}/admin/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ message: msg, target: target, user_ids: userIds })
    });

    if (res.ok) {
        alert("Notifications sent successfully!");
        document.getElementById('admin-notif-msg').value = '';
    }
}

function renderRoleSpecificContent() {
    const role = currentUser.role;
    if (role === 'student') showMyComplaints();
    else if (role === 'warden') showAllComplaints();
    else if (role === 'staff') showAssignedTasks();
    else if (role === 'admin') showUserManagement();
}

async function showAssignedTasks() {
    setActiveLink('showAssignedTasks');
    const token = localStorage.getItem('access_token');
    const res = await fetch(`${apiBase}/staff/tasks`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const tasks = await res.json();
    
    document.getElementById('role-content').innerHTML = `
        <div class="glass-card animate-fade">
            <h4>My Assigned Tasks</h4>
            <div class="table-responsive">
                <table class="table align-middle">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Student</th>
                            <th>Block/Room</th>
                            <th>Issue</th>
                            <th>Priority</th>
                            <th>Status</th>
                            <th>Submitted On</th>
                            <th>Assigned On</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tasks.map(t => `
                            <tr>
                                <td>#${t.id}</td>
                                <td>${t.student}</td>
                                <td>${t.block} - ${t.room_number}</td>
                                <td>${t.complaint_type}</td>
                                <td><span class="badge-custom bg-blue">${t.priority}</span></td>
                                <td><span class="badge-custom ${getStatusClass(t.status)}">${t.status}</span></td>
                                <td>${t.created_at}</td>
                                <td>${t.assigned_at || 'Not Assigned'}</td>
                                <td>
                                    ${t.status === 'In Progress' ? `
                                        <button class="btn btn-sm btn-success" onclick="resolveTask(${t.id})">Mark Resolved</button>
                                    ` : `
                                        <button class="btn btn-sm btn-outline-warning" onclick="revertTask(${t.id})"><i class="fa-solid fa-rotate-left"></i> Revert</button>
                                    `}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

async function resolveTask(id) {
    const token = localStorage.getItem('access_token');
    const res = await fetch(`${apiBase}/staff/resolve/${id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
        alert("Task marked as Resolved!");
        showAssignedTasks();
        loadDashboardStats();
    }
}

async function revertTask(id) {
    if (!confirm("Are you sure you want to move this task back to In Progress?")) return;
    const token = localStorage.getItem('access_token');
    const res = await fetch(`${apiBase}/staff/revert/${id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
        alert("Task reverted to In Progress");
        showAssignedTasks();
        loadDashboardStats();
    }
}

async function updateWardenStatus(id, newStatus) {
    if (!confirm(`Change status of Complaint #${id} to ${newStatus}?`)) return showAllComplaints();
    const token = localStorage.getItem('access_token');
    const res = await fetch(`${apiBase}/warden/update_status/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus })
    });
    if (res.ok) {
        alert("Status updated successfully");
        showAllComplaints();
        loadDashboardStats();
    }
}

// Assignment Logic
let currentAssignId = null;
async function showAssignModal(id) {
    currentAssignId = id;
    const token = localStorage.getItem('access_token');
    const resStaff = await fetch(`${apiBase}/warden/staff`, { headers: { 'Authorization': `Bearer ${token}` } });
    const staff = await resStaff.json();

    document.getElementById('modalTitle').innerText = `Assign Complaint #${id}`;
    document.getElementById('modalBody').innerHTML = `
        <div class="mb-3">
            <label class="form-label">Assign to Maintenance Staff</label>
            <select id="assign-staff-id" class="form-select">
                ${staff.map(s => `<option value="${s.id}">${s.username}</option>`).join('')}
            </select>
        </div>
        <div class="mb-3">
            <label class="form-label">Assign Priority</label>
            <select id="assign-priority" class="form-select">
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
            </select>
        </div>
        <button class="btn btn-premium" onclick="confirmAssignment()">Confirm Assignment</button>
    `;
    const modal = new bootstrap.Modal(document.getElementById('complaintModal'));
    modal.show();
}

async function confirmAssignment() {
    const data = {
        staff_id: document.getElementById('assign-staff-id').value,
        priority: document.getElementById('assign-priority').value
    };
    const token = localStorage.getItem('access_token');
    const res = await fetch(`${apiBase}/warden/assign/${currentAssignId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(data)
    });
    if (res.ok) {
        bootstrap.Modal.getInstance(document.getElementById('complaintModal')).hide();
        showAllComplaints();
        loadDashboardStats();
    }
}

let currentRejectId = null;
function showRejectModal(id) {
    currentRejectId = id;
    const modal = new bootstrap.Modal(document.getElementById('rejectModal'));
    modal.show();
}

document.getElementById('confirmRejectBtn').onclick = async () => {
    const data = {
        reason: document.getElementById('reject-reason').value,
        priority: document.getElementById('reject-priority').value
    };
    const token = localStorage.getItem('access_token');
    const res = await fetch(`${apiBase}/warden/reject/${currentRejectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(data)
    });
    if (res.ok) {
        bootstrap.Modal.getInstance(document.getElementById('rejectModal')).hide();
        showAllComplaints();
        loadDashboardStats();
    }
};

// Admin User Management
async function showUserManagement() {
    setActiveLink('showUserManagement');
    const token = localStorage.getItem('access_token');
    const res = await fetch(`${apiBase}/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const users = await res.json();
    
    document.getElementById('role-content').innerHTML = `
        <div class="glass-card animate-fade">
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h4>User Management</h4>
                <button class="btn btn-premium btn-sm" onclick="showUserModal()"><i class="fa-solid fa-plus me-1"></i> Add New User</button>
            </div>
            <div class="table-responsive">
                <table class="table align-middle">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Username</th>
                            <th>Role</th>
                            <th>Block/Room</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${users.map(u => `
                            <tr>
                                <td>${u.id}</td>
                                <td>${u.username}</td>
                                <td><span class="badge bg-secondary">${u.role.toUpperCase()}</span></td>
                                <td>${u.block || 'N/A'} - ${u.room_number || 'N/A'}</td>
                                <td>
                                    <button class="btn btn-sm btn-outline-primary" onclick="showUserModal(${JSON.stringify(u).replace(/"/g, '&quot;')})"><i class="fa-solid fa-edit"></i></button>
                                    <button class="btn btn-sm btn-outline-danger" onclick="deleteUser(${u.id})"><i class="fa-solid fa-trash"></i></button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function showUserModal(user = null) {
    const isEdit = !!user;
    document.getElementById('modalTitle').innerText = isEdit ? `Edit User: ${user.username}` : "Add New User";
    document.getElementById('modalBody').innerHTML = `
        <input type="hidden" id="manage-user-id" value="${user ? user.id : ''}">
        <div class="mb-3">
            <label class="form-label">Username</label>
            <input type="text" id="manage-username" class="form-control" value="${user ? user.username : ''}" required>
        </div>
        <div class="mb-3">
            <label class="form-label">${isEdit ? 'New Password (leave blank to keep)' : 'Password'}</label>
            <div class="input-group">
                <input type="password" id="manage-password" class="form-control" placeholder="${isEdit ? '••••••••' : ''}" ${isEdit ? '' : 'required'}>
                <button class="btn btn-outline-secondary" type="button" onclick="const p = document.getElementById('manage-password'); p.type = p.type === 'password' ? 'text' : 'password';"><i class="fa-solid fa-eye"></i></button>
            </div>
        </div>
        <div class="mb-3">
            <label class="form-label">Role</label>
            <select id="manage-role" class="form-select">
                <option value="student" ${user && user.role === 'student' ? 'selected' : ''}>Student</option>
                <option value="warden" ${user && user.role === 'warden' ? 'selected' : ''}>Warden</option>
                <option value="staff" ${user && user.role === 'staff' ? 'selected' : ''}>Maintenance Staff</option>
                <option value="admin" ${user && user.role === 'admin' ? 'selected' : ''}>Admin</option>
            </select>
        </div>
        <button class="btn btn-premium" onclick="confirmUserManage()">${isEdit ? 'Update User' : 'Create User'}</button>
    `;
    const modal = new bootstrap.Modal(document.getElementById('complaintModal'));
    modal.show();
}

async function confirmUserManage() {
    const userId = document.getElementById('manage-user-id').value;
    const data = {
        username: document.getElementById('manage-username').value,
        role: document.getElementById('manage-role').value
    };
    const password = document.getElementById('manage-password').value;
    if (password) data.password = password;
    if (userId) data.id = userId;

    const token = localStorage.getItem('access_token');
    const res = await fetch(`${apiBase}/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(data)
    });

    if (res.ok) {
        bootstrap.Modal.getInstance(document.getElementById('complaintModal')).hide();
        showUserManagement();
    } else {
        const err = await res.json();
        alert(err.msg);
    }
}

async function showAdminComplaintsView() {
    setActiveLink('showAdminComplaintsView');
    const token = localStorage.getItem('access_token');
    const res = await fetch(`${apiBase}/warden/complaints`, { // Using Warden's comprehensive list
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const complaints = await res.json();
    
    document.getElementById('role-content').innerHTML = `
        <div class="glass-card animate-fade">
            <h4>Global Complaint Status</h4>
            <div class="table-responsive">
                <table class="table align-middle">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Student</th>
                            <th>Issue</th>
                            <th>Status</th>
                            <th>Priority</th>
                            <th>Block/Room</th>
                            <th>Submitted On</th>
                            <th>Assigned On</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${complaints.map(c => `
                            <tr>
                                <td>#${c.id}</td>
                                <td>${c.student}</td>
                                <td>${c.complaint_type}</td>
                                <td><span class="badge-custom ${getStatusClass(c.status)}">${c.status}</span></td>
                                <td><span class="badge bg-secondary">${c.priority || 'UNASSIGNED'}</span></td>
                                <td>${c.block} - ${c.room_number}</td>
                                <td>${c.created_at}</td>
                                <td>${c.assigned_at || 'Not Assigned'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

async function deleteUser(id) {
    if (!confirm("Are you sure?")) return;
    const token = localStorage.getItem('access_token');
    const res = await fetch(`${apiBase}/admin/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) showUserManagement();
}

async function showStaffList() {
    setActiveLink('showStaffList');
    const token = localStorage.getItem('access_token');
    const res = await fetch(`${apiBase}/warden/staff`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const staff = await res.json();
    
    document.getElementById('role-content').innerHTML = `
        <div class="glass-card animate-fade">
            <h4>Maintenance Staff Members</h4>
            <div class="table-responsive">
                <table class="table align-middle">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Username</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${staff.map(s => `
                            <tr>
                                <td>#${s.id}</td>
                                <td>${s.username}</td>
                                <td><span class="badge bg-success">Active</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}
