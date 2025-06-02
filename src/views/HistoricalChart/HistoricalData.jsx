import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import Layout from '../Layout/Layout';
import styles from './HistoricalData.module.css';
import TemperatureChart from '../../components/Charts/TemperatureChart';
import NitrateChart from '../../components/Charts/NitrateChart';

const API_URL = 'http://localhost:8080';
const getAuthToken = () => localStorage.getItem('authToken');

const formatTime = (date) => {
    if (!date) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

function HistoricalData() {
    const { pondId } = useParams();
    const [historicalData, setHistoricalData] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchPondDataAndHistoricalSensorData = useCallback(async () => {
        setLoading(true);
        setError('');
        const token = getAuthToken();
        if (!token) {
            setError("No autenticado.");
            setLoading(false);
            return;
        }

        try {
            const pondResponse = await axios.get(`${API_URL}/estanques/${pondId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const sensorsForPond = pondResponse.data.sensores || [];

            const tempSensor = sensorsForPond.find(s => s.tipo === 'temperatura');
            const nitrateSensor = sensorsForPond.find(s => s.tipo === 'nitrato');

            if (!tempSensor && !nitrateSensor) {
                setLoading(false);
                return;
            }

            const allSensorDataForPondResponse = await axios.get(`${API_URL}/datos-sensor/estanque/${pondId}/history`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const allSensorDataForPond = allSensorDataForPondResponse.data || [];

            const processedHistoricalData = {};
            let processedTempPoints = 0;
            let processedNitratePoints = 0;
            let ignoredPoints = 0;

            allSensorDataForPond.forEach(dataPoint => {

                if (dataPoint.sensor && dataPoint.sensor.id && dataPoint.timestamp && dataPoint.valor !== undefined) {
                    const date = new Date(dataPoint.timestamp);
                    const dayKey = date.toISOString().split('T')[0]; // Formato YYYY-MM-DD

                    if (!processedHistoricalData[dayKey]) {
                        processedHistoricalData[dayKey] = {
                            temperatura: [],
                            nitrato: [],
                        };
                    }
                    if (dataPoint.sensor.id === tempSensor?.id) {
                        processedHistoricalData[dayKey].temperatura.push({ timestamp: date, value: dataPoint.valor });
                        processedTempPoints++;
                    } else if (dataPoint.sensor.id === nitrateSensor?.id) {
                        processedHistoricalData[dayKey].nitrato.push({ timestamp: date, value: dataPoint.valor });
                        processedNitratePoints++;
                    } else {
                        ignoredPoints++;
                    }
                } else {
                    ignoredPoints++;
                }
            });

            setHistoricalData(processedHistoricalData);

        } catch (err) {
            setError("Error al cargar la información histórica. Asegúrate de que el API de datos de sensor esté funcionando y devuelva el 'timestamp'.");
        } finally {
            setLoading(false);
        }
    }, [pondId]);

    useEffect(() => {
        if (pondId) {
            fetchPondDataAndHistoricalSensorData();
        }
    }, [pondId, fetchPondDataAndHistoricalSensorData]);

    const formatChartData = useCallback((dataHistory, sensorTypeLabel, day) => {
        if (!dataHistory || dataHistory.length === 0) {
            return { labels: [], datasets: [] };
        }

        const sortedHistory = [...dataHistory].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        return {
            labels: sortedHistory.map(point => formatTime(point.timestamp)),
            datasets: [
                {
                    label: `Valor de ${sensorTypeLabel} - ${day}`,
                    data: sortedHistory.map(point => point.value),
                    borderColor: sensorTypeLabel === 'Temperatura' ? '#00FF00' : '#007bff',
                    backgroundColor: sensorTypeLabel === 'Temperatura' ? 'rgba(7, 255, 48, 0.2)' : 'rgba(0, 123, 255, 0.2)',
                    fill: true,
                    tension: 0.1,
                    pointRadius: 2,
                },
            ],
        };
    }, []);

    const availableDays = Object.keys(historicalData).sort((a, b) => b.localeCompare(a));
    return (
        <Layout>
            <div className={styles.pageContainer}>
                <h1 className={styles.title}>Datos Históricos del Estanque ID: {pondId}</h1>
                {loading && <p>Cargando datos históricos...</p>}
                {error && <p className={styles.errorText}>{error}</p>}

                {!loading && !error && availableDays.length === 0 && (
                    <p>No hay datos históricos disponibles para este estanque.</p>
                )}

                {!loading && !error && availableDays.length > 0 && (
                    availableDays.map(day => {
                        const dailyData = historicalData[day];
                        const hasTempData = dailyData.temperatura && dailyData.temperatura.length > 0;
                        const hasNitrateData = dailyData.nitrato && dailyData.nitrato.length > 0;
                        return (
                            <div key={day} className={styles.dailySection}>
                                <h2>Datos del Día: {day}</h2>
                                <div className={styles.chartsRow}>
                                    <div className={styles.chartWrapper}>
                                        <h3>Temperatura</h3>
                                        {hasTempData ? (
                                            <TemperatureChart chartData={formatChartData(dailyData.temperatura, 'Temperatura', day)} />
                                        ) : (
                                            <p>No hay datos de temperatura para este día.</p>
                                        )}
                                    </div>
                                    <div className={styles.chartWrapper}>
                                        <h3>Nitrato</h3>
                                        {hasNitrateData ? (
                                            <NitrateChart chartData={formatChartData(dailyData.nitrato, 'Nitrato', day)} />
                                        ) : (
                                            <p>No hay datos de nitrato para este día.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </Layout>
    );
}

export default HistoricalData;