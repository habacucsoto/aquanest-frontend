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


// Opciones de la gráfica (pueden ser fijas o pasarse también como prop)
const options = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    title: { display: true, text: 'Temperatura (°C)' },
  },
  scales: { y: { beginAtZero: false } },
   animation: false
};

function TemperatureChart({ chartData }) {
    if (!chartData || !chartData.datasets || chartData.datasets[0].data.length === 0) {
        return <p>Cargando datos de temperatura...</p>;
    }

  return <Line options={options} data={chartData} />;
}

export default TemperatureChart;