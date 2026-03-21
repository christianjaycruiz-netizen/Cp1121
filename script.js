let folders = JSON.parse(localStorage.getItem("folders")) || [];
let currentFilter = 'day';
let activeNoteCoord = { fIdx: null, nIdx: null };
let activeFolderIdx = null;
let currentView = 'notes';
let selectedFolderIdx = null; 

let userName = localStorage.getItem("userName") || "User 911";
let currentTheme = localStorage.getItem("theme") || "default";
let pinnedData = JSON.parse(localStorage.getItem("pinnedData")) || { schedule: "Exam Day 8:30 AM", agenda: "Complete GUI Project" };

function init() {
    const savedTheme = localStorage.getItem("theme") || "default";
    const savedAccent = localStorage.getItem("accentColor") || "#4a90e2";
    
    document.getElementById("userNameText").innerText = userName;
    setTheme(savedTheme, savedAccent);
    
    renderPinned();
    renderFolders();
    renderNotes();
    
    document.body.addEventListener('click', function() {
        const audio = document.getElementById("alarmSound");
        if(audio) {
            audio.muted = true;
            audio.play().then(() => {
                audio.pause();
                audio.muted = false;
            });
        }
    }, { once: true });
}

// --- NEW UI NOTIFICATION LOGIC ---
function showUIFeedback(message) {
    const container = document.getElementById("toastContainer");
    if (!container) return; // Guard clause if HTML element is missing
    const toast = document.createElement("div");
    toast.className = "toast-msg";
    toast.innerText = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

function stopAlarmUI() {
    const audio = document.getElementById("alarmSound");
    if (audio) {
        audio.pause();
        audio.currentTime = 0;
    }
    document.getElementById("alarmModal").style.display = "none";
}

function playAlarm() {
    const audio = document.getElementById("alarmSound");
    if (audio) {
        audio.loop = true;
        audio.currentTime = 0;
        audio.play().catch(e => console.log("Audio play blocked."));
    }
}

function setView(view) {
    currentView = view;
    selectedFolderIdx = null; 
    document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
    document.getElementById(`menu-${view}`).classList.add('active');
    
    document.getElementById('notesView').style.display = view === 'notes' ? 'block' : 'none';
    document.getElementById('remindersView').style.display = view === 'reminders' ? 'block' : 'none';
    document.getElementById('archivesView').style.display = view === 'archives' ? 'block' : 'none';
    
    if (view === 'notes') { renderFolders(); renderNotes(); }
    if (view === 'reminders') renderReminders();
    if (view === 'archives') renderArchives();
}

function openFolderContents() {
    selectedFolderIdx = activeFolderIdx;
    hideModals();
    renderNotes();
    const folderName = folders[selectedFolderIdx].name;
    document.querySelector(".top-bar h1").innerText = `NOTES > ${folderName.toUpperCase()}`;
}

function downloadFolder() {
    const folder = folders[activeFolderIdx];
    if (!folder || folder.notes.length === 0) {
        // REPLACED alert() with UI Toast
        showUIFeedback(" 🗁 This folder is empty!");
        return;
    }
    let content = `FOLDER: ${folder.name}\n==========================\n\n`;
    folder.notes.forEach(note => {
        content += `TITLE: ${note.title}\nDATE: ${new Date(note.timestamp).toLocaleString()}\nCONTENT:\n${note.content}\n\n--------------------------\n\n`;
    });
    const blob = new Blob([content], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${folder.name}_Backup.txt`;
    a.click();
}

function openReminderPrompt() {
    if (activeNoteCoord.nIdx !== null) {
        document.getElementById("reminderPrompt").style.display = "flex";
        document.getElementById("noteViewer").style.display = "none";
    } else {
        // REPLACED alert() with UI Toast
        showUIFeedback("⚠️ Please SAVE the note before setting a reminder.");
    }
}

function saveReminder() {
    const dtValue = document.getElementById("reminderDateTime").value;
    if (dtValue) {
        const { fIdx, nIdx } = activeNoteCoord;
        const dateObj = new Date(dtValue);
        const formatted = dateObj.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        folders[fIdx].notes[nIdx].reminder = dtValue; 
        folders[fIdx].notes[nIdx].reminderDisplay = formatted;
        save();
        hideModals();
        showUIFeedback(" 🕰  Alarm set successfully!");
        if (currentView === 'reminders') renderReminders();
    }
}

function renderReminders() {
    const container = document.getElementById("reminderListContainer");
    if (!container) return;
    container.innerHTML = "";
    let hasReminders = false;
    folders.forEach((f, fIdx) => {
        f.notes.forEach((n, nIdx) => {
            if (n.reminder) {
                hasReminders = true;
                const div = document.createElement("div");
                div.className = "reminder-card";
                div.innerHTML = `<div class="reminder-info"><h3>${n.title}</h3><span>⏰ ${n.reminderDisplay}</span></div>
                                 <button class="remove-reminder-btn" onclick="removeReminderOnly(${fIdx}, ${nIdx})">Remove</button>`;
                container.appendChild(div);
            }
        });
    });
    if (!hasReminders) container.innerHTML = "<p style='opacity:0.5; text-align:center;'>No active alarms.</p>";
}

function removeReminderOnly(fIdx, nIdx) {
    delete folders[fIdx].notes[nIdx].reminder;
    delete folders[fIdx].notes[nIdx].reminderDisplay;
    save();
    if (currentView === 'reminders') renderReminders();
}

setInterval(() => {
    const now = new Date();
    const currentTimeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    folders.forEach((folder, fIdx) => {
        folder.notes.forEach((note, nIdx) => {
            if (note.reminder && note.reminder === currentTimeStr) {
                document.getElementById("alarmNoteTitle").innerText = note.title;
                document.getElementById("alarmModal").style.display = "flex";
                playAlarm();
                removeReminderOnly(fIdx, nIdx);
            }
        });
    });
}, 30000);

function createFolderUI(folder, idx) {
    const wrapper = document.createElement("div");
    wrapper.className = "folder-item";
    const icon = document.createElement("div");
    icon.className = "folder";
    icon.onclick = (e) => { e.stopPropagation(); openFolderMenu(idx); };
    icon.ondblclick = () => { activeFolderIdx = idx; openFolderContents(); };
    const label = document.createElement("span");
    label.innerText = folder.name;
    label.style.marginTop = "8px";
    wrapper.appendChild(icon);
    wrapper.appendChild(label);
    return wrapper;
}

function renderFolders() {
    const container = document.getElementById("folderContainer");
    if (!container) return;
    container.innerHTML = "";
    folders.forEach((folder, idx) => {
        if (!folder.archived) container.appendChild(createFolderUI(folder, idx));
    });
}

function openFolderMenu(idx) {
    activeFolderIdx = idx;
    document.getElementById("menuFolderName").innerText = folders[idx].name;
    document.getElementById("archiveBtn").innerText = folders[idx].archived ? "📁 Restore Folder" : "📁 Archive Folder";
    document.getElementById("folderMenuModal").style.display = "flex";
}

function renderNotes() {
    const container = document.getElementById("recentNotesContainer");
    if (!container) return;
    container.innerHTML = "";
    if (selectedFolderIdx === null) document.querySelector(".top-bar h1").innerText = "NOTES";
    folders.forEach((folder, fIdx) => {
        if (selectedFolderIdx !== null && fIdx !== selectedFolderIdx) return; 
        if (folder.archived && currentView !== 'archives') return;
        folder.notes.forEach((note, nIdx) => {
            if (isWithinTimeframe(note.timestamp)) {
                const card = document.createElement("div");
                card.className = "card";
                card.innerHTML = `<h3>${note.title}</h3><p style="opacity:0.6;font-size:12px">Folder: ${folder.name}</p>`;
                card.onclick = () => openViewer(fIdx, nIdx);
                container.appendChild(card);
            }
        });
    });
    if (selectedFolderIdx !== null) {
        const backBtn = document.createElement("div");
        backBtn.className = "card";
        backBtn.style.borderLeft = "5px solid #ccc";
        backBtn.innerHTML = "<h3>⬅ Back to All Notes</h3>";
        backBtn.onclick = () => { selectedFolderIdx = null; renderNotes(); };
        container.prepend(backBtn);
    }
}

function saveEdit() {
    const { fIdx, nIdx } = activeNoteCoord;
    const title = document.getElementById("editTitle").value;
    const content = document.getElementById("editContent").value;
    if (!title) return;
    if (nIdx === null) {
        folders[fIdx].notes.push({ title, content, timestamp: new Date().toISOString() });
    } else {
        folders[fIdx].notes[nIdx] = { ...folders[fIdx].notes[nIdx], title, content, timestamp: new Date().toISOString() };
    }
    save(); hideModals();
    showUIFeedback("✅ Note Saved");
}

function openViewer(fIdx, nIdx) {
    activeNoteCoord = { fIdx, nIdx };
    const note = folders[fIdx].notes[nIdx];
    document.getElementById("editTitle").value = note.title;
    document.getElementById("editContent").value = note.content;
    document.getElementById("noteViewer").style.display = "flex";
}

function hideModals() { document.querySelectorAll('.custom-modal').forEach(m => m.style.display = 'none'); }

function confirmAddFolder() {
    const name = document.getElementById("newFolderNameInput").value;
    if (name) { 
        folders.push({ name, notes: [], archived: false }); 
        save(); 
        hideModals(); 
        document.getElementById("newFolderNameInput").value = ""; 
        showUIFeedback("📁 Folder Created");
    }
}

function prepAddNote() {
    hideModals();
    activeNoteCoord = { fIdx: activeFolderIdx, nIdx: null };
    document.getElementById("editTitle").value = "";
    document.getElementById("editContent").value = "";
    document.getElementById("noteViewer").style.display = "flex";
}

function deleteFolder() { 
    folders.splice(activeFolderIdx, 1); 
    save(); 
    hideModals(); 
    showUIFeedback("🗑️ Folder Deleted");
}

function deleteCurrentNote() { 
    folders[activeNoteCoord.fIdx].notes.splice(activeNoteCoord.nIdx, 1); 
    save(); 
    hideModals(); 
    showUIFeedback("🗑️ Note Deleted");
}

function save() { localStorage.setItem("folders", JSON.stringify(folders)); renderFolders(); renderNotes(); }

function setTheme(theme, accentColor) {
    const body = document.getElementById("mainBody");
    const root = document.querySelector(':root');
    const themes = {
        'default': 'linear-gradient(135deg, #0c2d4f, #1f5f91)',
        'dark': 'linear-gradient(135deg, #1a1a1a, #000000)',
        'purple': 'linear-gradient(135deg, #6a11cb, #9975c9)',
        'green': 'linear-gradient(135deg, #1d976c, #93f9b9)',
        'orange': 'linear-gradient(135deg, #921b03, #cc6622)'
        
    };
    body.style.background = themes[theme] || themes['default'];
    if (accentColor) {
        root.style.setProperty('--accent', accentColor);
        localStorage.setItem("accentColor", accentColor);
    }
    localStorage.setItem("theme", theme);
}

function renderPinned() {
    const section = document.getElementById("pinnedSection");
    if (section) {
        section.innerHTML = `<h4 onclick="showPinnedModal()" style="cursor:pointer; color:var(--accent); margin-bottom:10px;">📌 PINNED</h4>
                             <p><strong>SCHEDULE</strong><br><small style="opacity:0.7">${pinnedData.schedule}</small></p>
                             <p style="margin-top:10px;"><strong>AGENDA</strong><br><small style="opacity:0.7">${pinnedData.agenda}</small></p>`;
    }
}

function showFolderModal() { document.getElementById("folderModal").style.display = "flex"; }
function showUserModal() { document.getElementById("userModal").style.display = "flex"; }
function showSettingsModal() { document.getElementById("settingsModal").style.display = "flex"; }
function showPinnedModal() {
    document.getElementById("pinnedModal").style.display = "flex";
    document.getElementById("editSchedule").value = pinnedData.schedule;
    document.getElementById("editAgenda").value = pinnedData.agenda;
}

function savePinned() {
    pinnedData.schedule = document.getElementById("editSchedule").value;
    pinnedData.agenda = document.getElementById("editAgenda").value;
    localStorage.setItem("pinnedData", JSON.stringify(pinnedData));
    renderPinned(); hideModals();
    showUIFeedback("📌 Pinned Updated");
}

function saveUserName() {
    userName = document.getElementById("newUserName").value || userName;
    localStorage.setItem("userName", userName);
    document.getElementById("userNameText").innerText = userName;
    hideModals();
    showUIFeedback("Username Updated");
}

function isWithinTimeframe(ts) {
    const d = new Date(ts), n = new Date();
    if (currentFilter === 'day') return d.toDateString() === n.toDateString();
    if (currentFilter === 'week') return (n - d) < 604800000;
    if (currentFilter === 'month') return (n - d) < 2592000000;
    return true;
}

function setFilter(f) {
    currentFilter = f;
    document.querySelectorAll('.filters span').forEach(s => s.classList.remove('active'));
    document.getElementById(`filter-${f}`).classList.add('active');
    renderNotes();
}

function toggleArchiveFolder() {
    if (activeFolderIdx !== null) {
        folders[activeFolderIdx].archived = !folders[activeFolderIdx].archived;
        const status = folders[activeFolderIdx].archived ? "Archived" : "Restored";
        save(); hideModals();
        setView(folders[activeFolderIdx].archived ? 'archives' : 'notes');
        showUIFeedback(`📁 Folder ${status}`);
    }
}

function renderArchives() {
    const container = document.getElementById("archivedFolderContainer");
    if(container) {
        container.innerHTML = "";
        folders.forEach((folder, idx) => { if (folder.archived) container.appendChild(createFolderUI(folder, idx)); });
    }
}

function setFolderFilter(type) {
    document.querySelectorAll('.folder-filters span').forEach(s => s.classList.remove('active'));
    document.getElementById(`f-${type}`).classList.add('active');
    if (type === 'recent') folders.reverse();
    renderFolders();
}

function downloadNote() {
    const note = folders[activeNoteCoord.fIdx].notes[activeNoteCoord.nIdx];
    const blob = new Blob([note.content], {type: "text/plain"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = note.title + ".txt";
    a.click();
    showUIFeedback("📥 Note Downloaded");
}

window.onload = init;