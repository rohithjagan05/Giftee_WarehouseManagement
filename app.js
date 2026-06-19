/**
 * InventoryPro MVP Logic
 * High-fidelity prototype with dynamic state and inventory tracking
 */

// --- STATE MANAGEMENT ---
const State = {
    activePage: 'dashboard',
    projects: [
        { id: 1, number: 'PRJ-24-001', name: 'Dubai Airport T3 CCTV Upgrade', location: 'Dubai, UAE', remarks: 'High priority implementation' },
        { id: 2, number: 'PRJ-24-002', name: 'Mall of Emirates Security Mesh', location: 'Dubai, UAE', remarks: 'Phase 1 completed' },
    ],
    lpos: [
        { id: 1, projectId: 1, number: 'LPO-7701', supplier: 'Axis Communications', address: 'Silicon Oasis, Dubai', date: '2024-05-15' },
        { id: 2, projectId: 1, number: 'LPO-7702', supplier: 'Western Digital', address: 'JAFZA, Dubai', date: '2024-05-20' },
    ],
    grns: [
        { id: 1, lpoId: 1, number: 'GRN-9001', date: '2024-06-01', remarks: 'Standard inspection passed', items: [
            { id: 1, code: 'CAM-AX-P32', oem: 'P3245-LV', desc: 'Dome Camera 4MP', unit: 'Pcs', qty: 50, price: 245 },
            { id: 2, code: 'CAM-AX-M30', oem: 'M3067-P', desc: 'Fixed Mini Dome', unit: 'Pcs', qty: 30, price: 180 },
        ]},
        { id: 2, lpoId: 2, number: 'GRN-9002', date: '2024-06-05', remarks: 'Drives delivered in batches', items: [
            { id: 3, code: 'HDD-WD-10TB', oem: 'WD101PURP', desc: 'Purple Pro 10TB HDD', unit: 'Pcs', qty: 20, price: 310 },
        ]}
    ],
    gdns: [
        { id: 1, lpoId: 1, number: 'GDN-4001', date: '2024-06-10', consignee: 'Ahmad Logistics', address: 'Gate 4, Terminal 3', items: [
            { id: 1, code: 'CAM-AX-P32', qty: 20 },
        ]}
    ]
};

// --- CORE UTILITIES ---

const Icons = () => lucide.createIcons();

const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

const getProjectByLpo = (lpoId) => {
    const lpo = State.lpos.find(l => l.id == lpoId);
    return State.projects.find(p => p.id == lpo.projectId);
};

const getInventory = (lpoId) => {
    const recieved = {};
    const delivered = {};

    // Calculate all items received for this LPO
    State.grns.filter(g => g.lpoId == lpoId).forEach(grn => {
        grn.items.forEach(item => {
            if (!recieved[item.code]) {
                recieved[item.code] = { ...item, qty: 0 };
            }
            recieved[item.code].qty += item.qty;
        });
    });

    // Calculate all items delivered for this LPO
    State.gdns.filter(d => d.lpoId == lpoId).forEach(gdn => {
        gdn.items.forEach(item => {
            if (!delivered[item.code]) delivered[item.code] = 0;
            delivered[item.code] += item.qty;
        });
    });

    // Combine
    return Object.keys(recieved).map(code => ({
        ...recieved[code],
        receivedQty: recieved[code].qty,
        deliveredQty: delivered[code] || 0,
        availableQty: recieved[code].qty - (delivered[code] || 0)
    }));
};

// --- ROUTING ---

const navigate = (page) => {
    State.activePage = page;
    
    // Update navigation UI
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.toggle('active', el.dataset.page === page);
    });

    // Update Title
    const titles = {
        dashboard: 'Dashboard Overview',
        projects: 'Project Database',
        grn: 'Goods Receipt (GRN)',
        gdn: 'Goods Delivery (GDN)',
        reports: 'System Reports'
    };
    document.getElementById('page-title').innerText = titles[page] || 'InventoryPro';
    
    // Render Page
    renderPage(page);
};

// --- RENDERING ENGINE ---

const renderPage = (page) => {
    const container = document.getElementById('content-area');
    container.innerHTML = ''; // Clear

    switch(page) {
        case 'dashboard': renderDashboard(container); break;
        case 'projects': renderProjects(container); break;
        case 'grn': renderGRN(container); break;
        case 'gdn': renderGDN(container); break;
        case 'reports': renderReports(container); break;
    }
    Icons();
};

const renderDashboard = (container) => {
    // Calculate Stats
    const totalProjects = State.projects.length;
    const totalLPOs = State.lpos.length;
    const totalGRNs = State.grns.length;
    const totalGDNs = State.gdns.length;

    let receivedVal = 0;
    State.grns.forEach(g => g.items.forEach(i => receivedVal += (i.qty * i.price)));
    
    let deliveredVal = 0;
    State.gdns.forEach(g => {
        const lpoItems = getInventory(g.lpoId);
        g.items.forEach(gi => {
            const itemInfo = lpoItems.find(li => li.code === gi.code);
            if (itemInfo) deliveredVal += (gi.qty * itemInfo.price);
        });
    });

    container.innerHTML = `
        <div class="space-y-10 animate-fade-in-up">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                ${renderStatCard('Total Projects', totalProjects, 'layers', 'blue')}
                ${renderStatCard('Total LPOs', totalLPOs, 'file-text', 'indigo')}
                ${renderStatCard('Active GRNs', totalGRNs, 'arrow-down-left', 'emerald')}
                ${renderStatCard('Active GDNs', totalGDNs, 'arrow-up-right', 'orange')}
            </div>

            <div class="grid grid-cols-1 xl:grid-cols-3 gap-10">
                <div class="xl:col-span-2 bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                    <div class="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                        <h4 class="font-outfit font-bold text-xl text-slate-900">Recent Operations</h4>
                        <div class="flex gap-2">
                             <button class="px-4 py-2 text-xs font-bold text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors">Export Log</button>
                        </div>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full text-left">
                            <thead class="bg-slate-50/50">
                                <tr>
                                    <th class="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Type</th>
                                    <th class="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Reference No</th>
                                    <th class="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
                                    <th class="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Project</th>
                                    <th class="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100">
                                ${State.grns.map(g => `
                                    <tr class="hover:bg-slate-50/50 transition-colors cursor-pointer">
                                        <td class="px-8 py-4"><span class="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-full uppercase">Receipt</span></td>
                                        <td class="px-8 py-4 font-bold text-slate-700">${g.number}</td>
                                        <td class="px-8 py-4 text-sm text-slate-500">${g.date}</td>
                                        <td class="px-8 py-4 text-sm font-medium text-slate-600">${getProjectByLpo(g.lpoId).number}</td>
                                        <td class="px-8 py-4 text-right items-center">
                                            <span class="w-2 h-2 rounded-full bg-emerald-400 inline-block mr-2"></span>
                                            <span class="text-xs font-bold text-slate-500 italic">Completed</span>
                                        </td>
                                    </tr>
                                `).join('')}
                                ${State.gdns.map(g => `
                                    <tr class="hover:bg-slate-50/50 transition-colors cursor-pointer">
                                        <td class="px-8 py-4"><span class="px-3 py-1 bg-orange-50 text-orange-600 text-[10px] font-bold rounded-full uppercase">Delivery</span></td>
                                        <td class="px-8 py-4 font-bold text-slate-700">${g.number}</td>
                                        <td class="px-8 py-4 text-sm text-slate-500">${g.date}</td>
                                        <td class="px-8 py-4 text-sm font-medium text-slate-600">${getProjectByLpo(g.lpoId).number}</td>
                                        <td class="px-8 py-4 text-right items-center">
                                            <span class="w-2 h-2 rounded-full bg-blue-400 inline-block mr-2"></span>
                                            <span class="text-xs font-bold text-slate-500 italic">Dispatched</span>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="space-y-8">
                    <div class="bg-white rounded-[32px] border border-slate-200 shadow-sm p-8 flex flex-col relative overflow-hidden">
                        <div class="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 blur-3xl rounded-full -mr-16 -mt-16"></div>
                        <h4 class="font-outfit font-bold text-xl text-slate-900 mb-8">Stock Valuation</h4>
                        <div class="flex-1 flex flex-col items-center justify-center space-y-8">
                            <div class="relative w-56 h-56 rounded-full border-[16px] border-slate-100 flex items-center justify-center p-4">
                                <svg class="absolute inset-0 w-full h-full -rotate-90">
                                    <circle cx="112" cy="112" r="96" fill="none" stroke="#2563eb" stroke-width="16" stroke-dasharray="603" stroke-dashoffset="${603 - (603 * (deliveredVal/receivedVal || 0))}" stroke-linecap="round"></circle>
                                </svg>
                                <div class="text-center z-10">
                                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Inventory</p>
                                    <p class="text-3xl font-black text-slate-900 mt-1">${formatCurrency(receivedVal - deliveredVal)}</p>
                                </div>
                            </div>
                            <div class="w-full space-y-4">
                                <div class="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                                    <div class="flex items-center gap-3">
                                        <div class="w-2 h-2 rounded-full bg-blue-500"></div>
                                        <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Received</span>
                                    </div>
                                    <span class="font-bold text-slate-900">${formatCurrency(receivedVal)}</span>
                                </div>
                                <div class="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                                    <div class="flex items-center gap-3">
                                        <div class="w-2 h-2 rounded-full bg-orange-500"></div>
                                        <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Delivered</span>
                                    </div>
                                    <span class="font-bold text-slate-900">${formatCurrency(deliveredVal)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
};

const renderStatCard = (title, value, icon, color) => {
    const colors = {
        blue: 'bg-blue-50 text-blue-600',
        indigo: 'bg-indigo-50 text-indigo-600',
        emerald: 'bg-emerald-50 text-emerald-600',
        orange: 'bg-orange-50 text-orange-600'
    };
    return `
        <div class="stat-card group">
            <div class="flex items-start justify-between relative z-10">
                <div>
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1 font-outfit">${title}</p>
                    <h4 class="text-4xl font-black text-slate-900 tracking-tight">${value}</h4>
                </div>
                <div class="p-4 ${colors[color]} rounded-2xl group-hover:scale-110 transition-transform duration-300">
                    <i data-lucide="${icon}" class="w-7 h-7"></i>
                </div>
            </div>
            <div class="mt-6 flex items-center gap-2 text-xs font-bold">
                 <span class="text-emerald-500">+12%</span>
                 <span class="text-slate-400 font-medium italic">vs last month</span>
            </div>
        </div>
    `;
};

// --- MODULE: PROJECTS ---
const renderProjects = (container) => {
    container.innerHTML = `
        <div class="animate-fade-in-up space-y-8">
            <div class="flex items-center justify-between">
                <div>
                    <h3 class="text-2xl font-black text-slate-900 tracking-tight">Active Projects</h3>
                    <p class="text-sm text-slate-500 font-medium">Manage and track your global project portfolio.</p>
                </div>
                <button class="px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold text-sm shadow-xl shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2">
                    <i data-lucide="plus" class="w-4 h-4"></i>
                    Create New Project
                </button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                ${State.projects.map(p => `
                    <div class="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm hover:border-blue-500/50 transition-all group">
                        <div class="flex justify-between items-start mb-6">
                            <div class="p-4 bg-slate-50 text-slate-900 rounded-2xl group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                <i data-lucide="folder" class="w-8 h-8"></i>
                            </div>
                            <span class="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black rounded-full uppercase tracking-wider">${p.number}</span>
                        </div>
                        <h4 class="text-xl font-bold text-slate-900 mb-2 truncate">${p.name}</h4>
                        <p class="text-sm text-slate-500 flex items-center gap-2 mb-6">
                            <i data-lucide="map-pin" class="w-4 h-4"></i>
                            ${p.location}
                        </p>
                        <div class="pt-6 border-t border-slate-100 flex items-center justify-between">
                            <div class="flex -space-x-2">
                                <div class="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-bold">JD</div>
                                <div class="w-8 h-8 rounded-full border-2 border-white bg-blue-500 text-white flex items-center justify-center text-[10px] font-bold">RM</div>
                            </div>
                            <button class="text-slate-400 hover:text-blue-600 transition-colors" title="Settings">
                                <i data-lucide="more-horizontal" class="w-5 h-5"></i>
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
};

// --- MODULE: GRN ---
const renderGRN = (container) => {
    container.innerHTML = `
        <div class="animate-fade-in-up space-y-8">
            <div class="flex items-center justify-between">
                <div>
                    <h3 class="text-2xl font-black text-slate-900 tracking-tight">Consolidated Goods Receipt</h3>
                    <p class="text-sm text-slate-500 font-medium">Create Receipts, Projects, and LPOs in one unified workflow.</p>
                </div>
                <button onclick="openGRNModal()" class="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-bold text-sm shadow-xl shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2">
                    <i data-lucide="plus" class="w-4 h-4"></i>
                    Add New Receipt
                </button>
            </div>

            <div class="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                <table class="w-full text-left">
                    <thead class="bg-slate-50/50">
                        <tr>
                            <th class="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Receipt No</th>
                            <th class="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Supplier</th>
                            <th class="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Project Reference</th>
                            <th class="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">LPO Ref</th>
                            <th class="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Items</th>
                            <th class="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        ${[...State.grns].reverse().map(g => {
                            const lpo = State.lpos.find(l => l.id == g.lpoId);
                            const prj = State.projects.find(p => p.id == (lpo ? lpo.projectId : null));
                            return `
                                <tr class="hover:bg-slate-50/50 transition-all group">
                                    <td class="px-8 py-6">
                                        <div class="flex items-center gap-3">
                                            <div class="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                                                <i data-lucide="file-check" class="w-4 h-4"></i>
                                            </div>
                                            <span class="font-bold text-slate-900">${g.number}</span>
                                        </div>
                                    </td>
                                    <td class="px-8 py-6 text-sm font-medium text-slate-600">${lpo ? lpo.supplier : 'Unknown'}</td>
                                    <td class="px-8 py-6">
                                        <div class="text-xs font-bold text-slate-900 capitalize">${prj ? prj.name : 'Unknown'}</div>
                                        <div class="text-[10px] text-slate-400 mt-1 uppercase font-bold">${prj ? prj.number : 'N/A'}</div>
                                    </td>
                                    <td class="px-8 py-6 text-sm font-bold text-blue-600">${lpo ? lpo.number : 'N/A'}</td>
                                    <td class="px-8 py-6 text-right font-bold text-slate-900">${g.items.length}</td>
                                    <td class="px-8 py-6 text-right">
                                        <button class="p-2 text-slate-400 hover:text-blue-600 transition-colors">
                                            <i data-lucide="eye" class="w-5 h-5"></i>
                                        </button>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
};

// --- MODAL HANDLING ---

const openGRNModal = () => {
    const modal = document.getElementById('modal-container');
    const content = document.getElementById('modal-content');
    const body = document.getElementById('modal-body');
    const title = document.getElementById('modal-title');
    const subtitle = document.getElementById('modal-subtitle');
    const submitBtn = document.getElementById('modal-submit');
    
    title.innerText = 'New Goods Receipt (GRN)';
    subtitle.innerText = 'Enter receipt, project, and LPO details to register new stock.';
    
    body.innerHTML = `
        <form id="grn-form" class="space-y-10">
            <!-- SECTION 1: PROJECT -->
            <div class="space-y-4">
                <div class="flex items-center gap-2 mb-4">
                    <div class="w-1 h-4 bg-blue-600 rounded-full"></div>
                    <h5 class="text-xs font-black text-slate-900 uppercase tracking-widest">1. Project Information</h5>
                </div>
                <div class="grid grid-cols-2 gap-6">
                    <div class="space-y-1.5">
                        <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Project Number</label>
                        <input list="prj-list" type="text" id="p-number" required placeholder="PRJ-1234" class="w-full h-12 px-4 bg-slate-50 rounded-xl font-medium outline-none border border-slate-100 focus:border-blue-500/50 focus:bg-white transition-all">
                        <datalist id="prj-list">${State.projects.map(p => `<option value="${p.number}">`).join('')}</datalist>
                    </div>
                    <div class="space-y-1.5">
                        <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Project Name</label>
                        <input type="text" id="p-name" required placeholder="e.g. Dubai Metro Expansion" class="w-full h-12 px-4 bg-slate-50 rounded-xl font-medium outline-none border border-slate-100 focus:border-blue-500/50 focus:bg-white transition-all">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-6">
                    <div class="space-y-1.5">
                        <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Location</label>
                        <input type="text" id="p-location" placeholder="e.g. Dubai, UAE" class="w-full h-12 px-4 bg-slate-50 rounded-xl font-medium outline-none border border-slate-100 focus:border-blue-500/50 focus:bg-white transition-all">
                    </div>
                </div>
            </div>

            <!-- SECTION 2: LPO -->
            <div class="space-y-4">
                <div class="flex items-center gap-2 mb-4">
                    <div class="w-1 h-4 bg-indigo-600 rounded-full"></div>
                    <h5 class="text-xs font-black text-slate-900 uppercase tracking-widest">2. LPO & Supplier Details</h5>
                </div>
                <div class="grid grid-cols-2 gap-6">
                    <div class="space-y-1.5">
                        <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">LPO Number</label>
                        <input type="text" id="l-number" required placeholder="LPO-8801" class="w-full h-12 px-4 bg-slate-50 rounded-xl font-medium outline-none border border-slate-100 focus:border-indigo-500/50 focus:bg-white transition-all">
                    </div>
                    <div class="space-y-1.5">
                        <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Supplier Name</label>
                        <input type="text" id="l-supplier" required placeholder="e.g. Axis Communications" class="w-full h-12 px-4 bg-slate-50 rounded-xl font-medium outline-none border border-slate-100 focus:border-indigo-500/50 focus:bg-white transition-all">
                    </div>
                </div>
            </div>

            <!-- SECTION 3: RECEIPT -->
            <div class="space-y-4">
                <div class="flex items-center gap-2 mb-4">
                    <div class="w-1 h-4 bg-emerald-600 rounded-full"></div>
                    <h5 class="text-xs font-black text-slate-900 uppercase tracking-widest">3. Goods Receipt Header</h5>
                </div>
                <div class="grid grid-cols-2 gap-6">
                    <div class="space-y-1.5">
                        <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">GRN Number</label>
                        <input type="text" id="g-number" required value="GRN-${Math.floor(Math.random()*10000)}" class="w-full h-12 px-4 bg-slate-50 rounded-xl font-medium outline-none border border-slate-100 focus:border-emerald-500/50 focus:bg-white transition-all">
                    </div>
                    <div class="space-y-1.5">
                        <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Receipt Date</label>
                        <input type="date" id="g-date" required value="${new Date().toISOString().split('T')[0]}" class="w-full h-12 px-4 bg-slate-50 rounded-xl font-medium outline-none border border-slate-100 focus:border-emerald-500/50 focus:bg-white transition-all">
                    </div>
                </div>
            </div>

            <!-- SECTION 4: ITEMS -->
            <div class="space-y-4">
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center gap-2">
                        <div class="w-1 h-4 bg-amber-500 rounded-full"></div>
                        <h5 class="text-xs font-black text-slate-900 uppercase tracking-widest">4. Product Items</h5>
                    </div>
                    <button type="button" id="add-row" class="px-3 py-1.5 bg-blue-50 text-blue-600 text-[10px] font-black uppercase rounded-lg hover:bg-blue-100 transition-all">+ Add Product</button>
                </div>
                <div id="items-container" class="space-y-3">
                    <div class="grid grid-cols-12 gap-3 p-4 bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl item-row">
                        <div class="col-span-2"><input type="text" placeholder="P-CODE" class="w-full h-10 px-3 bg-white rounded-lg text-xs font-bold outline-none border border-slate-100 i-code"></div>
                        <div class="col-span-2"><input type="text" placeholder="OEM" class="w-full h-10 px-3 bg-white rounded-lg text-xs font-bold outline-none border border-slate-100 i-oem"></div>
                        <div class="col-span-4"><input type="text" placeholder="Description" class="w-full h-10 px-3 bg-white rounded-lg text-xs font-medium outline-none border border-slate-100 i-desc"></div>
                        <div class="col-span-2"><input type="number" placeholder="Qty" class="w-full h-10 px-3 bg-white rounded-lg text-xs font-bold outline-none border border-slate-100 i-qty"></div>
                        <div class="col-span-2"><input type="number" placeholder="Price" class="w-full h-10 px-3 bg-white rounded-lg text-xs font-bold outline-none border border-slate-100 i-price"></div>
                    </div>
                </div>
            </div>
        </form>
    `;

    modal.classList.remove('opacity-0', 'pointer-events-none');
    content.classList.remove('scale-95');
    Icons();

    // Auto-fill logic for existing projects
    document.getElementById('p-number').addEventListener('input', (e) => {
        const prj = State.projects.find(p => p.number === e.target.value);
        if (prj) {
            document.getElementById('p-name').value = prj.name;
            document.getElementById('p-location').value = prj.location;
        }
    });

    document.getElementById('add-row').addEventListener('click', () => {
        const container = document.getElementById('items-container');
        const row = document.createElement('div');
        row.className = 'grid grid-cols-12 gap-3 p-4 bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl item-row animate-fade-in-up';
        row.innerHTML = `
            <div class="col-span-2"><input type="text" placeholder="P-CODE" class="w-full h-10 px-3 bg-white rounded-lg text-xs font-bold outline-none border border-slate-100 i-code"></div>
            <div class="col-span-2"><input type="text" placeholder="OEM" class="w-full h-10 px-3 bg-white rounded-lg text-xs font-bold outline-none border border-slate-100 i-oem"></div>
            <div class="col-span-4"><input type="text" placeholder="Description" class="w-full h-10 px-3 bg-white rounded-lg text-xs font-medium outline-none border border-slate-100 i-desc"></div>
            <div class="col-span-2"><input type="number" placeholder="Qty" class="w-full h-10 px-3 bg-white rounded-lg text-xs font-bold outline-none border border-slate-100 i-qty"></div>
            <div class="col-span-2 flex items-center gap-2">
                <input type="number" placeholder="Price" class="w-full h-10 px-3 bg-white rounded-lg text-xs font-bold outline-none border border-slate-100 i-price">
                <button type="button" class="text-rose-400 hover:bg-rose-50 p-1.5 rounded-lg transition-all" onclick="this.parentElement.parentElement.remove()"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </div>
        `;
        container.appendChild(row);
        Icons();
    });

    // Submit Action
    submitBtn.onclick = () => {
        handleSaveGRN();
    };
};

const handleSaveGRN = () => {
    const pNo = document.getElementById('p-number').value;
    const pName = document.getElementById('p-name').value;
    const pLoc = document.getElementById('p-location').value;
    const lNo = document.getElementById('l-number').value;
    const lSupp = document.getElementById('l-supplier').value;
    const gNo = document.getElementById('g-number').value;
    const gDate = document.getElementById('g-date').value;

    if (!pNo || !pName || !lNo || !lSupp || !gNo) return alert('Please fill all required fields.');

    // 1. Process Project
    let prj = State.projects.find(p => p.number === pNo);
    if (!prj) {
        prj = { id: State.projects.length + 1, number: pNo, name: pName, location: pLoc || '' };
        State.projects.push(prj);
    }

    // 2. Process LPO
    let lpo = State.lpos.find(l => l.number === lNo && l.projectId === prj.id);
    if (!lpo) {
        lpo = { id: State.lpos.length + 1, projectId: prj.id, number: lNo, supplier: lSupp, date: gDate };
        State.lpos.push(lpo);
    }

    // 3. Process Items
    const rows = document.querySelectorAll('.item-row');
    const items = Array.from(rows).map(row => ({
        id: Math.floor(Math.random() * 10000),
        code: row.querySelector('.i-code').value,
        oem: row.querySelector('.i-oem').value,
        desc: row.querySelector('.i-desc').value,
        unit: 'Pcs',
        qty: parseFloat(row.querySelector('.i-qty').value) || 0,
        price: parseFloat(row.querySelector('.i-price').value) || 0
    })).filter(i => i.code && i.qty > 0);

    if (items.length === 0) return alert('Please add at least one valid product.');

    // 4. Save GRN
    State.grns.push({ id: State.grns.length + 1, lpoId: lpo.id, number: gNo, date: gDate, items });

    closeModal();
    navigate('grn');
    setTimeout(() => alert('Success: Goods Receipt Created. Project and LPO details captured!'), 500);
};

const closeModal = () => {
    const modal = document.getElementById('modal-container');
    const content = document.getElementById('modal-content');
    modal.classList.add('opacity-0', 'pointer-events-none');
    content.classList.add('scale-95');
};

// --- BOOTSTRAP ---

window.addEventListener('DOMContentLoaded', () => {
    // Nav Listeners
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            navigate(btn.dataset.page);
        });
    });

    // Sidebar Toggle
    document.getElementById('toggle-sidebar').addEventListener('click', () => {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('w-72');
        sidebar.classList.toggle('w-0');
        sidebar.classList.toggle('opacity-0');
    });

    // Close Modal
    document.getElementById('close-modal').addEventListener('click', closeModal);
    document.getElementById('modal-cancel').addEventListener('click', closeModal);

    // Initial Nav
    navigate('dashboard');
    Icons();
});

// Mock LPOs rendering Removed as it is now integrated into GRN

// Mock GDN rendering (Crucial Logic)
const renderGDN = (container) => {
    container.innerHTML = `
        <div class="animate-fade-in-up space-y-10">
            <div class="flex items-center justify-between">
                <div>
                    <h3 class="text-2xl font-black text-slate-900 tracking-tight">Dispatches & Deliveries</h3>
                    <p class="text-sm text-slate-500 font-medium">Issue stock to consignees against specific project LPOs.</p>
                </div>
                <button onclick="openGDNModal()" class="px-8 py-4 bg-orange-600 text-white rounded-2xl font-bold text-sm shadow-xl shadow-orange-500/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2">
                    <i data-lucide="plus" class="w-4 h-4"></i>
                    Issue New GDN
                </button>
            </div>

            <div class="bg-white rounded-[40px] p-8 shadow-sm border border-slate-100 flex flex-col md:flex-row gap-10 items-center">
                 <div class="w-32 h-32 bg-orange-50 text-orange-600 rounded-[32px] flex items-center justify-center shrink-0">
                    <i data-lucide="truck" class="w-16 h-16"></i>
                 </div>
                 <div class="flex-1">
                    <h4 class="text-xl font-black text-slate-900 mb-2 italic">Automated Stock Reservation</h4>
                    <p class="text-slate-500 max-w-2xl text-sm leading-relaxed">When you create a delivery, the system automatically checks the <strong>Available Stock</strong> for the selected LPO. You cannot deliver items that haven't been received under that specific LPO number.</p>
                 </div>
            </div>

            <div class="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                <table class="w-full text-left">
                    <thead class="bg-slate-50/50">
                        <tr>
                            <th class="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">GDN Number</th>
                            <th class="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Consignee</th>
                            <th class="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
                            <th class="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">LPO Reference</th>
                            <th class="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Items</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        ${State.gdns.map(d => {
                            const lpo = State.lpos.find(l => l.id == d.lpoId);
                            return `
                                <tr class="hover:bg-slate-50/50 transition-colors">
                                    <td class="px-8 py-6 font-bold text-slate-900">${d.number}</td>
                                    <td class="px-8 py-6 text-sm font-medium text-slate-600">${d.consignee}</td>
                                    <td class="px-8 py-6 text-sm text-slate-400">${d.date}</td>
                                    <td class="px-8 py-6 text-sm font-bold text-blue-600">${lpo.number}</td>
                                    <td class="px-8 py-6 text-right font-bold text-slate-900">${d.items.length}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    Icons();
};

const openGDNModal = () => {
    const modal = document.getElementById('modal-container');
    const content = document.getElementById('modal-content');
    const body = document.getElementById('modal-body');
    const title = document.getElementById('modal-title');
    
    title.innerText = 'Issue Goods Delivery (GDN)';
    body.innerHTML = `
        <div class="space-y-8">
            <div class="grid grid-cols-2 gap-6">
                <div class="space-y-2">
                    <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select Project</label>
                    <select id="gdn-project" class="w-full h-12 px-4 bg-slate-100 rounded-xl font-medium outline-none border-2 border-transparent focus:border-blue-500/50 transition-all">
                        <option value="">Select Project...</option>
                        ${State.projects.map(p => `<option value="${p.id}">${p.number} - ${p.name}</option>`).join('')}
                    </select>
                </div>
                <div class="space-y-2">
                    <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select LPO</label>
                    <select id="gdn-lpo" class="w-full h-12 px-4 bg-slate-100 rounded-xl font-medium outline-none border-2 border-transparent focus:border-blue-500/50 transition-all">
                        <option value="">Choose Project First</option>
                    </select>
                </div>
            </div>

            <div id="stock-info" class="hidden animate-fade-in-up">
                <div class="p-6 bg-blue-50 rounded-[28px] mb-8 border border-blue-100">
                    <h5 class="text-xs font-bold text-blue-800 uppercase tracking-widest mb-4">Available Items Under Selected LPO</h5>
                    <div id="lpo-stock-list" class="space-y-2">
                        <!-- Loaded via selection -->
                    </div>
                </div>

                <div class="bg-slate-50 p-6 rounded-[28px] space-y-4">
                    <h5 class="text-xs font-bold text-slate-400 uppercase tracking-widest">Delivery Details</h5>
                    <div class="grid grid-cols-2 gap-6">
                         <input type="text" placeholder="GDN Number" class="w-full h-12 px-4 bg-white rounded-xl font-medium outline-none border border-slate-200">
                         <input type="date" value="${new Date().toISOString().split('T')[0]}" class="w-full h-12 px-4 bg-white rounded-xl font-medium outline-none border border-slate-200">
                    </div>
                    <input type="text" placeholder="Consignee Name" class="w-full h-12 px-4 bg-white rounded-xl font-medium outline-none border border-slate-200">
                    <input type="text" placeholder="Consignee Address" class="w-full h-12 px-4 bg-white rounded-xl font-medium outline-none border border-slate-200">
                </div>
            </div>
        </div>
    `;

    modal.classList.remove('opacity-0', 'pointer-events-none');
    content.classList.remove('scale-95');
    Icons();

    document.getElementById('gdn-project').addEventListener('change', (e) => {
        const lpoSelect = document.getElementById('gdn-lpo');
        const pId = e.target.value;
        if (!pId) {
            lpoSelect.innerHTML = '<option value="">Choose Project First</option>';
            return;
        }
        const pLpos = State.lpos.filter(l => l.projectId == pId);
        lpoSelect.innerHTML = '<option value="">Select LPO...</option>' + pLpos.map(l => `<option value="${l.id}">${l.number}</option>`).join('');
    });

    document.getElementById('gdn-lpo').addEventListener('change', (e) => {
        const lpoId = e.target.value;
        const stockDiv = document.getElementById('stock-info');
        const stockList = document.getElementById('lpo-stock-list');
        
        if (!lpoId) {
            stockDiv.classList.add('hidden');
            return;
        }

        const items = getInventory(lpoId);
        stockDiv.classList.remove('hidden');
        
        if (items.length === 0) {
            stockList.innerHTML = '<p class="text-xs text-rose-500 font-bold italic">No goods received yet for this LPO.</p>';
        } else {
            stockList.innerHTML = items.map(item => `
                <div class="flex items-center justify-between p-4 bg-white rounded-2xl border border-blue-100 shadow-sm">
                    <div>
                        <div class="text-sm font-bold text-slate-900">${item.desc}</div>
                        <div class="text-[10px] text-slate-400 font-bold uppercase mt-0.5">${item.code} | Stock: ${item.availableQty} ${item.unit}</div>
                    </div>
                    <div class="flex items-center gap-3">
                        <label class="text-[10px] font-black text-blue-600 uppercase">Issue:</label>
                        <input type="number" max="${item.availableQty}" placeholder="0" class="w-20 h-10 px-3 bg-slate-50 border border-blue-100 rounded-lg text-sm text-center font-bold focus:ring-2 focus:ring-blue-500 outline-none">
                    </div>
                </div>
            `).join('');
        }
    });
};

// --- MODULE: REPORTS ---
const renderReports = (container) => {
    container.innerHTML = `
        <div class="animate-fade-in-up space-y-10">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div class="report-type-card active" data-report="project">
                    <div class="p-4 bg-blue-50 text-blue-600 rounded-2xl mb-4 w-fit"><i data-lucide="layers"></i></div>
                    <h5 class="font-bold text-slate-900">Project Statement</h5>
                    <p class="text-xs text-slate-400 mt-2">Comprehensive view of all LPOs and stock under a specific project.</p>
                </div>
                <div class="report-type-card" data-report="lpo">
                    <div class="p-4 bg-indigo-50 text-indigo-600 rounded-2xl mb-4 w-fit"><i data-lucide="file-text"></i></div>
                    <h5 class="font-bold text-slate-900">LPO Ledger</h5>
                    <p class="text-xs text-slate-400 mt-2">Track receipts vs deliveries for a single Local Purchase Order.</p>
                </div>
                <div class="report-type-card" data-report="oem">
                    <div class="p-4 bg-orange-50 text-orange-600 rounded-2xl mb-4 w-fit"><i data-lucide="tag"></i></div>
                    <h5 class="font-bold text-slate-900">OEM Search</h5>
                    <p class="text-xs text-slate-400 mt-2">Locate specific parts across all warehouses and projects.</p>
                </div>
            </div>

            <div class="bg-white rounded-[32px] border border-slate-200 shadow-sm p-10">
                <div class="flex flex-col md:flex-row items-end gap-6 mb-10 pb-10 border-b border-slate-50">
                    <div class="flex-1 space-y-2">
                        <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select Report Subject</label>
                        <select class="w-full h-14 px-6 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none ring-blue-500/10 focus:ring-4 transition-all">
                            ${State.projects.map(p => `<option>${p.number} - ${p.name}</option>`).join('')}
                        </select>
                    </div>
                    <button class="h-14 px-10 bg-slate-900 text-white rounded-2xl font-bold flex items-center gap-3 hover:bg-slate-800 transition-all">
                        <i data-lucide="search" class="w-5 h-5"></i>
                        Run Report
                    </button>
                    <button onclick="simulateExcelExport()" class="h-14 px-10 bg-emerald-600 text-white rounded-2xl font-bold flex items-center gap-3 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20">
                        <i data-lucide="file-spreadsheet" class="w-5 h-5"></i>
                        Export Excel
                    </button>
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead>
                            <tr class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                <th class="pb-6">Item Code</th>
                                <th class="pb-6">Description</th>
                                <th class="pb-6 text-right">Received</th>
                                <th class="pb-6 text-right">Delivered</th>
                                <th class="pb-6 text-right text-blue-600">Balance</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-50">
                            ${getInventory(1).map(item => `
                                <tr>
                                    <td class="py-5 font-bold text-slate-900">${item.code}</td>
                                    <td class="py-5 text-sm font-medium text-slate-500">${item.desc}</td>
                                    <td class="py-5 text-right font-bold text-slate-900">${item.receivedQty}</td>
                                    <td class="py-5 text-right font-bold text-slate-500">${item.deliveredQty}</td>
                                    <td class="py-5 text-right font-black text-blue-600">${item.availableQty}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    Icons();
};

const simulateExcelExport = () => {
    const btn = event.currentTarget;
    const originalContent = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Generating...';
    Icons();
    
    setTimeout(() => {
        btn.innerHTML = '<i data-lucide="check" class="w-5 h-5"></i> Downloaded!';
        btn.classList.replace('bg-emerald-600', 'bg-emerald-500');
        Icons();
        
        // In a real app we'd use XLSX library here.
        alert("Success: Report exported to Excel (Simulated).\nFilename: Project_Statement_PRJ001.xlsx");
        
        setTimeout(() => {
            btn.innerHTML = originalContent;
            btn.classList.replace('bg-emerald-500', 'bg-emerald-600');
            Icons();
        }, 3000);
    }, 1500);
};
