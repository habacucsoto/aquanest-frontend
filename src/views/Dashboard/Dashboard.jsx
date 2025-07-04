import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Layout from '../Layout/Layout';
import styles from './Dashboard.module.css';
import termometroIcon from '../../assets/temperatura.jpeg';
import nitratoIcon from '../../assets/bombaagua.jpeg';
import TemperatureChart from '../../components/Charts/TemperatureChart';
import NitrateChart from '../../components/Charts/NitrateChart';
import mqtt from 'mqtt';

const MQTT_BROKER_URL = 'ws://18.222.108.48:8083/mqtt';
const API_URL = 'http://localhost:8080';
const getAuthToken = () => localStorage.getItem('authToken');

const formatTime = (date) => {
    if (!date) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const MAX_DATA_POINTS = 40;
const MAX_ALERTS = 20;

function Dashboard() {
    const { pondId } = useParams();
    const navigate = useNavigate();

    const [pondData, setPondData] = useState(null);
    const [pondLoading, setPondLoading] = useState(false);
    const [pondError, setPondError] = useState('');

    const [alertsList, setAlertsList] = useState([]);
    const [alertsLoading, setAlertsLoading] = useState(false);
    const [alertsError, setAlertsError] = useState('');

    const [liveSensorData, setLiveSensorData] = useState({});

    const mqttClientRef = useRef(null);

    const formatDateTime = (dateTimeString) => {
        if (!dateTimeString) return 'N/A';
        try {
            const date = new Date(dateTimeString);
            return date.toLocaleString();
        } catch (e) {
            console.error("Error formateando fecha:", e);
            return 'Fecha inválida';
        }
    };

    const extractNumericId = (prefixedId) => {
        if (prefixedId == null || prefixedId === "") {
            return null;
        }

        let numericPart = prefixedId;
        const prefixes = ["ENF", "CAL", "BR", "ST", "SN", "E"];

        for (const prefix of prefixes) {
            if (prefixedId.startsWith(prefix)) {
                if (prefixedId.length > prefix.length) {
                    numericPart = prefixedId.substring(prefix.length);
                    break;
                } else {
                    return null;
                }
            }
        }

        try {
            const numericId = parseInt(numericPart, 10);
            if (isNaN(numericId)) {
                 return null;
            }
            return numericId;
        } catch (e) {
            return null;
        }
    };

    const fetchPondData = useCallback(async (id) => {
        setPondLoading(true);
        setPondError('');
        const token = getAuthToken();
        if (!token) {
            setPondError("No autenticado.");
            setPondLoading(false);
            return;
        }
        try {
            const response = await axios.get(`${API_URL}/estanques/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setPondData(response.data || null);
        } catch (error) {
            setPondError("Error al cargar la información del estanque.");
        } finally {
            setPondLoading(false);
        }
    }, []);

    const fetchAlertsAndLogsForPond = useCallback(async () => {
        if (!pondData || (!pondData.sensores && !pondData.actuadores)) {
            setAlertsList([]);
            return;
        }

        setAlertsLoading(true);
        setAlertsError('');
        const token = getAuthToken();
        if (!token) {
            setAlertsError("No autenticado.");
            setAlertsLoading(false);
            return;
        }

        try {
            let combinedNotifications = [];
            const allAlertsResponse = await axios.get(`${API_URL}/alerta`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const allAlerts = allAlertsResponse.data || [];
            const sensorIdsDelEstanque = pondData.sensores ? pondData.sensores.map(sensor => sensor.id) : [];

            const filteredSensorAlerts = allAlerts.filter(alerta =>
                // Verifica que alerta.sensor.id exista y que esté en la lista de IDs de sensores del estanque
                alerta.sensor?.id !== undefined && sensorIdsDelEstanque.includes(alerta.sensor.id)
            ).map(alerta => ({
                id: `api-alert-${alerta.id}`,
                type: 'Alerta Histórica de Sensor',
                timestamp: new Date(alerta.timestamp),
                message: alerta.mensaje || 'Alerta de sensor'
            }));
            combinedNotifications.push(...filteredSensorAlerts);

            const allLogsResponse = await axios.get(`${API_URL}/log`, {
                headers: { Authorization: `Bearer ${token}`}
            });
            const allLogs = allLogsResponse.data || [];
            const actuadorIdsDelEstanque = pondData.actuadores ? pondData.actuadores.map(actuador => actuador.id) : [];

            const filteredActuatorLogs = allLogs.filter(log =>
                (log.accion === 'Heartbeat Error' || log.accion === 'Status Update') &&
                log.actuador?.id !== undefined && actuadorIdsDelEstanque.includes(log.actuador.id)
            ).map(log => ({
                id: `api-log-${log.id}`,
                type: log.accion === 'Heartbeat Error' ? 'Error Heartbeat Histórico de Actuador' : 'Actualización de Estado Histórica de Actuador',
                timestamp: new Date(log.timestamp),
                message: `Actuador ID ${log.actuador.id} - ${log.accion}: ${log.resultado}`
            }));
            combinedNotifications.push(...filteredActuatorLogs);

            combinedNotifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
            setAlertsList(combinedNotifications.slice(0, MAX_ALERTS));

        } catch (error) {
            console.error("Error al cargar alertas y logs históricos:", error);
            setAlertsError("Error al cargar notificaciones históricas.");
        } finally {
            setAlertsLoading(false);
        }
    }, [pondData]);

    const subscribeToPondTopics = useCallback((client, currentPondId, sensors) => {
        if (!client || !client.connected || !currentPondId) {
            console.warn("[MQTT_SUBSCRIBE] No se puede suscribir: Cliente no conectado o sin pondId.");
            return;
        }
        const topicsToSubscribe = [];

        if (sensors && sensors.length > 0) {
            sensors.forEach(sensor => {
                if (!sensor || sensor.id === undefined || !sensor.tipo) {
                     return;
                }
                let sensorPrefix;
                switch (sensor.tipo) {
                    case 'temperatura': sensorPrefix = 'ST'; break;
                    case 'nitrato': sensorPrefix = 'SN'; break;
                    default:
                        return;
                }
                const sensorDataTopic = `aquanest/E${currentPondId}/${sensorPrefix}${sensor.id}/data/+`;
                topicsToSubscribe.push(sensorDataTopic);
                setLiveSensorData(prevData => ({
                     ...prevData,
                     [sensor.id]: prevData[sensor.id] || []
                 }));
            });
        }

         topicsToSubscribe.push(`aquanest/E${currentPondId}/+/alert/anomalous`);
         topicsToSubscribe.push(`aquanest/E${currentPondId}/+/heartbeat/error`);

        if (topicsToSubscribe.length > 0) {
             client.subscribe(topicsToSubscribe, { qos: 0 }, (err) => {
                 if (err) {
                     console.error(`[MQTT_SUBSCRIBE ERROR] Error al suscribir a tópicos:`, err);
                 } else {
                 }
             });
        } else {
            console.warn("[MQTT_SUBSCRIBE] Lista de tópicos para suscribir está vacía.");
        }
    }, []);


    const unsubscribeFromPondTopics = useCallback((client, currentPondId, sensors) => {
         if (!client || !currentPondId) {
             console.warn("[MQTT_UNSUBSCRIBE] No se puede desuscribir: Cliente no válido o sin pondId.");
             return;
         }

        const topicsToUnsubscribe = [];

        if (sensors && sensors.length > 0) {
            sensors.forEach(sensor => {
                 if (!sensor || sensor.id === undefined || !sensor.tipo) return;
                 let sensorPrefix;
                 switch (sensor.tipo) {
                     case 'temperatura': sensorPrefix = 'ST'; break;
                     case 'nitrato': sensorPrefix = 'SN'; break;
                     default: return;
                 }
                 const sensorDataTopic = `aquanest/E${currentPondId}/${sensorPrefix}${sensor.id}/data/+`;
                 topicsToUnsubscribe.push(sensorDataTopic);
             });
         }

         topicsToUnsubscribe.push(`aquanest/E${currentPondId}/+/alert/anomalous`);
         topicsToUnsubscribe.push(`aquanest/E${currentPondId}/+/heartbeat/error`);

         if (topicsToUnsubscribe.length > 0) {
             client.unsubscribe(topicsToUnsubscribe, (err) => {
                 if (err) {
                     console.error(`[MQTT_UNSUBSCRIBE ERROR] Error al desuscribir de tópicos:`, err);
                 } 
             });
         } else {
              console.warn("[MQTT_UNSUBSCRIBE] Lista de tópicos para desuscribir está vacía.");
         }
    }, []);

    useEffect(() => {
        console.log(`[MQTT_EFFECT 1] Inicializando/Conectando cliente MQTT para estanque ID: ${pondId}`);

        if (mqttClientRef.current && mqttClientRef.current.connected) {
             return () => { /* cleanup will run on dismount or pondId change */ };
        }
         if (mqttClientRef.current && !mqttClientRef.current.connected) {
         }

         if (!mqttClientRef.current) {
             const client = mqtt.connect(MQTT_BROKER_URL);
             mqttClientRef.current = client;

             client.on('connect', () => {
                 if (pondData && (pondData.sensores || pondData.actuadores)) { // Check for both
                     subscribeToPondTopics(client, pondId, pondData.sensores); // Pass sensors, actuadores for MQTT sub if needed
                 } else {
                 }
             });

             client.on('error', (err) => {
                 console.error('[MQTT_CLIENT] Error en conexión MQTT:', err);
             });

             client.on('close', () => {
                  console.log('[MQTT_CLIENT] Cliente MQTT desconectado.');
             });

             client.on('message', (topic, message) => {
                 const topicParts = topic.split('/');

                 if (topicParts[0] !== 'aquanest') {
                      console.warn(`[MQTT_MSG] Tópico no esperado: '${topic}'. Ignorando.`);
                      return;
                 }
                  if (topicParts.length < 3) {
                     console.warn(`[MQTT_MSG] Tópico muy corto: '${topic}'. Ignorando.`);
                     return;
                  }

                 const rawPondIdFromTopic = topicParts[1];
                 const receivedPondNumericId = extractNumericId(rawPondIdFromTopic);

                 if (receivedPondNumericId === null || receivedPondNumericId !== parseInt(pondId, 10)) {
                      console.warn(`[MQTT_MSG] Recibido mensaje para estanque raw '${rawPondIdFromTopic}' (${receivedPondNumericId}) pero el dashboard actual es para estanque ID ${pondId}. Ignorando.`);
                      return;
                 }

                 if (topicParts.length === 5 && topicParts[3] === 'data') {
                     const rawDeviceId = topicParts[2];
                     const stringValue = message.toString();

                     try {
                         const deviceDbId = extractNumericId(rawDeviceId);
                         if (deviceDbId === null) {
                             return;
                         }

                         const sensorMatch = pondData?.sensores?.find(s => s.id === deviceDbId);
                         if (sensorMatch) {
                             const numericValue = parseFloat(stringValue);
                             if (isNaN(numericValue)) {
                                 return;
                             }

                             setLiveSensorData(prevData => {
                                 const currentHistory = prevData[sensorMatch.id] || [];
                                 const newHistory = [...currentHistory, { timestamp: new Date(), value: numericValue }];
                                 const trimmedHistory = newHistory.slice(-MAX_DATA_POINTS);

                                 return {
                                     ...prevData,
                                     [sensorMatch.id]: trimmedHistory
                                 };
                             });
                         } else {
                              console.warn(`[MQTT_MSG] Dispositivo con ID DB ${deviceDbId} (Raw: ${rawDeviceId}) encontrado en tópico /data para estanque ${pondId}, pero no es un sensor conocido de este estanque.`);
                         }

                     } catch (e) {
                         console.error(`[MQTT_MSG] Error procesando dato de sensor de tópico '${topic}':`, e);
                     }
                 }

                 else if (topicParts.length >= 5 && topicParts[topicParts.length - 2] === 'alert' && topicParts[topicParts.length - 1] === 'anomalous') {
                      const rawDeviceId = topicParts[topicParts.length === 6 ? 3 : 2];
                      const alertPayload = message.toString();
                      try {
                           const deviceDbId = extractNumericId(rawDeviceId);
                           if (deviceDbId === null) {
                              console.warn(`[MQTT_MSG] ID de dispositivo raw '${rawDeviceId}' en /alert/anomalous tópico '${topic}' no tiene un formato prefijado válido.`);
                              return;
                          }
                         const deviceMatch = pondData?.sensores?.find(s => s.id === deviceDbId) ||
                                           pondData?.actuadores?.find(a => a.id === deviceDbId);

                         const deviceIdentifier = deviceMatch ? `${deviceMatch.tipo} (ID ${deviceDbId})` : `Dispositivo ID ${deviceDbId} (Raw: ${rawDeviceId})`;

                         const nuevaAlerta = {
                             id: `mqtt-alert-${Date.now() + Math.random()}`,
                             type: 'Alerta Anómala en Tiempo Real',
                             timestamp: new Date(),
                             message: `Alerta: Valor fuera de rango en ${deviceIdentifier}. Detalles: ${alertPayload}`,
                         };

                         setAlertsList(prevAlerts => {
                             const newAlerts = [nuevaAlerta, ...prevAlerts];
                             return newAlerts.slice(0, MAX_ALERTS);
                         });
                      } catch (e) {
                           console.error(`[MQTT_MSG] Error procesando alerta de tópico '${topic}':`, e);
                      }
                  }

                  else if (topicParts.length === 5 &&
                           topicParts[3] === 'heartbeat' && topicParts[4] === 'error'
                          ) {
                      const rawDeviceId = topicParts[2];
                      const errorMessage = message.toString();
                      try {
                           const deviceDbId = extractNumericId(rawDeviceId);
                            if (deviceDbId === null) {
                               console.warn(`[MQTT_MSG] ID de dispositivo raw '${rawDeviceId}' en /heartbeat/error tópico '${topic}' no tiene un formato prefijado válido.`);
                               return;
                           }

                          // Determinar el tipo de dispositivo basado en el prefijo del ID (ST, SN, ENF, etc.)
                          let friendlyDeviceType = 'Dispositivo';
                          if (rawDeviceId.startsWith('ST') || rawDeviceId.startsWith('SN')) {
                              friendlyDeviceType = 'Sensor';
                          } else if (rawDeviceId.startsWith('ENF') || rawDeviceId.startsWith('CAL') || rawDeviceId.startsWith('BR')) {
                              friendlyDeviceType = 'Actuador';
                          }


                          const nuevoError = {
                              id: `mqtt-error-${Date.now() + Math.random()}`,
                              type: `Error Heartbeat en Tiempo Real`,
                              timestamp: new Date(),
                              message: `Error de conexión en ${friendlyDeviceType} ID ${deviceDbId} (Raw: ${rawDeviceId}). Mensaje: ${errorMessage}`,
                          };

                          setAlertsList(prevAlerts => {
                              const newAlerts = [nuevoError, ...prevAlerts];
                              return newAlerts.slice(0, MAX_ALERTS);
                          });
                      } catch (e) {
                           console.error(`[MQTT_MSG] Error procesando error heartbeat de tópico '${topic}':`, e);
                      }
                  }
                 else {
                      console.warn(`[MQTT_MSG] Mensaje recibido con formato de tópico desconocido para estanque ${pondId}: '${topic}'`);
                 }
             });
         }

        return () => {
            console.log('[MQTT_EFFECT 1 CLEANUP] Desmontando Dashboard, cerrando conexión MQTT.');
            if (mqttClientRef.current) {
                mqttClientRef.current.end(true, () => {
                    console.log('[MQTT_EFFECT 1 CLEANUP] Cliente MQTT desconectado.');
                });
                mqttClientRef.current = null;
            }
             setLiveSensorData({});
             setAlertsList([]);
        };
    }, [pondId, pondData, subscribeToPondTopics, navigate]);


    useEffect(() => {
        const client = mqttClientRef.current;

        if (client && client.connected && pondData) {
            console.log('[MQTT_EFFECT 2] pondData cargado y cliente MQTT conectado. Procediendo a suscribir a tópicos.');
             subscribeToPondTopics(client, pondId, pondData.sensores);
        } else if (client && !client.connected) {
             console.log('[MQTT_EFFECT 2] Cliente MQTT no conectado. Suscripción pendiente hasta que conecte.');
        } else if (!client) {
             console.log('[MQTT_EFFECT 2] Cliente MQTT aún no inicializado.');
        } else {
             console.log('[MQTT_EFFECT 2] pondData no disponible. Suscripción pendiente hasta que cargue.');
        }

        return () => {
            console.log('[MQTT_EFFECT 2 CLEANUP] Limpieza de suscripciones...');
             if (mqttClientRef.current && pondData) {
                 console.log(`[MQTT_EFFECT 2 CLEANUP] Desuscribiendo tópicos del estanque ID ${pondId} (usando datos previos de pondData).`);
                 unsubscribeFromPondTopics(mqttClientRef.current, pondId, pondData.sensores);
             } else {
                 console.log("[MQTT_EFFECT 2 CLEANUP] pondData no disponible previamente. Saltando desuscripción explícita de tópicos específicos.");
             }
        };
    }, [pondData, pondId, subscribeToPondTopics, unsubscribeFromPondTopics]);

    // Cargar la información del estanque Y las alertas históricas al montar o si pondId cambia
    useEffect(() => {
        if (pondId) {
            console.log(`[POND_DATA_EFFECT] Dashboard cargado para el estanque ID: ${pondId}. Iniciando carga de pondData y notificaciones históricas.`);
            fetchPondData(pondId); // Carga los datos del estanque, incluyendo sensores y actuadores
            // Una vez que pondData se establece, el useEffect de abajo se ejecutará para las alertas/logs.
            setAlertsList([]);
            setLiveSensorData({});
        }
    }, [pondId, fetchPondData]);

    // Nuevo useEffect que se dispara cuando pondData cambia para cargar las alertas/logs
    useEffect(() => {
        if (pondData && (pondData.sensores || pondData.actuadores)) {
            // Llama al nuevo método combinado
            fetchAlertsAndLogsForPond();
        }
    }, [pondData, fetchAlertsAndLogsForPond]);


    const formatChartData = (dataHistory) => {
        const sortedHistory = [...dataHistory].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        return {
            labels: sortedHistory.map(point => formatTime(point.timestamp)),
            datasets: [
                {
                    label: 'Valor',
                    data: sortedHistory.map(point => point.value),
                    borderColor: '#42A5F5',
                    backgroundColor: 'rgba(66, 165, 245, 0.2)',
                    fill: true,
                    tension: 0.1,
                    pointRadius: 2,
                },
            ],
        };
    };

    const goToControlTemperatura = () => navigate(`/control-temperature/${pondId}`);
    const goToControlNitrato = () => navigate(`/control-nitrate/${pondId}`);

    const tempSensor = pondData?.sensores?.find(s => s.tipo === 'temperatura');
    const nitrateSensor = pondData?.sensores?.find(s => s.tipo === 'nitrato');

    const tempHistory = tempSensor ? liveSensorData[tempSensor.id] || [] : [];
    const nitrateHistory = nitrateSensor ? liveSensorData[nitrateSensor.id] || [] : [];

    const tempChartData = formatChartData(tempHistory);
    const nitrateChartData = formatChartData(nitrateHistory);

    return (
        <Layout>
            <div className={styles.pageContainer}>
                <div className={styles.header}>
                    <h1 className={styles.dashboardTitle}>
                        Dashboard ({pondData ? pondData.nombre : `Estanque ID: ${pondId}`})
                    </h1>
                    {pondLoading && <p>Cargando información del estanque...</p>}
                    {pondError && <p className={styles.errorText}>{pondError}</p>}
                    <div className={styles.historyButtonContainer}>
                        <Link to={`/historical-data/${pondId}`} className={styles.historicalButton}>
                            Graficas Históricas
                        </Link>
                </div>
                </div>


                <div className={styles.gridContainer}>
                    <div className={styles.controlContainer} onClick={goToControlTemperatura}>
                        <img src={termometroIcon} alt="Control Temperatura" className={styles.controlIcon} />
                        <span>Control Temperatura</span>
                    </div>

                    <div className={`${styles.chartContainer} temp`}>
                        {tempSensor && tempHistory.length > 0 ? (
                            <TemperatureChart chartData={tempChartData} />
                        ) : !pondLoading && !tempSensor ? (
                            <p>No hay sensor de temperatura configurado.</p>
                        ) : (
                            <p>Esperando datos de temperatura...</p>
                        )}
                    </div>

                    <div className={styles.controlContainer} onClick={goToControlNitrato}>
                        <img src={nitratoIcon} alt="Control Nitrato Amoniacal" className={styles.controlIcon} />
                        <span>Control Nitrato Amoniacal</span>
                    </div>

                     <div className={`${styles.chartContainer} nitrato`}>
                         {nitrateSensor && nitrateHistory.length > 0 ? (
                             <NitrateChart chartData={nitrateChartData} />
                          ) : !pondLoading && !nitrateSensor ? (
                             <p>No hay sensor de nitrato configurado.</p>
                          ) : (
                             <p>Esperando datos de nitrato...</p>
                          )}
                    </div>
                </div>

                <div className={styles.tableContainer}>
                    <h2 className={styles.tableTitle}>Registro de notificaciones</h2>
                    {alertsLoading && <p className={styles.loadingText}>Cargando notificaciones históricas...</p>}
                    {alertsError && <p className={styles.errorText}>{alertsError}</p>}
                    {!alertsLoading && !alertsError && (
                        <table className={styles.alertsTable}>
                            <thead>
                                <tr>
                                    <th>Tipo</th>
                                    <th>Detalle</th>
                                    <th>Hora</th>
                                </tr>
                            </thead>
                            <tbody>
                                {alertsList.length > 0 ? (
                                    alertsList.map(notificacion => (
                                        <tr key={notificacion.id}>
                                            <td>
                                                <span className={
                                                    notificacion.type.includes('Alerta') ? styles.statusAlerta
                                                    : notificacion.type.includes('Error') ? styles.statusError
                                                    : notificacion.type.includes('Estado') ? styles.statusCambioEstado
                                                    : ''
                                                }>
                                                    {notificacion.type || 'N/A'}
                                                </span>
                                            </td>
                                            <td>{notificacion.message || 'Sin detalle'}</td>
                                            <td>{formatDateTime(notificacion.timestamp)}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="3" style={{ textAlign: 'center' }}>No hay notificaciones para mostrar o esperando nuevas notificaciones...</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

            </div>
        </Layout>
    );
}

export default Dashboard;