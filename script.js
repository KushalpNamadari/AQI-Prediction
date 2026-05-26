const API_BASE = window.location.origin;

    const CATEGORY_INFO = {
        "Good": "Air quality is satisfactory with little or no risk.",
        "Moderate": "Acceptable air quality. Some pollutants may be a concern for sensitive individuals.",
        "Unhealthy for Sensitive Groups": "Members of sensitive groups may experience health effects.",
        "Unhealthy": "Everyone may begin to experience health effects.",
        "Very Unhealthy": "Health alert — everyone may experience more serious health effects.",
        "Hazardous": "Health warning of emergency conditions. The entire population is likely to be affected."
    };

    const FIELD_MAP = {
        "pm25": "PM2.5",
        "pm10": "PM10",
        "no2": "NO2",
        "so2": "SO2",
        "co": "CO",
        "o3": "O3"
    };

    // Load model stats for hints
    async function loadStats() {
        try {
            const resp = await fetch(API_BASE + '/stats');
            if (!resp.ok) return;
            const stats = await resp.json();

            // Populate range hints
            if (stats.ranges) {
                for (const [fieldId, apiKey] of Object.entries(FIELD_MAP)) {
                    const range = stats.ranges[apiKey];
                    if (range) {
                        const hintEl = document.getElementById('hint-' + fieldId);
                        if (hintEl) {
                            hintEl.textContent = `Range in dataset: ${range.min} – ${range.max}`;
                        }
                    }
                }
            }

            // Populate model info section
            if (stats.r2 !== undefined) {
                const infoEl = document.getElementById('modelInfo');
                infoEl.innerHTML = `
                    <div class="model-info-row">
                        <div class="model-stat">
                            <span class="stat-label">R² Score</span>
                            <span class="stat-value">${stats.r2}</span>
                        </div>
                        <div class="model-stat">
                            <span class="stat-label">RMSE</span>
                            <span class="stat-value">${stats.rmse}</span>
                        </div>
                        <div class="model-stat">
                            <span class="stat-label">Classification Acc.</span>
                            <span class="stat-value">${(stats.classification_accuracy * 100).toFixed(1)}%</span>
                        </div>
                        <div class="model-stat">
                            <span class="stat-label">Training Samples</span>
                            <span class="stat-value">${stats.sample_count.toLocaleString()}</span>
                        </div>
                    </div>
                `;
            }
        } catch (e) {
            // Stats are optional, don't block anything
        }
    }

    function getAqiScalePercent(aqi) {
        // Map AQI 0-500 onto the scale. Clamp to 0-100%.
        const clamped = Math.max(0, Math.min(500, aqi));
        return (clamped / 500) * 100;
    }

    function getAqiDescription(aqi) {
        if (aqi <= 50) return "Air quality is good.";
        if (aqi <= 100) return "Air quality is acceptable.";
        if (aqi <= 150) return "Unhealthy for sensitive groups.";
        if (aqi <= 200) return "Unhealthy for general population.";
        if (aqi <= 300) return "Very unhealthy — health alert.";
        return "Hazardous — emergency conditions.";
    }

    // Form submission
    document.getElementById('predictForm').addEventListener('submit', async function(e) {
        e.preventDefault();

        const btn = document.getElementById('btnPredict');
        const errorDiv = document.getElementById('formError');
        const resultSection = document.getElementById('resultSection');

        errorDiv.style.display = 'none';
        btn.classList.add('loading');
        btn.disabled = true;

        const data = {};
        for (const [fieldId, apiKey] of Object.entries(FIELD_MAP)) {
            const val = document.getElementById(fieldId).value;
            if (val === '' || isNaN(parseFloat(val))) {
                errorDiv.textContent = `Please enter a valid number for ${apiKey}.`;
                errorDiv.style.display = 'block';
                btn.classList.remove('loading');
                btn.disabled = false;
                return;
            }
            data[apiKey] = parseFloat(val);
        }

        try {
            const response = await fetch(API_BASE + '/predict', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Server returned an error.');
            }

            const result = await response.json();

            // Populate results
            document.getElementById('aqiValue').textContent = result.predicted_aqi.toFixed(1);
            document.getElementById('aqiDesc').textContent = getAqiDescription(result.predicted_aqi);
            document.getElementById('categoryValue').textContent = result.predicted_category;
            document.getElementById('categoryDesc').textContent = CATEGORY_INFO[result.predicted_category] || '';

            // Update scale bar
            const pct = getAqiScalePercent(result.predicted_aqi);
            document.getElementById('scaleFill').style.width = pct + '%';
            document.getElementById('scaleMarker').style.left = pct + '%';

            resultSection.classList.add('visible');
            resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        } catch (err) {
            errorDiv.textContent = err.message;
            errorDiv.style.display = 'block';
        } finally {
            btn.classList.remove('loading');
            btn.disabled = false;
        }
    });

    // Clear button
    document.getElementById('btnClear').addEventListener('click', function() {
        document.getElementById('predictForm').reset();
        document.getElementById('resultSection').classList.remove('visible');
        document.getElementById('formError').style.display = 'none';
    });

    // Init
    loadStats();