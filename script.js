// Replace with your actual .m3u link
var PLAYLIST_URL = "https://raw.githubusercontent.com/sanyahmed07/playlist1/refs/heads/main/playlist.m3u";

// --- DATA ---
const ICONS = {
    play: `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`,
    pause: `<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`,
    menu: `<svg viewBox="0 0 24 24"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>`,
    search: `<svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>`,
    back: `<svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>`,
    close: `<svg viewBox="0 0 24 24"><path d="M16 13v-2H7V8l-5 4 5 4v-3zM20 3H10v2h10v14H10v2h10c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg>`,
    check: `<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`
};

// --- APP STATE ---
var channels = [];
var filteredChannels = [];
var currentView = 'home';
var focusIndices = { home: 0, menu: 0, search: 0, network: 0 };
var focusIndex = 0;
var viewMode = localStorage.getItem('iptv_view_mode') || 'list';
var hlsInstance = null;
var modalCallback = null;

// --- DOM ELEMENTS ---
var elHeader = document.getElementById('header');
var views = document.querySelectorAll('.view-section');
var listContainer = document.getElementById('channel-list');
var searchResults = document.getElementById('search-results');
var menuList = document.getElementById('menu-view');
var elVideo = document.getElementById('video-player');
var skLSK = document.getElementById('sk-lsk');
var skCSK = document.getElementById('sk-csk');
var skRSK = document.getElementById('sk-rsk');

// --- INITIALIZATION ---
window.onload = function () {
    var savedData = localStorage.getItem('bd_iptv_playlist');
    if (savedData) {
        parseM3U(savedData);
        renderList(channels, listContainer);
    } else {
        fetchRemotePlaylist();
    }
    setupTouchControls();
    history.replaceState({ view: 'home' }, "Home", "#home");
    updateUI('home');
};

function fetchRemotePlaylist() {
    openModal("Loading Playlist...", null);
    setSoftkeys("", "Wait", "");
    var xhr = new XMLHttpRequest();
    xhr.open('GET', PLAYLIST_URL, true);
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
            closeModal();
            if (xhr.status === 200) {
                var data = xhr.responseText;
                localStorage.setItem('bd_iptv_playlist', data);
                parseM3U(data);
                renderList(channels, listContainer);
            } else {
                openModal("Failed to load playlist.\nStatus: " + xhr.status, function() { history.back(); });
            }
        }
    };
    xhr.onerror = function () { closeModal(); openModal("Network error occurred.", null); };
    xhr.send();
}

window.onpopstate = function (e) {
    if (document.getElementById('modal-overlay').style.display === 'flex') {
        closeModal(false);
        history.forward();
        return;
    }
    var view = e.state ? e.state.view : 'home';
    updateUI(view);
};

function navigate(viewName) {
    if (currentView === viewName) return;
    history.pushState({ view: viewName }, viewName, "#" + viewName);
    updateUI(viewName);
}

function updateUI(viewName) {
    if (currentView === 'player' && viewName !== 'player') {
        elVideo.pause();
        if (hlsInstance) hlsInstance.destroy();
    }
    for (var i = 0; i < views.length; i++) views[i].classList.remove('active');
    document.getElementById('player-view').style.display = 'none';
    currentView = viewName;
    focusIndex = focusIndices[viewName] !== undefined ? focusIndices[viewName] : 0;

    if (viewName === 'home') {
        document.getElementById('home-view').classList.add('active');
        elHeader.innerText = "IPTV Pro";
        setSoftkeys(ICONS.menu, ICONS.play, ICONS.close);
        renderList(channels, listContainer);
    } else if (viewName === 'menu') {
        menuList.classList.add('active');
        elHeader.innerText = "Options";
        setSoftkeys("", ICONS.check, ICONS.back);
    } else if (viewName === 'search') {
        document.getElementById('search-view').classList.add('active');
        elHeader.innerText = "Search";
        setSoftkeys("", ICONS.check, ICONS.back);
        document.getElementById('search-input').value = "";
        searchResults.innerHTML = "";
    } else if (viewName === 'network') {
        document.getElementById('network-view').classList.add('active');
        elHeader.innerText = "Net Stream";
        setSoftkeys("", ICONS.check, ICONS.back);
        document.getElementById('net-url').value = "";
    } else if (viewName === 'player') {
        document.getElementById('player-view').style.display = 'block';
        elHeader.innerText = "Playing...";
        setSoftkeys("", ICONS.pause, ICONS.back);
    }
    updateFocus();
}

function getFocusableItems() {
    if (currentView === 'home') return listContainer.children;
    if (currentView === 'menu') return menuList.children;
    if (currentView === 'search') return document.querySelectorAll('#search-view .focusable, #search-results .list-item');
    if (currentView === 'network') return document.querySelectorAll('#network-view .focusable');
    return [];
}

function updateFocus() {
    focusIndices[currentView] = focusIndex;
    var items = getFocusableItems();
    if (items.length === 0) return;
    if (focusIndex < 0) focusIndex = 0;
    if (focusIndex >= items.length) focusIndex = items.length - 1;
    for (var i = 0; i < items.length; i++) {
        items[i].classList.remove('focused');
        var span = items[i].querySelector('.truncate');
        if (span) span.classList.remove('marquee-text');
    }
    var target = items[focusIndex];
    if (target) {
        target.classList.add('focused');
        var targetSpan = target.querySelector('.truncate');
        if (targetSpan && targetSpan.scrollWidth > targetSpan.clientWidth) {
            targetSpan.classList.add('marquee-text');
        }
        target.scrollIntoView({ block: "center" });
        if (target.tagName === 'INPUT') target.focus();
        else if (document.activeElement.tagName === 'INPUT') document.activeElement.blur();
    }
}

document.addEventListener('keydown', function (e) {
    var key = e.key;
    if (document.getElementById('modal-overlay').style.display === 'flex') {
        if (key === 'Escape' || key === 'SoftLeft' || key === 'F1') closeModal(true);
        else if (key === 'Backspace' || key === 'SoftRight' || key === 'F2' || key === 'Enter' || key === 'SoftCenter') {
            e.preventDefault();
            closeModal(key === 'Enter' || key === 'SoftCenter' ? true : false);
        }
        return;
    }
    if (key === 'ArrowDown') { e.preventDefault(); focusIndex++; updateFocus(); }
    else if (key === 'ArrowUp') { e.preventDefault(); focusIndex--; updateFocus(); }
    else if (key === 'Enter' || key === 'SoftCenter' || key === '5') { e.preventDefault(); handleCenter(); }
    else if (key === 'Escape' || key === 'SoftLeft' || key === 'F1') { e.preventDefault(); if (currentView === 'home') navigate('menu'); }
    else if (key === 'Backspace' || key === 'SoftRight' || key === 'F2') {
        if (document.activeElement.tagName === 'INPUT' && document.activeElement.value.length > 0) return;
        e.preventDefault();
        if (currentView !== 'home') history.back();
        else openModal("Exit app?", function (res) { if (res) window.close(); });
    }
});

function handleCenter() {
    var items = getFocusableItems();
    var target = items[focusIndex];
    if (!target) return;

    if (currentView === 'home') {
        playMedia(channels[focusIndex].url);
    } else if (currentView === 'menu') {
        var action = target.getAttribute('data-action');
        if (action === 'search') navigate('search');
        else if (action === 'network') navigate('network');
        else if (action === 'upload') document.getElementById('file-upload').click();
        else if (action === 'reset') {
            openModal("Refresh playlist from server?", function (res) {
                if (res) { localStorage.removeItem('bd_iptv_playlist'); fetchRemotePlaylist(); }
            });
        } else if (action === 'toggle-view') {
            viewMode = (viewMode === 'list') ? 'grid' : 'list';
            localStorage.setItem('iptv_view_mode', viewMode);
            location.reload();
        } else if (action === 'about') {
            openModal("IPTV Pro\nCloud Phone Version1.0 \n2025-2026  \nCode: Shifat100 & Sany Ahmed Raaz", null);
            setSoftkeys("", "OK", "");
        }
    } else if (currentView === 'search') {
        if (target.tagName === 'INPUT') return;
        var actualIndex = focusIndex - 1;
        if (filteredChannels[actualIndex]) playMedia(filteredChannels[actualIndex].url);
    } else if (currentView === 'network') {
        if (target.id === 'net-play-btn') {
            var url = document.getElementById('net-url').value.trim();
            if (url) playMedia(url);
            else openModal("Please enter URL", null);
        }
    } else if (currentView === 'player') {
        if (elVideo.paused) { elVideo.play(); setSoftkeys("", ICONS.check, ICONS.back); }
        else { elVideo.pause(); setSoftkeys("", ICONS.play, ICONS.back); }
    }
}

function playMedia(url) {
    if (!url) return;
    navigate('player');
    elVideo.src = url;
    elVideo.play().catch(function (error) {
        openModal("Stream Error: Browser doesn't support native HLS", function () { history.back(); });
    });
}

document.getElementById('search-input').addEventListener('input', function (e) {
    var term = e.target.value.toLowerCase();
    filteredChannels = channels.filter(function (c) { return c.name.toLowerCase().indexOf(term) > -1; });
    renderList(filteredChannels, searchResults);
    focusIndex = 0;
    updateFocus();
});

document.getElementById('file-upload').addEventListener('change', function (e) {
    var file = e.target.files[0];
    if (!file) return;
    var r = new FileReader();
    r.onload = function (ev) {
        localStorage.setItem('bd_iptv_playlist', ev.target.result);
        parseM3U(ev.target.result);
        openModal("Playlist Loaded!", function () { history.back(); });
    };
    r.readAsText(file);
});

function parseM3U(data) {
    var lines = data.split('\n');
    channels = []; var item = {};
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (line.indexOf('#EXTINF:') === 0) {
            var logo = line.match(/tvg-logo="([^"]*)"/); item.logo = logo ? logo[1] : '';
            var group = line.match(/group-title="([^"]*)"/); item.group = group ? group[1] : 'General';
            var parts = line.split(','); item.name = parts[parts.length - 1].trim();
        } else if (line.length > 0 && line.indexOf('#') !== 0) {
            item.url = line; channels.push(item); item = {};
        }
    }
}

function renderList(data, container) {
    container.innerHTML = '';
    container.className = (viewMode === 'grid') ? 'grid-container' : '';
    for (var i = 0; i < data.length; i++) {
        var div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = '<img src="' + (data[i].logo || 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=') + '" class="channel-logo" onerror="this.style.display=\'none\'">' +
            '<div class="text-container"><span class="truncate">' + data[i].name + '</span><span class="group-title truncate">' + data[i].group + '</span></div>';
        (function (element) { element.onclick = function () { handleTouchSelect(element); }; })(div);
        container.appendChild(div);
    }
}

function setSoftkeys(l, c, r) {
    skLSK.innerHTML = l; skCSK.innerHTML = c; skRSK.innerHTML = r;
}

function openModal(msg, callback) {
    document.getElementById('modal-msg').innerText = msg;
    document.getElementById('modal-overlay').style.display = 'flex';
    modalCallback = callback;
    setSoftkeys(callback ? "Yes" : "", "OK", callback ? "No" : "");
}

function closeModal(result) {
    document.getElementById('modal-overlay').style.display = 'none';
    if (currentView === 'home') setSoftkeys(ICONS.menu, ICONS.play, ICONS.close);
    else updateUI(currentView);
    if (modalCallback) { var cb = modalCallback; modalCallback = null; cb(result); }
}

function triggerKey(keyName) {
    var event = new KeyboardEvent('keydown', { key: keyName });
    document.dispatchEvent(event);
}

function handleTouchSelect(clickedEl) {
    var items = getFocusableItems();
    for (var j = 0; j < items.length; j++) {
        if (items[j] === clickedEl) {
            focusIndex = j;
            updateFocus();
            if (clickedEl.tagName !== 'INPUT') triggerKey('Enter');
            break;
        }
    }
}

function setupTouchControls() {
    skLSK.onclick = function () { triggerKey('SoftLeft'); };
    skCSK.onclick = function () { triggerKey('Enter'); };
    skRSK.onclick = function () { triggerKey('SoftRight'); };
    var staticItems = document.querySelectorAll('.focusable');
    for (var i = 0; i < staticItems.length; i++) {
        staticItems[i].onclick = function () { handleTouchSelect(this); };
    }
    document.getElementById('player-view').onclick = function () { triggerKey('Enter'); };
    document.getElementById('modal-box').onclick = function () { triggerKey('Enter'); };
}
