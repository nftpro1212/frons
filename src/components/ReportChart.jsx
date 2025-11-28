import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";

const numberFormatter = new Intl.NumberFormat("uz-UZ");
const dateFormatter = new Intl.DateTimeFormat("uz-UZ", { day: "2-digit", month: "short" });

const ChartPoint = ({ x, y, value, date, active, onFocus }) => (
	<g
		className={`report-chart-point${active ? " active" : ""}`}
		transform={`translate(${x}, ${y})`}
		tabIndex={0}
		role="presentation"
		onFocus={onFocus}
	>
		<circle r={2.6} />
		<text y={-6.5} textAnchor="middle">{value}</text>
		<title>{`${date}\n${value}`}</title>
	</g>
);

ChartPoint.propTypes = {
	x: PropTypes.number.isRequired,
	y: PropTypes.number.isRequired,
	value: PropTypes.string.isRequired,
	date: PropTypes.string.isRequired,
	active: PropTypes.bool,
	onFocus: PropTypes.func,
};

const ReportChart = ({ data }) => {
	const svgRef = useRef(null);
	const [hoverIndex, setHoverIndex] = useState(null);
	const [dimensions, setDimensions] = useState({ width: 420, height: 240 });

	const points = Array.isArray(data) ? data : [];

	useEffect(() => {
		if (!svgRef.current || typeof ResizeObserver !== "function") return;
		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (entry?.contentRect) {
				setDimensions({
					width: entry.contentRect.width || 420,
					height: entry.contentRect.height || 240,
				});
			}
		});
		observer.observe(svgRef.current);
		return () => observer.disconnect();
	}, []);

	if (points.length === 0) {
		return <div className="report-chart report-chart-empty">Grafik uchun ma'lumot yo‘q</div>;
	}

	const { width: chartWidth, height: chartHeight } = dimensions;
	const padding = 20;

	const values = points.map((point) => point.total || 0);
	const maxValue = Math.max(...values, 0);
	const minValue = Math.min(...values, 0);
	const valueRange = maxValue - minValue || 1;
	const stepX = (chartWidth - padding * 2) / Math.max(points.length - 1, 1);

	const normalizedPoints = points.map((point, index) => {
		const x = padding + index * stepX;
		const value = point.total || 0;
		const percentage = (value - minValue) / valueRange;
		const y = chartHeight - padding - percentage * (chartHeight - padding * 2);
		return {
			...point,
			x,
			y,
			value,
			formattedValue: `${numberFormatter.format(Math.round(value))} so‘m`,
			formattedDate: dateFormatter.format(new Date(point.date)),
		};
	});

	const pathD = normalizedPoints
		.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
		.join(" ");

	const activeIndex = hoverIndex != null ? hoverIndex : normalizedPoints.length - 1;

	const handleMouseMove = (event) => {
		if (!svgRef.current) return;
		const { left } = svgRef.current.getBoundingClientRect();
		const relativeX = event.clientX - left;
		const distances = normalizedPoints.map((point) => Math.abs(point.x - relativeX));
		const closestIndex = distances.indexOf(Math.min(...distances));
		setHoverIndex(closestIndex);
	};

	const handleMouseLeave = () => setHoverIndex(null);

	return (
		<div className="report-chart">
			<svg
				ref={svgRef}
				viewBox={`0 0 ${chartWidth} ${chartHeight}`}
				role="img"
				aria-label="Kunlik tushum grafiki"
				onMouseMove={handleMouseMove}
				onMouseLeave={handleMouseLeave}
			>
				<defs>
					<linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stopColor="rgba(255, 0, 60, 0.35)" />
						<stop offset="100%" stopColor="rgba(255, 106, 95, 0)" />
					</linearGradient>
				</defs>

				<g className="report-chart-grid">
					{[0, 1, 2, 3].map((step) => {
						const y = padding + ((chartHeight - padding * 2) / 3) * step;
						return <line key={step} x1={padding} y1={y} x2={chartWidth - padding} y2={y} />;
					})}
				</g>

				<path
					className="report-chart-area"
					d={`${pathD} L${normalizedPoints[normalizedPoints.length - 1].x},${chartHeight - padding}
						L${normalizedPoints[0].x},${chartHeight - padding} Z`}
					fill="url(#chartGradient)"
				/>

				<path className="report-chart-line" d={pathD} stroke="rgba(255, 0, 60, 0.6)" fill="none" />

				{normalizedPoints.map((point, index) => (
					<ChartPoint
						key={point.date || index}
						x={point.x}
						y={point.y}
						value={point.formattedValue}
						date={point.formattedDate}
						active={index === activeIndex}
						onFocus={() => setHoverIndex(index)}
					/>
				))}
			</svg>
			<div className="report-chart-labels">
				{normalizedPoints.map((point, index) => (
					<span key={point.date} className={index === activeIndex ? "active" : ""}>
						{point.formattedDate}
					</span>
				))}
			</div>
			<div className="report-chart-tooltip" role="status" aria-live="polite">
				{normalizedPoints[activeIndex]?.formattedDate} — {normalizedPoints[activeIndex]?.formattedValue}
			</div>
		</div>
	);
};

ReportChart.propTypes = {
	data: PropTypes.arrayOf(
		PropTypes.shape({
			date: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
			total: PropTypes.number,
		})
	),
};

ReportChart.defaultProps = {
	data: [],
};

export default ReportChart;
