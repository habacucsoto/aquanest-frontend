// src/components/Charts/NitrateChart.jsx
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
  Filler // <--- ¡Importa el plugin Filler!
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler // <--- ¡Regístralo aquí también!
);

// Opciones de la gráfica
const options = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    title: { display: true, text: 'Nitrato Amoniacal (ppm)' }, // Título más específico
  },
  scales: { y: { beginAtZero: true } }, // El nitrato quizás sí empiece en 0
    animation: false
};

// El componente ahora recibe 'chartData' como prop
function NitrateChart({ chartData }) {
    if (!chartData || !chartData.datasets || chartData.datasets[0].data.length === 0) {
         return <p>Cargando datos de nitrato...</p>;
    }
  return <Line options={options} data={chartData} />;
}

export default NitrateChart;