// src/components/Charts/TemperatureChart.jsx
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
  Filler // <--- ¡Importación correcta!
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler // <--- ¡DEBES REGISTRARLO AQUÍ TAMBIÉN!
);


// Opciones de la gráfica (pueden ser fijas o pasarse también como prop)
const options = {
  responsive: true,
  maintainAspectRatio: false, // Permite controlar el tamaño con CSS del contenedor
  plugins: {
    legend: { display: false },
    title: { display: true, text: 'Temperatura (°C)' }, // Título más específico
  },
  scales: { y: { beginAtZero: false } },
   animation: false // Deshabilita animación para actualizaciones rápidas
};

// El componente ahora recibe 'chartData' como prop
function TemperatureChart({ chartData }) {
    // Si chartData no tiene datasets o datos, puedes renderizar un estado vacío o un mensaje
    if (!chartData || !chartData.datasets || chartData.datasets[0].data.length === 0) {
        return <p>Cargando datos de temperatura...</p>;
    }

  return <Line options={options} data={chartData} />;
}

export default TemperatureChart;