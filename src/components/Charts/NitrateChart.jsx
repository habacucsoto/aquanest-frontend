import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const options = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    title: { display: true, text: 'Nitrato Amoniacal (ppm)' },
  },
  scales: { y: { beginAtZero: true } },
    animation: false
};

function NitrateChart({ chartData }) {
    if (!chartData || !chartData.datasets || chartData.datasets[0].data.length === 0) {
         return <p>Cargando datos de nitrato...</p>;
    }
  return <Line options={options} data={chartData} />;
}

export default NitrateChart;