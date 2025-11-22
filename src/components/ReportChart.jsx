import React, { useId, useMemo } from "react";

const formatter = new Intl.NumberFormat("uz-UZ", {
	maximumFractionDigits: 0,
});

const dateLabel = new Intl.DateTimeFormat("uz-UZ", {
	day: "2-digit",
	month: "short",
});

export default function ReportChart({ data = [] }) {
	const chartId = useId();
	const prepared = useMemo(() => {
		if (!Array.isArray(data) || data.length === 0) return [];
		return data.map((point) => ({
			date: point?.date,
			total: Number(point?.total ?? 0) || 0,
			label: point?.date ? dateLabel.format(new Date(point.date)) : "",
		}));
	}, [data]);

	if (prepared.length === 0) {
		return <div className="report-chart-empty">Ma'lumot yetarli emas</div>;
	}

	const maxValue = prepared.reduce((max, point) => (point.total > max ? point.total : max), 0);
	const safeMax = maxValue === 0 ? 1 : maxValue;
	const verticalPadding = 12;

	const coordinates = prepared.map((point, index) => {
		const ratio = prepared.length === 1 ? 0 : index / (prepared.length - 1);
		const x = ratio * 100;
		const valueRatio = point.total / safeMax;
		const y = (100 - verticalPadding) - valueRatio * (100 - verticalPadding * 2);
		return { ...point, x, y, isLast: index === prepared.length - 1 };
	});

	const polylinePoints = coordinates.map(({ x, y }) => `${x},${y}`).join(" ");
	const areaPoints = [`0,100`, ...coordinates.map(({ x, y }) => `${x},${y}`), `100,100`].join(" ");

	return (
		<div className="report-chart">
			<svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Tushum grafigi">
				<defs>
					<linearGradient id={`${chartId}-fill`} x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stopColor="rgba(255,0,60,0.65)" />
						<stop offset="85%" stopColor="rgba(255,0,60,0.05)" />
					</linearGradient>
					<linearGradient id={`${chartId}-stroke`} x1="0" y1="0" x2="1" y2="0">
						<stop offset="0%" stopColor="rgba(255,0,60,0.85)" />
						<stop offset="100%" stopColor="rgba(255,106,95,0.9)" />
					</linearGradient>
				</defs>
				<g className="report-chart-grid">
					{[20, 40, 60, 80].map((y) => (
						<line key={y} x1="0" y1={y} x2="100" y2={y} />
					))}
				</g>
				<polygon className="report-chart-area" points={areaPoints} fill={`url(#${chartId}-fill)`} />
				<polyline className="report-chart-line" points={polylinePoints} fill="none" stroke={`url(#${chartId}-stroke)`} />
				{coordinates.map(({ x, y, total, isLast }, index) => (
					<g
						key={index}
						className={`report-chart-point${isLast ? " active" : ""}`}
						transform={`translate(${x}, ${y})`}
					>
						<circle r={1.8} />
						<text x="0" y="-4" textAnchor="middle">
							{formatter.format(total)}
						</text>
					</g>
				))}
			</svg>
			<div className="report-chart-labels">
				{coordinates.map(({ label }, index) => (
					<span key={index}>{label}</span>
				))}
			</div>
		</div>
	);
}
