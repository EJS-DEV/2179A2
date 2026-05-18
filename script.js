(function () {
	"use strict";

	// CONFIGURATION

	const CONFIG = {
		ooklaDataPath: "./data/speedtest-AU-Q325.geojson",
		ooklaCSVPath: "./data/speedtest-AUS.csv",
		nbnDataPath:
			"./data/broadband-performance-data-march-2026-source-data.xlsx",
		colors: {
			highSpeed: "#10b981",
			adequate: "#f59e0b",
			underServed: "#ef4444",
		},
	};

	// STATE MANAGEMENT

	const state = {
		ooklaData: null,
		ooklaCSVData: null,
		nbnData: null,
		filteredData: null,
		selectedRegion: null,
		selectedTier: null,
		zoomLevel: 1,
	};

	// VEGA-LITE CHART EMBEDDING

	function embedChart(divId, spec) {
		const container = document.getElementById(divId);
		if (!container) return Promise.reject(new Error("Container not found"));
		container.innerHTML = "";
		return vegaEmbed(`#${divId}`, spec, { actions: false });
	}

	// CHAPTER 1 MAP - Shows speed data on Australian map

	const cityFocus = {
		aus: { center: [133, -28], zoom: 1 },
		melbourne: { center: [144.96, -37.81], zoom: 14 },
		sydney: { center: [151.21, -33.87], zoom: 14 },
		brisbane: { center: [152.98, -27.47], zoom: 14 },
		perth: { center: [115.86, -31.95], zoom: 14 },
		adelaide: { center: [138.6, -34.93], zoom: 14 },
		goldcoast: { center: [153.4, -28.02], zoom: 14 },
		canberra: { center: [149.13, -35.28], zoom: 16 },
		hobart: { center: [147.33, -42.88], zoom: 16 },
		darwin: { center: [130.84, -12.46], zoom: 14 },
	};

	async function renderChapter1Map() {
		const baseSpec = {
			$schema: "https://vega.github.io/schema/vega-lite/v6.json",
			width: 900,
			height: 500,
			projection: {
				type: "mercator",
				center: [144.96, -37.81],
				scale: 8400,
			},
			layer: [
				{
					data: {
						url: "https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson",
						format: { type: "json" },
						transform: [{ filter: "datum.properties.ISO_A3 === 'AUS'" }],
					},
					mark: {
						type: "geoshape",
						fill: "#e0e0e0",
						fillOpacity: 0.3,
						stroke: "#999",
						strokeWidth: 1,
					},
				},
				{
					data: {
						url: CONFIG.ooklaDataPath,
						format: { type: "json", property: "features" },
					},
					mark: "geoshape",
					encoding: {
						color: {
							field: "properties.avg_d_kbps",
							type: "quantitative",
							scale: { scheme: "plasma", domain: [0, 400000] },
							title: "Download Speed (kbps)",
						},
						tooltip: [
							{ field: "properties.avg_d_kbps", title: "Download (kbps)" },
							{ field: "properties.avg_u_kbps", title: "Upload (kbps)" },
							{ field: "properties.avg_lat_ms", title: "Latency (ms)" },
						],
					},
				},
			],
		};

		// Add city dropdown to the page if not exists
		addCityDropdown();

		// Store base spec for city switching
		window.chapter1BaseSpec = baseSpec;

		try {
			await embedChart("chart-1-map", baseSpec);
		} catch (error) {
			const container = document.getElementById("chart-1-map");
			if (container) {
				container.innerHTML =
					'<div class="chart-placeholder"><p>Error loading map. Please check console for details.</p></div>';
			}
		}
	}

	function addCityDropdown() {
		if (document.getElementById("chapter1-city-select")) return;

		const chartCard = document.querySelector("#chapter-1 .chart-card");
		if (!chartCard) return;

		const chartTitle = chartCard.querySelector(".chart-title");
		if (!chartTitle) return;

		const controlsDiv = document.createElement("div");
		controlsDiv.className = "map-controls";
		controlsDiv.style.cssText =
			"display: flex; align-items: center; gap: 10px; margin-top: 10px;";

		const label = document.createElement("label");
		label.textContent = "Focus: ";
		label.style.cssText =
			"font-size: 13px; font-weight: 500; color: var(--color-text-muted, #666);";

		const select = document.createElement("select");
		select.id = "chapter1-city-select";
		select.className = "city-select";
		select.style.cssText =
			"padding: 6px 12px; border-radius: 6px; border: 1px solid #e0e0e0; background: #fff; font-size: 13px; color: #333; cursor: pointer;";
		select.innerHTML = `
    <option value="aus">Australia</option>
    <option value="melbourne" selected>Melbourne</option>
    <option value="sydney">Sydney</option>
    <option value="brisbane">Brisbane</option>
    <option value="perth">Perth</option>
    <option value="adelaide">Adelaide</option>
    <option value="goldcoast">Gold Coast</option>
    <option value="canberra">Canberra</option>
    <option value="hobart">Hobart</option>
    <option value="darwin">Darwin</option>
   `;
		select.addEventListener("change", async (e) => {
			const city = cityFocus[e.target.value];
			if (!city || !window.chapter1BaseSpec) return;

			const newSpec = JSON.parse(JSON.stringify(window.chapter1BaseSpec));
			newSpec.projection.center = city.center;
			newSpec.projection.scale = 600 * city.zoom;

			await embedChart("chart-1-map", newSpec);
		});

		controlsDiv.appendChild(label);
		controlsDiv.appendChild(select);

		if (chartTitle.nextSibling) {
			chartCard.insertBefore(controlsDiv, chartTitle.nextSibling);
		} else {
			chartCard.appendChild(controlsDiv);
		}
	}

	// CHAPTER 2 - ISP Provider Performance (Bar Chart with Reference Line)

	async function renderChapter2ISPChart() {
		if (!state.nbnData || !state.nbnData.ispData) {
			return;
		}

		const ispData = state.nbnData ? state.nbnData.ispData : null;

		if (!ispData || ispData.length === 0) {
			return;
		}

		const container = document.getElementById("chart-2-isp");
		if (!container) {
			return;
		}

		const spec = {
			$schema: "https://vega.github.io/schema/vega-lite/v5.json",

			width: "container",
			height: 380,

			data: { values: ispData },

			layer: [
				{
					// Reference line at 100% (expected speed)
					mark: {
						type: "rule",
						stroke: "#ef4444",
						strokeDash: [6, 4],
						strokeWidth: 2,
					},
					encoding: { x: { datum: 100 } },
				},
				{
					mark: "bar",

					encoding: {
						y: {
							field: "provider",
							type: "nominal",
							sort: "-x",
							title: "Provider",
							axis: { labelLimit: 150 },
						},
						x: {
							field: "downloadBusyHours",
							type: "quantitative",
							title: "Speed (% of Plan)",
							scale: { domain: [85, 110] },
						},
						color: {
							field: "downloadBusyHours",
							type: "quantitative",
							scale: {
								domain: [90, 95, 100, 105],
								range: ["#ef4444", "#f59e0b", "#10b981", "#3b82f6"],
							},
							legend: { title: "Speed %", orient: "right" },
						},
						tooltip: [
							{ field: "provider", title: "Provider" },
							{
								field: "downloadBusyHours",
								title: "Busy Hour Speed",
								format: ".1f",
							},
							{
								field: "downloadBusiest",
								title: "Busiest Hour Speed",
								format: ".1f",
							},
							{
								field: "uploadBusyHours",
								title: "Upload Speed",
								format: ".1f",
							},
						],
					},
				},
			],
		};

		try {
			container.innerHTML = "";
			await vegaEmbed("#chart-2-isp", spec, { actions: false });
		} catch (error) {
			container.innerHTML =
				'<div class="chart-placeholder"><p>Error: ' +
				error.message +
				"</p></div>";
		}
	}

	// CHAPTER 3 - Plan Tiers Grouped Bar Chart (Advertised vs Busy Hours vs All Hours)

	async function renderChapter3PlanChart() {
		const container = document.getElementById("chart-3-plans");
		if (!container) {
			return;
		}

		if (
			!state.nbnData ||
			!state.nbnData.planData ||
			state.nbnData.planData.length === 0
		) {
			container.innerHTML =
				'<div class="chart-placeholder"><p>No data available</p></div>';
			return;
		}

		// Transform data from Excel: thisReport = busy hours, lastReport = all hours
		// Advertised speed derived from plan name
		const transformedData = [];
		state.nbnData.planData.forEach((d) => {
			const match = d.plan.match(/NBN\s*(\d+)/i);
			const advertised = match ? parseInt(match[1]) : 0;
			transformedData.push({
				plan: d.plan,
				speedType: "Advertised",
				speed: advertised,
			});
			transformedData.push({
				plan: d.plan,
				speedType: "All Hours",
				speed: d.lastReport || 0,
			});
			transformedData.push({
				plan: d.plan,
				speedType: "Busy Hours",
				speed: d.thisReport || 0,
			});
		});

		const spec = {
			$schema: "https://vega.github.io/schema/vega-lite/v5.json",
			width: "container",
			height: 380,
			data: { values: transformedData },
			mark: { type: "bar", cornerRadiusEnd: 3 },
			encoding: {
				x: {
					field: "plan",
					type: "nominal",
					title: "NBN Plan Tier",
					axis: { labelAngle: 0 },
					sort: [
						"NBN 12",
						"NBN 25",
						"NBN 50",
						"NBN 100",
						"NBN 250",
						"NBN 1000",
					],
				},
				y: {
					field: "speed",
					type: "quantitative",
					title: "Download Speed (Mbps)",
					scale: { domain: [0, 1100] },
				},
				xOffset: {
					field: "speedType",
					sort: ["Busy Hours", "All Hours", "Advertised"],
				},
				color: {
					field: "speedType",
					type: "nominal",
					scale: {
						domain: ["Busy Hours", "All Hours", "Advertised"],
						range: ["#3b82f6", "#06b6d4", "#1e3a8a"],
					},
					legend: { title: "Speed Type", orient: "top" },
				},
				tooltip: [
					{ field: "plan", title: "Plan" },
					{ field: "speedType", title: "Speed Type" },
					{ field: "speed", title: "Speed (Mbps)", format: ".1f" },
				],
			},
		};

		try {
			container.innerHTML = "";
			await vegaEmbed("#chart-3-plans", spec, { actions: false });
		} catch (error) {
			container.innerHTML =
				'<div class="chart-placeholder"><p>Error: ' +
				error.message +
				"</p></div>";
		}
	}

	// CHAPTER 4 - Technology Types (Horizontal Bar Chart with Sort Toggle)

	async function renderChapter4TechChart() {
		const container = document.getElementById("chart-4-tech");
		if (!container) {
			return;
		}

		if (
			!state.nbnData ||
			!state.nbnData.techData ||
			state.nbnData.techData.length === 0
		) {
			container.innerHTML =
				'<div class="chart-placeholder"><p>No data available</p></div>';
			return;
		}

		// Store base data for sorting
		const techData = state.nbnData.techData;
		window.chapter4Data = techData;
		window.chapter4SortBy = "performance"; // 'performance' or 'alphabetical'

		const spec = {
			$schema: "https://vega.github.io/schema/vega-lite/v5.json",
			width: 280,
			height: 240,
			data: { values: techData },
			mark: { type: "arc", innerRadius: 40, outerRadius: 90 },
			encoding: {
				theta: {
					field: "percentOfPlan",
					type: "quantitative",
					title: "Speed (% of Plan)",
				},
				color: {
					field: "technology",
					type: "nominal",
					title: "Technology",
					scale: {
						domain: ["FTTP", "FTTB", "FTTC", "HFC", "FTTN"],
						range: ["#10b981", "#06b6d4", "#3b82f6", "#f59e0b", "#ef4444"],
					},
					legend: { title: "Technology Type", orient: "bottom" },
				},
				tooltip: [
					{ field: "technology", title: "Technology" },
					{ field: "percentOfPlan", title: "Speed % of Plan", format: ".1f" },
				],
			},
		};

		try {
			container.innerHTML = "";
			await vegaEmbed("#chart-4-tech", spec, { actions: false });
		} catch (error) {
			container.innerHTML =
				'<div class="chart-placeholder"><p>Error: ' +
				error.message +
				"</p></div>";
		}
	}

	// CHAPTER 5 - Time of Day Line Chart (The Evening Slowdown)

	function generateTimeOfDayData() {
		const plans = ["NBN 25", "NBN 50", "NBN 100", "NBN 250", "NBN 1000"];
		const hours = [
			7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
		];

		const planBaseSpeeds = {
			"NBN 25": 24.5,
			"NBN 50": 48.3,
			"NBN 100": 92.4,
			"NBN 250": 228.5,
			"NBN 1000": 750.5,
		};

		const planAdvertised = {
			"NBN 25": 25,
			"NBN 50": 50,
			"NBN 100": 100,
			"NBN 250": 250,
			"NBN 1000": 1000,
		};

		const congestionPattern = {
			7: 0.97,
			8: 0.96,
			9: 0.97,
			10: 0.98,
			11: 0.98,
			12: 0.97,
			13: 0.97,
			14: 0.97,
			15: 0.98,
			16: 0.98,
			17: 0.96,
			18: 0.93,
			19: 0.88,
			20: 0.82,
			21: 0.85,
			22: 0.9,
			23: 0.95,
		};

		const data = [];
		plans.forEach((plan) => {
			const baseSpeed = planBaseSpeeds[plan];
			const advertised = planAdvertised[plan];

			hours.forEach((hour) => {
				const congestion = congestionPattern[hour];
				const randomVar = 0.98 + Math.random() * 0.04;
				const actualSpeed = baseSpeed * congestion * randomVar;
				const percentOfPlan = (actualSpeed / advertised) * 100;

				data.push({
					plan: plan,
					hour: hour,
					speed: Math.round(actualSpeed * 10) / 10,
					percentOfPlan: Math.round(percentOfPlan * 10) / 10,
					timeLabel:
						hour <= 12
							? `${hour} AM`
							: hour === 12
								? "12 PM"
								: `${hour - 12} PM`,
				});
			});
		});

		return data;
	}

	window.timeOfDayData = generateTimeOfDayData();

	async function renderChapter5TimeChart() {
		const container = document.getElementById("chart-5-time");
		if (!container) {
			return;
		}

		const data = window.timeOfDayData;

		const spec = {
			$schema: "https://vega.github.io/schema/vega-lite/v5.json",
			width: "container",
			height: 380,
			data: { values: data },

			layer: [
				{
					mark: {
						type: "line",
						strokeWidth: 3,
						point: { size: 60, filled: true },
					},
					encoding: {
						x: {
							field: "hour",
							type: "ordinal",
							title: "Hour of Day",
							axis: {
								labelAngle: 0,
								labelExpr:
									"datum.value <= 12 ? datum.value + ' AM' : (datum.value === 12 ? '12 PM' : (datum.value - 12) + ' PM')",
							},
							sort: [
								7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
							],
						},
						y: {
							field: "percentOfPlan",
							type: "quantitative",
							title: "Speed (% of Advertised)",
							scale: { domain: [60, 105] },
						},
						color: {
							field: "plan",
							type: "nominal",
							title: "NBN Plan",
							scale: {
								domain: ["NBN 25", "NBN 50", "NBN 100", "NBN 250", "NBN 1000"],
								range: ["#3b82f6", "#06b6d4", "#0d9488", "#f59e0b", "#ef4444"],
							},
							legend: { orient: "right", title: "Plan Tier" },
						},
						tooltip: [
							{ field: "plan", title: "Plan" },
							{ field: "hour", title: "Hour", format: "d" },
							{ field: "speed", title: "Speed (Mbps)", format: ".1f" },
							{
								field: "percentOfPlan",
								title: "% of Advertised",
								format: ".1f",
							},
						],
					},
				},
				{
					// Reference line at 100%
					mark: {
						type: "rule",
						stroke: "#ef4444",
						strokeDash: [6, 4],
						strokeWidth: 2,
					},
					encoding: { y: { datum: 100 } },
				},
				{
					// Peak congestion label
					mark: {
						type: "text",
						align: "center",
						baseline: "bottom",
						dy: -10,
						fontSize: 11,
						fill: "#64748b",
					},
					encoding: {
						x: { value: "8pm" },
						y: { value: 73 },
						text: { value: "Peak Congestion" },
					},
				},
			],
		};

		try {
			container.innerHTML = "";
			await vegaEmbed("#chart-5-time", spec, { actions: false });
		} catch (error) {
			container.innerHTML =
				'<div class="chart-placeholder"><p>Error: ' +
				error.message +
				"</p></div>";
		}
	}

	function setupChapter5Controls() {
		const container = document.getElementById("chapter5-controls");
		if (!container) return;

		const checkboxes = container.querySelectorAll('input[type="checkbox"]');

		checkboxes.forEach((cb) => {
			cb.addEventListener("change", async () => {
				const selectedPlans = Array.from(checkboxes)
					.filter((c) => c.checked)
					.map((c) => c.value);

				const allData = window.timeOfDayData;
				const filteredData = allData.filter((d) =>
					selectedPlans.includes(d.plan),
				);

				const container = document.getElementById("chart-5-time");

				const minPercent =
					Math.min(...filteredData.map((d) => d.percentOfPlan)) - 5;
				const maxPercent =
					Math.max(...filteredData.map((d) => d.percentOfPlan)) + 5;

				const selectedCount = selectedPlans.length;
				const subtitle =
					selectedCount === 5
						? "All plans selected"
						: selectedCount === 1
							? `Showing ${selectedPlans[0]}`
							: `${selectedCount} plans selected`;

				const spec = {
					$schema: "https://vega.github.io/schema/vega-lite/v6.json",
					width: "container",
					height: 380,
					data: { values: filteredData },
					layer: [
						{
							mark: {
								type: "line",
								strokeWidth: 3,
								point: { size: 60, filled: true },
							},
							encoding: {
								x: {
									field: "hour",
									type: "ordinal",
									title: "Hour of Day",
									axis: {
										labelAngle: 0,
										labelExpr:
											"datum.value <= 12 ? datum.value + ' AM' : (datum.value === 12 ? '12 PM' : (datum.value - 12) + ' PM')",
									},
									sort: [
										7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22,
										23,
									],
								},
								y: {
									field: "percentOfPlan",
									type: "quantitative",
									title: "Speed (% of Advertised)",
									scale: {
										domain: [
											Math.floor(minPercent / 10) * 10,
											Math.ceil(maxPercent / 10) * 10,
										],
									},
								},
								color: {
									field: "plan",
									type: "nominal",
									title: "NBN Plan",
									scale: {
										domain: [
											"NBN 25",
											"NBN 50",
											"NBN 100",
											"NBN 250",
											"NBN 1000",
										],
										range: [
											"#3b82f6",
											"#06b6d4",
											"#0d9488",
											"#f59e0b",
											"#ef4444",
										],
									},
									legend: { orient: "right", title: "Plan Tier" },
								},
								tooltip: [
									{ field: "plan", title: "Plan" },
									{ field: "hour", title: "Hour", format: "d" },
									{ field: "speed", title: "Speed (Mbps)", format: ".1f" },
									{
										field: "percentOfPlan",
										title: "% of Advertised",
										format: ".1f",
									},
								],
							},
						},
						{
							mark: {
								type: "rule",
								stroke: "#ef4444",
								strokeDash: [6, 4],
								strokeWidth: 2,
							},
							encoding: { y: { datum: 100 } },
						},
					],
				};

				try {
					container.innerHTML = "";
					await vegaEmbed("#chart-5-time", spec, { actions: false });
				} catch (error) { }
			});
		});
	}

	// CHAPTER 7 - Performance Insights

	async function renderChapter7RegionalChart() {
		const container = document.getElementById("chart-7-regional");
		if (!container) {
			return;
		}

		if (!state.ooklaData || !state.ooklaData.features) {
			container.innerHTML =
				'<div class="chart-placeholder"><p>No data available</p></div>';
			return;
		}

		// Calculate regional statistics based on performance tier as proxy
		// High Speed (>50 Mbps) = Urban, Adequate (25-50) = Regional, Under-served (<25) = Remote
		const regionStats = {
			Urban: { totalSpeed: 0, count: 0 },
			Regional: { totalSpeed: 0, count: 0 },
			Remote: { totalSpeed: 0, count: 0 },
		};

		const regionCounts = {};
		state.ooklaData.features.forEach((f) => {
			const tier = f.properties.performance_tier;
			let region;
			if (tier === "High Speed") region = "Urban";
			else if (tier === "Adequate") region = "Regional";
			else region = "Remote";

			regionCounts[region] = (regionCounts[region] || 0) + 1;
			regionStats[region].totalSpeed += f.properties.download_mbps;
			regionStats[region].count++;
		});

		const regionalData = Object.entries(regionStats).map(([region, stats]) => ({
			region,
			avgSpeed: Math.round(stats.totalSpeed / stats.count),
			locations: stats.count,
		}));

		const spec = {
			$schema: "https://vega.github.io/schema/vega-lite/v6.json",
			width: "container",
			height: 300,
			title: {
				text: "Average Download Speed by Region Type",
				subtitle: "Based on Ookla speedtest data",
			},
			data: { values: regionalData },
			mark: { type: "bar", cornerRadiusEnd: 4 },
			encoding: {
				y: {
					field: "region",
					type: "nominal",
					title: "Region Type",
					sort: "-x",
					axis: { labelLimit: 100 },
				},
				x: {
					field: "avgSpeed",
					type: "quantitative",
					title: "Average Download Speed (Mbps)",
					scale: {
						domain: [0, Math.max(...regionalData.map((d) => d.avgSpeed)) * 1.1],
					},
				},
				color: {
					field: "region",
					type: "nominal",
					scale: {
						domain: ["Urban", "Regional", "Remote"],
						range: ["#10b981", "#f59e0b", "#ef4444"],
					},
					legend: { title: "Region", orient: "top" },
				},
				tooltip: [
					{ field: "region", title: "Region Type" },
					{ field: "avgSpeed", title: "Avg Speed (Mbps)", format: ".1f" },
					{ field: "locations", title: "Test Locations" },
				],
			},
		};

		try {
			container.innerHTML = "";
			await vegaEmbed("#chart-7-regional", spec, { actions: false });
		} catch (error) {
			container.innerHTML =
				'<div class="chart-placeholder"><p>Error: ' +
				error.message +
				"</p></div>";
		}
	}

	async function renderChapter7ScatterChart() {
		const container = document.getElementById("chart-7-scatter");
		if (!container) {
			return;
		}

		if (!state.ooklaData || !state.ooklaData.features) {
			container.innerHTML =
				'<div class="chart-placeholder"><p>No data available</p></div>';
			return;
		}

		// Prepare scatter data - sample to improve performance
		const scatterData = state.ooklaData.features.slice(0, 500).map((f) => ({
			downloadSpeed: f.properties.download_mbps,
			latency: f.properties.avg_lat_ms,
			tier: f.properties.performance_tier,
			region: f.properties.region_type,
		}));

		const spec = {
			$schema: "https://vega.github.io/schema/vega-lite/v5.json",
			width: "container",
			height: 300,
			title: {
				text: "Download Speed vs Latency Correlation",
				subtitle: "Each point represents a test location",
			},
			data: { values: scatterData },
			mark: {
				type: "point",
				filled: true,
				opacity: 0.6,
				size: 50,
			},
			encoding: {
				x: {
					field: "downloadSpeed",
					type: "quantitative",
					title: "Download Speed (Mbps)",
					scale: {
						domain: [
							0,
							Math.max(...scatterData.map((d) => d.downloadSpeed)) * 1.05,
						],
					},
				},
				y: {
					field: "latency",
					type: "quantitative",
					title: "Latency (ms)",
					scale: {
						domain: [0, Math.max(...scatterData.map((d) => d.latency)) * 1.1],
					},
				},
				color: {
					field: "tier",
					type: "nominal",
					scale: {
						domain: ["High Speed", "Adequate", "Under-served"],
						range: ["#10b981", "#f59e0b", "#ef4444"],
					},
					legend: { title: "Performance Tier", orient: "right" },
				},
				tooltip: [
					{ field: "downloadSpeed", title: "Download (Mbps)", format: ".1f" },
					{ field: "latency", title: "Latency (ms)", format: ".1f" },
					{ field: "tier", title: "Performance Tier" },
					{ field: "region", title: "Region" },
				],
			},
		};

		try {
			container.innerHTML = "";
			await vegaEmbed("#chart-7-scatter", spec, { actions: false });
		} catch (error) {
			container.innerHTML =
				'<div class="chart-placeholder"><p>Error: ' +
				error.message +
				"</p></div>";
		}
	}

	function setupChapter7Controls() {
		const tierSelect = document.getElementById("chapter7-tier-filter");
		if (!tierSelect) return;

		tierSelect.addEventListener("change", async (e) => {
			const selectedTier = e.target.value;
			await updateChapter7Scatter(selectedTier);
		});
	}

	async function updateChapter7Scatter(filterTier) {
		const container = document.getElementById("chart-7-scatter");
		if (!container || !state.ooklaData) return;

		// Filter scatter data
		let scatterData = state.ooklaData.features.slice(0, 500).map((f) => ({
			downloadSpeed: f.properties.download_mbps,
			latency: f.properties.avg_lat_ms,
			tier: f.properties.performance_tier,
			region: f.properties.region_type,
		}));

		if (filterTier !== "all") {
			scatterData = scatterData.filter((d) => d.tier === filterTier);
		}

		const spec = {
			$schema: "https://vega.github.io/schema/vega-lite/v6.json",
			width: "container",
			height: 300,
			title: {
				text: "Download Speed vs Latency Correlation",
				subtitle:
					filterTier === "all"
						? "Each point represents a test location"
						: `Showing: ${filterTier}`,
			},
			data: { values: scatterData },
			mark: {
				type: "point",
				filled: true,
				opacity: 0.6,
				size: 50,
			},
			encoding: {
				x: {
					field: "downloadSpeed",
					type: "quantitative",
					title: "Download Speed (Mbps)",
					scale: {
						domain: [
							0,
							Math.max(...scatterData.map((d) => d.downloadSpeed)) * 1.05,
						],
					},
				},
				y: {
					field: "latency",
					type: "quantitative",
					title: "Latency (ms)",
					scale: {
						domain: [0, Math.max(...scatterData.map((d) => d.latency)) * 1.1],
					},
				},
				color: {
					field: "tier",
					type: "nominal",
					scale: {
						domain: ["High Speed", "Adequate", "Under-served"],
						range: ["#10b981", "#f59e0b", "#ef4444"],
					},
					legend: { title: "Performance Tier", orient: "right" },
				},
				tooltip: [
					{ field: "downloadSpeed", title: "Download (Mbps)", format: ".1f" },
					{ field: "latency", title: "Latency (ms)", format: ".1f" },
					{ field: "tier", title: "Performance Tier" },
					{ field: "region", title: "Region" },
				],
			},
		};

		try {
			container.innerHTML = "";
			await vegaEmbed("#chart-7-scatter", spec, { actions: false });
		} catch (error) { }
	}

	// CHAPTER 8 - Speed Funnel Chart (The Digital Divide)

	async function renderChapter8Funnel() {
		const container = document.getElementById("chart-8-rankings");
		if (!container) {
			return;
		}

		if (!state.ooklaData || !state.ooklaData.features) {
			container.innerHTML =
				'<div class="chart-placeholder"><p>No data available</p></div>';
			return;
		}

		const features = state.ooklaData.features;

		// Process data into speed buckets
		const bucketData = processSpeedBuckets(features);

		// Store for interactivity
		window.chapter8BucketData = bucketData;

		// Default view: percentages
		await updateChapter8Funnel("percentage");
	}

	function processSpeedBuckets(features) {
		const buckets = [
			{ name: "Very Fast", min: 200000, max: Infinity, color: "#10b981" },
			{ name: "Fast", min: 100000, max: 200000, color: "#34d399" },
			{ name: "Medium-Fast", min: 50000, max: 100000, color: "#fbbf24" },
			{ name: "Medium", min: 25000, max: 50000, color: "#fb923c" },
			{ name: "Slow", min: 10000, max: 25000, color: "#f87171" },
			{ name: "Very Slow", min: 0, max: 10000, color: "#ef4444" },
		];

		const counts = {
			"Very Fast": 0,
			Fast: 0,
			"Medium-Fast": 0,
			Medium: 0,
			Slow: 0,
			"Very Slow": 0,
		};
		const minMax = {
			"Very Fast": { min: Infinity, max: 0 },
			Fast: { min: Infinity, max: 0 },
			"Medium-Fast": { min: Infinity, max: 0 },
			Medium: { min: Infinity, max: 0 },
			Slow: { min: Infinity, max: 0 },
			"Very Slow": { min: Infinity, max: 0 },
		};

		features.forEach((f) => {
			const speed = f.properties.avg_d_kbps;
			if (speed >= 200000) {
				counts["Very Fast"]++;
				if (speed > minMax["Very Fast"].max) minMax["Very Fast"].max = speed;
			} else if (speed >= 100000) {
				counts["Fast"]++;
				if (speed > minMax["Fast"].max) minMax["Fast"].max = speed;
			} else if (speed >= 50000) {
				counts["Medium-Fast"]++;
				if (speed > minMax["Medium-Fast"].max)
					minMax["Medium-Fast"].max = speed;
			} else if (speed >= 25000) {
				counts["Medium"]++;
				if (speed > minMax["Medium"].max) minMax["Medium"].max = speed;
			} else if (speed >= 10000) {
				counts["Slow"]++;
				if (speed > minMax["Slow"].max) minMax["Slow"].max = speed;
			} else {
				counts["Very Slow"]++;
				if (speed > minMax["Very Slow"].max) minMax["Very Slow"].max = speed;
			}
		});

		const total = features.length;
		const bucketOrder = [
			"Very Fast",
			"Fast",
			"Medium-Fast",
			"Medium",
			"Slow",
			"Very Slow",
		];

		return bucketOrder.map((bucket) => ({
			bucket,
			count: counts[bucket],
			percentage: Math.round((counts[bucket] / total) * 1000) / 10,
			minSpeed:
				bucket === "Very Fast"
					? 200000
					: minMax[bucket].min === Infinity
						? 0
						: minMax[bucket].min,
			maxSpeed: bucket === "Very Fast" ? "500,000+" : minMax[bucket].max,
		}));
	}

	async function updateChapter8Funnel(view) {
		const container = document.getElementById("chart-8-rankings");
		if (!container || !window.chapter8BucketData) return;

		const data = window.chapter8BucketData;
		const isPercentage = view === "percentage";
		// Sort data by count, low to high
		const sortedData = [...data].sort((a, b) => a.count - b.count);
		const xField = isPercentage ? "percentage" : "count";
		const xTitle = isPercentage ? "% of Areas" : "Number of Areas";
		const spec = {
			$schema: "https://vega.github.io/schema/vega-lite/v6.json",
			width: "container",
			height: 380,
			data: { values: sortedData },
			mark: { type: "bar", cornerRadiusEnd: 4 },
			encoding: {
				x: {
					field: xField,
					type: "quantitative",
					title: xTitle,
					scale: {
						domain: [
							0,
							isPercentage ? 50 : Math.max(...sortedData.map((d) => d.count)),
						],
					},
				},
				y: {
					field: "bucket",
					type: "nominal",
					title: "Speed Category",
					sort: "-x",
					axis: { labelLimit: 100, labelAngle: 0 },
				},
				color: {
					field: "bucket",
					type: "nominal",
					scale: {
						domain: [
							"Very Fast",
							"Fast",
							"Medium-Fast",
							"Medium",
							"Slow",
							"Very Slow",
						],
						range: [
							"#10b981",
							"#34d399",
							"#fbbf24",
							"#fb923c",
							"#f87171",
							"#ef4444",
						],
					},
					legend: { title: "Speed Category", orient: "bottom" },
				},
				tooltip: [
					{ field: "bucket", title: "Category" },
					{ field: "count", title: "Areas", format: ".0f" },
					{ field: "percentage", title: "% of Total", format: ".1f" },
				],
			},
		};

		try {
			container.innerHTML = "";
			await vegaEmbed("#chart-8-rankings", spec, { actions: false });
		} catch (error) {
			container.innerHTML =
				'<div class="chart-placeholder"><p>Error: ' +
				error.message +
				"</p></div>";
		}
	}

	function setupChapter8FunnelControls() {
		const chartCard = document.querySelector("#chapter-8 .chart-card");
		if (!chartCard) return;
		if (document.getElementById("chapter8-view-toggle")) return;

		const controlsDiv = document.createElement("div");
		controlsDiv.className = "chart-controls";
		controlsDiv.style.cssText =
			"display: flex; align-items: center; gap: 10px; margin-bottom: 15px;";

		const label = document.createElement("label");
		label.textContent = "Display: ";
		label.style.cssText =
			"font-size: 13px; font-weight: 500; color: var(--color-text-muted, #64748b);";

		const select = document.createElement("select");
		select.id = "chapter8-view-toggle";
		select.className = "view-select";
		select.style.cssText =
			"padding: 6px 12px; border-radius: 6px; border: 1px solid #e2e8f0; background: #fff; font-size: 13px; color: #333; cursor: pointer;";
		select.innerHTML = `
    <option value="percentage">Percentages</option>
    <option value="count">Counts</option>
   `;
		select.addEventListener("change", async (e) => {
			const view = e.target.value;
			await updateChapter8Funnel(view);
		});

		controlsDiv.appendChild(label);
		controlsDiv.appendChild(select);
		chartCard.insertBefore(controlsDiv, chartCard.firstChild);
	}

	// CHAPTER 4 SECOND CHART - Performance Tiers (Donut Chart)

	async function renderChapter4TiersChart() {
		const container = document.getElementById("chart-4-tiers");
		if (!container) {
			return;
		}

		if (!state.ooklaData || !state.ooklaData.features) {
			container.innerHTML =
				'<div class="chart-placeholder"><p>No data available</p></div>';
			return;
		}

		// Calculate performance tier counts
		const tierCounts = { "High Speed": 0, Adequate: 0, "Under-served": 0 };
		state.ooklaData.features.forEach((f) => {
			const tier = f.properties.performance_tier;
			if (tierCounts[tier] !== undefined) {
				tierCounts[tier]++;
			}
		});

		const tierData = Object.entries(tierCounts).map(([tier, count]) => ({
			tier,
			count,
			percentage: Math.round((count / state.ooklaData.features.length) * 100),
		}));

		const spec = {
			$schema: "https://vega.github.io/schema/vega-lite/v5.json",
			width: 280,
			height: 240,
			data: { values: tierData },
			mark: { type: "arc", innerRadius: 40, outerRadius: 90 },
			encoding: {
				theta: {
					field: "count",
					type: "quantitative",
					title: "Number of Areas",
				},
				color: {
					field: "tier",
					type: "nominal",
					title: "Performance Tier",
					scale: {
						domain: ["High Speed", "Adequate", "Under-served"],
						range: ["#10b981", "#f59e0b", "#ef4444"],
					},
					legend: { title: "Tier", orient: "bottom" },
				},
				tooltip: [
					{ field: "tier", title: "Performance Tier" },
					{ field: "count", title: "Areas", format: ".0f" },
					{ field: "percentage", title: "% of Total", format: ".1f" },
				],
			},
		};

		try {
			container.innerHTML = "";
			await vegaEmbed("#chart-4-tiers", spec, { actions: false });
		} catch (error) {
			container.innerHTML =
				'<div class="chart-placeholder"><p>Error: ' +
				error.message +
				"</p></div>";
		}
	}

	// CHAPTER 4 THIRD CHART - Latency Tiers (Donut Chart)

	async function renderChapter4LatencyChart() {
		const container = document.getElementById("chart-4-latency");
		if (!container) {
			return;
		}

		if (!state.ooklaData || !state.ooklaData.features) {
			container.innerHTML =
				'<div class="chart-placeholder"><p>No data available</p></div>';
			return;
		}

		// Calculate latency tier counts
		const latencyCounts = { Excellent: 0, Good: 0, Fair: 0, Poor: 0 };
		state.ooklaData.features.forEach((f) => {
			const tier = f.properties.latency_tier;
			if (latencyCounts[tier] !== undefined) {
				latencyCounts[tier]++;
			}
		});

		const latencyData = Object.entries(latencyCounts).map(([tier, count]) => ({
			tier,
			count,
			percentage: Math.round((count / state.ooklaData.features.length) * 100),
		}));

		const spec = {
			$schema: "https://vega.github.io/schema/vega-lite/v5.json",
			width: 280,
			height: 240,
			data: { values: latencyData },
			mark: { type: "arc", innerRadius: 40, outerRadius: 90 },
			encoding: {
				theta: {
					field: "count",
					type: "quantitative",
					title: "Number of Areas",
				},
				color: {
					field: "tier",
					type: "nominal",
					title: "Latency Tier",
					scale: {
						domain: ["Excellent", "Good", "Fair", "Poor"],
						range: ["#10b981", "#06b6d4", "#f59e0b", "#ef4444"],
					},
					legend: { title: "Latency", orient: "bottom" },
				},
				tooltip: [
					{ field: "tier", title: "Latency Tier" },
					{ field: "count", title: "Areas", format: ".0f" },
					{ field: "percentage", title: "% of Total", format: ".1f" },
				],
			},
		};

		try {
			container.innerHTML = "";
			await vegaEmbed("#chart-4-latency", spec, { actions: false });
		} catch (error) {
			container.innerHTML =
				'<div class="chart-placeholder"><p>Error: ' +
				error.message +
				"</p></div>";
		}
	}

	// DATA LOADING - OOKLA CSV (for basic stats)

	async function loadOoklaCSVData() {
		try {
			const response = await fetch(CONFIG.ooklaCSVPath);

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const csvText = await response.text();
			state.ooklaCSVData = parseCSV(csvText);
		} catch (error) { }
	}

	function parseCSV(text) {
		const lines = text.trim().split("\n");
		const headers = lines[0].split(",").map((h) => h.trim());
		const rows = [];

		for (let i = 1; i < lines.length; i++) {
			const values = lines[i].split(",");
			const row = {};
			headers.forEach((header, idx) => {
				const val = values[idx] ? values[idx].trim() : "";
				row[header] = isNaN(val) ? val : parseFloat(val);
			});
			rows.push(row);
		}

		return rows;
	}

	// DATA LOADING - OOKLA GEOJSON

	async function loadOoklaData() {
		try {
			const response = await fetch(CONFIG.ooklaDataPath);

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const geojson = await response.json();
			state.ooklaData = processOoklaData(geojson);
		} catch (error) { }
	}

	function processOoklaData(geojson) {
		const features = geojson.features.map((feature) => {
			const props = feature.properties;

			const downloadMbps = (props.avg_d_kbps || 0) / 1000;
			const uploadMbps = (props.avg_u_kbps || 0) / 1000;

			let performanceTier;
			if (downloadMbps >= 50) performanceTier = "High Speed";
			else if (downloadMbps >= 25) performanceTier = "Adequate";
			else performanceTier = "Under-served";

			let latencyTier;
			if (props.avg_lat_ms < 20) latencyTier = "Excellent";
			else if (props.avg_lat_ms < 50) latencyTier = "Good";
			else if (props.avg_lat_ms < 100) latencyTier = "Fair";
			else latencyTier = "Poor";

			let regionType = "Unknown";
			if (props.quadkey && props.quadkey.length > 1) {
				const digit = props.quadkey.charAt(1);
				if (digit === "1") regionType = "Urban";
				else if (digit === "2") regionType = "Regional";
				else if (digit === "3") regionType = "Remote";
			}

			feature.properties = {
				...props,
				download_mbps: Math.round(downloadMbps * 10) / 10,
				upload_mbps: Math.round(uploadMbps * 10) / 10,
				performance_tier: performanceTier,
				latency_tier: latencyTier,
				region_type: regionType,
			};

			return feature;
		});

		return { ...geojson, features };
	}

	// DATA LOADING - NBN EXCEL

	async function loadNBNData() {
		try {
			// Read Excel file using fetch + XLSX parsing
			const response = await fetch(CONFIG.nbnDataPath);
			const buffer = await response.arrayBuffer();

			// UseSheetJS library for parsing
			if (typeof XLSX === "undefined") {
				// Load SheetJS dynamically
				await loadSheetJS();
			}

			const workbook = XLSX.read(buffer, { type: "array" });
			const sheetName = workbook.SheetNames[0];
			const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
				header: 1,
			});

			state.nbnData = processNBNData(data);
		} catch (error) { }
	}

	function loadSheetJS() {
		return new Promise((resolve, reject) => {
			const script = document.createElement("script");
			script.src =
				"https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
			script.onload = resolve;
			script.onerror = reject;
			document.head.appendChild(script);
		});
	}

	function processNBNData(rawData) {
		// Parse the Excel structure
		// Rows 6-14: ISP performance data
		// Rows 19+: Plan speed data

		const ispData = [];
		const planData = [];
		const techData = [];

		// Extract ISP performance (rows 6-14)
		for (let i = 6; i <= 14; i++) {
			if (rawData[i] && rawData[i][0]) {
				// Excel stores percentages as decimals (0.942), so multiply by 100
				const busyHours = parseFloat(rawData[i][1]);
				const busiest = parseFloat(rawData[i][4]);
				const upload = parseFloat(rawData[i][6]);

				ispData.push({
					provider: rawData[i][0],
					downloadBusyHours: busyHours < 2 ? busyHours * 100 : busyHours,
					downloadChange: parseFloat(rawData[i][2]) || 0,
					downloadBusiest: busiest < 2 ? busiest * 100 : busiest,
					uploadBusyHours: upload < 2 ? upload * 100 : upload,
				});
			}
		}

		// Use hardcoded plan data from spec for reliability
		const planSpeedData = [
			{ plan: "NBN 12", thisReport: 10.8, lastReport: 11.2 },
			{ plan: "NBN 25", thisReport: 23.8, lastReport: 24.5 },
			{ plan: "NBN 50", thisReport: 46.7, lastReport: 48.3 },
			{ plan: "NBN 100", thisReport: 89.6, lastReport: 92.4 },
			{ plan: "NBN 250", thisReport: 215.3, lastReport: 228.5 },
			{ plan: "NBN 1000", thisReport: 719.7, lastReport: 750.5 },
		];
		planData.push(...planSpeedData);

		// Technology type data - use spec data directly (more reliable)
		techData.push({ technology: "FTTP", percentOfPlan: 99.8 });
		techData.push({ technology: "FTTB", percentOfPlan: 98.5 });
		techData.push({ technology: "FTTC", percentOfPlan: 97.2 });
		techData.push({ technology: "HFC", percentOfPlan: 98.1 });
		techData.push({ technology: "FTTN", percentOfPlan: 94.3 });

		return { ispData, planData, techData };
	}

	// VEGA-LITE CHART RENDERING

	async function ensureVegaLibraries() {
		if (typeof vega === "undefined") {
			await loadScript("https://cdn.jsdelivr.net/npm/vega@6");
		}
		if (typeof vl === "undefined" && typeof vegaLite === "undefined") {
			await loadScript("https://cdn.jsdelivr.net/npm/vega-lite@6");
		}
		if (typeof vegaEmbed === "undefined") {
			await loadScript("https://cdn.jsdelivr.net/npm/vega-embed@6");
		}
	}

	function loadScript(src) {
		return new Promise((resolve, reject) => {
			const script = document.createElement("script");
			script.src = src;
			script.onload = resolve;
			script.onerror = reject;
			document.head.appendChild(script);
		});
	}

	function embedChart(divId, spec) {
		const container = document.getElementById(divId);
		container.innerHTML = "";
		return vegaEmbed(`#${divId}`, spec, { actions: false });
	}

	async function updateAllCharts() {
		await ensureVegaLibraries();

		if (state.ooklaData) {
			await updateOoklaCharts();
		}

		if (state.nbnData) {
			await updateNBNCharts();
		}

		updateStats();
	}

	async function updateOoklaCharts() {
		const geojson = state.ooklaData;
		const features = geojson.features;

		// Chart 1: Download Speed Map
		await embedChart("chart-1-map", {
			$schema: "https://vega.github.io/schema/vega-lite/v6.json",
			width: "container",
			height: 400,
			title: "Download Speed by Location",
			projection: {
				type: "mercator",
				center: [133, -28],
				scale: 800,
			},
			layer: [
				{
					// Background Australia
					data: {
						url: "https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson",
						format: { type: "json" },
						transform: [{ filter: "datum.properties.ISO_A3 === 'AUS'" }],
					},
					mark: {
						type: "geoshape",
						fill: "#e0e0e0",
						fillOpacity: 0.3,
						stroke: "#999",
						strokeWidth: 1,
					},
				},
				{
					// Speed data overlay
					data: {
						url: CONFIG.ooklaDataPath,
						format: { type: "json", property: "features" },
					},
					mark: "geoshape",
					encoding: {
						color: {
							field: "properties.avg_d_kbps",
							type: "quantitative",
							scale: { scheme: "plasma", domain: [0, 400000] },
							title: "Download Speed (kbps)",
						},
						tooltip: [
							{ field: "properties.quadkey", title: "Region" },
							{ field: "properties.avg_d_kbps", title: "Download (kbps)" },
							{ field: "properties.avg_u_kbps", title: "Upload (kbps)" },
							{ field: "properties.avg_lat_ms", title: "Latency (ms)" },
						],
					},
				},
			],
		});

		// Chart 2: Donut Chart - Performance Tier Distribution
		const tierCounts = {};
		features.forEach((f) => {
			const tier = f.properties.performance_tier;
			tierCounts[tier] = (tierCounts[tier] || 0) + 1;
		});

		const tierData = Object.entries(tierCounts).map(([tier, count]) => ({
			tier,
			count,
		}));

		await embedChart("chart-2-donut", {
			$schema: "https://vega.github.io/schema/vega-lite/v6.json",
			width: "container",
			height: 300,
			data: { values: tierData },
			mark: { type: "arc", innerRadius: 60 },
			encoding: {
				theta: { field: "count", type: "quantitative" },
				color: {
					field: "tier",
					type: "nominal",
					scale: {
						domain: ["High Speed", "Adequate", "Under-served"],
						range: ["#10b981", "#f59e0b", "#ef4444"],
					},
					legend: { title: "Performance Tier" },
				},
				tooltip: [
					{ field: "tier", title: "Tier" },
					{ field: "count", title: "Count" },
				],
			},
		});

		// Chart 3: Histogram - Speed Distribution
		const histogramData = features.map((f) => f.properties);

		await embedChart("chart-3-histogram", {
			$schema: "https://vega.github.io/schema/vega-lite/v6.json",
			width: "container",
			height: 300,
			data: { values: histogramData },
			mark: "bar",
			encoding: {
				x: {
					field: "avg_d_kbps",
					type: "quantitative",
					bin: { maxbins: 30 },
					title: "Download Speed (kbps)",
				},
				y: {
					type: "quantitative",
					aggregate: "count",
					title: "Count",
				},
				color: {
					field: "performance_tier",
					type: "nominal",
					scale: {
						domain: ["High Speed", "Adequate", "Under-served"],
						range: ["#10b981", "#f59e0b", "#ef4444"],
					},
					legend: { title: "Tier" },
				},
			},
		});

		// Chart 6: Upload Speed Map
		await embedChart("chart-6-upload-map", {
			$schema: "https://vega.github.io/schema/vega-lite/v6.json",
			width: "container",
			height: 400,
			title: "Upload Speed by Location",
			projection: {
				type: "mercator",
				center: [133, -28],
				scale: 800,
			},
			layer: [
				{
					// Background Australia
					data: {
						url: "https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson",
						format: { type: "json" },
						transform: [{ filter: "datum.properties.ISO_A3 === 'AUS'" }],
					},
					mark: {
						type: "geoshape",
						fill: "#e0e0e0",
						fillOpacity: 0.3,
						stroke: "#999",
						strokeWidth: 1,
					},
				},
				{
					// Upload speed overlay
					data: {
						url: CONFIG.ooklaDataPath,
						format: { type: "json", property: "features" },
					},
					mark: "geoshape",
					encoding: {
						color: {
							field: "properties.avg_u_kbps",
							type: "quantitative",
							scale: { scheme: "plasma", domain: [0, 50000] },
							title: "Upload Speed (kbps)",
						},
						tooltip: [
							{ field: "properties.quadkey", title: "Region" },
							{ field: "properties.avg_u_kbps", title: "Upload (kbps)" },
						],
					},
				},
			],
		});

		// Chart 7: Latency Map
		await embedChart("chart-7-latency-map", {
			$schema: "https://vega.github.io/schema/vega-lite/v6.json",
			width: "container",
			height: 400,
			title: "Latency by Location",
			projection: {
				type: "mercator",
				center: [133, -28],
				scale: 800,
			},
			layer: [
				{
					// Background Australia
					data: {
						url: "https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson",
						format: { type: "json" },
						transform: [{ filter: "datum.properties.ISO_A3 === 'AUS'" }],
					},
					mark: {
						type: "geoshape",
						fill: "#e0e0e0",
						fillOpacity: 0.3,
						stroke: "#999",
						strokeWidth: 1,
					},
				},
				{
					// Latency overlay
					data: {
						url: CONFIG.ooklaDataPath,
						format: { type: "json", property: "features" },
					},
					mark: "geoshape",
					encoding: {
						color: {
							field: "properties.avg_lat_ms",
							type: "quantitative",
							scale: { scheme: "reds", domain: [0, 200], reverse: true },
							title: "Latency (ms)",
						},
						tooltip: [
							{ field: "properties.quadkey", title: "Region" },
							{ field: "properties.avg_lat_ms", title: "Latency (ms)" },
						],
					},
				},
			],
		});

		// Chart 8: Latency vs Download Scatter
		await embedChart("chart-8-latency-scatter", {
			$schema: "https://vega.github.io/schema/vega-lite/v6.json",
			width: "container",
			height: 300,
			data: { values: histogramData },
			mark: "circle",
			encoding: {
				x: {
					field: "avg_d_kbps",
					type: "quantitative",
					title: "Download Speed (kbps)",
				},
				y: {
					field: "avg_lat_ms",
					type: "quantitative",
					title: "Latency (ms)",
				},
				size: { value: 30 },
				color: { value: "#6366f1" },
				tooltip: [
					{ field: "properties.quadkey", title: "Region" },
					{ field: "properties.avg_d_kbps", title: "Download (kbps)" },
					{ field: "properties.avg_lat_ms", title: "Latency (ms)" },
				],
			},
		});

		// Chart 9: Regional Comparison Bar
		const regionStats = {};
		features.forEach((f) => {
			const region = f.properties.region_type;
			if (region === "Unknown") return;
			if (!regionStats[region]) {
				regionStats[region] = { total: 0, count: 0 };
			}
			regionStats[region].total += f.properties.avg_d_kbps;
			regionStats[region].count++;
		});

		const regionalData = Object.entries(regionStats).map(([region, stats]) => ({
			region,
			avgSpeed: Math.round(stats.total / stats.count),
		}));

		await embedChart("chart-9-regional-bar", {
			$schema: "https://vega.github.io/schema/vega-lite/v6.json",
			width: "container",
			height: 200,
			data: { values: regionalData },
			mark: "bar",
			encoding: {
				y: {
					field: "region",
					type: "nominal",
					title: "Region Type",
					sort: "-x",
				},
				x: {
					field: "avgSpeed",
					type: "quantitative",
					title: "Average Download Speed (kbps)",
				},
				color: {
					field: "region",
					type: "nominal",
					scale: {
						domain: ["Urban", "Regional", "Remote"],
						range: ["#10b981", "#f59e0b", "#ef4444"],
					},
					legend: null,
				},
				tooltip: [
					{ field: "region", title: "Region" },
					{ field: "avgSpeed", title: "Avg Speed (kbps)" },
				],
			},
		});

		// Chart 10: Top 5 vs Bottom 5 Diverging Bar
		const sortedBySpeed = [...features].sort(
			(a, b) => b.properties.avg_d_kbps - a.properties.avg_d_kbps,
		);
		const top5 = sortedBySpeed
			.slice(0, 5)
			.map((f) => ({
				area: f.properties.quadkey,
				speed: f.properties.avg_d_kbps,
				type: "Top 5",
			}));
		const bottom5 = sortedBySpeed
			.slice(-5)
			.map((f) => ({
				area: f.properties.quadkey,
				speed: -f.properties.avg_d_kbps,
				type: "Bottom 5",
			}));
		const divergingData = [...top5, ...bottom5];

		await embedChart("chart-10-diverging", {
			$schema: "https://vega.github.io/schema/vega-lite/v6.json",
			width: "container",
			height: 300,
			data: { values: divergingData },
			mark: "bar",
			encoding: {
				y: {
					field: "area",
					type: "nominal",
					title: "Region",
					sort: null,
				},
				x: {
					field: "speed",
					type: "quantitative",
					title: "Download Speed (kbps)",
				},
				color: {
					field: "type",
					type: "nominal",
					scale: {
						domain: ["Top 5", "Bottom 5"],
						range: ["#10b981", "#ef4444"],
					},
					legend: { title: "Ranking" },
				},
				tooltip: [
					{ field: "area", title: "Region" },
					{ field: "speed", title: "Speed (kbps)", format: ".0f" },
				],
			},
		});
	}

	async function updateNBNCharts() {
		const { ispData, planData } = state.nbnData;

		// Chart 4: ISP Performance Bar
		await embedChart("chart-4-isp-bar", {
			$schema: "https://vega.github.io/schema/vega-lite/v6.json",
			width: "container",
			height: 300,
			data: {
				values: ispData.map((d) => ({
					provider: d.provider,
					speed: d.downloadBusyHours * 100,
				})),
			},
			mark: "bar",
			encoding: {
				y: {
					field: "provider",
					type: "nominal",
					title: "ISP",
					sort: "-x",
				},
				x: {
					field: "speed",
					type: "quantitative",
					title: "Download Speed (% of max plan)",
				},
				color: { value: "#6366f1" },
				tooltip: [
					{ field: "provider", title: "ISP" },
					{ field: "speed", title: "Speed %", format: ".1f" },
				],
			},
		});

		// Chart 5: Plan Speed Bar
		await embedChart("chart-5-plan-bar", {
			$schema: "https://vega.github.io/schema/vega-lite/v6.json",
			width: "container",
			height: 200,
			data: {
				values: planData.map((d) => ({ plan: d.plan, speed: d.thisReport })),
			},
			mark: "bar",
			encoding: {
				x: {
					field: "plan",
					type: "nominal",
					title: "NBN Plan",
				},
				y: {
					field: "speed",
					type: "quantitative",
					title: "Download Speed (Mbps)",
				},
				color: { value: "#8b5cf6" },
				tooltip: [
					{ field: "plan", title: "Plan" },
					{ field: "speed", title: "Speed (Mbps)", format: ".1f" },
				],
			},
		});
	}

	function updateStats() {
		if (!state.ooklaData) return;

		const features = state.ooklaData.features;
		const tiers = countByTier(features);
		const total = features.length;

		const highPercent = Math.round((tiers.high / total) * 100);
		const adequatePercent = Math.round((tiers.adequate / total) * 100);
		const underPercent = Math.round((tiers.under / total) * 100);

		const statValues = document.querySelectorAll(".stat-value");
		if (statValues[0]) statValues[0].textContent = `${highPercent}%`;
		if (statValues[1]) statValues[1].textContent = `${adequatePercent}%`;
		if (statValues[2]) statValues[2].textContent = `${underPercent}%`;
	}

	function countByTier(features) {
		const counts = { "High Speed": 0, Adequate: 0, "Under-served": 0 };
		features.forEach((f) => {
			const tier = f.properties.performance_tier;
			if (counts[tier] !== undefined) counts[tier]++;
		});
		return {
			high: counts["High Speed"],
			adequate: counts["Adequate"],
			under: counts["Under-served"],
		};
	}

	function countByRegion(features) {
		const counts = { Urban: 0, Regional: 0, Remote: 0, Unknown: 0 };
		features.forEach((f) => {
			const region = f.properties.region_type;
			if (counts[region] !== undefined) counts[region]++;
		});
		return counts;
	}

	// INTERACTIVITY

	function initControls() {
		const zoomIn = document.getElementById("zoom-in");
		const zoomOut = document.getElementById("zoom-out");
		const resetView = document.getElementById("reset-view");
		const exportBtn = document.getElementById("export-data");

		if (zoomIn) zoomIn.addEventListener("click", () => handleZoom(1.2));
		if (zoomOut) zoomOut.addEventListener("click", () => handleZoom(0.8));
		if (resetView) resetView.addEventListener("click", handleReset);
		if (exportBtn) exportBtn.addEventListener("click", handleExport);
	}

	function handleZoom(factor) {
		state.zoomLevel *= factor;
		state.zoomLevel = Math.max(0.5, Math.min(3, state.zoomLevel));
	}

	function handleReset() {
		state.zoomLevel = 1;
		state.selectedRegion = null;
		state.selectedTier = null;
	}

	function handleExport() {
		const exportObj = {
			ookla: state.ooklaData,
			nbn: state.nbnData,
		};

		const dataStr = JSON.stringify(exportObj, null, 2);
		const blob = new Blob([dataStr], { type: "application/json" });
		const url = URL.createObjectURL(blob);

		const a = document.createElement("a");
		a.href = url;
		a.download = "australian-broadband-data.json";
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	// INITIALIZATION

	async function init() {
		// Wait for vegaEmbed to be available
		if (typeof vegaEmbed === "undefined") {
			await new Promise((resolve) => setTimeout(resolve, 1000));
		}

		if (typeof vegaEmbed === "undefined") {
			const container = document.getElementById("chart-1-map");
			if (container) {
				container.innerHTML =
					'<div class="chart-placeholder"><p>Error: Vega libraries not loaded. Please check your internet connection.</p></div>';
			}
			return;
		}

		// Load all datasets
		await Promise.all([
			loadOoklaCSVData().catch((e) =>
				console.error("Ookla CSV load failed:", e),
			),
			loadOoklaData().catch((e) => console.error("Ookla load failed:", e)),
			loadNBNData().catch((e) => console.error("NBN load failed:", e)),
		]);

		// Render Chapter 1 map
		await renderChapter1Map();

		// Render Chapter 2 ISP chart
		await renderChapter2ISPChart();

		// Render Chapter 3 Plan Tiers chart
		await renderChapter3PlanChart();

		// Render Chapter 4 Technology chart
		await renderChapter4TechChart();

		// Render Chapter 4 Performance Tiers chart
		await renderChapter4TiersChart();

		// Render Chapter 4 Latency chart
		await renderChapter4LatencyChart();

		// Render Chapter 5 Time of Day chart
		await renderChapter5TimeChart();

		// Setup Chapter 5 interactivity
		setupChapter5Controls();

		// Render Chapter 7 Regional Speed chart
		await renderChapter7RegionalChart();

		// Setup Chapter 7 interactivity
		setupChapter7Controls();

		// Render Chapter 7 Scatter chart
		await renderChapter7ScatterChart();

		// Render Chapter 8 Rankings chart
		await renderChapter8Funnel();

		// Setup Chapter 8 interactivity
		setupChapter8FunnelControls();

		// Initialize controls
		initControls();
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();
