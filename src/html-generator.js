import { generateEmbeddableFlameGraph, getFlamegraphBundle } from 'react-pprof'

/**
 * Generate HTML for the "profile in progress" page
 *
 * @param {string} profileId - Profile ID
 * @param {number} duration - Profile duration in milliseconds
 * @param {string} basePath - Base path for the middleware
 * @returns {string} HTML content
 */
export function generateProgressPage (profileId, duration, basePath) {
  const resultUrl = `${basePath}/result/${profileId}`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Profiling in Progress</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #1e1e1e;
      color: #ffffff;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
    }
    .container {
      text-align: center;
      max-width: 500px;
      padding: 40px;
    }
    h1 {
      font-size: 32px;
      margin-bottom: 40px;
      font-weight: 300;
    }
    .progress-container {
      width: 100%;
      height: 8px;
      background-color: #2a2a2a;
      border-radius: 4px;
      overflow: hidden;
      margin: 30px 0;
    }
    .progress-bar {
      height: 100%;
      background: linear-gradient(90deg, #ff4444, #ffcc66);
      width: 0%;
      transition: width 0.1s linear;
      border-radius: 4px;
    }
    .time-remaining {
      font-size: 16px;
      margin-top: 20px;
      opacity: 0.8;
    }
    .status {
      font-size: 18px;
      margin-top: 30px;
      opacity: 0.7;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔥 Profiling in Progress</h1>

    <div class="progress-container">
      <div class="progress-bar" id="progressBar"></div>
    </div>

    <div class="time-remaining" id="timeRemaining"></div>
    <div class="status">Collecting CPU and heap profiles...</div>
  </div>

  <script>
    const duration = ${duration};
    const startTime = Date.now();
    const resultUrl = '${resultUrl}';

    function updateProgress() {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, duration - elapsed);
      const progress = Math.min(100, (elapsed / duration) * 100);

      // Update progress bar
      document.getElementById('progressBar').style.width = progress + '%';

      // Update time remaining
      if (remaining > 0) {
        const seconds = Math.ceil(remaining / 1000);
        document.getElementById('timeRemaining').textContent =
          seconds + 's remaining';
        requestAnimationFrame(updateProgress);
      } else {
        document.getElementById('timeRemaining').textContent = 'Complete!';
        // Redirect after a brief moment
        setTimeout(() => {
          window.location.href = resultUrl;
        }, 500);
      }
    }

    // Start the progress animation
    updateProgress();
  </script>
</body>
</html>`
}

/**
 * Generate HTML for the completed profile results page
 *
 * @param {Buffer} cpuProfileBuffer - Encoded CPU profile
 * @param {Buffer} heapProfileBuffer - Encoded heap profile
 * @param {Object} options - Options (colors, etc.)
 * @returns {Promise<string>} HTML content
 */
export async function generateResultsPage (cpuProfileBuffer, heapProfileBuffer, options = {}) {
  const {
    primaryColor = '#ff4444',
    secondaryColor = '#ffcc66'
  } = options

  // Get the bundle once (it's cached internally)
  const { bundle } = await getFlamegraphBundle()

  // Generate embeddable flamegraphs for both profiles
  const [cpuFlamegraph, heapFlamegraph] = await Promise.all([
    generateEmbeddableFlameGraph(cpuProfileBuffer, {
      title: 'CPU Profile',
      filename: 'cpu-profile.pb',
      primaryColor,
      secondaryColor
    }),
    generateEmbeddableFlameGraph(heapProfileBuffer, {
      title: 'Heap Profile',
      filename: 'heap-profile.pb',
      primaryColor,
      secondaryColor
    })
  ])

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Profile Results</title>
  <style>
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 0;
      background-color: #1e1e1e;
      color: #ffffff;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      height: 100vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .tabs {
      display: flex;
      background-color: #2a2a2a;
      border-bottom: 1px solid #333;
      padding: 0 20px;
      flex-shrink: 0;
    }
    .tab {
      padding: 15px 30px;
      cursor: pointer;
      border: none;
      background: none;
      color: #888;
      font-size: 16px;
      font-family: inherit;
      border-bottom: 2px solid transparent;
      transition: all 0.2s ease;
    }
    .tab:hover {
      color: #fff;
      background-color: rgba(255, 255, 255, 0.05);
    }
    .tab.active {
      color: ${primaryColor};
      border-bottom-color: ${primaryColor};
    }
    .tab-content {
      display: none;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }
    .tab-content.active {
      display: flex;
      flex-direction: column;
    }
  </style>
</head>
<body>
  <div class="tabs">
    <button class="tab active" onclick="switchTab('cpu')">CPU Profile</button>
    <button class="tab" onclick="switchTab('heap')">Heap Profile</button>
  </div>

  <div id="cpu-tab" class="tab-content active">
    ${cpuFlamegraph.html}
  </div>

  <div id="heap-tab" class="tab-content">
    ${heapFlamegraph.html}
  </div>

  <!-- React-pprof bundle (loaded once, reused for both graphs) -->
  <script>
    ${bundle}
  </script>

  <!-- Render CPU flamegraph immediately -->
  <script>
    ${cpuFlamegraph.script}
  </script>

  <!-- Tab switching logic with lazy rendering -->
  <script>
    // Track which tabs have been rendered
    const renderedTabs = new Set(['cpu']);

    function switchTab(tabName) {
      // Hide all tabs
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
      });

      // Show selected tab
      document.getElementById(tabName + '-tab').classList.add('active');
      event.target.classList.add('active');

      // Lazy render heap flamegraph when first shown
      if (tabName === 'heap' && !renderedTabs.has('heap')) {
        renderedTabs.add('heap');
        ${heapFlamegraph.script}
      }

      // Trigger a resize event to handle any layout changes
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 0);
    }
  </script>
</body>
</html>`
}

/**
 * Generate HTML for error pages
 *
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @returns {string} HTML content
 */
export function generateErrorPage (message, statusCode = 400) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error ${statusCode}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #1e1e1e;
      color: #ffffff;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
    }
    .container {
      text-align: center;
      max-width: 600px;
      padding: 40px;
    }
    h1 {
      font-size: 48px;
      margin-bottom: 20px;
      color: #ff6b6b;
    }
    p {
      font-size: 18px;
      line-height: 1.6;
      opacity: 0.9;
    }
    code {
      color: #ff6b6b;
      font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Courier, monospace;
      background-color: #2a2a2a;
      padding: 2px 8px;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Error ${statusCode}</h1>
    <p>${escapeHtml(message)}</p>
  </div>
</body>
</html>`
}

/**
 * Escape HTML special characters
 *
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml (text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return text.replace(/[&<>"']/g, m => map[m])
}
