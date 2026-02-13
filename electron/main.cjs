const { app, BrowserWindow } = require('electron');
const path = require('path');

// ── Performance optimizations ──
app.commandLine.appendSwitch('enable-features', 'Metal');          // macOS GPU accel
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('disable-renderer-backgrounding');    // don't throttle hidden
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=512');

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        title: 'BiReader',
        titleBarStyle: 'hiddenInset',
        trafficLightPosition: { x: 16, y: 16 },
        backgroundColor: '#f8f9fc',        // Avoid white flash on launch
        show: false,                        // Don't show until ready
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            spellcheck: false,              // Disable spellcheck overhead
            enableBlinkFeatures: '',        // No extra Blink features
            backgroundThrottling: false,    // Keep performance when unfocused
        }
    });

    // Show window only after content is ready (eliminates perceived lag)
    win.once('ready-to-show', () => {
        win.show();
    });

    win.loadFile(path.join(__dirname, '../dist/index.html'));
    win.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    app.quit();
});
