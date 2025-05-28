import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
                    console.warn(`[MQTT_MSG] ID prefijado es solo el prefijo sin número: ${prefixedId}`);
                    return null;
                }
            }
        }

        try {
            const numericId = parseInt(numericPart, 10);
            if (isNaN(numericId)) {
                 console.warn(`[MQTT_MSG] La parte numérica '${numericPart}' del ID '${prefixedId}' no es un número válido.`);
                 return null;
            }
            return numericId;
        } catch (e) {
            console.error(`[MQTT_MSG] Error parseando la parte numérica '${numericPart}' del ID '${prefixedId}':`, e);
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
            console.error("Error fetching pond data:", error);
            setPondError("Error al cargar la información del estanque.");
        } finally {
            setPondLoading(false);
        }
    }, []);

    const fetchAlertsAndLogsForPond = useCallback(async () => {
        // Asegurarse de tener pondData cargado y que contenga sensores/actuadores
        if (!pondData || (!pondData.sensores && !pondData.actuadores)) {
            setAlertsList([]);
            console.log("[ALERTS_API] No hay datos de estanque o sensores/actuadores para filtrar alertas históricas.");
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

            // 1. Obtener y filtrar Alertas de Sensores
            const allAlertsResponse = await axios.get(`${API_URL}/alerta`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const allAlerts = allAlertsResponse.data || [];

            // IDs de los sensores asociados a este estanque
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
            console.log(`[ALERTS_API] ${filteredSensorAlerts.length} alertas de sensor históricas filtradas para el estanque ${pondId}.`);

            // 2. Obtener y filtrar Logs de Actuadores (Heartbeat Errors)
            const allLogsResponse = await axios.get(`${API_URL}/log`, {
                headers: { Authorization: `Bearer ${token}`}
            });
            const allLogs = allLogsResponse.data || [];

            // IDs de los actuadores asociados a este estanque
            // **IMPORTANTE**: Asegúrate que pondData.actuadores existe y es un array de objetos con 'id'.
            // Si tu API /estanques/{id} no devuelve los actuadores, esto necesitará ajuste en el backend.
            const actuadorIdsDelEstanque = pondData.actuadores ? pondData.actuadores.map(actuador => actuador.id) : [];

            const filteredHeartbeatLogs = allLogs.filter(log =>
                // Filtra por 'Heartbeat Error' y verifica que el actuador.id esté en la lista de IDs de actuadores del estanque
                log.accion === 'Heartbeat Error' &&
                log.actuador?.id !== undefined && actuadorIdsDelEstanque.includes(log.actuador.id)
            ).map(log => ({
                id: `api-log-${log.id}`,
                type: 'Error Heartbeat Histórico de Actuador',
                timestamp: new Date(log.timestamp),
                message: `Error Heartbeat en Actuador ID ${log.actuador.id}. Resultado: ${log.resultado}`
            }));
            combinedNotifications.push(...filteredHeartbeatLogs);
            console.log(`[ALERTS_API] ${filteredHeartbeatLogs.length} errores de Heartbeat históricos filtrados para el estanque ${pondId}.`);

            // 3. Combinar y ordenar todas las notificaciones
            combinedNotifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
            setAlertsList(combinedNotifications.slice(0, MAX_ALERTS));
            console.log(`[ALERTS_API] ${combinedNotifications.length} notificaciones históricas totales cargadas para el estanque ${pondId}.`);

        } catch (error) {
            console.error("Error al cargar alertas y logs históricos:", error);
            setAlertsError("Error al cargar notificaciones históricas.");
        } finally {
            setAlertsLoading(false);
        }
    }, [pondData, pondId]); // Dependencias: pondData (para sensores/actuadores) y pondId


    const subscribeToPondTopics = useCallback((client, currentPondId, sensors) => {
        if (!client || !client.connected || !currentPondId) {
            console.warn("[MQTT_SUBSCRIBE] No se puede suscribir: Cliente no conectado o sin pondId.");
            return;
        }

        console.log(`[MQTT_SUBSCRIBE] Suscribiendo a tópicos del estanque ID: ${currentPondId}...`);

        const topicsToSubscribe = [];

        if (sensors && sensors.length > 0) {
            sensors.forEach(sensor => {
                if (!sensor || sensor.id === undefined || !sensor.tipo) {
                     console.warn("[MQTT_SUBSCRIBE] Sensor inválido encontrado:", sensor);
                     return;
                }
                let sensorPrefix;
                switch (sensor.tipo) {
                    case 'temperatura': sensorPrefix = 'ST'; break;
                    case 'nitrato': sensorPrefix = 'SN'; break;
                    default:
                        console.warn(`[MQTT_SUBSCRIBE] Tipo de sensor desconocido '${sensor.tipo}' para sensor ID ${sensor.id}.`);
                        return;
                }
                const sensorDataTopic = `aquanest/E${currentPondId}/${sensorPrefix}${sensor.id}/data/+`;
                topicsToSubscribe.push(sensorDataTopic);
                setLiveSensorData(prevData => ({
                     ...prevData,
                     [sensor.id]: prevData[sensor.id] || []
                 }));
            });
            console.log(`[MQTT_SUBSCRIBE] Añadidos tópicos de datos de sensores (${sensors.length}):`, topicsToSubscribe.filter(t => t.includes('/data/')));
        } else {
            console.log("[MQTT_SUBSCRIBE] No hay sensores configurados para este estanque. No se suscribirá a tópicos de datos específicos.");
        }

         topicsToSubscribe.push(`aquanest/E${currentPondId}/+/alert/anomalous`);
         console.log(`[MQTT_SUBSCRIBE] Añadido tópico de alertas anómalas: aquanest/E${currentPondId}/+/alert/anomalous`);

         topicsToSubscribe.push(`aquanest/E${currentPondId}/+/heartbeat/error`);
         console.log(`[MQTT_SUBSCRIBE] Añadido tópico de errores heartbeat: aquanest/E${currentPondId}/+/heartbeat/error`);

        if (topicsToSubscribe.length > 0) {
             client.subscribe(topicsToSubscribe, { qos: 0 }, (err) => {
                 if (err) {
                     console.error(`[MQTT_SUBSCRIBE ERROR] Error al suscribir a tópicos:`, err);
                 } else {
                     console.log(`[MQTT_SUBSCRIBE] Suscripción exitosa a los siguientes tópicos:`, topicsToSubscribe);
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
         console.log(`[MQTT_UNSUBSCRIBE] Desuscribiendo tópicos del estanque ID: ${currentPondId}...`);

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
                 } else {
                     console.log(`[MQTT_UNSUBSCRIBE] Desuscripción exitosa de los siguientes tópicos:`, topicsToUnsubscribe);
                 }
             });
         } else {
              console.warn("[MQTT_UNSUBSCRIBE] Lista de tópicos para desuscribir está vacía.");
         }
    }, []);


    useEffect(() => {
        console.log(`[MQTT_EFFECT 1] Inicializando/Conectando cliente MQTT para estanque ID: ${pondId}`);

        if (mqttClientRef.current && mqttClientRef.current.connected) {
             console.log("[MQTT_EFFECT 1 CLEANUP] Cliente MQTT existente conectado. Evitando doble conexión.");
             return () => { /* cleanup will run on dismount or pondId change */ };
        }
         if (mqttClientRef.current && !mqttClientRef.current.connected) {
              console.log("[MQTT_EFFECT 1] Cliente MQTT existente pero no conectado. Intentando conectar.");
         }

         if (!mqttClientRef.current) {
              console.log("[MQTT_EFFECT 1] No hay cliente MQTT existente. Creando nuevo cliente.");
             const client = mqtt.connect(MQTT_BROKER_URL);
             mqttClientRef.current = client;

             client.on('connect', () => {
                 console.log('[MQTT_CLIENT] Cliente MQTT conectado al broker.');
                 if (pondData && (pondData.sensores || pondData.actuadores)) { // Check for both
                     console.log("[MQTT_CLIENT] Cliente conectado y pondData disponible. Procediendo a suscribir.");
                     subscribeToPondTopics(client, pondId, pondData.sensores); // Pass sensors, actuadores for MQTT sub if needed
                 } else {
                      console.log("[MQTT_CLIENT] Cliente conectado, pero pondData aún no disponible. Suscripción pendiente.");
                 }
             });

             client.on('error', (err) => {
                 console.error('[MQTT_CLIENT] Error en conexión MQTT:', err);
             });

             client.on('close', () => {
                  console.log('[MQTT_CLIENT] Cliente MQTT desconectado.');
             });

             client.on('message', (topic, message) => {
                 console.log(`[MQTT_MSG] ### Mensaje Recibido EN HANDLER ### Tópico: '${topic}', Payload: '${message.toString()}'`);

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

                 // This check ensures only messages for the current pond are processed
                 if (receivedPondNumericId === null || receivedPondNumericId !== parseInt(pondId, 10)) {
                      console.warn(`[MQTT_MSG] Recibido mensaje para estanque raw '${rawPondIdFromTopic}' (${receivedPondNumericId}) pero el dashboard actual es para estanque ID ${pondId}. Ignorando.`);
                      return;
                 }


                 if (topicParts.length === 5 && topicParts[3] === 'data') {
                     const rawDeviceId = topicParts[2];
                     const _dataType = topicParts[4];
                     const stringValue = message.toString();

                     console.log(`[MQTT_MSG] Posible dato de sensor. Dispositivo Raw: ${rawDeviceId}, Tipo Dato: ${_dataType}, Valor String: ${stringValue}`);

                     try {
                         const deviceDbId = extractNumericId(rawDeviceId);
                         if (deviceDbId === null) {
                             console.warn(`[MQTT_MSG] ID de dispositivo raw '${rawDeviceId}' en /data tópico '${topic}' no tiene un formato prefijado válido.`);
                             return;
                         }

                         const sensorMatch = pondData?.sensores?.find(s => s.id === deviceDbId);
                         if (sensorMatch) {
                             const numericValue = parseFloat(stringValue);
                             if (isNaN(numericValue)) {
                                 console.warn(`[MQTT_MSG] Payload de datos no es un número: '${stringValue}' en tópico '${topic}'`);
                                 return;
                             }
                             console.log(`[MQTT_MSG] Coincidencia encontrada con sensor ID DB ${sensorMatch.id} (Tipo: ${sensorMatch.tipo}). Actualizando estado liveSensorData.`);

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
                      const rawDeviceId = topicParts[topicParts.length === 6 ? 3 : 2]; // Depends on how many path segments
                      const alertPayload = message.toString();

                      console.log(`[MQTT_MSG] Posible alerta anómala. Dispositivo Raw: ${rawDeviceId}, Payload: ${alertPayload}`);

                      try {
                           const deviceDbId = extractNumericId(rawDeviceId);
                           if (deviceDbId === null) {
                              console.warn(`[MQTT_MSG] ID de dispositivo raw '${rawDeviceId}' en /alert/anomalous tópico '${topic}' no tiene un formato prefijado válido.`);
                              return;
                          }

                         // Match against known sensors or actuators for this pond (if available in pondData)
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

                          console.log(`[MQTT_MSG] Notificación de Alerta MQTT añadida.`);

                      } catch (e) {
                           console.error(`[MQTT_MSG] Error procesando alerta de tópico '${topic}':`, e);
                      }
                  }

                  else if (topicParts.length === 5 &&
                           topicParts[3] === 'heartbeat' && topicParts[4] === 'error'
                          ) {
                      const rawDeviceId = topicParts[2]; // Ahora el ID del dispositivo es topicParts[2]
                      const errorMessage = message.toString();

                      console.log(`[MQTT_MSG] Posible error heartbeat. Dispositivo Raw: ${rawDeviceId}, Mensaje: ${errorMessage}`);

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

                           console.log(`[MQTT_MSG] Notificación de Error Heartbeat MQTT añadida.`);

                      } catch (e) {
                           console.error(`[MQTT_MSG] Error procesando error heartbeat de tópico '${topic}':`, e);
                      }
                  }

                  else if (topicParts.length === 3 && topicParts[2] === 'delete') {
                       const deletePayload = message.toString();
                       console.log(`[MQTT_MSG] Posible eliminación de estanque. Payload: ${deletePayload}`);
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
                                                    notificacion.type.includes('Alerta') ? styles.statusPendiente
                                                    : notificacion.type.includes('Error') ? styles.statusResuelta
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